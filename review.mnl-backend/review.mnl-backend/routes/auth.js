const express  = require('express');
const router   = express.Router();
const jwt      = require('jsonwebtoken');
const passport = require('../config/passport');
const upload   = require('../middleware/upload');
const { registerStudent, registerCenter, verifyEmail, login, forgotPassword, resetPassword, resendVerification, googleCallback, verifyOTP } = require('../controllers/authController');

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
router.post('/resend-verification', resendVerification);

// ── Google OAuth ─────────────────────────────────────────────────────────────
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login.html?error=oauth_failed' }),
  googleCallback
);

router.post('/verify-otp', verifyOTP);

module.exports = router;
