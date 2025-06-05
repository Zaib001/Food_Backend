const express = require('express');
const router = express.Router();
const ingredientController = require('../controllers/ingredientController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public Read
router.get('/', protect, ingredientController.getIngredients);

router.post('/', protect,  ingredientController.createIngredient);
router.put('/:id', protect,  ingredientController.updateIngredient);
router.delete('/:id', protect,  ingredientController.deleteIngredient);
router.patch('/:id/stock', protect,  ingredientController.adjustStock);

module.exports = router;
