const Recipe = require('../models/Recipe');

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

// @desc    Get one recipe
// @route   GET /api/recipes/:id
// @access  Private
exports.getRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id).populate('ingredients.ingredientId');
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
    res.json(recipe);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch recipe', error: err.message });
  }
};

// @desc    Create a new recipe
// @route   POST /api/recipes
// @access  Private
exports.createRecipe = async (req, res) => {
  const { name, portions, yieldWeight, type, procedure } = req.body;
  let ingredients = req.body.ingredients;

  try {
    if (typeof ingredients === 'string') {
      ingredients = JSON.parse(ingredients);
    }

    if (!name || !portions || !yieldWeight || !type || !ingredients?.length) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    let totalWeight = 0;
    const processedIngredients = ingredients.map(ing => {
      const qty = Number(ing.quantity) || 0;
      totalWeight += qty;
      return {
        ingredientId: ing.ingredientId,
        quantity: qty,
        baseQuantity: Number(ing.baseQuantity ?? qty)
      };
    });

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const isLockedIncoming = (req.body.isLocked === 'true' || req.body.isLocked === true);

    const recipe = await Recipe.create({
      name,
      portions: Number(portions),
      yieldWeight: Number(totalWeight),
      type,
      ingredients: processedIngredients,
      procedure,
      imageUrl,
      basePortions: Number(portions),
      isLocked: !!isLockedIncoming
    });

    const populated = await Recipe.findById(recipe._id).populate('ingredients.ingredientId');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create recipe', error: err.message });
  }
};

// @desc    Update recipe (blocked if locked). Supports scaling via clientCount
// @route   PUT /api/recipes/:id
// @access  Private
exports.updateRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

    if (recipe.isLocked) {
      return res.status(400).json({ message: 'Cannot update a locked recipe' });
    }

    const { name, portions, type, procedure, ingredients, clientCount, isLocked } = req.body;
    let parsedIngredients = ingredients;

    if (typeof ingredients === 'string') parsedIngredients = JSON.parse(ingredients);

    // If no ingredients passed, keep existing
    if (!Array.isArray(parsedIngredients)) parsedIngredients = recipe.ingredients;

    let scaledPortions = Number(portions ?? recipe.portions);
    let scaledIngredients = parsedIngredients.map(ing => ({
      ingredientId: ing.ingredientId || (ing.ingredientId?._id),
      quantity: Number(ing.quantity),
      baseQuantity: Number(ing.baseQuantity ?? ing.quantity)
    }));
    let scaledYieldWeight = scaledIngredients.reduce((s, i) => s + (Number(i.quantity) || 0), 0);

    if (clientCount && !isNaN(clientCount)) {
      const factor = Number(clientCount) / Number(recipe.basePortions || recipe.portions || 1);
      scaledPortions = Number(clientCount);
      scaledIngredients = scaledIngredients.map(ing => ({
        ...ing,
        quantity: Number(((ing.baseQuantity || ing.quantity) * factor).toFixed(2))
      }));
      scaledYieldWeight = Number((Number(recipe.yieldWeight || scaledYieldWeight) * factor).toFixed(2));
    }

    const updateData = {
      name: name ?? recipe.name,
      portions: scaledPortions,
      yieldWeight: scaledYieldWeight,
      type: type ?? recipe.type,
      procedure: procedure ?? recipe.procedure,
      ingredients: scaledIngredients,
    };

    // allow locking on update
    if (typeof isLocked !== 'undefined') {
      updateData.isLocked = (isLocked === 'true' || isLocked === true);
    }

    if (req.file) {
      updateData.imageUrl = `/uploads/${req.file.filename}`;
    }

    const updated = await Recipe.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('ingredients.ingredientId');

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

// @desc    Scale recipe quantities (preview only; not saved)
// @route   POST /api/recipes/:id/scale
// @access  Private
exports.scaleRecipe = async (req, res) => {
  try {
    const { clientCount } = req.body;
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
    if (recipe.isLocked) return res.status(400).json({ message: 'Recipe is locked' });

    const factor = Number(clientCount) / Number(recipe.basePortions || recipe.portions || 1);

    const scaledIngredients = recipe.ingredients.map(ing => ({
      ...ing._doc,
      quantity: Number((Number(ing.baseQuantity || ing.quantity) * factor).toFixed(2))
    }));

    const scaledRecipe = {
      ...recipe._doc,
      ingredients: scaledIngredients,
      portions: Number(clientCount),
      yieldWeight: Number((Number(recipe.yieldWeight) * factor).toFixed(2))
    };

    res.json(scaledRecipe);
  } catch (err) {
    res.status(500).json({ message: 'Failed to scale recipe', error: err.message });
  }
};

// @desc    Get recipes by type (locked only)
// @route   GET /api/recipes/menu/:type
// @access  Private
exports.getRecipesByType = async (req, res) => {
  try {
    const recipes = await Recipe.find({
      type: req.params.type,
      isLocked: true
    }).select('name portions yieldWeight');
    res.json(recipes);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch menu recipes', error: err.message });
  }
};
