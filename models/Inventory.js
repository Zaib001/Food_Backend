// models/Inventory.js
const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
  ingredientName: { type: String },

  // NEW: which production base / location this movement belongs to
  base: { type: String, default: '', trim: true }, // e.g. "BASE", "Kitchen A", "Warehouse 1"

  supplier: { type: String }, // optional (outbound won't have a supplier)

  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true },

  // Purchase costing (optional on outbound)
  purchasePrice: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
  costTotal: { type: Number, default: 0 },

  date: { type: String, required: true },
  notes: { type: String, default: '' },

  // Movement direction & provenance (audit & idempotency)
  direction: {
    type: String,
    enum: ['inbound', 'outbound', 'adjustment'],
    default: 'inbound'
  },
  sourceType: {
    type: String,
    enum: ['Requisition', 'ProductionOrder', 'Manual', 'Adjustment'],
    default: 'Manual'
  },
  sourceId: { type: String }, // store ObjectId as string for quick lookups
}, { timestamps: true });

inventorySchema.index({ base: 1, sourceType: 1, sourceId: 1, ingredientId: 1, direction: 1 });

module.exports = mongoose.model('Inventory', inventorySchema);
