const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getProfile,
} = require('../controllers/authController');

const { protect } = require('../middleware/authMiddleware');

// Public Routes
router.post('/register', register);
router.post('/login', login);

// Private Route
router.get('/me', protect, getProfile);

module.exports = router;
