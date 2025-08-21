// routes/requisitionRoutes.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const {
  getRequisitions,
  getRequisitionById,
  createRequisition,
  updateRequisition,
  deleteRequisition,
  importGenerated,
  approveRequisition,
  bulkApprove,
  getStats
} = require('../controllers/requisitionController');

const { protect, authorize } = require('../middleware/authMiddleware');

// ---- READ ----
router.get('/', protect, getRequisitions);
router.get('/stats', protect, getStats);

// ---- APPROVALS / BULK (STATIC FIRST) ----
router.put('/bulk-approve', protect, authorize('admin'), bulkApprove);

// ---- CRUD (admin recommended) ----
router.post('/', protect, authorize('admin'), createRequisition);
router.post('/import', protect, authorize('admin'), importGenerated);

// ---- id validation middleware (avoid inline regex in the path) ----
router.param('id', (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid requisition id' });
  }
  next();
});

// ---- PARAM ROUTES (AFTER STATIC) ----
router.get('/:id', protect, getRequisitionById);
router.put('/:id', protect, authorize('admin'), updateRequisition);
router.put('/:id/approve', protect, authorize('admin'), approveRequisition);
router.delete('/:id', protect, authorize('admin'), deleteRequisition);

module.exports = router;
