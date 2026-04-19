const db = require('../config/db');

const toSafeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseMetadata = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
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

  const createdDate = toSafeDate(createdAt);
  if (createdDate && toStartOfDay(createdDate) < toStartOfDay(now)) {
    return 'past';
  }

  if (createdDate && toStartOfDay(createdDate) > toStartOfDay(now)) {
    return 'upcoming';
  }

  if (normalizedLegacyStatus === 'cancelled' || normalizedReviewStatus === 'rejected') {
    return 'past';
  }

  if (normalizedLegacyStatus === 'active' || normalizedReviewStatus === 'approved') {
    return 'current';
  }

  return 'current';
};

const getCenterEnrollmentsByCenterId = async (req, res) => {
  try {
    const centerId = Number(req.params.centerId);
    const userId = req.user.id;

    if (!Number.isInteger(centerId) || centerId <= 0) {
      return res.status(400).json({ message: 'Invalid center id.' });
    }

    const [centerRows] = await db.query(
      'SELECT id FROM review_centers WHERE id = ? AND user_id = ?',
      [centerId, userId]
    );

    if (!centerRows.length) {
      return res.status(403).json({ message: 'You can only access enrollments for your own review center.' });
    }

    const [rows] = await db.query(
      `SELECT
         e.id,
         e.user_id,
         e.center_id AS review_center_id,
         rc.business_name AS review_center_name,
         e.status,
         e.review_status,
         e.payment_verified,
         e.created_at,
         TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS student_name,
         u.email AS student_email,
         p.amount,
         p.provider,
         p.status AS payment_status,
         p.provider_payment_id AS reference_number,
         p.metadata
       FROM enrollments e
       JOIN review_centers rc ON rc.id = e.center_id
       JOIN users u ON u.id = e.user_id
       LEFT JOIN payments p ON p.id = e.payment_id
       WHERE e.center_id = ?
       ORDER BY e.created_at DESC`,
      [centerId]
    );

    const enrollments = rows.map((row) => {
      let metadata = {};
      try {
        metadata = row.metadata && typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
      } catch (e) {
        metadata = {};
      }

      const reviewStatus = String(row.review_status || '').toLowerCase();
      const normalizedStatus = reviewStatus === 'approved'
        ? 'approved'
        : reviewStatus === 'rejected'
          ? 'rejected'
          : 'pending';
      const studentName = row.student_name || row.student_email || 'Student';

      return {
        enrollmentId: row.id,
        id: row.id,
        studentId: row.user_id,
        user_id: row.user_id,
        studentName,
        student_name: studentName,
        student_email: row.student_email,
        reviewCenterId: row.review_center_id,
        review_center_id: row.review_center_id,
        reviewCenterName: row.review_center_name,
        review_center_name: row.review_center_name,
        program: metadata.program_enrolled || 'Program not specified',
        program_enrolled: metadata.program_enrolled || 'Program not specified',
        paymentStatus: row.payment_status || 'pending',
        payment_status: row.payment_status || 'pending',
        enrollmentStatus: normalizedStatus,
        status: row.status,
        review_status: normalizedStatus,
        payment_verified: Boolean(row.payment_verified),
        createdAt: row.created_at,
        created_at: row.created_at,
        amount: row.amount,
        provider: row.provider,
        reference_number: row.reference_number,
        student_reference_number: (metadata && (metadata.reference_number || metadata.student_reference_number)) || row.reference_number || null,
        site_reference: (metadata && metadata.site_reference) || null,
        metadata,
      };
    });

    console.log('[Enrollment] Fetched center enrollments', {
      reviewCenterId: centerId,
      reviewCenterUserId: userId,
      count: enrollments.length,
      sampleReviewCenterId: enrollments[0] ? enrollments[0].review_center_id : null,
    });

    return res.json({ enrollments });
  } catch (err) {
    console.error('Get center enrollments by center id error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

const deleteMyEnrollment = async (req, res) => {
  let conn;
  try {
    const enrollmentId = Number(req.params.id);
    const userId = req.user.id;

    if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) {
      return res.status(400).json({ message: 'Invalid enrollment id.' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT e.id, e.user_id, e.status, e.review_status, e.created_at,
              p.metadata
       FROM enrollments e
       LEFT JOIN payments p ON p.id = e.payment_id
       WHERE e.id = ? AND e.user_id = ?
       FOR UPDATE`,
      [enrollmentId, userId]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Enrollment not found.' });
    }

    const enrollment = rows[0];
    const metadata = parseMetadata(enrollment.metadata);
    const phase = computeEnrollmentPhase({
      metadata,
      legacyStatus: enrollment.status,
      reviewStatus: enrollment.review_status,
      createdAt: enrollment.created_at,
    });

    console.log('[Enrollment][Delete] Phase check', {
      enrollmentId,
      userId,
      enrollmentDate: metadata.enrollment_date || null,
      createdAt: enrollment.created_at,
      reviewStatus: enrollment.review_status,
      legacyStatus: enrollment.status,
      phase,
    });

    if (phase === 'current' || phase === 'upcoming') {
      await conn.rollback();
      console.warn('[Enrollment][Delete] Blocked by restriction', {
        enrollmentId,
        userId,
        phase,
      });
      return res.status(409).json({
        message: 'Cannot delete current or upcoming enrollment.',
        schedule_phase: phase,
      });
    }

    await conn.query('DELETE FROM enrollment_notifications WHERE enrollment_id = ?', [enrollmentId]);
    await conn.query('DELETE FROM chat_messages WHERE enrollment_id = ?', [enrollmentId]);
    await conn.query('DELETE FROM enrollments WHERE id = ? AND user_id = ?', [enrollmentId, userId]);

    await conn.commit();
    console.log('[Enrollment][Delete] Deleted successfully', {
      enrollmentId,
      userId,
      phase,
    });
    return res.json({
      message: 'Enrollment deleted successfully.',
      enrollment_id: enrollmentId,
      schedule_phase: phase,
    });
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (e) {}
    }
    console.error('Delete enrollment error:', err);
    return res.status(500).json({ message: 'Server error.' });
  } finally {
    if (conn) {
      try { conn.release(); } catch (e) {}
    }
  }
};

module.exports = {
  getCenterEnrollmentsByCenterId,
  deleteMyEnrollment,
};
