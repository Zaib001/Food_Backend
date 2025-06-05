const express = require('express');
const router = express.Router();
const {
  getAllPlans,
  createPlan,
  updatePlan,
  deletePlan
} = require('../controllers/planningController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getAllPlans);
router.post('/', protect, createPlan);
router.put('/:id', protect, updatePlan);
router.delete('/:id', protect, deletePlan);

module.exports = router;
