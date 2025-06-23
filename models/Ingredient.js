const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  purchaseUnit: {
    type: String,
    enum: ['kg', 'lt'],
    required: true,
    trim: true,
  },
  purchaseQuantity: {
    type: Number,
    required: true,
    min: 0.01,
  },
  originalUnit: { type: String, required: true, trim: true },
  originalPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  pricePerKg: {
    type: Number,
    required: true,
    min: 0,
  },
  kcal: {
    type: Number,
    default: 0,
    min: 0,
  },
  yield: {
    type: Number,
    default: 100,
    min: 1,
    max: 100,
  },
  category: {
    type: String,
    enum: [
      'Proteins', 'Vegetables', 'Fruits', 'Grains and Flours',
      'Oils and Sauces', 'Liquors', 'Soft Drinks', 'Condiments',
      'Other'
    ],
    default: 'Other',
    trim: true,
  },
  warehouse: {
    type: String,
    enum: ['Refrigeration', 'Freezing', 'Dry'],
    default: 'Dry',
    trim: true,
  },
  supplier: {
    type: String,
    default: '',
    trim: true,
  },
  stock: {
    type: Number,
    default: 0,
    min: 0,
  },
  standardWeight: {
    type: Number,
    default: 0,
    min: 0,
  },
}, { timestamps: true });

module.exports = mongoose.model('Ingredient', ingredientSchema);
