<<<<<<< HEAD
const express = require('express');
const router  = express.Router();
const upload  = require('../middleware/upload');
const passport = require('../config/passport');
const jwt = require('jsonwebtoken');
const { registerStudent, registerCenter, verifyEmail, login, forgotPassword, resetPassword, resendVerification } = require('../controllers/authController');
const FRONTEND_URL = process.env.CLIENT_URL || 'https://review-mnl.vercel.app';

router.post('/resend-verification', resendVerification);
=======
const express  = require('express');
const router   = express.Router();
const jwt      = require('jsonwebtoken');
const passport = require('../config/passport');
const upload   = require('../middleware/upload');
const { registerStudent, registerCenter, verifyEmail, login, forgotPassword, resetPassword, resendVerification, googleCallback, verifyOTP, resendOTP } = require('../controllers/authController');

function hasRealGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) return false;
  if (clientId === 'your_google_client_id.apps.googleusercontent.com') return false;
  if (clientSecret === 'your_google_client_secret') return false;

  return true;
}

function appendErrorParam(targetUrl, errorCode) {
  const url = new URL(targetUrl);
  url.searchParams.set('error', errorCode);
  return url.toString();
}

function buildOAuthErrorRedirect(req, fallbackPage, errorCode) {
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5500').replace(/\/$/, '');
  const fallbackUrl = `${clientUrl}/${fallbackPage}`;
  const referer = req.get('referer');

  if (!referer) {
    return appendErrorParam(fallbackUrl, errorCode);
  }

  try {
    const refererUrl = new URL(referer);
    const clientOrigin = new URL(clientUrl).origin;

    if (refererUrl.origin !== clientOrigin) {
      return appendErrorParam(fallbackUrl, errorCode);
    }

    return appendErrorParam(refererUrl.toString(), errorCode);
  } catch (error) {
    return appendErrorParam(fallbackUrl, errorCode);
  }
}

function ensureGoogleAuthConfigured(req, res, next) {
  if (hasRealGoogleOAuthConfig()) {
    return next();
  }

  const redirectUrl = buildOAuthErrorRedirect(req, 'login.html', 'google_oauth_unavailable');
  return res.redirect(302, redirectUrl);
}
>>>>>>> 03b8cb9a55b43a65ee2b38f2ffdd770cc85bf797

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
