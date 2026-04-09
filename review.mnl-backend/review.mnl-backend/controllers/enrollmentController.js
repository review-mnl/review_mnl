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

module.exports = {
  getCenterEnrollmentsByCenterId,
};
