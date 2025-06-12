const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Ingredient name is required'],
      trim: true,
    },

    // Purchased packaging unit, e.g., 'kg', 'pcs', 'box'
    purchaseUnit: {
      type: String,
      required: [true, 'Purchase unit is required'],
      trim: true,
    },

    // Quantity in that purchase unit, e.g., 5kg pack -> 5
    purchaseQuantity: {
      type: Number,
      required: [true, 'Purchase quantity is required'],
      min: [0.01, 'Purchase quantity must be greater than zero'],
    },

    // The unit used in recipe calculations
    originalUnit: {
      type: String,
      required: [true, 'Original unit is required'],
      trim: true,
    },

    // Price of the purchased pack
    originalPrice: {
      type: Number,
      required: [true, 'Original price is required'],
      min: [0, 'Price must be positive'],
    },

    // Auto-calculated: cost per kg or per usable unit
    pricePerKg: {
      type: Number,
      required: [true, 'Price per Kg is required'],
      min: [0, 'Price per Kg must be positive'],
    },

    // Optional calories
    kcal: {
      type: Number,
      default: 0,
      min: [0, 'Calories must be non-negative'],
    },

    // Yield % (how much usable output we get after trimming/waste)
    yield: {
      type: Number,
      default: 100,
      min: [1, 'Yield must be at least 1%'],
      max: [100, 'Yield cannot exceed 100%'],
    },

    // Optional for classification
    category: {
      type: String,
      default: 'other',
      trim: true,
    },

    // Optional warehouse label
    warehouse: {
      type: String,
      default: '',
      trim: true,
    },

    // Optional stock quantity for inventory management
    stock: {
      type: Number,
      default: 0,
      min: [0, 'Stock must be zero or more'],
    },

    // Optional: actual weight in kg if purchaseUnit = 'pcs'
    standardWeight: {
      type: Number,
      default: 0,
      min: [0, 'Standard weight must be non-negative'],
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

module.exports = mongoose.model('Ingredient', ingredientSchema);
