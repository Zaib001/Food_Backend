const Ingredient = require('../models/Ingredient');

// @desc    Get all ingredients
// @route   GET /api/ingredients
// @access  Private
exports.getIngredients = async (req, res) => {
  try {
    const ingredients = await Ingredient.find().sort({ createdAt: -1 });
    res.status(200).json(ingredients);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch ingredients', error: err.message });
  }
};

const calculatePricePerKg = (originalPrice, purchaseQuantity, yieldVal) => {
  return (originalPrice / purchaseQuantity) / (yieldVal / 100);
};

// @desc    Create new ingredient
// @route   POST /api/ingredients
// @access  Private/Admin
exports.createIngredient = async (req, res) => {
  try {
    const {
      name,
      purchaseUnit,
      purchaseQuantity,
      originalUnit,
      originalPrice,
      kcal = 0,
      yield: yieldVal = 100,
      category = 'other',
      warehouse = '',
      standardWeight = 0,
    } = req.body;

    // Validate required fields
    if (!name || !purchaseUnit || !purchaseQuantity || !originalUnit || !originalPrice) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    const pricePerKg = calculatePricePerKg(originalPrice, purchaseQuantity, yieldVal);

    const newIngredient = await Ingredient.create({
      name: name.trim(),
      purchaseUnit: purchaseUnit.trim(),
      purchaseQuantity,
      originalUnit: originalUnit.trim(),
      originalPrice,
      pricePerKg,
      kcal,
      yield: yieldVal,
      category: category?.trim() || 'other',
      warehouse: warehouse?.trim() || '',
      standardWeight,
    });

    res.status(201).json(newIngredient);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create ingredient', error: err.message });
  }
};



// @desc    Update ingredient
// @route   PUT /api/ingredients/:id
// @access  Private/Admin
exports.updateIngredient = async (req, res) => {
  try {
    const {
      name,
      purchaseUnit,
      purchaseQuantity,
      originalUnit,
      originalPrice,
      yield: yieldVal = 100,
      kcal,
      category,
      warehouse,
      standardWeight
    } = req.body;

    // Validate required fields
    if (!name || !purchaseUnit || !purchaseQuantity || !originalUnit || !originalPrice) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    const pricePerKg = calculatePricePerKg(originalPrice, purchaseQuantity, yieldVal);

    const updated = await Ingredient.findByIdAndUpdate(
      req.params.id,
      {
        name: name.trim(),
        purchaseUnit: purchaseUnit.trim(),
        purchaseQuantity,
        originalUnit: originalUnit.trim(),
        originalPrice,
        pricePerKg,
        kcal,
        yield: yieldVal,
        category: category?.trim() || 'other',
        warehouse: warehouse?.trim() || '',
        standardWeight,
      },
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ message: 'Ingredient not found' });

    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update ingredient', error: err.message });
  }
};



// @desc    Delete ingredient
// @route   DELETE /api/ingredients/:id
// @access  Private/Admin
exports.deleteIngredient = async (req, res) => {
  try {
    const ingredient = await Ingredient.findByIdAndDelete(req.params.id);
    if (!ingredient) return res.status(404).json({ message: 'Ingredient not found' });

    res.status(200).json({ message: 'Ingredient deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete ingredient', error: err.message });
  }
};

// @desc    Adjust stock for an ingredient
// @route   PATCH /api/ingredients/:id/stock
// @access  Private/Admin
exports.adjustStock = async (req, res) => {
  try {
    const { quantity, type } = req.body;
    if (typeof quantity !== 'number' || !['add', 'deduct'].includes(type)) {
      return res.status(400).json({ message: 'Invalid quantity or type' });
    }

    const ingredient = await Ingredient.findById(req.params.id);
    if (!ingredient) return res.status(404).json({ message: 'Ingredient not found' });

    if (type === 'add') {
      ingredient.stock += quantity;
    } else {
      ingredient.stock = Math.max(0, ingredient.stock - quantity);
    }

    await ingredient.save();
    res.status(200).json(ingredient);
  } catch (err) {
    res.status(500).json({ message: 'Failed to adjust stock', error: err.message });
  }
};
