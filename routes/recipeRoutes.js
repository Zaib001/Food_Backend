const express = require('express');
const router = express.Router();
const {
  getAllRecipes,
  getRecipe,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  scaleRecipe,
  getRecipesByType,setRecipeLock
} = require('../controllers/recipeController');
const { protect, authorize } = require('../middleware/authMiddleware');
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

router.patch('/:id/lock', authorize('admin'), setRecipeLock);
module.exports = router;
