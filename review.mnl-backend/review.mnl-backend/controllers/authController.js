// Resend verification email
const resendVerification = async (req, res) => {
  const { email } = req.body;
  try {
    const [rows] = await db.query('SELECT id, first_name, is_verified FROM users WHERE email = ?', [email]);
    if (rows.length === 0)
      return res.status(404).json({ message: 'No account found with that email.' });
    if (rows[0].is_verified)
      return res.status(400).json({ message: 'Account is already verified.' });
    const token = crypto.randomBytes(32).toString('hex');
    await db.query('UPDATE users SET verify_token = ? WHERE email = ?', [token, email]);
    await sendVerificationEmail(email, token, rows[0].first_name);
    res.json({ message: 'Verification email resent.' });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};
const db      = require('../config/db');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
// Conflict marker removed
const { sendVerificationEmail, sendPasswordResetEmail, sendOTPEmail } = require('../config/mailer');
// Conflict marker removed
const { sendVerificationEmail, sendPasswordResetEmail } = require('../config/mailer');
// Conflict marker removed
require('dotenv').config();

async function issueLoginOTP(user) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpSession = crypto.randomBytes(32).toString('hex');
  const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

  await db.query(
    'UPDATE users SET otp_code = ?, otp_expires_at = ?, otp_session = ? WHERE id = ?',
    [otp, otpExpires, otpSession, user.id]
  );

  await sendOTPEmail(user.email, otp, user.first_name);
  return otpSession;
}

