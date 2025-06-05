const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema({
  date: { type: String, required: true }, // Prefer ISO date strings: YYYY-MM-DD
  base: { type: String, required: true },
  mealType: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner'],
    required: true
  },
  recipeIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recipe'
  }]
}, { timestamps: true });

module.exports = mongoose.model('Menu', menuSchema);
