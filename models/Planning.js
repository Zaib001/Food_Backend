const mongoose = require('mongoose');

const mealRefSchema = new mongoose.Schema({
  menu: { type: mongoose.Schema.Types.ObjectId, ref: 'Menu' }, // selected menu for that block
  qty: { type: Number, default: 0 }, // how many to produce for that block
}, { _id: false });

const planningSchema = new mongoose.Schema({
  date: { type: String, required: true }, // ISO date (YYYY-MM-DD)
  base: { type: String, required: true },

  // one menu + qty per block
  breakfast: { type: mealRefSchema, default: {} },
  lunch:     { type: mealRefSchema, default: {} },
  snack:     { type: mealRefSchema, default: {} },
  dinner:    { type: mealRefSchema, default: {} },
  extra:     { type: mealRefSchema, default: {} },

  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Planning', planningSchema);
