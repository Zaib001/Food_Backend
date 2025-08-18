const Planning = require('../models/Planning');
const Menu = require('../models/Menu');
const Ingredient = require('../models/Ingredient');
const Requisition = require('../models/Requisition');

// helpers
function normalizeMealRef(val) {
  if (!val) return {};
  const menu = val.menu || val.menuId || null;
  const qty  = Number(val.qty ?? 0);
  return menu ? { menu, qty: isNaN(qty) ? 0 : qty } : {};
}

async function generateRequisitionsForPlan(planDoc) {
  // wipe previous auto-reqs for this plan to avoid duplicates
  await Requisition.deleteMany({ plan: planDoc._id });

  const mealBlocks = ['breakfast', 'lunch', 'snack', 'dinner', 'extra'];
  const agg = {}; // ingredientId -> { qty, name, unit, ingredientId }

  for (const block of mealBlocks) {
    const ref = planDoc[block];
    if (!ref?.menu || !ref?.qty || ref.qty <= 0) continue;

    const menu = await Menu.findById(ref.menu).populate('recipeIds');
    if (!menu) continue;

    for (const recipe of (menu.recipeIds || [])) {
      // scale factor: planned servings / recipe base portions (defaults to 10)
      const basePortions = Number(recipe.basePortions || recipe.portions || 10);
      const scale = basePortions > 0 ? (Number(ref.qty) / basePortions) : 0;

      for (const ing of (recipe.ingredients || [])) {
        const ingredientDoc = await Ingredient.findById(ing.ingredientId);
        if (!ingredientDoc) continue;

        const baseQty = Number(ing.baseQuantity ?? ing.quantity ?? 0);
        const scaled = baseQty * scale;

        const yieldPct = Number(ingredientDoc.yield ?? 100);
        const adjustedQty = yieldPct === 0 ? 0 : (scaled / (yieldPct / 100)); // buy-side

        const key = String(ingredientDoc._id);
        if (!agg[key]) {
          agg[key] = {
            name: ingredientDoc.name,
            unit: ingredientDoc.originalUnit || 'kg',
            qty: 0,
            ingredientId: ingredientDoc._id
          };
        }
        agg[key].qty += adjustedQty;
      }
    }
  }

  const docs = Object.values(agg).map(row => ({
    date: planDoc.date,
    base: planDoc.base,
    item: row.name,
    ingredientId: row.ingredientId,
    quantity: Number(row.qty.toFixed(4)),
    unit: row.unit,
    requestedBy: 'Auto-System',
    supplier: 'Default Supplier',
    status: 'pending',
    plan: planDoc._id
  }));

  if (docs.length) {
    await Requisition.insertMany(docs);
  }
  return docs.length;
}

// @route GET /api/planning
// Roles: planner, base-supervisor, admin (read)
exports.getAllPlans = async (req, res) => {
  try {
    const plans = await Planning.find()
      .populate('breakfast.menu')
      .populate('lunch.menu')
      .populate('snack.menu')
      .populate('dinner.menu')
      .populate('extra.menu');
    res.status(200).json(plans);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch plans', error: err.message });
  }
};

// @route POST /api/planning
// Roles: planner, admin
exports.createPlan = async (req, res) => {
  try {
    const { date, base, breakfast, lunch, snack, dinner, extra, notes } = req.body;
    if (!date || !base) {
      return res.status(400).json({ message: 'Missing required fields "date" or "base"' });
    }

    const plan = await Planning.create({
      date,
      base,
      breakfast: normalizeMealRef(breakfast),
      lunch:     normalizeMealRef(lunch),
      snack:     normalizeMealRef(snack),
      dinner:    normalizeMealRef(dinner),
      extra:     normalizeMealRef(extra),
      notes: notes || ''
    });

    // auto-generate requisitions anchored to this plan
    const generatedCount = await generateRequisitionsForPlan(plan);

    const populated = await Planning.findById(plan._id)
      .populate('breakfast.menu')
      .populate('lunch.menu')
      .populate('snack.menu')
      .populate('dinner.menu')
      .populate('extra.menu');

    res.status(201).json({ ...populated.toObject(), _generatedRequisitions: generatedCount });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create plan', error: err.message });
  }
};

// @route PUT /api/planning/:id
// Roles: planner, admin
exports.updatePlan = async (req, res) => {
  try {
    const { date, base, breakfast, lunch, snack, dinner, extra, notes } = req.body;

    const payload = {};
    if (date) payload.date = date;
    if (base) payload.base = base;
    if (typeof notes !== 'undefined') payload.notes = notes;

    if (typeof breakfast !== 'undefined') payload.breakfast = normalizeMealRef(breakfast);
    if (typeof lunch     !== 'undefined') payload.lunch     = normalizeMealRef(lunch);
    if (typeof snack     !== 'undefined') payload.snack     = normalizeMealRef(snack);
    if (typeof dinner    !== 'undefined') payload.dinner    = normalizeMealRef(dinner);
    if (typeof extra     !== 'undefined') payload.extra     = normalizeMealRef(extra);

    const updated = await Planning.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!updated) return res.status(404).json({ message: 'Plan not found' });

    // regenerate requisitions for this plan
    const generatedCount = await generateRequisitionsForPlan(updated);

    const populated = await Planning.findById(updated._id)
      .populate('breakfast.menu')
      .populate('lunch.menu')
      .populate('snack.menu')
      .populate('dinner.menu')
      .populate('extra.menu');

    res.status(200).json({ ...populated.toObject(), _generatedRequisitions: generatedCount });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update plan', error: err.message });
  }
};

// @route DELETE /api/planning/:id
// Roles: admin
exports.deletePlan = async (req, res) => {
  try {
    const deleted = await Planning.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Plan not found' });

    // also remove its auto-generated requisitions
    await Requisition.deleteMany({ plan: deleted._id });

    res.status(200).json({ message: 'Plan deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete plan', error: err.message });
  }
};
