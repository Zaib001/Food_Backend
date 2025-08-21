// models/Requisition.js
const mongoose = require('mongoose');

const RequisitionItemSchema = new mongoose.Schema({
  ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
  item: String,
  unit: String,
  quantity: Number,
  supplier: String,
  status: { type: String, enum: ['pending','approved','rejected'], default: 'pending' }
}, { _id: false });

const RequisitionSchema = new mongoose.Schema({
  date: { type: String, required: true },          // "YYYY-MM-DD"
  base: { type: String, required: true },
  menuName: { type: String },                       // optional anchor
  mealType: { type: String, enum: ['breakfast','lunch','dinner','snack','extra'] },
  peopleCount: { type: Number, default: 100 },
  portionFactor: Number,
  items: [RequisitionItemSchema],
  status: { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  requestedBy: { type: String, default: 'Auto-System' },
  linkedMenuIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Menu' }],
}, { timestamps: true, indexes: [{ date: 1, base: 1, mealType: 1 }] });

RequisitionSchema.index({ date: 1, base: 1, mealType: 1 }, { unique: true }); // idempotency per service

module.exports = mongoose.model('Requisition', RequisitionSchema);
