// models/Recipe.js
const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  portions: { type: Number, required: true },
  yieldWeight: { type: Number, required: true },
  type: { type: String },
  category: { type: String },
  ingredients: [
    {
      ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient' },
      quantity: { type: Number, required: true },
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Recipe', recipeSchema);
