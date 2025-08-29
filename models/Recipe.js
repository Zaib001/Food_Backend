// models/Recipe.js
const mongoose = require('mongoose');
const Ingredient = require('./Ingredient');

/**
 * Minimal unit helpers. If you track densities per ingredient, you can
 * extend this to be more accurate for liquids.
 */
function toKg(qty, unit) {
  const u = String(unit || '').toLowerCase();
  if (u === 'kg') return qty;
  if (u === 'g') return qty / 1000;
  if (u === 'lb' || u === 'lbs' || u === 'pound' || u === 'pounds') return qty * 0.453592;
  if (u === 'l' || u === 'lt' || u === 'liter' || u === 'litre') return qty; // assume density ~1
  // Unknown unit → pass through so we don't block saves
  return qty;
}

const recipeIngredientSchema = new mongoose.Schema(
  {
    ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },

    // Quantity used in this recipe (for the current `portions` value).
    quantity: { type: Number, required: true, min: 0 },

    // NEW: unit for this ingredient line (defaults to Ingredient.originalUnit when computing).
    unit: { type: String, default: '' },

    // Original quantity for the base scaling (when portions === basePortions)
    baseQuantity: { type: Number, min: 0 },

    // NEW: computed field: cost of this line at save time
    lineCost: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const recipeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    portions: { type: Number, required: true, min: 1 },
    yieldWeight: { type: Number, required: true, min: 0 },

    type: {
      type: String,
      enum: [
        'Fruit', 'Protein', 'Side Dish', 'Salad',
        'Soup', 'Cold Drink', 'Hot Drink', 'Bakery',
        'Desserts', 'Base Recipes'
      ],
      required: true
    },

    isLocked: { type: Boolean, default: false },
    lockedAt: { type: Date },
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lockNote: { type: String },

    // For scaling reference (you already had this)
    basePortions: { type: Number, default: 10, min: 1 },

    // Lines
    ingredients: { type: [recipeIngredientSchema], default: [] },

    procedure: { type: String },
    imageUrl: { type: String },

    // NEW: computed totals
    totalCost: { type: Number, default: 0, min: 0 },
    costPerPortion: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// For quick lookups by ingredient
recipeSchema.index({ 'ingredients.ingredientId': 1 });

/**
 * Ensure baseQuantity is present for each line so scaling is predictable.
 * If baseQuantity is missing, initialize it from current quantity when creating.
 */
recipeSchema.pre('save', function (next) {
  // If new recipe or ingredients changed, backfill baseQuantity where absent
  if (this.isNew || this.isModified('ingredients') || this.isModified('portions') || this.isModified('basePortions')) {
    for (const line of this.ingredients) {
      if (line.baseQuantity == null || Number.isNaN(line.baseQuantity)) {
        // Treat current quantity as base if not provided
        line.baseQuantity = line.quantity;
      }
    }
  }
  next();
});

/**
 * Recompute costs for this recipe from current Ingredient.pricePerKg.
 * - Uses line.unit if provided, else Ingredient.originalUnit
 * - Computes lineCost and sums to totalCost
 * - Updates costPerPortion = totalCost / portions
 */
recipeSchema.methods.recomputeCosts = async function () {
  let total = 0;

  // We fetch all needed ingredients in one go to reduce round trips
  const ids = this.ingredients.map(i => i.ingredientId).filter(Boolean);
  const ingDocs = await Ingredient.find({ _id: { $in: ids } }).lean();
  const ingMap = new Map(ingDocs.map(d => [String(d._id), d]));

  for (const line of this.ingredients) {
    const ing = ingMap.get(String(line.ingredientId));
    if (!ing) { line.lineCost = 0; continue; }

    // Decide which unit to use for quantity conversion
    const unitToUse = line.unit && line.unit.trim() ? line.unit : ing.originalUnit;

    // Convert recipe quantity to kg (approx) and multiply by pricePerKg
    const qtyKg = toKg(Number(line.quantity || 0), unitToUse);
    const lineCost = (Number(ing.pricePerKg || 0) * qtyKg) || 0;

    line.lineCost = Math.max(0, Number(lineCost.toFixed(4)));
    total += line.lineCost;
  }

  this.totalCost = Math.max(0, Number(total.toFixed(4)));
  this.costPerPortion = this.portions > 0 ? Number((this.totalCost / this.portions).toFixed(4)) : 0;

  return {
    totalCost: this.totalCost,
    costPerPortion: this.costPerPortion,
  };
};

/**
 * Static: recompute costs for every recipe that references a given ingredient.
 * Call this after an Ingredient price changes (we already wired this in Ingredient post-save).
 */
recipeSchema.statics.recomputeCostsForIngredient = async function (ingredientId) {
  const Recipe = this;
  const cursor = Recipe.find({ 'ingredients.ingredientId': ingredientId }).cursor();
  for await (const rec of cursor) {
    await rec.recomputeCosts();
    await rec.save();
  }
};

/**
 * Optional helper: scale current quantities to a target portions count based on basePortions.
 * This does NOT auto-save. Call `await recipe.save()` after if you want to persist the scaled quantities.
 */
recipeSchema.methods.scaleToPortions = function (targetPortions) {
  const base = Number(this.basePortions || 1);
  const t = Number(targetPortions || this.portions || base);
  if (base <= 0) return;

  const factor = t / base;

  for (const line of this.ingredients) {
    const bq = Number(line.baseQuantity || 0);
    line.quantity = Number((bq * factor).toFixed(6));
  }

  this.portions = t;
};

module.exports = mongoose.model('Recipe', recipeSchema);
