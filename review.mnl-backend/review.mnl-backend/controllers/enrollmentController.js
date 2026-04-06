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
         e.status,
         e.review_status,
         e.payment_verified,
         e.created_at,
         TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS student_name,
         u.email AS student_email,
         p.amount,
         p.provider,
         p.provider_payment_id AS reference_number,
         p.metadata
       FROM enrollments e
       JOIN users u ON u.id = e.user_id
       JOIN payments p ON p.id = e.payment_id
       WHERE e.center_id = ?
       ORDER BY e.created_at DESC`,
      [centerId]
    );

    const enrollments = rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      status: row.status,
      review_status: row.review_status,
      payment_verified: Boolean(row.payment_verified),
      created_at: row.created_at,
      student_name: row.student_name || row.student_email || 'Student',
      student_email: row.student_email,
      amount: row.amount,
      provider: row.provider,
      reference_number: row.reference_number,
      metadata: row.metadata,
    }));

    return res.json({ enrollments });
  } catch (err) {
    console.error('Get center enrollments by center id error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = {
  getCenterEnrollmentsByCenterId,
};
