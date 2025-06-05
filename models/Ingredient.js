const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  originalUnit: { type: String, required: true },
  originalPrice: { type: Number, required: true, min: 0 },
  pricePerKg: { type: Number, required: true, min: 0 },
  kcal: { type: Number, default: 0 },
  yield: { type: Number, default: 100 },
  category: { type: String, default: 'other' },
  warehouse: { type: String, default: '' },
  stock: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Ingredient', ingredientSchema);
