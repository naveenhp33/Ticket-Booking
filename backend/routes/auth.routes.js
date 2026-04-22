const express = require('express');
const router = express.Router();
const {
  requestVerification, verifyEmail,
  sendOtp, verifyOtp, login, getMe,
  adminCreateUser, adminResetPassword
} = require('../controllers/auth.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// Public
router.post('/request-verification', requestVerification);
router.get('/verify-email', verifyEmail);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/login', login); // kept for admin password login

// Private
router.get('/me', protect, getMe);

// Admin only
router.post('/admin/create-user', protect, authorize('admin'), adminCreateUser);
router.put('/admin/reset-password', protect, authorize('admin'), adminResetPassword);

module.exports = router;
