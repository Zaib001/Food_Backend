const express = require('express');
const router = express.Router();
const {
  getAllRecipes,
  getRecipe,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  scaleRecipe,
  getRecipesByType
} = require('../controllers/recipeController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.route('/')
  .get(protect, getAllRecipes)
  .post(protect, upload.single('image'), createRecipe);

router.route('/:id')
  .get(protect, getRecipe)
  .put(protect, upload.single('image'), updateRecipe)
  .delete(protect, deleteRecipe);

router.route('/:id/scale')
  .post(protect, scaleRecipe);

router.route('/menu/:type')
  .get(protect, getRecipesByType);

module.exports = router;
