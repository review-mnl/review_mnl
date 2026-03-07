const express  = require('express');
const router   = express.Router();
const passport = require('passport');
const jwt      = require('jsonwebtoken');
const upload   = require('../middleware/upload');
const { registerStudent, registerCenter, verifyEmail, login, forgotPassword, resendVerification } = require('../controllers/authController');

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
router.post('/resend-verification', resendVerification);

// ── OAuth helper — generates JWT and redirects back to the frontend ────────────
function oauthSuccess(req, res) {
    const FRONTEND_URL = 'https://reviewmnl.netlify.app';
    const user  = req.user;
    const token = jwt.sign(
        { id: user.id, role: user.role, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    const userStr = encodeURIComponent(JSON.stringify({
        id:    user.id,
        name:  `${user.first_name} ${user.last_name}`,
        email: user.email,
        role:  user.role,
    }));
    res.redirect(`${FRONTEND_URL}/login.html?token=${token}&user=${userStr}`);
}

// ── Google OAuth ─────────────────────────────────────────────────────────────
router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback',
    passport.authenticate('google', {
        failureRedirect: 'https://reviewmnl.netlify.app/login.html?error=google_failed',
    }),
    oauthSuccess
);

// ── Facebook OAuth ───────────────────────────────────────────────────────────
router.get('/facebook',
    passport.authenticate('facebook', { scope: ['email'] }));
router.get('/facebook/callback',
    passport.authenticate('facebook', {
        failureRedirect: 'https://reviewmnl.netlify.app/login.html?error=fb_failed',
    }),
    oauthSuccess
);

module.exports = router;
