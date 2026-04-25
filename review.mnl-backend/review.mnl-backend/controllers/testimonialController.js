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
  // Only students who are enrolled may submit testimonials
  try {
    if (!req.user || String(req.user.role || '').toLowerCase() !== 'student') {
      return res.status(403).json({ message: 'Only enrolled students can submit reviews.' });
    }
  } catch (e) {
    // continue to regular error handling below
  }
  try {
    const [center] = await db.query(
      "SELECT id FROM review_centers WHERE id = ? AND status = 'approved'", [center_id]
    );
    if (center.length === 0)
      return res.status(404).json({ message: 'Review center not found.' });

    // Verify enrollment: require an active enrollment or an approved review_status
    const [enrollRows] = await db.query(
      'SELECT id FROM enrollments WHERE user_id = ? AND center_id = ? AND (status = "active" OR review_status = "approved")',
      [student_id, center_id]
    );
    if (!enrollRows || enrollRows.length === 0) {
      return res.status(403).json({ message: 'Only enrolled students can submit reviews for this center.' });
    }

    const [insertResult] = await db.query(
      `INSERT INTO testimonials (student_id, center_id, content, rating, is_approved)
       VALUES (?, ?, ?, ?, 1)`,
      [student_id, center_id, String(content).trim(), parsedRating]
    );

    try {
      await db.query(
        `INSERT INTO center_ratings (student_id, center_id, rating)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE rating = VALUES(rating), updated_at = CURRENT_TIMESTAMP`,
        [student_id, center_id, parsedRating]
      );
    } catch (e) {
      // Rating sync is best-effort; do not fail testimonial creation.
    }

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
  const { id } = req.params;
  try {
    await db.query('DELETE FROM testimonials WHERE id = ?', [id]);
    res.json({ message: 'Testimonial deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

const updateTestimonial = async (req, res) => {
  const testimonialId = Number(req.params.testimonialId || req.params.id || 0);
  const centerId = Number(req.params.id || req.body.center_id || 0);
  const studentId = req.user.id;
  const content = String((req.body && req.body.content) || '').trim();
  const parsedRating = Number(req.body && req.body.rating);

  if (!testimonialId || testimonialId <= 0) {
    return res.status(400).json({ message: 'Invalid testimonial id.' });
  }
  if (!centerId || centerId <= 0) {
    return res.status(400).json({ message: 'Invalid review center.' });
  }
  if (!content) {
    return res.status(400).json({ message: 'Review content is required.' });
  }
  if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
  }

  try {
    const [rows] = await db.query(
      `SELECT id, student_id, center_id, created_at, updated_at
       FROM testimonials
       WHERE id = ? AND center_id = ?
       LIMIT 1`,
      [testimonialId, centerId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Review not found.' });
    const row = rows[0];
    if (Number(row.student_id) !== Number(studentId)) {
      return res.status(403).json({ message: 'You can only edit your own review.' });
    }

    const lastEditAt = row.updated_at || row.created_at;
    const lastEditTime = lastEditAt ? new Date(lastEditAt).getTime() : 0;
    const now = Date.now();
    const cooldownMs = 3 * 24 * 60 * 60 * 1000;
    if (lastEditTime && now - lastEditTime < cooldownMs) {
      const remainingMs = cooldownMs - (now - lastEditTime);
      const remainingHours = Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));
      return res.status(429).json({ message: 'You can edit your review again in ' + remainingHours + ' hour(s).' });
    }

    await db.query(
      `UPDATE testimonials
       SET content = ?, rating = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [content, parsedRating, testimonialId]
    );

    try {
      await db.query(
        `INSERT INTO center_ratings (student_id, center_id, rating)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE rating = VALUES(rating), updated_at = CURRENT_TIMESTAMP`,
        [studentId, centerId, parsedRating]
      );
    } catch (e) {
      // Rating sync is best-effort.
    }

    const [updatedRows] = await db.query(
      `SELECT id, content, rating, created_at, updated_at
       FROM testimonials
       WHERE id = ?
       LIMIT 1`,
      [testimonialId]
    );

    res.json({ message: 'Review updated successfully.', testimonial: updatedRows[0] || null });
  } catch (err) {
    console.error('Update testimonial error:', err);
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
      `SELECT t.id, t.center_id, t.student_id, t.content, t.rating, t.created_at, t.updated_at,
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
