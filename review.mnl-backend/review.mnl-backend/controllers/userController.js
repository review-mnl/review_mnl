const db = require('../config/db');
const bcrypt = require('bcryptjs');
const path = require('path');

const getUploadedFileUrl = (fileObj) => {
  if (!fileObj) return null;
  if (fileObj.secure_url) return String(fileObj.secure_url);
  if (fileObj.url && /^https?:\/\//i.test(String(fileObj.url))) return String(fileObj.url);
  if (fileObj.path && /^https?:\/\//i.test(String(fileObj.path))) return String(fileObj.path);
  if (fileObj.filename) return '/uploads/' + String(fileObj.filename);
  if (fileObj.path) return '/uploads/' + path.basename(String(fileObj.path));
  return null;
};

const toReviewStatus = (reviewStatus, legacyStatus) => {
  if (reviewStatus === 'approved' || reviewStatus === 'rejected' || reviewStatus === 'pending') return reviewStatus;
  if (legacyStatus === 'active') return 'approved';
  if (legacyStatus === 'cancelled') return 'rejected';
  return 'pending';
};

const toSafeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toStartOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const computeEnrollmentPhase = ({ metadata, legacyStatus, reviewStatus, createdAt }) => {
  const now = new Date();
  const normalizedLegacyStatus = String(legacyStatus || '').toLowerCase();
  const normalizedReviewStatus = String(reviewStatus || '').toLowerCase();

  const startCandidate = metadata.schedule_start_date
    || metadata.start_date
    || metadata.enrollment_start_date
    || metadata.enrollment_date
    || metadata.schedule_date;
  const endCandidate = metadata.schedule_end_date
    || metadata.end_date
    || metadata.enrollment_end_date
    || metadata.expiry_date
    || metadata.expires_at;

  const startDate = toSafeDate(startCandidate);
  const endDate = toSafeDate(endCandidate);

  if (startDate && endDate && endDate < startDate) {
    if (startDate > now) return 'upcoming';
    return 'past';
  }

  if (startDate && endDate) {
    if (now < startDate) return 'upcoming';
    if (now > endDate) return 'past';
    return 'current';
  }

  if (startDate && !endDate) {
    const today = toStartOfDay(now);
    const scheduleDay = toStartOfDay(startDate);
    if (scheduleDay > today) return 'upcoming';
    if (scheduleDay < today) return 'past';
    return 'current';
  }

  if (normalizedLegacyStatus === 'active' || normalizedReviewStatus === 'approved') {
    return 'current';
  }

  if (normalizedLegacyStatus === 'cancelled' || normalizedReviewStatus === 'rejected') {
    return 'past';
  }

  const createdDate = toSafeDate(createdAt);
  if (createdDate && toStartOfDay(createdDate) < toStartOfDay(now)) {
    return 'past';
  }

  return 'current';
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

      const normalizedReviewStatus = toReviewStatus(row.review_status, row.enrollment_status);
      const schedulePhase = computeEnrollmentPhase({
        metadata,
        legacyStatus: row.enrollment_status,
        reviewStatus: row.review_status,
        createdAt: row.enrollment_created_at,
      });

      return {
        id: row.enrollment_id,
        enrollment_id: row.enrollment_id,
        user_id: row.user_id,
        review_center_id: row.review_center_id,
        review_center_name: row.review_center_name,
        review_center_logo: row.review_center_logo,
        program_enrolled: metadata.program_enrolled || 'Program not specified',
        teacher: metadata.teacher || metadata.teacher_name || metadata.professor || null,
        teacher_name: metadata.teacher || metadata.teacher_name || metadata.professor || null,
        teacher_from: metadata.teacher_from || null,
        teacher_to: metadata.teacher_to || null,
        teacher_program: metadata.teacher_program || null,
        teacher_label: metadata.teacher_label || null,
        enrollment_date: metadata.enrollment_date || (row.enrollment_created_at ? new Date(row.enrollment_created_at).toISOString().slice(0, 10) : null),
        payment_status: row.payment_status || 'pending',
        payment_method: row.payment_method || 'gcash',
        payment_review_reason: metadata.payment_review_reason || null,
        amount: row.amount || 0,
        review_status: normalizedReviewStatus,
        review_status_display: String(normalizedReviewStatus).replace(/^\w/, (c) => c.toUpperCase()),
        schedule_phase: schedulePhase,
        can_delete: schedulePhase === 'past' && String(row.enrollment_status || '').toLowerCase() !== 'active',
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

const getMyRatings = async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await db.query(
      `SELECT
         ec.center_id,
         rc.business_name AS center_name,
         rc.logo_url AS center_logo,
         cr.rating,
         cr.updated_at AS rated_at,
         t.id AS testimonial_id,
         t.content AS testimonial_content,
         t.rating AS testimonial_rating,
         t.created_at AS testimonial_created_at,
         t.updated_at AS testimonial_updated_at
       FROM (
         SELECT DISTINCT e.center_id
         FROM enrollments e
         WHERE e.user_id = ?
           AND (e.review_status = 'approved' OR e.status = 'active')
       ) ec
       JOIN review_centers rc ON rc.id = ec.center_id
       LEFT JOIN center_ratings cr ON cr.center_id = ec.center_id AND cr.student_id = ?
       LEFT JOIN (
         SELECT t1.id, t1.student_id, t1.center_id, t1.content, t1.rating, t1.created_at, t1.updated_at
         FROM testimonials t1
         JOIN (
           SELECT center_id, MAX(created_at) AS max_created
           FROM testimonials
           WHERE student_id = ? AND is_approved = 1
           GROUP BY center_id
         ) t2 ON t1.center_id = t2.center_id AND t1.created_at = t2.max_created
         WHERE t1.student_id = ? AND t1.is_approved = 1
       ) t ON t.center_id = ec.center_id
       ORDER BY rc.business_name ASC`,
      [userId, userId, userId, userId]
    );

    const reviews = rows.map((row) => ({
      center_id: row.center_id,
      center_name: row.center_name,
      center_logo: row.center_logo,
      rating: row.rating ? Number(row.rating) : null,
      rated_at: row.rated_at || null,
      testimonial_id: row.testimonial_id || null,
      testimonial_content: row.testimonial_content || null,
      testimonial_rating: row.testimonial_rating ? Number(row.testimonial_rating) : null,
      testimonial_created_at: row.testimonial_created_at || null,
      testimonial_updated_at: row.testimonial_updated_at || null,
    }));

    console.log('[Ratings] Fetched rating-eligible centers for user', { userId, count: reviews.length });
    return res.json({ reviews });
  } catch (err) {
    console.error('Get my ratings error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

const upsertMyRating = async (req, res) => {
  try {
    const userId = req.user.id;
    const centerId = Number(req.params.centerId);
    const rating = Number(req.body && req.body.rating);

    if (!Number.isInteger(centerId) || centerId <= 0) {
      return res.status(400).json({ message: 'Invalid review center.' });
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be an integer between 1 and 5.' });
    }

    const [eligibleRows] = await db.query(
      `SELECT id
       FROM enrollments
       WHERE user_id = ?
         AND center_id = ?
         AND (review_status = 'approved' OR status = 'active')
       LIMIT 1`,
      [userId, centerId]
    );

    if (!eligibleRows.length) {
      return res.status(403).json({ message: 'You can only rate review centers where your enrollment is approved.' });
    }

    await db.query(
      `INSERT INTO center_ratings (student_id, center_id, rating)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), updated_at = CURRENT_TIMESTAMP`,
      [userId, centerId, rating]
    );

    const [savedRows] = await db.query(
      `SELECT center_id, rating, updated_at AS rated_at
       FROM center_ratings
       WHERE student_id = ? AND center_id = ?
       LIMIT 1`,
      [userId, centerId]
    );

    console.log('[Ratings] Upserted center rating', { userId, centerId, rating });
    return res.json({
      message: 'Rating saved successfully.',
      review: savedRows[0] || { center_id: centerId, rating, rated_at: null },
    });
  } catch (err) {
    console.error('Upsert my rating error:', err);
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
    const url = getUploadedFileUrl(req.file);
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

module.exports = {
  getMyProfile,
  getMyEnrollments,
  getMyRatings,
  upsertMyRating,
  updateMyProfile,
  updateMyProfilePhoto,
};
