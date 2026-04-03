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
const path     = require('path');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../config/mailer');
require('dotenv').config();

const registerStudent = async (req, res) => {
  const { fullname, email, password } = req.body;
  
  // Input validation
  if (!fullname || !fullname.trim())
    return res.status(400).json({ message: 'Full name is required.' });
  if (!email || !email.trim())
    return res.status(400).json({ message: 'Email is required.' });
  if (!password || password.length < 6)
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  
  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim()))
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  
  const nameParts = fullname.trim().split(' ');
  const first_name = nameParts[0];
  const last_name = nameParts.slice(1).join(' ') || '';
  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing.length > 0)
      return res.status(409).json({ message: 'Email is already registered.' });
    const hashed = await bcrypt.hash(password, 10);
    const token  = crypto.randomBytes(32).toString('hex');
    await db.query(
      `INSERT INTO users (first_name, last_name, email, password, role, verify_token)
       VALUES (?, ?, ?, ?, 'student', ?)`,
      [first_name, last_name, email.toLowerCase(), hashed, token]
    );
    await sendVerificationEmail(email, token, first_name);
    res.status(201).json({ message: 'Account created! Please check your email to verify.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

const registerCenter = async (req, res) => {
  const { business_name, email, password } = req.body;
  
  // Input validation
  if (!business_name || !business_name.trim())
    return res.status(400).json({ message: 'Business name is required.' });
  if (!email || !email.trim())
    return res.status(400).json({ message: 'Email is required.' });
  if (!password || password.length < 6)
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  
  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim()))
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  
  // Use Cloudinary file URLs instead of local filenames
  const normalizeDocValue = (v) => {
    if (!v) return null;
    return String(v).trim().slice(0, 255);
  };

  const toStoredUploadPath = (fileObj) => {
    if (!fileObj) return null;
    if (fileObj.secure_url) return fileObj.secure_url;
    if (fileObj.url && /^https?:\/\//i.test(String(fileObj.url))) return String(fileObj.url);
    if (fileObj.path && /^https?:\/\//i.test(String(fileObj.path))) return String(fileObj.path);
    if (fileObj.filename) return '/uploads/' + String(fileObj.filename);
    if (fileObj.path) return '/uploads/' + path.basename(String(fileObj.path));
    return null;
  };

  const businessPermitRaw = toStoredUploadPath(req.files?.business_permit?.[0]);
  const dtiSecRegRaw      = toStoredUploadPath(req.files?.dti_sec_reg?.[0]);
  const businessPermit = normalizeDocValue(businessPermitRaw);
  const dtiSecReg      = normalizeDocValue(dtiSecRegRaw);
  if (!businessPermit || !dtiSecReg)
    return res.status(400).json({ message: 'Both Business Permit and DTI/SEC Registration are required.' });

  const normalizedEmail = email.toLowerCase().trim();
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [existingCenterByEmail] = await conn.query('SELECT id FROM review_centers WHERE email = ? LIMIT 1', [normalizedEmail]);
    if (existingCenterByEmail.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: 'A review center account already exists for this email.' });
    }

    const [existingUsers] = await conn.query('SELECT id, role FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);
    const hashed = await bcrypt.hash(password, 10);

    let userId;
    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];

      if (existingUser.role !== 'review_center') {
        await conn.rollback();
        return res.status(409).json({ message: 'This email is already used by another account type.' });
      }

      // Recover previously partial review-center signups by reusing/updating the existing user.
      userId = existingUser.id;
      await conn.query(
        `UPDATE users
         SET first_name = ?, last_name = '', password = ?, role = 'review_center', is_verified = 1,
             verify_token = '', reset_token = NULL
         WHERE id = ?`,
        [business_name.trim(), hashed, userId]
      );
    } else {
      const [userResult] = await conn.query(
        `INSERT INTO users (first_name, last_name, email, password, role, is_verified, verify_token, reset_token)
         VALUES (?, '', ?, ?, 'review_center', 1, '', NULL)`,
        [business_name.trim(), normalizedEmail, hashed]
      );
      userId = userResult.insertId;
    }

    const [existingCenterByUser] = await conn.query('SELECT id FROM review_centers WHERE user_id = ? LIMIT 1', [userId]);
    if (existingCenterByUser.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: 'A review center application already exists for this email.' });
    }

    await conn.query(
      `INSERT INTO review_centers (user_id, business_name, email, password, business_permit, dti_sec_reg, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [userId, business_name.trim(), normalizedEmail, hashed, businessPermit, dtiSecReg]
    );

    await conn.commit();
    res.status(201).json({ message: 'Application submitted! Admin will review your documents.' });
  } catch (err) {
    console.error('registerCenter error:', {
      code: err && err.code,
      errno: err && err.errno,
      sqlMessage: err && err.sqlMessage,
      message: err && err.message,
    });
    if (conn) {
      try { await conn.rollback(); } catch (e) {}
    }
    if (err && err.code === 'ER_DATA_TOO_LONG') {
      return res.status(400).json({ message: 'Uploaded document metadata is too long. Please rename the file shorter and try again.' });
    }
    if (err && (err.code === 'ER_BAD_FIELD_ERROR' || err.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD')) {
      return res.status(500).json({ message: 'Database schema is outdated for review center signup. Please restart backend to apply migrations and try again.' });
    }
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Email is already registered.' });
    }
    const code = (err && err.code) ? err.code : 'UNKNOWN';
    res.status(500).json({ message: 'Server error (' + code + '). Please try again.' });
  } finally {
    if (conn) conn.release();
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
  
  // Input validation
  if (!email || !email.trim())
    return res.status(400).json({ message: 'Email is required.' });
  if (!password)
    return res.status(400).json({ message: 'Password is required.' });
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
    try {
      // Log minimal info for debugging without exposing password/hash
      const pwLooksHashed = typeof user.password === 'string' && (user.password.startsWith('$2') || user.password.startsWith('$argon'));
      console.log(`Login attempt: email=${email}, userId=${user.id}, is_verified=${user.is_verified}, role=${user.role}, pwLooksHashed=${pwLooksHashed}, pwLen=${user.password ? user.password.length : 0}`);
    } catch (e) {}

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.warn(`Login failed: bcrypt.compare returned false for userId=${user.id} email=${email}`);
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    const tokenExpires = process.env.JWT_EXPIRES_IN || '7d';
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: tokenExpires }
    );
    // Build a richer user payload so frontend keeps profile images after re-login
    const userPayload = {
      id: user.id,
      name: `${user.first_name} ${user.last_name}`,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
      bio: user.bio || null,
      profile_picture_url: user.profile_picture_url || null,
    };

    // If this is a review center, include center logo/business_name if available
    if (user.role === 'review_center') {
      try {
        const [centerRows] = await db.query('SELECT business_name, logo_url FROM review_centers WHERE user_id = ?', [user.id]);
        if (centerRows && centerRows.length > 0) {
          userPayload.logo_url = centerRows[0].logo_url || null;
          userPayload.business_name = centerRows[0].business_name || userPayload.name;
        }
      } catch (e) {
        // ignore center fetching errors
      }
    }

    res.json({
      message: 'Login successful.',
      token,
      user: userPayload,
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
    await db.query('UPDATE users SET reset_token = ? WHERE email = ?', [token, email]);
    await sendPasswordResetEmail(email, token, rows[0].first_name);
    res.json({ message: 'Password reset link sent to your email.' });
  } catch (err) {
    console.error('Forgot password error:', err);
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

module.exports = { registerStudent, registerCenter, verifyEmail, login, forgotPassword, resetPassword, resendVerification };
