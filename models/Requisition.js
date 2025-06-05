const mongoose = require('mongoose');

const requisitionSchema = new mongoose.Schema({
  date: { type: String, required: true }, // Consider using Date type
  item: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true },
  requestedBy: { type: String, required: true },
  supplier: { type: String, default: 'Default Supplier' },
  status: { type: String, enum: ['pending', 'approved', 'completed'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('Requisition', requisitionSchema);
