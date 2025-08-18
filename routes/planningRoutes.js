const express = require('express');
const router = express.Router();
const { getAllPlans, createPlan, updatePlan, deletePlan } = require('../controllers/planningController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', protect, getAllPlans);
router.post('/', protect, authorize('planner', 'admin'), createPlan);
router.put('/:id', protect, authorize('planner', 'admin'), updatePlan);
router.delete('/:id', protect, authorize('admin'), deletePlan); // delete only admin

module.exports = router;
