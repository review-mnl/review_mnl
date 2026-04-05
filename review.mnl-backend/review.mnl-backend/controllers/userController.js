const db = require('../config/db');
const bcrypt = require('bcryptjs');

const toReviewStatus = (reviewStatus, legacyStatus) => {
  if (reviewStatus === 'approved' || reviewStatus === 'rejected' || reviewStatus === 'pending') return reviewStatus;
  if (legacyStatus === 'active') return 'approved';
  if (legacyStatus === 'cancelled') return 'rejected';
  return 'pending';
};

const getMyProfile = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, first_name, last_name, email, phone, address, bio, profile_picture_url, role, created_at 
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

const getMyEnrollments = async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await db.query(
      `SELECT
         e.id AS enrollment_id,
         e.user_id,
         e.center_id AS review_center_id,
         e.status AS enrollment_status,
         e.review_status,
         e.payment_verified,
         e.created_at AS enrollment_created_at,
         e.reviewed_at,
         rc.business_name AS review_center_name,
         rc.logo_url AS review_center_logo,
         p.amount,
         p.status AS payment_status,
         p.provider AS payment_method,
         p.metadata,
         p.created_at AS payment_created_at,
         (
           SELECT en.message
           FROM enrollment_notifications en
           WHERE en.enrollment_id = e.id
           ORDER BY en.created_at DESC
           LIMIT 1
         ) AS latest_notification,
         (
           SELECT en.created_at
           FROM enrollment_notifications en
           WHERE en.enrollment_id = e.id
           ORDER BY en.created_at DESC
           LIMIT 1
         ) AS latest_notification_at
       FROM enrollments e
       JOIN review_centers rc ON rc.id = e.center_id
       LEFT JOIN payments p ON p.id = e.payment_id
       WHERE e.user_id = ?
       ORDER BY e.created_at DESC`,
      [userId]
    );

    const enrollments = rows.map((row) => {
      let metadata = {};
      try {
        metadata = row.metadata && typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
      } catch (e) {
        metadata = {};
      }

      return {
        enrollment_id: row.enrollment_id,
        user_id: row.user_id,
        review_center_id: row.review_center_id,
        review_center_name: row.review_center_name,
        review_center_logo: row.review_center_logo,
        program_enrolled: metadata.program_enrolled || 'Program not specified',
        enrollment_date: metadata.enrollment_date || (row.enrollment_created_at ? new Date(row.enrollment_created_at).toISOString().slice(0, 10) : null),
        payment_status: row.payment_status || 'pending',
        payment_method: row.payment_method || 'gcash',
        amount: row.amount || 0,
        review_status: toReviewStatus(row.review_status, row.enrollment_status),
        payment_verified: Boolean(row.payment_verified),
        latest_notification: row.latest_notification || null,
        latest_notification_at: row.latest_notification_at || null,
        reviewed_at: row.reviewed_at || null,
        created_at: row.enrollment_created_at,
      };
    });

    console.log('[Enrollment] Fetched enrollments for user', { userId, count: enrollments.length });
    return res.json({ enrollments });
  } catch (err) {
    console.error('Get enrollments error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

const updateMyProfile = async (req, res) => {
  try {
    const { first_name, last_name, phone, address, bio, profile_picture_url, current_password, new_password, email } = req.body;
    // If changing email, ensure uniqueness
    if (email !== undefined) {
      const [existing] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.user.id]);
      if (existing.length > 0) return res.status(409).json({ message: 'Email already in use.' });
    }
    
    // If changing password, verify current password first
    if (new_password) {
      if (!current_password) {
        return res.status(400).json({ message: 'Current password is required to set a new password.' });
      }
      const [userRows] = await db.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
      if (userRows.length === 0) {
        return res.status(404).json({ message: 'User not found.' });
      }
      const isMatch = await bcrypt.compare(current_password, userRows[0].password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Current password is incorrect.' });
      }
      const hashed = await bcrypt.hash(new_password, 10);
      await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);
    }

    // Update profile fields
    const updates = [];
    const values = [];
    
    if (first_name !== undefined) {
      updates.push('first_name = ?');
      values.push(first_name);
    }
    if (last_name !== undefined) {
      updates.push('last_name = ?');
      values.push(last_name);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }
    if (address !== undefined) {
      updates.push('address = ?');
      values.push(address);
    }
    if (bio !== undefined) {
      updates.push('bio = ?');
      values.push(bio);
    }
    if (profile_picture_url !== undefined) {
      updates.push('profile_picture_url = ?');
      values.push(profile_picture_url);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }

    if (updates.length > 0) {
      values.push(req.user.id);
      await db.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    // Get updated profile
    const [rows] = await db.query(
      `SELECT id, first_name, last_name, email, phone, address, bio, profile_picture_url, role, created_at 
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    res.json({ 
      message: 'Profile updated successfully.',
      user: rows[0] 
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

const updateMyProfilePhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const url = req.file.path || req.file.url || req.file.secure_url || null;
    if (!url) return res.status(500).json({ message: 'Upload failed.' });
    await db.query('UPDATE users SET profile_picture_url = ? WHERE id = ?', [url, req.user.id]);
    const [rows] = await db.query(
      `SELECT id, first_name, last_name, email, phone, address, bio, profile_picture_url, role, created_at 
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    res.json({ message: 'Profile photo updated.', user: rows[0] });
  } catch (err) {
    console.error('Update profile photo error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getMyProfile, getMyEnrollments, updateMyProfile, updateMyProfilePhoto };
