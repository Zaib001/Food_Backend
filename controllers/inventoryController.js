// controllers/inventoryController.js
const Inventory = require('../models/Inventory');
const Ingredient = require('../models/Ingredient');
const { Parser } = require('json2csv');



function toPricePerKg(purchasePrice, unit) {
  if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) return null;
  const u = String(unit || '').toLowerCase();
  switch (u) {
    case 'kg':
      return purchasePrice;
    case 'g':
      return purchasePrice * 1000; // 1g -> kg
    case 'lb':
    case 'lbs':
    case 'pound':
    case 'pounds':
      // 1 lb = 0.453592 kg -> price per kg = price / 0.453592
      return purchasePrice / 0.453592;
    default:
      return null; // unknown unit; skip
  }
}



// GET /api/inventory
exports.getInventory = async (req, res) => {
  try {
    const { supplier, ingredientId, date, base } = req.query;
    const filter = {};
    if (supplier) filter.supplier = supplier;
    if (ingredientId) filter.ingredientId = ingredientId;
    if (date) filter.date = date;
    if (base) filter.base = base;

    const records = await Inventory.find(filter).sort({ createdAt: -1 });
    res.status(200).json(records);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch inventory', error: err.message });
  }
};


// POST /inventory
exports.createInventory = async (req, res) => {
  try {
    const {
      ingredientId,
      supplier,
      quantity,
      unit,
      date,            // string (YYYY-MM-DD) per your schema
      notes,
      purchasePrice,
      currency,
      base,
      direction,       // NEW: optional ('inbound' | 'outbound' | 'adjustment')
    } = req.body;

    // Basic validation (mirror your existing checks)
    if (!ingredientId || !quantity || !unit || !date) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const ingredient = await Ingredient.findById(ingredientId);
    if (!ingredient) {
      return res.status(404).json({ message: 'Ingredient not found' });
    }

    const qty = Number(quantity) || 0;
    const price = Number(purchasePrice) || 0;
    const costTotal = qty * price;

    // Validate & default direction
    const allowed = ['inbound', 'outbound', 'adjustment'];
    const dir = allowed.includes(direction) ? direction : 'inbound';

    // Create inventory movement row (date stays STRING)
    const entry = await Inventory.create({
      ingredientId,
      ingredientName: ingredient.name,
      base: base || 'BASE',
      supplier: supplier || '',
      quantity: qty,
      unit,
      purchasePrice: price,
      currency: currency || 'USD',
      costTotal,
      date,
      notes: notes || '',
      direction: dir,
      sourceType: 'Manual',
      sourceId: undefined,
    });

    // Update stock based on direction
    const current = Number(ingredient.stock || 0);
    if (dir === 'inbound') {
      ingredient.stock = current + qty;
    } else if (dir === 'outbound') {
      ingredient.stock = current - qty; // optionally guard against negatives
    } else if (dir === 'adjustment') {
      // Treat quantity as a positive adjustment (increase).
      // If you want signed adjustments, send negative quantity from FE.
      ingredient.stock = current + qty;
    }
    await ingredient.save();

    return res.status(201).json(entry);
  } catch (err) {
    console.error('createInventory error:', err);
    return res.status(500).json({
      message: 'Failed to create inventory entry',
      error: err.message,
    });
  }
};

