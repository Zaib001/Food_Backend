// models/Ingredient.js
const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },

  purchaseUnit: {
    type: String,
    enum: ['kg', 'lt'],
    required: true,
    trim: true,
  },
  purchaseQuantity: {
    type: Number,
    required: true,
    min: 0.01,
  },

  originalUnit: { type: String, required: true, trim: true },

  originalPrice: {
    type: Number,
    required: true,
    min: 0,
  },

  pricePerKg: {
    type: Number,
    required: true,
    min: 0,
  },

  kcal: { type: Number, default: 0, min: 0 },

  yield: { type: Number, default: 100, min: 1, max: 100 },

  category: {
    type: String,
    enum: [
      'Proteins', 'Vegetables', 'Fruits', 'Grains and Flours',
      'Oils and Sauces', 'Liquors', 'Soft Drinks', 'Condiments',
      'Other'
    ],
    default: 'Other',
    trim: true,
  },

  warehouse: {
    type: String,
    enum: ['Refrigeration', 'Freezing', 'Dry'],
    default: 'Dry',
    trim: true,
  },

  supplier: { type: String, default: '', trim: true },

  stock: { type: Number, default: 0, min: 0 },

  standardWeight: { type: Number, default: 0, min: 0 },

  // NEW: optional price history (for traceability)
  priceHistory: [{
    pricePerKg: { type: Number, min: 0 },
    originalPrice: { type: Number, min: 0 },
    purchaseUnit: { type: String, enum: ['kg', 'lt'] },
    purchaseQuantity: { type: Number, min: 0.01 },
    recordedAt: { type: Date, default: Date.now }
  }],
}, { timestamps: true });

// helper to compute price per kg from purchase pack
function computePricePerKg(doc) {
  const { purchaseUnit, purchaseQuantity, originalPrice } = doc;
  if (!purchaseUnit || !purchaseQuantity || !originalPrice) return doc.pricePerKg || 0;
  if (purchaseUnit === 'kg') return originalPrice / purchaseQuantity;
  if (purchaseUnit === 'lt') {
    // If 1 lt == 1 kg for your use-case (typical water/oil approximations), keep simple:
    return originalPrice / purchaseQuantity;
  }
  return doc.pricePerKg || 0;
}

// Keep pricePerKg consistent
ingredientSchema.pre('save', function (next) {
  if (this.isModified('purchaseUnit') || this.isModified('purchaseQuantity') || this.isModified('originalPrice')) {
    const ppk = computePricePerKg(this);
    this.pricePerKg = Number.isFinite(ppk) && ppk >= 0 ? ppk : this.pricePerKg;
    // push to history
    this.priceHistory.push({
      pricePerKg: this.pricePerKg,
      originalPrice: this.originalPrice,
      purchaseUnit: this.purchaseUnit,
      purchaseQuantity: this.purchaseQuantity,
    });
  }
  next();
});

// After price changes, recompute all recipes using this ingredient
ingredientSchema.post('save', async function () {
  try {
    if (this.isModified('pricePerKg') || this.isModified('originalPrice') || this.isModified('purchaseQuantity') || this.isModified('purchaseUnit')) {
      const Recipe = require('./Recipe');
      await Recipe.recomputeCostsForIngredient(this._id);
    }
  } catch (e) {
    // avoid crashing save pipeline; log and move on
    console.error('Recipe cost recompute failed for ingredient:', this._id, e.message);
  }
});

module.exports = mongoose.model('Ingredient', ingredientSchema);
