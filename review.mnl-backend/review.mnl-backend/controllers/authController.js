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

const getRequiredNoDefaultColumns = async (conn, tableName) => {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, EXTRA
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND IS_NULLABLE = 'NO'
       AND COLUMN_DEFAULT IS NULL`,
    [tableName]
  );
  return rows.filter((r) => !String(r.EXTRA || '').toLowerCase().includes('auto_increment'));
};

const fallbackValueForColumn = (col) => {
  const dataType = String(col.DATA_TYPE || '').toLowerCase();
  const columnType = String(col.COLUMN_TYPE || '').toLowerCase();

  if (dataType === 'enum') {
    const m = columnType.match(/^enum\((.+)\)$/i);
    if (m && m[1]) {
      const first = m[1].split(',')[0].trim();
      return first.replace(/^'+|'+$/g, '');
    }
    return '';
  }
  if (dataType === 'json') return '[]';
  if (['tinyint', 'smallint', 'mediumint', 'int', 'bigint', 'decimal', 'float', 'double'].includes(dataType)) return 0;
  if (['date', 'datetime', 'timestamp'].includes(dataType)) return new Date();
  if (dataType === 'time') return '00:00:00';
  return '';
};

const insertWithLegacyRequiredColumns = async (conn, tableName, valuesMap) => {
  const requiredCols = await getRequiredNoDefaultColumns(conn, tableName);
  requiredCols.forEach((col) => {
    if (!(col.COLUMN_NAME in valuesMap)) {
      valuesMap[col.COLUMN_NAME] = fallbackValueForColumn(col);
    }
  });

  const cols = Object.keys(valuesMap);
  const placeholders = cols.map(() => '?').join(', ');
  const vals = cols.map((c) => valuesMap[c]);
  const sql = `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`;
  return conn.query(sql, vals);
};

const getSiteSettings = async () => {
  try {
    const [rows] = await db.query(
      'SELECT site_name, maintenance_mode, allow_center_registrations, allow_student_registrations FROM site_settings ORDER BY id ASC LIMIT 1'
    );
    if (rows.length) return rows[0];
  } catch (e) {
    // ignore and use defaults
  }
  return {
    site_name: 'Review.MNL',
    maintenance_mode: 0,
    allow_center_registrations: 1,
    allow_student_registrations: 1,
  };
};

const registerStudent = async (req, res) => {
  const { fullname, email, password } = req.body;

  try {
    const settings = await getSiteSettings();
    if (Number(settings.maintenance_mode) === 1) {
      return res.status(403).json({ message: 'Registrations are temporarily paused due to maintenance.' });
    }
    if (Number(settings.allow_student_registrations) === 0) {
      return res.status(403).json({ message: 'Student signups are currently closed.' });
    }
  } catch (e) {
    // ignore settings errors and continue
  }
  
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
  const normalizedEmail = email.toLowerCase().trim();
  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length > 0)
      return res.status(409).json({ message: 'Email is already registered.' });
    const hashed = await bcrypt.hash(password, 10);
    const token  = crypto.randomBytes(32).toString('hex');
    await db.query(
      `INSERT INTO users (first_name, last_name, email, password, role, verify_token)
       VALUES (?, ?, ?, ?, 'student', ?)`,
      [first_name, last_name, normalizedEmail, hashed, token]
    );
    await sendVerificationEmail(normalizedEmail, token, first_name);
    res.status(201).json({ message: 'Account created! Please check your email to verify.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

const registerCenter = async (req, res) => {
  const { business_name, email, password } = req.body;

  try {
    const settings = await getSiteSettings();
    if (Number(settings.maintenance_mode) === 1) {
      return res.status(403).json({ message: 'Registrations are temporarily paused due to maintenance.' });
    }
    if (Number(settings.allow_center_registrations) === 0) {
      return res.status(403).json({ message: 'Review center registrations are currently closed.' });
    }
  } catch (e) {
    // ignore settings errors and continue
  }
  
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
      const [userResult] = await insertWithLegacyRequiredColumns(conn, 'users', {
        first_name: business_name.trim(),
        last_name: '',
        email: normalizedEmail,
        password: hashed,
        role: 'review_center',
        is_verified: 1,
        verify_token: '',
        reset_token: null,
        created_at: new Date(),
      });
      userId = userResult.insertId;
    }

    const [existingCenterByUser] = await conn.query('SELECT id FROM review_centers WHERE user_id = ? LIMIT 1', [userId]);
    if (existingCenterByUser.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: 'A review center application already exists for this email.' });
    }

    await insertWithLegacyRequiredColumns(conn, 'review_centers', {
      user_id: userId,
      business_name: business_name.trim(),
      email: normalizedEmail,
      password: hashed,
      business_permit: businessPermit,
      dti_sec_reg: dtiSecReg,
      status: 'pending',
      created_at: new Date(),
    });

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
    const normalizedEmail = email.toLowerCase().trim();
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    if (rows.length === 0)
      return res.status(401).json({ message: 'Invalid email or password.' });
    const user = rows[0];
    if (!user.is_verified)
      return res.status(403).json({ message: 'Please verify your email first.' });
    var centerStatus = null;
    if (user.role === 'review_center') {
      const [center] = await db.query('SELECT status FROM review_centers WHERE user_id = ?', [user.id]);
      centerStatus = center[0]?.status || null;
      if (centerStatus === 'pending')
        return res.status(403).json({ message: 'Your account is still pending admin approval.' });
      if (centerStatus === 'rejected')
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
    // Record last_login and insert a session record (non-blocking if it fails)
    try {
      const ipRaw = req.headers['x-forwarded-for'] || req.ip || '';
      const ip = String(ipRaw).split(',')[0].trim() || null;
      const ua = req.get('User-Agent') || null;
      await db.query('UPDATE users SET last_login = ? WHERE id = ?', [new Date(), user.id]);
      if (user.role === 'review_center') {
        try { await db.query('UPDATE review_centers SET last_login = ? WHERE user_id = ?', [new Date(), user.id]); } catch (e) {}
      }
      await db.query('INSERT INTO user_sessions (user_id, role, ip, user_agent) VALUES (?, ?, ?, ?)', [user.id, user.role, ip, ua]);
    } catch (e) {
      console.warn('Failed to write login session:', e && e.message);
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
        const [centerRows] = await db.query('SELECT business_name, logo_url, status FROM review_centers WHERE user_id = ?', [user.id]);
        if (centerRows && centerRows.length > 0) {
          userPayload.logo_url = centerRows[0].logo_url || null;
          userPayload.business_name = centerRows[0].business_name || userPayload.name;
          userPayload.status = centerRows[0].status || null;
          centerStatus = centerRows[0].status || centerStatus;
        }
      } catch (e) {
        // ignore center fetching errors
      }
      if (!('status' in userPayload)) userPayload.status = centerStatus || null;
    }

    const suspended = (user.role === 'review_center' && String(centerStatus || '').toLowerCase() === 'suspended');

    res.json({
      message: suspended
        ? 'Your account is currently suspended by the administrator.'
        : 'Login successful.',
      success: true,
      suspended,
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
