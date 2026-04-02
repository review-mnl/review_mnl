const express = require('express');
const router  = express.Router();
const upload  = require('../middleware/upload');
const passport = require('../config/passport');
const jwt = require('jsonwebtoken');
const { registerStudent, registerCenter, verifyEmail, login, forgotPassword, resetPassword, resendVerification } = require('../controllers/authController');

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
router.get('/google', 
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false 
  })
);

router.get('/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/login.html?error=google_auth_failed`
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
    
    res.redirect(`${process.env.CLIENT_URL}/loggedin.html?token=${token}&user=${userData}`);
  }
);

module.exports = router;
