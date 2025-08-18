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

    const userRole = req.user?.role || 'user';
    console.log(userRole)
    const isAdmin = userRole === 'admin';

    // If recipe is locked and user is NOT admin, block any update
    if (recipe.isLocked && !isAdmin) {
      return res.status(403).json({ message: 'Cannot update a locked recipe' });
    }

    // Parse payload
    const {
      name,
      portions,
      type,
      procedure,
      ingredients,
      clientCount,
      isLocked,
    } = req.body;

    // Parse/normalize ingredients
    let parsedIngredients = ingredients;
    if (typeof parsedIngredients === 'string') {
      try { parsedIngredients = JSON.parse(parsedIngredients); } catch { parsedIngredients = null; }
    }
    if (!Array.isArray(parsedIngredients)) parsedIngredients = recipe.ingredients;

    let scaledPortions = Number(portions ?? recipe.portions);
    let scaledIngredients = parsedIngredients.map((ing) => ({
      ingredientId: ing.ingredientId || ing.ingredientId?._id,
      quantity: Number(ing.quantity),
      baseQuantity: Number(ing.baseQuantity ?? ing.quantity),
    }));
    let scaledYieldWeight = scaledIngredients.reduce((s, i) => s + (Number(i.quantity) || 0), 0);

    // Optional: scale via clientCount
    if (clientCount && !isNaN(clientCount)) {
      const base = Number(recipe.basePortions || recipe.portions || 1);
      const factor = base > 0 ? Number(clientCount) / base : 1;
      scaledPortions = Number(clientCount);
      scaledIngredients = scaledIngredients.map((ing) => ({
        ...ing,
        quantity: Number(((ing.baseQuantity || ing.quantity) * factor).toFixed(2)),
      }));
      const baseYield = Number(recipe.yieldWeight || scaledYieldWeight || 0);
      scaledYieldWeight = Number((baseYield * factor).toFixed(2));
    }

    const updateData = {
      name: name ?? recipe.name,
      portions: scaledPortions,
      yieldWeight: scaledYieldWeight,
      type: type ?? recipe.type,
      procedure: procedure ?? recipe.procedure,
      ingredients: scaledIngredients,
    };

    // Image (if uploaded)
    if (req.file) {
      updateData.imageUrl = `/uploads/${req.file.filename}`;
    }

    // Lock/unlock logic:
    // - Admin can set isLocked true/false
    // - Non-admin: ignore isLocked in payload
    if (typeof isLocked !== 'undefined' && isAdmin) {
      updateData.isLocked = (isLocked === 'true' || isLocked === true);
    }

    const updated = await Recipe.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    }).populate('ingredients.ingredientId');

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
exports.setRecipeLock = async (req, res) => {
  try {
    const { isLocked, note } = req.body;
    if (typeof isLocked === 'undefined') {
      return res.status(400).json({ message: 'isLocked is required' });
    }

    const patch = { isLocked: !!isLocked };
    if (isLocked) {
      patch.lockedAt = new Date();
      patch.lockedBy = req.user?._id || null;
      patch.lockNote = note || '';
    } else {
      patch.lockedAt = null;
      patch.lockedBy = null;
      patch.lockNote = '';
    }

    const updated = await Recipe.findByIdAndUpdate(
      req.params.id,
      patch,
      { new: true }
    ).populate('ingredients.ingredientId');

    if (!updated) return res.status(404).json({ message: 'Recipe not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to set recipe lock', error: err.message });
  }
};
