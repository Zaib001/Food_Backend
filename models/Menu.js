const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema({
  menuName: { type: String, required: true }, // NEW: anchor name, e.g., "MENU 1"
  date: { type: String, required: true },     // ISO date YYYY-MM-DD
  base: { type: String, required: true },
  mealType: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner', 'snack', 'extra'], // NEW: snack & extra
    required: true
  },
  recipeIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recipe'
  }]
}, { timestamps: true });

module.exports = mongoose.model('Menu', menuSchema);
