const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  portions: { type: Number, required: true },
  yieldWeight: { type: Number, required: true },
  type: {
    type: String,
    enum: [
      'Fruit', 'Protein', 'Side Dish', 'Salad',
      'Soup', 'Cold Drink', 'Hot Drink', 'Bakery',
      'Desserts', 'Base Recipes'
    ],
    required: true
  },
  isLocked: { type: Boolean, default: false },
  basePortions: { type: Number, default: 10 },
  ingredients: [
    {
      ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient' },
      quantity: { type: Number, required: true },
      baseQuantity: { type: Number } // Store original quantity for scaling
    }
  ],
  procedure: { type: String },
  imageUrl: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Recipe', recipeSchema);