const registerStudent = async (req, res) => {
  const { fullname, email, password } = req.body;
  const nameParts = fullname.trim().split(' ');
  const first_name = nameParts[0];
  const last_name = nameParts.slice(1).join(' ') || '';
  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0)
      return res.status(409).json({ message: 'Email is already registered.' });
    const hashed = await bcrypt.hash(password, 10);
    const token  = crypto.randomBytes(32).toString('hex');
    await db.query(
      `INSERT INTO users (first_name, last_name, email, password, role, verify_token)
       VALUES (?, ?, ?, ?, 'student', ?)`,
      [first_name, last_name, email, hashed, token]
    );
    await sendVerificationEmail(email, token, first_name);
    res.status(201).json({ message: 'Account created! Please check your email to verify.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

const registerCenter = async (req, res) => {
  const { owner_first, owner_last, business_name, email, password } = req.body;
  const businessPermit = req.files?.business_permit?.[0]?.filename || null;
  const dtiSecReg      = req.files?.dti_sec_reg?.[0]?.filename || null;
  if (!businessPermit || !dtiSecReg)
    return res.status(400).json({ message: 'Both Business Permit and DTI/SEC Registration are required.' });
  try {
    const [existing] = await db.query('SELECT id FROM review_centers WHERE email = ?', [email]);
    if (existing.length > 0)
      return res.status(409).json({ message: 'Email is already registered.' });
    const hashed = await bcrypt.hash(password, 10);
    const [userResult] = await db.query(
      `INSERT INTO users (first_name, last_name, email, password, role, is_verified)
       VALUES (?, ?, ?, ?, 'review_center', 1)`,
      [owner_first, owner_last, email, hashed]
    );
    await db.query(
      `INSERT INTO review_centers (user_id, business_name, email, password, owner_first, owner_last, business_permit, dti_sec_reg, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [userResult.insertId, business_name, email, hashed, owner_first, owner_last, businessPermit, dtiSecReg]
    );
    res.status(201).json({ message: 'Application submitted! Admin will review your documents.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

const verifyEmail = async (req, res) => {
  const { token } = req.query;
  try {
    const [rows] = await db.query('SELECT id FROM users WHERE verify_token = ?', [token]);
    if (rows.length === 0)
      return res.status(400).json({ message: 'Invalid or expired verification link.' });
    await db.query('UPDATE users SET is_verified = 1, verify_token = NULL WHERE id = ?', [rows[0].id]);
    res.json({ message: 'Email verified! You can now log in.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0)
      return res.status(401).json({ message: 'Invalid email or password.' });
    const user = rows[0];
    // Skip email verification for superadmin only
    if (!user.is_verified && user.role !== 'superadmin')
      return res.status(403).json({ message: 'Please verify your email first.' });
    if (user.role === 'review_center') {
      const [center] = await db.query('SELECT status FROM review_centers WHERE user_id = ?', [user.id]);
      if (center[0]?.status === 'pending')
        return res.status(403).json({ message: 'Your account is still pending admin approval.' });
      if (center[0]?.status === 'rejected')
        return res.status(403).json({ message: 'Your application was rejected.' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: 'Invalid email or password.' });

    if (user.role === 'superadmin') {
      const token = jwt.sign(
        { id: user.id, role: user.role, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      return res.json({
        message: 'Login successful.',
        token,
        user: { id: user.id, name: `${user.first_name} ${user.last_name}`, email: user.email, role: user.role },
      });
    }

    const otpSession = await issueLoginOTP(user);

    res.json({
      message: 'OTP sent to your email. Please verify to continue.',
      requiresOtp: true,
      session: otpSession,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const [rows] = await db.query('SELECT id, first_name FROM users WHERE email = ?', [email]);
    if (rows.length === 0)
      return res.status(404).json({ message: 'No account found with that email.' });
    const token = crypto.randomBytes(32).toString('hex');
<<<<<<< HEAD
    await db.query('UPDATE users SET verify_token = ? WHERE id = ?', [token, rows[0].id]);
    await sendPasswordResetEmail(email, token, rows[0].first_name);
    res.json({ message: 'Password reset link sent to your email.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

const resendVerification = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required.' });
  try {
    const [rows] = await db.query('SELECT id, first_name, is_verified FROM users WHERE email = ?', [email]);
    if (rows.length === 0)
      return res.status(404).json({ message: 'No account found with that email.' });
    if (rows[0].is_verified)
      return res.status(400).json({ message: 'This account is already verified.' });
    const token = crypto.randomBytes(32).toString('hex');
    await db.query('UPDATE users SET verify_token = ? WHERE id = ?', [token, rows[0].id]);
    await sendVerificationEmail(email, token, rows[0].first_name);
    res.json({ message: 'Verification email resent. Please check your inbox.' });
  } catch (err) {
    console.error(err);
=======
    await db.query('UPDATE users SET reset_token = ? WHERE email = ?', [token, email]);
    await sendPasswordResetEmail(email, token, rows[0].first_name);
    res.json({ message: 'Password reset link sent to your email.' });
  } catch (err) {
    console.error('Forgot password error:', err);
>>>>>>> a26df1f57db05daf2267d6580cb76f41b8cc0942
    res.status(500).json({ message: 'Server error.' });
  }
};

const resetPassword = async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ message: 'Token and password are required.' });
  }
  try {
    const [rows] = await db.query('SELECT id FROM users WHERE reset_token = ?', [token]);
    if (rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired reset link.' });
    }
    const hashed = await bcrypt.hash(password, 10);
    await db.query('UPDATE users SET password = ?, reset_token = NULL WHERE id = ?', [hashed, rows[0].id]);
    res.json({ message: 'Password reset successfully! You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

<<<<<<< HEAD
const googleCallback = async (req, res) => {
  try {
    const user = req.user;
    const otpSession = await issueLoginOTP(user);
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5500').replace(/\/$/, '');
    res.redirect(`${clientUrl}/verifyotp.html?session=${otpSession}`);
  } catch (err) {
    console.error('Google OTP error:', err);
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5500').replace(/\/$/, '');
    res.redirect(`${clientUrl}/login.html?error=oauth_failed`);
  }
};

const resendOTP = async (req, res) => {
  const { session } = req.body;
  if (!session)
    return res.status(400).json({ message: 'Session is required.' });

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE otp_session = ?', [session]);
    if (rows.length === 0)
      return res.status(400).json({ message: 'Invalid or expired session. Please log in again.' });

    const user = rows[0];
    const otpSession = await issueLoginOTP(user);
    res.json({
      message: 'A new OTP has been sent to your email.',
      session: otpSession,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

const verifyOTP = async (req, res) => {
  const { session, otp } = req.body;
  if (!session || !otp)
    return res.status(400).json({ message: 'Session and OTP are required.' });
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE otp_session = ?', [session]);
    if (rows.length === 0)
      return res.status(400).json({ message: 'Invalid or expired session. Please log in again.' });
    const user = rows[0];
    if (new Date() > new Date(user.otp_expires_at))
      return res.status(400).json({ message: 'OTP has expired. Please log in again.' });
    if (user.otp_code !== otp)
      return res.status(400).json({ message: 'Incorrect OTP. Please try again.' });
    await db.query(
      'UPDATE users SET otp_code = NULL, otp_expires_at = NULL, otp_session = NULL WHERE id = ?',
      [user.id]
    );
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    res.json({
      token,
      user: { id: user.id, name: `${user.first_name} ${user.last_name}`, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { registerStudent, registerCenter, verifyEmail, login, forgotPassword, resetPassword, resendVerification, googleCallback, verifyOTP, resendOTP };
