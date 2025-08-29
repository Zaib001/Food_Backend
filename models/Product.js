// models/Product.js
const mongoose = require('mongoose');

const bomItemSchema = new mongoose.Schema({
  ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
  quantityPerUnit: { type: Number, required: true }, // base unit qty per 1 product
  unit: { type: String, required: true },            // e.g., 'kg'
}, { _id: false });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  bom: { type: [bomItemSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
