const express = require('express');
const router  = express.Router();
const upload  = require('../middleware/upload');
const { protect } = require('../middleware/auth');
const { registerStudent, registerCenter, verifyEmail, login, forgotPassword, resetPassword, resendVerification, getProfile, updateProfile } = require('../controllers/authController');
router.post('/resend-verification', resendVerification);

router.post('/register/student', registerStudent);
router.post('/register/center',
  upload.fields([
    { name: 'business_permit', maxCount: 1 },
    { name: 'dti_sec_reg', maxCount: 1 },
  ]),
  registerCenter
);
router.get('/verify-email', verifyEmail);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Profile routes (protected)
router.get('/profile', protect, getProfile);
router.put('/profile', protect, upload.single('profilePhoto'), updateProfile);

module.exports = router;
