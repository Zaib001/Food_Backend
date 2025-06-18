const express = require('express');
const router = express.Router();
const {
  getAllRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe
} = require('../controllers/recipeController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.get('/', protect, getAllRecipes);
router.post('/',upload.single('image'), protect, createRecipe);
router.put('/:id',upload.single('image'), protect, updateRecipe);
router.delete('/:id', protect, deleteRecipe);

module.exports = router;
