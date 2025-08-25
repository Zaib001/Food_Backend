// models/Requisition.js
const mongoose = require('mongoose');

const RequisitionItemSchema = new mongoose.Schema({
  ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
  item: String,
  unit: String,
  quantity: Number,
  actualQuantity: { type: Number, default: null }, // For received amount
  supplier: String,
  status: { type: String, enum: ['pending','approved','rejected','completed'], default: 'pending' }
}, { _id: true }); // Keep _id for individual item identification

const RequisitionSchema = new mongoose.Schema({
  date: { type: String, required: true },
  base: { type: String, required: true },
  menuName: { type: String },
  mealType: { type: String, enum: ['breakfast','lunch','dinner','snack','extra'] },
  peopleCount: { type: Number, default: 100 },
  portionFactor: Number,
  items: [RequisitionItemSchema],
  status: { type: String, enum: ['pending','approved','rejected','completed'], default: 'pending' },
  requestedBy: { type: String, default: 'Auto-System' },
  linkedMenuIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Menu' }],
  completedAt: Date,
  completedBy: String,
  notes: String, // Add notes field for completion remarks
}, { timestamps: true });

module.exports = mongoose.model('Requisition', RequisitionSchema);