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
router.post('/resend-otp', resendOTP);

// ── Google OAuth ─────────────────────────────────────────────────────────────
router.get('/google',
  ensureGoogleAuthConfigured,
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  ensureGoogleAuthConfigured,
  passport.authenticate('google', { session: false, failureRedirect: '/login.html?error=oauth_failed' }),
  googleCallback
);

router.post('/verify-otp', verifyOTP);

module.exports = router;
