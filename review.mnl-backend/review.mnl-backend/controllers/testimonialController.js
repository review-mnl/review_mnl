const db = require('../config/db');

const postTestimonial = async (req, res) => {
  const center_id = req.params.id || req.body.center_id;
  const { content, rating } = req.body;
  const student_id = req.user.id;
  const parsedRating = Number(rating);
  if (!content || !String(content).trim() || !center_id || !Number.isFinite(parsedRating)) {
    return res.status(400).json({ message: 'Rating and feedback are required.' });
  }
  if (parsedRating < 1 || parsedRating > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
  }
  try {
    const [center] = await db.query(
      "SELECT id FROM review_centers WHERE id = ? AND status = 'approved'", [center_id]
    );
    if (center.length === 0)
      return res.status(404).json({ message: 'Review center not found.' });

    const [insertResult] = await db.query(
      `INSERT INTO testimonials (student_id, center_id, content, rating, is_approved)
       VALUES (?, ?, ?, ?, 1)`,
      [student_id, center_id, String(content).trim(), parsedRating]
    );

    const [rows] = await db.query(
      `SELECT t.id, t.content, t.rating, t.created_at, u.first_name, u.last_name
       FROM testimonials t
       JOIN users u ON u.id = t.student_id
       WHERE t.id = ? LIMIT 1`,
      [insertResult.insertId]
    );

    res.status(201).json({
      message: 'Feedback submitted successfully.',
      testimonial: rows[0] || null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

const getPendingTestimonials = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.id, t.content, t.rating, t.created_at,
              u.first_name, u.last_name, rc.business_name
       FROM testimonials t
       JOIN users u ON u.id = t.student_id
       JOIN review_centers rc ON rc.id = t.center_id
       WHERE t.is_approved = 0 ORDER BY t.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

const approveTestimonial = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('UPDATE testimonials SET is_approved = 1 WHERE id = ?', [id]);
    res.json({ message: 'Testimonial approved.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

const deleteTestimonial = async (req, res) => {
  const { testimonialId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    // Get the testimonial to check who created it
    const [testimonial] = await db.query(
      'SELECT id, student_id FROM testimonials WHERE id = ?',
      [testimonialId]
    );

    if (testimonial.length === 0) {
      return res.status(404).json({ message: 'Testimonial not found.' });
    }

    // Only the creator or an admin can delete
    if (testimonial[0].student_id !== userId && userRole !== 'superadmin' && userRole !== 'admin') {
      return res.status(403).json({ message: 'You can only delete your own testimonials.' });
    }

    await db.query('DELETE FROM testimonials WHERE id = ?', [testimonialId]);
    res.json({ message: 'Testimonial deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

const updateTestimonial = async (req, res) => {
  const { testimonialId } = req.params;
  const { content, rating } = req.body;
  const userId = req.user.id;

  if (!content || !String(content).trim()) {
    return res.status(400).json({ message: 'Review content is required.' });
  }

  const parsedRating = Number(rating);
  if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
  }

  try {
    // Get the testimonial to check who created it
    const [testimonial] = await db.query(
      'SELECT id, student_id FROM testimonials WHERE id = ?',
      [testimonialId]
    );

    if (testimonial.length === 0) {
      return res.status(404).json({ message: 'Testimonial not found.' });
    }

    // Only the creator can edit their own testimonial
    if (testimonial[0].student_id !== userId) {
      return res.status(403).json({ message: 'You can only edit your own testimonials.' });
    }

    // Update the testimonial
    await db.query(
      'UPDATE testimonials SET content = ?, rating = ?, updated_at = NOW() WHERE id = ?',
      [String(content).trim(), parsedRating, testimonialId]
    );

    // Return updated testimonial
    const [updated] = await db.query(
      `SELECT t.id, t.content, t.rating, t.created_at, t.updated_at, u.first_name, u.last_name
       FROM testimonials t
       JOIN users u ON u.id = t.student_id
       WHERE t.id = ? LIMIT 1`,
      [testimonialId]
    );

    res.json({
      message: 'Testimonial updated successfully.',
      testimonial: updated[0] || null
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

const getMyCenterTestimonials = async (req, res) => {
  const userId = req.user.id;
  const sort = String(req.query.sort || 'latest').toLowerCase();

  let orderBy = 't.created_at DESC';
  if (sort === 'highest') orderBy = 't.rating DESC, t.created_at DESC';
  if (sort === 'lowest') orderBy = 't.rating ASC, t.created_at DESC';

  try {
    const [centerRows] = await db.query('SELECT id FROM review_centers WHERE user_id = ? LIMIT 1', [userId]);
    if (centerRows.length === 0) {
      return res.status(404).json({ message: 'Review center not found.' });
    }

    const centerId = centerRows[0].id;
    const [rows] = await db.query(
      `SELECT t.id, t.center_id, t.content, t.rating, t.created_at,
              u.first_name, u.last_name,
              CONCAT(COALESCE(u.first_name, ''), CASE WHEN u.last_name IS NULL OR u.last_name = '' THEN '' ELSE ' ' END, COALESCE(u.last_name, '')) AS username
       FROM testimonials t
       JOIN users u ON u.id = t.student_id
       WHERE t.center_id = ? AND t.is_approved = 1
       ORDER BY ${orderBy}`,
      [centerId]
    );

    res.json({ centerId, testimonials: rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { postTestimonial, getPendingTestimonials, approveTestimonial, deleteTestimonial, updateTestimonial, getMyCenterTestimonials };
