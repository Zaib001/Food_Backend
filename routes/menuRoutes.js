const express = require('express');
const router = express.Router();
const {
  getAllMenus,
  createMenu,
  deleteMenu,
  generateRequisitions
} = require('../controllers/menuController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getAllMenus);
router.post('/', protect, createMenu);
router.delete('/:id', protect, deleteMenu);
router.get('/requisitions', protect, generateRequisitions);

module.exports = router;
