const express = require('express');
const router = express.Router();
const {
  adminListUsers,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
  adminSetUserRole,
  adminGetStats,
  adminListRequisitions,
  adminBulkUpdateRequisitionStatus,
  getAllUsers,          // if you still want a simple list (admin-only)
  updateUser,
  deleteUser,
} = require('../controllers/adminController');

const { protect, authorize } = require('../middleware/authMiddleware');

// admin-only gate
router.use(protect, authorize('admin'));

// users
router.get('/users', adminListUsers);          // paged + search
router.post('/users', adminCreateUser);
router.put('/users/:id', adminUpdateUser);
router.delete('/users/:id', adminDeleteUser);
router.patch('/users/:id/role', adminSetUserRole);

// (optional) simple variants
router.get('/users/all', getAllUsers);
router.put('/users/simple/:id', updateUser);
router.delete('/users/simple/:id', deleteUser);

// stats
router.get('/stats', adminGetStats);

// requisitions helpers
router.get('/requisitions', adminListRequisitions);
router.patch('/requisitions/status', adminBulkUpdateRequisitionStatus);

module.exports = router;
