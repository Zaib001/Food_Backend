// models/ProductionOrder.js
const mongoose = require('mongoose');

const productionOrderSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true }, // finished goods qty
  date: { type: String, required: true },
  base: { type: String, default: '' },        // NEW: where it is produced / deducted from
  status: { type: String, enum: ['planned', 'in_progress', 'completed', 'cancelled'], default: 'planned' },
  notes: String,
}, { timestamps: true });

module.exports = mongoose.model('ProductionOrder', productionOrderSchema);
