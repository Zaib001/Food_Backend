const express = require('express');
const router = express.Router();
const {
  getStats,
  getMonthlySummary,
  getCategoryShare,
  getActivityLog
} = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

router.get('/stats', protect, getStats);
router.get('/monthly-summary', protect,  getMonthlySummary);
router.get('/category-share', protect,  getCategoryShare);
router.get('/activity', protect, getActivityLog);

module.exports = router;
