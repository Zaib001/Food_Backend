const Inventory = require('../models/Inventory');
const Ingredient = require('../models/Ingredient');
const { Parser } = require('json2csv');

// @desc    Get all inventory entries with optional filters
// @route   GET /api/inventory
// @access  Private
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

// @desc    Create a new inventory entry and update ingredient stock
// @route   POST /api/inventory
// @access  Private/Admin
exports.createInventory = async (req, res) => {
  try {
    const { ingredientId, quantity, unit, supplier, date, notes } = req.body;

    if (!ingredientId || !quantity || !unit || !supplier || !date) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const ingredient = await Ingredient.findById(ingredientId);
    if (!ingredient) return res.status(404).json({ message: 'Ingredient not found' });

    const newEntry = await Inventory.create({
      ingredientId,
      ingredientName: ingredient.name,
      supplier,
      quantity,
      unit,
      date,
      notes
    });

    ingredient.stock += Number(quantity);
    await ingredient.save();

    res.status(201).json(newEntry);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create inventory entry', error: err.message });
  }
};

// @desc    Update inventory entry (stock not auto-adjusted)
// @route   PUT /api/inventory/:id
// @access  Private/Admin
exports.updateInventory = async (req, res) => {
  try {
    const updated = await Inventory.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ message: 'Inventory entry not found' });

    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update entry', error: err.message });
  }
};

// @desc    Delete inventory entry
// @route   DELETE /api/inventory/:id
// @access  Private/Admin
exports.deleteInventory = async (req, res) => {
  try {
    const entry = await Inventory.findByIdAndDelete(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    res.status(200).json({ message: 'Inventory entry deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete entry', error: err.message });
  }
};

// @desc    Group inventory totals by ingredient
// @route   GET /api/inventory/grouped
// @access  Private
exports.getGroupedInventory = async (req, res) => {
  try {
    const grouped = await Inventory.aggregate([
      {
        $group: {
          _id: "$ingredientName",
          totalQuantity: { $sum: "$quantity" },
          unit: { $first: "$unit" }
        }
      },
      { $sort: { totalQuantity: -1 } }
    ]);

    res.status(200).json(grouped);
  } catch (err) {
    res.status(500).json({ message: 'Failed to group inventory', error: err.message });
  }
};

// @desc    Export grouped inventory data as CSV
// @route   GET /api/inventory/export/csv
// @access  Private
exports.exportInventoryCSV = async (req, res) => {
  try {
    const grouped = await Inventory.aggregate([
      {
        $group: {
          _id: "$ingredientName",
          totalQuantity: { $sum: "$quantity" },
          unit: { $first: "$unit" }
        }
      }
    ]);

    const parser = new Parser({ fields: ['_id', 'totalQuantity', 'unit'] });
    const csv = parser.parse(grouped);

    res.header('Content-Type', 'text/csv');
    res.attachment('inventory_summary.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: 'Failed to export CSV', error: err.message });
  }
};

// @desc    Get low stock alerts
// @route   GET /api/inventory/alerts/low-stock
// @access  Private
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
