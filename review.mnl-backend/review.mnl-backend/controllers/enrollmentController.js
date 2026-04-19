const db = require('../config/db');

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

const extractScheduleDate = (metadata) => {
  if (!metadata || typeof metadata !== 'object') return null;
  const keys = [
    'review_schedule_date',
    'review_date',
    'schedule_date',
    'scheduled_date',
    'session_date',
    'review_schedule',
    'review_datetime',
    'session_start',
    'session_start_date',
    'class_start_date',
    'start_date'
  ];
  for (const k of keys) {
    if (metadata[k]) {
      const d = new Date(metadata[k]);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
};

const deleteEnrollment = async (req, res) => {
  try {
    const enrollmentId = Number(req.params.id);
    const userId = req.user && req.user.id;

    if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) {
      return res.status(400).json({ message: 'Invalid enrollment id.' });
    }
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }

    const [rows] = await db.query(
      `SELECT e.id, e.user_id, e.review_status, e.created_at, p.metadata AS payment_metadata
       FROM enrollments e
       LEFT JOIN payments p ON p.id = e.payment_id
       WHERE e.id = ? AND e.user_id = ?
       LIMIT 1`,
      [enrollmentId, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Enrollment not found.' });
    }

    let metadata = {};
    try {
      metadata = rows[0].payment_metadata && typeof rows[0].payment_metadata === 'string'
        ? JSON.parse(rows[0].payment_metadata)
        : (rows[0].payment_metadata || {});
    } catch (e) {
      metadata = {};
    }

    const scheduleDate = extractScheduleDate(metadata);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (scheduleDate) {
      const d = new Date(scheduleDate);
      d.setHours(0, 0, 0, 0);
      if (d >= today) {
        return res.status(400).json({ message: 'Cannot delete upcoming or today enrollments.' });
      }
    } else {
      const reviewStatus = String(rows[0].review_status || '').toLowerCase();
      if (reviewStatus !== 'approved' && reviewStatus !== 'rejected') {
        return res.status(400).json({ message: 'Cannot delete upcoming or today enrollments.' });
      }
    }

    await db.query('DELETE FROM enrollments WHERE id = ? AND user_id = ?', [enrollmentId, userId]);
    return res.json({ message: 'Enrollment deleted.' });
  } catch (err) {
    console.error('Delete enrollment error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = {
  getCenterEnrollmentsByCenterId,
  deleteEnrollment,
};
