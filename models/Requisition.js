const mongoose = require('mongoose');

const requisitionSchema = new mongoose.Schema({
  date: { type: String, required: true },          // ISO date (YYYY-MM-DD)
  base: { type: String, required: true },          // anchor to base/location
  item: { type: String, required: true },          // ingredient name (denormalized)
  ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient' },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true },          // ingredient.originalUnit (kg, g, L, etc.)
  requestedBy: { type: String, required: true },   // e.g. "Auto-System"
  supplier: { type: String, default: 'Default Supplier' },
  status: { type: String, enum: ['pending', 'approved', 'completed'], default: 'pending' },

  // Anchors
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Planning' }, // which plan produced this
}, { timestamps: true });

module.exports = mongoose.model('Requisition', requisitionSchema);
