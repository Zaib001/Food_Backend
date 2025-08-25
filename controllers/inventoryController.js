// controllers/inventoryController.js
const Inventory = require('../models/Inventory');
const Ingredient = require('../models/Ingredient');
const { Parser } = require('json2csv');

// helper: convert purchase price per 'unit' to price per KG if possible
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

// GET /api/inventory (unchanged)
exports.getInventory = async (req, res) => {
  try {
    const { supplier, ingredientId, date } = req.query;
    const filter = {};
    if (supplier) filter.supplier = supplier;
    if (ingredientId) filter.ingredientId = ingredientId;
    if (date) filter.date = date;

    const records = await Inventory.find(filter).sort({ createdAt: -1 });
    res.status(200).json(records);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch inventory', error: err.message });
  }
};


exports.createInventory = async (req, res) => {
 try {
    const {
      ingredientId, supplier, quantity, unit, date, notes,
      purchasePrice, currency
    } = req.body;

    if (!ingredientId || !supplier || !quantity || !unit || !date) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const ingredient = await Ingredient.findById(ingredientId);
    if (!ingredient) return res.status(404).json({ message: 'Ingredient not found' });

    const qty = Number(quantity) || 0;
    const price = Number(purchasePrice) || 0;
    const costTotal = qty * price;

    const entry = await Inventory.create({
      ingredientId,
      ingredientName: ingredient.name,
      supplier,
      quantity: qty,
      unit,
      purchasePrice: price,
      currency: currency || 'USD',
      costTotal,
      date,
      notes: notes || ''
    });

    // optional stock bump
    ingredient.stock = Number(ingredient.stock || 0) + qty;
    await ingredient.save();

    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create inventory entry', error: err.message });
  }
};

exports.updateInventory = async (req, res) => {
  try {
    const updates = { ...req.body };
    if ('quantity' in updates || 'purchasePrice' in updates) {
      const existing = await Inventory.findById(req.params.id);
      if (!existing) return res.status(404).json({ message: 'Inventory entry not found' });

      const qty = Number(updates.quantity ?? existing.quantity) || 0;
      const price = Number(updates.purchasePrice ?? existing.purchasePrice) || 0;
      updates.costTotal = qty * price;
    }

    const updated = await Inventory.findByIdAndUpdate(req.params.id, updates, {
      new: true, runValidators: true,
    });
    if (!updated) return res.status(404).json({ message: 'Inventory entry not found' });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update entry', error: err.message });
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
