const db      = require('../config/db');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const { sendVerificationEmail } = require('../config/mailer');
require('dotenv').config();

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
    if (!user.is_verified)
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
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    res.json({
      message: 'Login successful.',
      token,
      user: { id: user.id, name: `${user.first_name} ${user.last_name}`, email: user.email, role: user.role },
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
    await db.query('UPDATE users SET verify_token = ? WHERE email = ?', [token, email]);
    const link = `${process.env.CLIENT_URL}/resetpassword.html?token=${token}`;
    const { sendVerificationEmail: sendEmail } = require('../config/mailer');
    res.json({ message: 'Password reset link sent to your email.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { registerStudent, registerCenter, verifyEmail, login, forgotPassword };
