const Recipe = require('../models/Recipe');
const Ingredient = require('../models/Ingredient');

// @desc    Get all recipes with ingredients populated
// @route   GET /api/recipes
// @access  Private
exports.getAllRecipes = async (req, res) => {
  try {
    const recipes = await Recipe.find().populate('ingredients.ingredientId');
    res.status(200).json(recipes);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch recipes', error: err.message });
  }
};

// @desc    Create a new recipe
// @route   POST /api/recipes
// @access  Private
exports.createRecipe = async (req, res) => {
  try {
    const { name, portions, yieldWeight, type, category, ingredients, procedure } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    if (!name || !portions || !yieldWeight || !Array.isArray(ingredients)) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const recipe = await Recipe.create({
      name,
      portions,
      yieldWeight,
      type,
      category,
      ingredients,
      procedure,
      imageUrl
    });

    res.status(201).json(recipe);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create recipe', error: err.message });
  }
};



// @desc    Update recipe
// @route   PUT /api/recipes/:id
// @access  Private
exports.updateRecipe = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (req.file) {
      updateData.imageUrl = `/uploads/${req.file.filename}`;
    }

    const updated = await Recipe.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updated) return res.status(404).json({ message: 'Recipe not found' });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update recipe', error: err.message });
  }
};



// @desc    Delete recipe
// @route   DELETE /api/recipes/:id
// @access  Private
exports.deleteRecipe = async (req, res) => {
  try {
    const deleted = await Recipe.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Recipe not found' });
    res.json({ message: 'Recipe deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete recipe', error: err.message });
  }
};
