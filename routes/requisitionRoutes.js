// routes/requisitionRoutes.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getRequisitions, getRequisitionById, createRequisition, updateRequisition, deleteRequisition,
  importGenerated, approveRequisition, bulkApprove, getStats, completeRequisition
} = require('../controllers/requisitionController');

router.get('/', protect, getRequisitions);
router.get('/stats', protect, getStats);
router.put('/bulk-approve', protect, authorize('admin'), bulkApprove);
router.post('/', protect, authorize('admin'), createRequisition);
router.post('/import', protect, authorize('admin'), importGenerated);

router.param('id', (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid requisition id' });
  next();
});

router.get('/:id', protect, getRequisitionById);
router.put('/:id', protect, authorize('admin'), updateRequisition);
router.put('/:id/approve', protect, authorize('admin'), approveRequisition);
router.put('/:id/complete', protect, authorize('admin'), completeRequisition); // << here
router.delete('/:id', protect, authorize('admin'), deleteRequisition);

module.exports = router;