exports.updateInventory = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const id = req.params.id;
      const existing = await Inventory.findById(id).session(session);
      if (!existing) {
        return res.status(404).json({ message: 'Inventory entry not found' });
      }

      const updates = { ...req.body };

      // Normalize numeric fields from updates or fall back to existing
      const qtyNew = ('quantity' in updates)
        ? (Number(updates.quantity) || 0)
        : (Number(existing.quantity) || 0);

      const priceNew = ('purchasePrice' in updates)
        ? (Number(updates.purchasePrice) || 0)
        : (Number(existing.purchasePrice) || 0);

      // Recompute cost if quantity or price changed
      if ('quantity' in updates || 'purchasePrice' in updates) {
        updates.costTotal = qtyNew * priceNew;
      }

      // Validate & normalize direction
      const allowed = ['inbound', 'outbound', 'adjustment'];
      const dirNew = ('direction' in updates && allowed.includes(updates.direction))
        ? updates.direction
        : (existing.direction || 'inbound');

      // Ingredient change support
      const ingrIdNew = ('ingredientId' in updates && updates.ingredientId)
        ? String(updates.ingredientId)
        : String(existing.ingredientId);

      // Only adjust stock if quantity, direction, or ingredient changed
      const willAffectStock =
        ('quantity' in updates) || ('direction' in updates) || ('ingredientId' in updates);

      if (willAffectStock) {
        const asSigned = (dir, q) => (dir === 'outbound' ? -q : q); // 'adjustment' treated as inbound (+)
        const deltaOld = asSigned(existing.direction || 'inbound', Number(existing.quantity) || 0);
        const deltaNew = asSigned(dirNew, qtyNew);

        if (String(existing.ingredientId) !== ingrIdNew) {
          // Reverse old effect on the previous ingredient
          const oldIng = await Ingredient.findById(existing.ingredientId).session(session);
          if (!oldIng) {
            throw new Error('Old ingredient not found for stock rollback');
          }
          oldIng.stock = Number(oldIng.stock || 0) - deltaOld;
          await oldIng.save({ session });

          // Apply new effect on the new ingredient
          const newIng = await Ingredient.findById(ingrIdNew).session(session);
          if (!newIng) {
            return res.status(404).json({ message: 'Ingredient not found' });
          }
          newIng.stock = Number(newIng.stock || 0) + deltaNew;
          await newIng.save({ session });
        } else {
          // Same ingredient: apply net delta
          const ing = await Ingredient.findById(ingrIdNew).session(session);
          if (!ing) {
            return res.status(404).json({ message: 'Ingredient not found' });
          }
          const net = deltaNew - deltaOld;
          if (net !== 0) {
            ing.stock = Number(ing.stock || 0) + net;
            await ing.save({ session });
          }
        }
      }

      // Persist inventory updates (store normalized direction)
      updates.direction = dirNew;

      const updated = await Inventory.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true,
        session,
      });

      if (!updated) {
        return res.status(404).json({ message: 'Inventory entry not found' });
      }

      return res.json(updated);
    });
  } catch (err) {
    console.error('updateInventory error:', err);
    return res.status(500).json({ message: 'Failed to update entry', error: err.message });
  } finally {
    session.endSession();
  }
};



// DELETE /api/inventory/:id (unchanged)
exports.deleteInventory = async (req, res) => {
  try {
    const entry = await Inventory.findByIdAndDelete(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    res.status(200).json({ message: 'Inventory entry deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete entry', error: err.message });
  }
};

// GET /api/inventory/grouped (unchanged)
exports.getGroupedInventory = async (req, res) => {
  try {
    const grouped = await Inventory.aggregate([
      {
        $group: {
          _id: "$ingredientName",
          totalQuantity: { $sum: "$quantity" },
          unit: { $first: "$unit" },
          // NEW: rollup cost
          totalCost: { $sum: "$costTotal" }
        }
      },
      { $sort: { totalQuantity: -1 } }
    ]);
    res.status(200).json(grouped);
  } catch (err) {
    res.status(500).json({ message: 'Failed to group inventory', error: err.message });
  }
};

// GET /api/inventory/export/csv (add purchase & totals)
exports.exportInventoryCSV = async (req, res) => {
  try {
    const rows = await Inventory.find({}).sort({ date: -1 }).lean();
    const parser = new Parser({
      fields: [
        'date',
        'ingredientName',
        'supplier',
        'quantity',
        'unit',
        'purchasePrice',
        'currency',
        'costTotal',
        'notes'
      ]
    });
    const csv = parser.parse(rows);
    res.header('Content-Type', 'text/csv');
    res.attachment('inventory.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: 'Failed to export CSV', error: err.message });
  }
};

// GET /api/inventory/alerts/low-stock (unchanged)
exports.checkLowStock = async (req, res) => {
  try {
    const threshold = Number(req.query.threshold || 5);
    const lowStockItems = await Ingredient.find({ stock: { $lt: threshold } });
    res.status(200).json({
      count: lowStockItems.length,
      items: lowStockItems.map(i => ({
        name: i.name,
        stock: i.stock,
        unit: i.originalUnit,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to check low stock', error: err.message });
  }
};
