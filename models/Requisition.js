// models/Requisition.js
const mongoose = require('mongoose');

const RequisitionItemSchema = new mongoose.Schema(
  {
    ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient' }, // no longer required
    item: { type: String, trim: true },
    unit: { type: String, trim: true },
    quantity: { type: Number, default: 0 },
    actualQuantity: { type: Number, default: null }, // received amount
    supplier: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'completed'],
      default: 'pending',
    },
  },
  { _id: true }
);

const RequisitionSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    base: { type: String, default: '' }, // was required; make optional (UI may omit)
    menuName: { type: String, trim: true },
    mealType: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'snack', 'extra'],
    },
    peopleCount: { type: Number, default: 100 },
    portionFactor: Number,

    // New structure: line items
    items: { type: [RequisitionItemSchema], default: [] },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'completed'],
      default: 'pending',
    },
    requestedBy: { type: String, default: 'Auto-System' },
    linkedMenuIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Menu' }],
    completedAt: Date,
    completedBy: String,
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Requisition', RequisitionSchema);
