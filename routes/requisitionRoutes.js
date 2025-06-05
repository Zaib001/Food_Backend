const express = require('express');
const router = express.Router();
const {
  getRequisitions,
  createRequisition,
  updateRequisition,
  deleteRequisition,
  importGenerated
} = require('../controllers/requisitionController');

const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/', protect, getRequisitions);
router.post('/', protect, createRequisition);
router.put('/:id', protect, updateRequisition);
router.delete('/:id', protect, deleteRequisition);
router.post('/import', protect, importGenerated);

module.exports = router;
