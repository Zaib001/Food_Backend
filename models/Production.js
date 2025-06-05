const mongoose = require('mongoose');

const productionSchema = new mongoose.Schema({
  date: { type: String, required: true }, // Format: YYYY-MM-DD
  recipeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe', required: true },
  quantity: { type: Number, required: true },
  base: { type: String, required: true },
  handler: { type: String, required: true },
  cost: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Production', productionSchema);
