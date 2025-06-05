const Menu = require('../models/Menu');
const Recipe = require('../models/Recipe');
const { Parser } = require('json2csv');

// Helper to get month name from date
const getMonthName = (dateStr) => {
  return new Date(dateStr).toLocaleString('default', { month: 'long' });
};

// GET /api/reports?base=Base A&from=2024-01-01&to=2024-03-31
const getReportSummary = async (req, res) => {
  try {
    const { base = 'All', from = '', to = '' } = req.query;

    const query = {};
    if (base !== 'All') query.base = base;
    if (from || to) query.date = {};
    if (from) query.date.$gte = from;
    if (to) query.date.$lte = to;

    const menus = await Menu.find(query).populate('recipeIds');

    const reports = [];

    for (const menu of menus) {
      const month = getMonthName(menu.date);

      for (const recipe of menu.recipeIds) {
        const totalIngredients = recipe.ingredients.length;
        const cost = 0; // Extend if you have price/ingredient later
        const kcal = 0; // Extend if you add kcal field to Recipe

        reports.push({
          date: menu.date,
          month,
          base: menu.base,
          category: recipe.category || 'uncategorized',
          menus: 1,
          ingredients: totalIngredients,
          cost,
          kcal,
        });
      }
    }

    // Summarize by month
    const summaryByMonth = Object.values(
      reports.reduce((acc, curr) => {
        acc[curr.month] = acc[curr.month] || { ...curr, menus: 0, ingredients: 0, cost: 0, kcal: 0 };
        acc[curr.month].menus += curr.menus;
        acc[curr.month].ingredients += curr.ingredients;
        acc[curr.month].cost += curr.cost;
        acc[curr.month].kcal += curr.kcal;
        return acc;
      }, {})
    );

    // Summarize by category
    const summaryByCategory = Object.values(
      reports.reduce((acc, curr) => {
        acc[curr.category] = acc[curr.category] || { category: curr.category, cost: 0, kcal: 0 };
        acc[curr.category].cost += curr.cost;
        acc[curr.category].kcal += curr.kcal;
        return acc;
      }, {})
    );

    res.status(200).json({
      filtered: reports,
      summaryByMonth,
      summaryByCategory,
    });
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).json({ message: 'Failed to generate report summary' });
  }
};

// POST /api/reports/export
const exportReportsToCSV = async (req, res) => {
  try {
    const { reports } = req.body;

    if (!Array.isArray(reports) || reports.length === 0) {
      return res.status(400).json({ message: 'No data provided for export' });
    }

    const fields = ['date', 'month', 'base', 'category', 'menus', 'ingredients', 'cost', 'kcal'];
    const parser = new Parser({ fields });
    const csv = parser.parse(reports);

    res.header('Content-Type', 'text/csv');
    res.attachment('report_summary.csv');
    res.send(csv);
  } catch (err) {
    console.error('CSV Export Error:', err);
    res.status(500).json({ message: 'Failed to export CSV' });
  }
};

module.exports = {
  getReportSummary,
  exportReportsToCSV,
};
