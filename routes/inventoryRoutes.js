const express = require('express');
const router = express.Router();
const {
  getInventory,
  createInventory,
  updateInventory,
  deleteInventory,
  getGroupedInventory,
  exportInventoryCSV,
  checkLowStock
} = require('../controllers/inventoryController');

const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getInventory);
router.post('/', protect,  createInventory);
router.put('/:id', protect,  updateInventory);
router.delete('/:id', protect,  deleteInventory);

router.get('/grouped', protect, getGroupedInventory);
router.get('/export/csv', protect, exportInventoryCSV);
router.get('/alerts/low-stock', protect, checkLowStock);

module.exports = router;
