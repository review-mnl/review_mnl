const db = require('../config/db');

const postTestimonial = async (req, res) => {
  const center_id = req.params.id || req.body.center_id;
  const { content, rating } = req.body;
  const student_id = req.user.id;
  if (!content || !center_id)
    return res.status(400).json({ message: 'Content and center_id are required.' });
  try {
    const [center] = await db.query(
      "SELECT id FROM review_centers WHERE id = ? AND status = 'approved'", [center_id]
    );
    if (center.length === 0)
      return res.status(404).json({ message: 'Review center not found.' });
    await db.query(
      `INSERT INTO testimonials (student_id, center_id, content, rating, is_approved)
       VALUES (?, ?, ?, ?, 0)`,
      [student_id, center_id, content, rating || null]
    );
    res.status(201).json({ message: 'Testimonial submitted! It will appear after admin review.' });
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

module.exports = { postTestimonial, getPendingTestimonials, approveTestimonial, deleteTestimonial };
