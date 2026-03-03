const db = require('../config/db');

const getApprovedCenters = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT rc.id, rc.business_name, rc.address, rc.latitude, rc.longitude,
              IFNULL(AVG(t.rating), 0) AS avg_rating,
              COUNT(t.id) AS review_count
       FROM review_centers rc
       LEFT JOIN testimonials t ON t.center_id = rc.id AND t.is_approved = 1
       WHERE rc.status = 'approved'
       GROUP BY rc.id ORDER BY avg_rating DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

const getCenterById = async (req, res) => {
  const { id } = req.params;
  try {
    const [center] = await db.query(
      `SELECT rc.id, rc.business_name, rc.email, rc.address, rc.latitude, rc.longitude,
              IFNULL(AVG(t.rating), 0) AS avg_rating, COUNT(t.id) AS review_count
       FROM review_centers rc
       LEFT JOIN testimonials t ON t.center_id = rc.id AND t.is_approved = 1
       WHERE rc.id = ? AND rc.status = 'approved' GROUP BY rc.id`, [id]
    );
    if (center.length === 0)
      return res.status(404).json({ message: 'Review center not found.' });
    const [testimonials] = await db.query(
      `SELECT t.id, t.content, t.rating, t.created_at, u.first_name, u.last_name
       FROM testimonials t JOIN users u ON u.id = t.student_id
       WHERE t.center_id = ? AND t.is_approved = 1 ORDER BY t.created_at DESC`, [id]
    );
    res.json({ ...center[0], testimonials });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

const getCentersNearby = async (req, res) => {
  const { lat, lng, radius = 10 } = req.query;
  if (!lat || !lng)
    return res.status(400).json({ message: 'Latitude and longitude are required.' });
  try {
    const [rows] = await db.query(
      `SELECT rc.id, rc.business_name, rc.address, rc.latitude, rc.longitude,
              IFNULL(AVG(t.rating), 0) AS avg_rating, COUNT(t.id) AS review_count,
              (6371 * ACOS(
                COS(RADIANS(?)) * COS(RADIANS(rc.latitude)) *
                COS(RADIANS(rc.longitude) - RADIANS(?)) +
                SIN(RADIANS(?)) * SIN(RADIANS(rc.latitude))
              )) AS distance_km
       FROM review_centers rc
       LEFT JOIN testimonials t ON t.center_id = rc.id AND t.is_approved = 1
       WHERE rc.status = 'approved' AND rc.latitude IS NOT NULL
       GROUP BY rc.id HAVING distance_km <= ? ORDER BY distance_km ASC`,
      [lat, lng, lat, radius]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

const searchCenters = async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ message: 'Search query is required.' });
  try {
    const [rows] = await db.query(
      `SELECT rc.id, rc.business_name, rc.address, rc.latitude, rc.longitude,
              IFNULL(AVG(t.rating), 0) AS avg_rating, COUNT(t.id) AS review_count
       FROM review_centers rc
       LEFT JOIN testimonials t ON t.center_id = rc.id AND t.is_approved = 1
       WHERE rc.status = 'approved' AND rc.business_name LIKE ?
       GROUP BY rc.id ORDER BY avg_rating DESC`,
      [`%${q}%`]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

const updateCenterLocation = async (req, res) => {
  const { latitude, longitude, address } = req.body;
  const userId = req.user.id;
  try {
    await db.query(
      'UPDATE review_centers SET latitude = ?, longitude = ?, address = ? WHERE user_id = ?',
      [latitude, longitude, address, userId]
    );
    res.json({ message: 'Location updated successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getApprovedCenters, getCenterById, getCentersNearby, searchCenters, updateCenterLocation };
