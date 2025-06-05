const mongoose = require('mongoose');

const planningSchema = new mongoose.Schema({
  date: { type: String, required: true }, // ISO date (e.g. 2025-06-01)
  base: { type: String, required: true },
  menus: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Menu'
  }],
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Planning', planningSchema);
