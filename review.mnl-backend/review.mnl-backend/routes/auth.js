const express = require('express');
const router  = express.Router();
const upload  = require('../middleware/upload');
const passport = require('../config/passport');
const jwt = require('jsonwebtoken');
const { registerStudent, registerCenter, verifyEmail, login, forgotPassword, resetPassword, resendVerification } = require('../controllers/authController');
const FRONTEND_URL = process.env.CLIENT_URL || 'https://review-mnl.vercel.app';

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

// Google OAuth routes
// Patch: Capture ?role param and pass to passport via req._rmnlOAuthRole
router.get('/google', (req, res, next) => {
  // Accept ?role=student or ?role=admin (review_center)
  const role = req.query.role === 'admin' || req.query.role === 'review_center' ? 'review_center' : 'student';
  req._rmnlOAuthRole = role;
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    state: JSON.stringify({ role }) // state param for extra safety (optional)
  })(req, res, next);
});

router.get('/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${FRONTEND_URL}/login.html?error=google_auth_failed`
  }),
  (req, res) => {
    // Generate JWT token
    const token = jwt.sign(
      { id: req.user.id, role: req.user.role, email: req.user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    // Redirect to frontend with token and user data
    const userData = encodeURIComponent(JSON.stringify({
      id: req.user.id,
      name: `${req.user.first_name} ${req.user.last_name}`,
      email: req.user.email,
      role: req.user.role,
      profile_picture_url: req.user.profile_picture_url || null
    }));
    
    res.redirect(`${FRONTEND_URL}/loggedin.html?token=${token}&user=${userData}`);
  }
);

module.exports = router;
