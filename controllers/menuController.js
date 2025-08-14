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
exports.generateRequisitions = async (req, res) => {
  try {
    const peopleCount = parseInt(req.query.peopleCount) || 100;
    const portionFactor = peopleCount / 10;

    const menus = await Menu.find().populate('recipeIds');
    const ingredientMap = {};

    for (const menu of menus) {
      for (const recipe of menu.recipeIds) {
        if (!Array.isArray(recipe.ingredients)) continue;

        for (const { ingredientId, quantity } of recipe.ingredients) {
          const key = `${menu.date}-${menu.base}-${ingredientId}`;

          if (!ingredientMap[key]) {
            const ingredient = await Ingredient.findById(ingredientId);
            if (!ingredient) continue;

            ingredientMap[key] = {
              date: menu.date,
              base: menu.base,
              item: ingredient.name,
              ingredientId: ingredientId.toString(),
              quantity: 0,
              unit: ingredient.originalUnit || 'kg',
              supplier: 'Default Supplier',
              requestedBy: 'Auto-System',
              status: 'pending'
            };
          }

          ingredientMap[key].quantity += quantity * portionFactor;
        }
      }
    }

    res.status(200).json(Object.values(ingredientMap));
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate requisitions', error: err.message });
  }
};
