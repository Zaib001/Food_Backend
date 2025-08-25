// models/Inventory.js
const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
  ingredientName: { type: String },

  supplier: { type: String, required: true },

  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true },

  // NEW FIELDS
  purchasePrice: { type: Number, default: 0 }, // price per unit (e.g., per kg)
  currency: { type: String, default: 'USD' },
  costTotal: { type: Number, default: 0 }, // quantity * purchasePrice

  date: { type: String, required: true },
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Inventory', inventorySchema);
