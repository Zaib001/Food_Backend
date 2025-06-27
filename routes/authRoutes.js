const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getProfile,
  getAllUsers,updateUser,deleteUser
} = require('../controllers/authController');

const { protect } = require('../middleware/authMiddleware');

// Public Routes
router.post('/register', register);
router.post('/login', login);

// Private Route
router.get('/me', protect, getProfile);
router.get('/users', protect, getAllUsers);
router.put('/users/:id', protect, updateUser);
router.delete('/users/:id', protect,  deleteUser);

module.exports = router;
