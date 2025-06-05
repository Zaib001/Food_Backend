const Production = require('../models/Production');
const Recipe = require('../models/Recipe');
const Ingredient = require('../models/Ingredient');

// @desc    Get production logs with optional filters
// @route   GET /api/productions
// @access  Private
exports.getProductions = async (req, res) => {
  try {
    const { recipe, base, date } = req.query;
    const filter = {};
    if (recipe) filter.recipeId = recipe;
    if (base) filter.base = base;
    if (date) filter.date = date;

    const logs = await Production.find(filter).populate('recipeId');
    res.status(200).json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch productions', error: err.message });
  }
};

// @desc    Create a new production log and deduct ingredients from stock
// @route   POST /api/productions
// @access  Private
exports.createProduction = async (req, res) => {
  try {
    const { date, recipeId, quantity, base, handler } = req.body;

    if (!recipeId || !quantity || !date || !base || !handler) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const recipe = await Recipe.findById(recipeId);
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

    let totalCost = 0;

    for (const item of recipe.ingredients) {
      const { ingredientId, quantity: qtyPerUnit } = item;
      const ingredient = await Ingredient.findById(ingredientId);
      if (!ingredient) continue;

      const totalQty = qtyPerUnit * quantity;
      totalCost += (ingredient.pricePerKg || 0) * (totalQty / 1); // assumes 1 unit = 1kg for simplicity

      await Ingredient.findByIdAndUpdate(
        ingredientId,
        { $inc: { stock: -totalQty } },
        { new: true }
      );
    }

    const production = await Production.create({
      date,
      recipeId,
      quantity,
      base,
      handler,
      cost: totalCost,
    });

    res.status(201).json(production);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create production', error: err.message });
  }
};

// @desc    Update a production entry (does NOT restore stock)
// @route   PUT /api/productions/:id
// @access  Private
exports.updateProduction = async (req, res) => {
  try {
    const updated = await Production.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Production not found' });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update production', error: err.message });
  }
};

// @desc    Delete a production log (does NOT restore stock)
// @route   DELETE /api/productions/:id
// @access  Private
exports.deleteProduction = async (req, res) => {
  try {
    const deleted = await Production.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Production not found' });

    res.json({ message: 'Production log deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete production', error: err.message });
  }
};
