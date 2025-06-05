const Ingredient = require('../models/Ingredient');
const Menu = require('../models/Menu');
const Requisition = require('../models/Requisition');
const Production = require('../models/Production');
const Recipe = require('../models/Recipe');

// @desc    Get dashboard stats
// @route   GET /api/dashboard/stats
// @access  Private/Admin
exports.getStats = async (req, res) => {
  try {
    const [ingredientCount, menuCount, pendingReqCount] = await Promise.all([
      Ingredient.countDocuments(),
      Menu.countDocuments(),
      Requisition.countDocuments({ status: 'pending' }),
    ]);

    const totalCost = await Production.aggregate([
      { $group: { _id: null, total: { $sum: '$cost' } } }
    ]);

    const budgetUsed = totalCost[0]?.total || 0;
    const budgetLimit = 10000; // You can make this configurable via ENV or DB
    const budgetUsage = Math.round((budgetUsed / budgetLimit) * 100);

    return res.status(200).json({
      totalIngredients: ingredientCount,
      activeMenus: menuCount,
      pendingRequisitions: pendingReqCount,
      budgetUsage,
    });
  } catch (err) {
    console.error('Dashboard Stats Error:', err);
    return res.status(500).json({ message: 'Server error while fetching dashboard stats' });
  }
};

// @desc    Monthly summary (menus, cost, production)
// @route   GET /api/dashboard/monthly-summary
// @access  Private/Admin
exports.getMonthlySummary = async (req, res) => {
  try {
    const summary = await Production.aggregate([
      {
        $project: {
          month: { $substr: ['$date', 0, 7] },
          quantity: 1,
          cost: 1
        }
      },
      {
        $group: {
          _id: '$month',
          totalProduced: { $sum: '$quantity' },
          totalCost: { $sum: '$cost' },
          entries: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return res.status(200).json(summary);
  } catch (err) {
    console.error('Monthly Summary Error:', err);
    return res.status(500).json({ message: 'Server error while fetching monthly summary' });
  }
};

// @desc    Category share of ingredients
// @route   GET /api/dashboard/category-share
// @access  Private/Admin
exports.getCategoryShare = async (req, res) => {
  try {
    const share = await Ingredient.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          category: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    return res.status(200).json(share);
  } catch (err) {
    console.error('Category Share Error:', err);
    return res.status(500).json({ message: 'Server error while fetching category share' });
  }
};

// @desc    Activity logs from database (last 10)
// @route   GET /api/dashboard/activity
// @access  Private/Admin
exports.getActivityLog = async (req, res) => {
  try {
    const logs = [];

    const latestIngredients = await Ingredient.find().sort({ createdAt: -1 }).limit(3);
    const latestRequisitions = await Requisition.find().sort({ createdAt: -1 }).limit(3);
    const latestProductions = await Production.find().sort({ createdAt: -1 }).limit(3);

    latestIngredients.forEach((i) => {
      logs.push({ type: 'add', message: `Ingredient added: ${i.name}`, color: 'text-green-600' });
    });

    latestRequisitions.forEach((r) => {
      logs.push({ type: 'request', message: `Requisition: ${r.item} - ${r.status}`, color: 'text-blue-600' });
    });

    latestProductions.forEach((p) => {
      logs.push({ type: 'production', message: `Production logged: ${p.quantity} units`, color: 'text-indigo-600' });
    });

    logs.sort((a, b) => b.timestamp - a.timestamp);

    return res.status(200).json(logs.slice(0, 10)); // limit to last 10 entries
  } catch (err) {
    console.error('Activity Log Error:', err);
    return res.status(500).json({ message: 'Server error while fetching activity log' });
  }
};
