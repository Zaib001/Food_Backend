const express = require('express');
const router = express.Router();
const {
  getAllMenus,
  createMenu,
  deleteMenu,
  generateAndPersistRequisitions,
  approveRequisition,bulkApprove
} = require('../controllers/menuController');
const { protect,authorize } = require('../middleware/authMiddleware');

router.get('/', protect, getAllMenus);
router.post('/', protect, createMenu);
router.delete('/:id', protect, deleteMenu);
// persistent requisitions (header-level, upserted)
router.post('/requisitions', protect, generateAndPersistRequisitions);
// admin-only
router.put('/:id/approve', protect, authorize('admin'), approveRequisition);
router.put('/bulk-approve', protect, authorize('admin'), bulkApprove);


module.exports = router;
