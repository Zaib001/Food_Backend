const express = require('express');
const router = express.Router();
const {
  getProductions,
  createProduction,
  updateProduction,
  deleteProduction
} = require('../controllers/productionController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getProductions);
router.post('/', protect, createProduction);
router.put('/:id', protect, updateProduction);
router.delete('/:id', protect, deleteProduction);

module.exports = router;
