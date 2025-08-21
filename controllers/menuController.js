const Menu = require('../models/Menu');
const Recipe = require('../models/Recipe');
const Ingredient = require('../models/Ingredient');

// @desc    Get all menus with recipe details
// @route   GET /api/menus
// @access  Private
exports.getAllMenus = async (req, res) => {
  try {
    const menus = await Menu.find().populate('recipeIds');
    res.status(200).json(menus);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch menus', error: err.message });
  }
};

// @desc    Create a new menu (supports breakfast/lunch/dinner/snack/extra)
// @route   POST /api/menus
// @access  Private/Admin
exports.createMenu = async (req, res) => {
  try {
    const { menuName, date, base, mealType, recipeIds } = req.body;

    if (!menuName || !date || !base || !mealType || !Array.isArray(recipeIds) || recipeIds.length === 0) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const recipes = await Recipe.find({ _id: { $in: recipeIds } });

    if (recipes.length !== recipeIds.length) {
      const foundIds = recipes.map(r => r._id.toString());
      const missingIds = recipeIds.filter(id => !foundIds.includes(id));
      return res.status(400).json({ message: 'Some recipes not found', missingIds });
    }

    const menu = await Menu.create({
      menuName,
      date,
      base,
      mealType,
      recipeIds: recipes.map(r => r._id)
    });

    res.status(201).json(menu);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create menu', error: err.message });
  }
};

// @desc    Delete a menu
// @route   DELETE /api/menus/:id
// @access  Private/Admin
exports.deleteMenu = async (req, res) => {
  try {
    const menu = await Menu.findByIdAndDelete(req.params.id);
    if (!menu) return res.status(404).json({ message: 'Menu not found' });
    res.status(200).json({ message: 'Menu deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete menu', error: err.message });
  }
};

// @desc    Generate requisitions from menus (aggregated ingredients)
// @route   GET /api/menus/requisitions
// @access  Private
exports.generateAndPersistRequisitions = async (req, res) => {
  try {
    const peopleCount = parseInt(req.query.peopleCount) || 100;
    const portionFactor = peopleCount / 10;

    const menus = await Menu.find().populate('recipeIds');
    // Map: key = date-base-mealType => { header, items[] }
    const buckets = {};

    for (const menu of menus) {
      const mealType = (menu.mealType || '').toLowerCase();
      const key = `${menu.date}|${menu.base}|${mealType}`;

      if (!buckets[key]) {
        buckets[key] = {
          header: {
            date: menu.date,
            base: menu.base,
            mealType,
            menuName: menu.menuName,
            peopleCount,
            portionFactor,
            requestedBy: 'Auto-System',
            linkedMenuIds: [],
          },
          itemsByIngredient: new Map()
        };
      }
      buckets[key].header.linkedMenuIds.push(menu._id);

      for (const recipe of menu.recipeIds || []) {
        for (const { ingredientId, quantity } of (recipe.ingredients || [])) {
          const ingKey = String(ingredientId);
          const existing = buckets[key].itemsByIngredient.get(ingKey) || { qty: 0 };
          existing.qty += (quantity || 0) * portionFactor;
          buckets[key].itemsByIngredient.set(ingKey, existing);
        }
      }
    }

    // Resolve ingredient meta once (avoid N queries)
    const allIngIds = Array.from(
      new Set(
        Object.values(buckets).flatMap(b => Array.from(b.itemsByIngredient.keys()))
      )
    );
    const ingDocs = await Ingredient.find({ _id: { $in: allIngIds } })
      .select('_id name originalUnit supplier');
    const ingMap = new Map(ingDocs.map(i => [String(i._id), i]));

    const results = [];
    for (const key of Object.keys(buckets)) {
      const { header, itemsByIngredient } = buckets[key];
      const items = Array.from(itemsByIngredient.entries()).map(([id, v]) => {
        const meta = ingMap.get(id);
        if (!meta) return null;
        return {
          ingredientId: meta._id,
          item: meta.name,
          unit: meta.originalUnit || 'kg',
          quantity: v.qty,
          supplier: meta.supplier || 'Default Supplier',
          status: 'pending'
        };
      }).filter(Boolean);

      // Upsert per (date, base, mealType)
      const doc = await Requisition.findOneAndUpdate(
        { date: header.date, base: header.base, mealType: header.mealType },
        {
          ...header,
          items,
          status: 'pending'
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      results.push(doc);
    }

    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate requisitions', error: err.message });
  }
};
// @route PUT /api/requisitions/:id/approve
// @access Private/Admin
exports.approveRequisition = async (req, res) => {
  try {
    const { id } = req.params;
    const rq = await Requisition.findById(id);
    if (!rq) return res.status(404).json({ message: 'Requisition not found' });

    // Mark header + all items approved
    rq.status = 'approved';
    rq.items = rq.items.map(it => ({ ...it, status: 'approved' }));
    await rq.save();

    // (Optional) Push to inventory decrement queue/job here

    res.status(200).json({ message: 'Requisition approved', requisition: rq });
  } catch (err) {
    res.status(500).json({ message: 'Failed to approve requisition', error: err.message });
  }
};
// @route PUT /api/requisitions/bulk-approve
// body: { date, base, mealType } // any subset
exports.bulkApprove = async (req, res) => {
  try {
    const filter = {};
    ['date','base','mealType'].forEach(k => { if (req.body[k]) filter[k] = req.body[k]; });
    const docs = await Requisition.find(filter).select('_id');

    await Requisition.updateMany(filter, {
      $set: { status: 'approved', 'items.$[].status': 'approved' }
    });

    res.status(200).json({ message: 'Approved', count: docs.length, ids: docs.map(d=>d._id) });
  } catch (err) {
    res.status(500).json({ message: 'Bulk approve failed', error: err.message });
  }
};

