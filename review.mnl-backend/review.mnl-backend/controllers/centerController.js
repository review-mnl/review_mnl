const db = require('../config/db');

const getApprovedCenters = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT rc.id, rc.business_name, rc.address, rc.latitude, rc.longitude, rc.logo_url, rc.description, rc.programs,
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
            `SELECT rc.id, rc.business_name, rc.email, rc.address, rc.latitude, rc.longitude, rc.logo_url,
              rc.description, rc.programs, rc.achievements,
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

    let isEnrolled = false;
    if (req.user && req.user.role === 'student') {
      const [enrollment] = await db.query(
        'SELECT id FROM enrollments WHERE user_id = ? AND center_id = ? AND status = "active"',
        [req.user.id, id]
      );
      if (enrollment.length > 0) isEnrolled = true;
    }

    res.json({ ...center[0], testimonials, isEnrolled });
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
      `SELECT rc.id, rc.business_name, rc.address, rc.latitude, rc.longitude, rc.logo_url,
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
      `SELECT rc.id, rc.business_name, rc.address, rc.latitude, rc.longitude, rc.logo_url, rc.description, rc.programs,
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

const updateCenterProfile = async (req, res) => {
  const { business_name, email, address, description, programs, achievements } = req.body;
  const userId = req.user.id;
  try {
    // If email is provided, ensure it's not used by another user
    if (email) {
      const [existingUser] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
      if (existingUser.length > 0) return res.status(409).json({ message: 'Email already in use.' });
      const [existingCenter] = await db.query('SELECT id FROM review_centers WHERE email = ? AND user_id != ?', [email, userId]);
      if (existingCenter.length > 0) return res.status(409).json({ message: 'Email already in use by another center.' });
    }

    const updates = [];
    const vals = [];
    if (business_name !== undefined) { updates.push('business_name = ?'); vals.push(business_name); }
    if (email !== undefined) { updates.push('email = ?'); vals.push(email); }
    if (address !== undefined) { updates.push('address = ?'); vals.push(address); }
    if (description !== undefined) { updates.push('description = ?'); vals.push(description); }
    if (programs !== undefined) { updates.push('programs = ?'); vals.push(JSON.stringify(programs)); }
    if (achievements !== undefined) { updates.push('achievements = ?'); vals.push(JSON.stringify(achievements)); }

    if (updates.length > 0) {
      vals.push(userId);
      await db.query(`UPDATE review_centers SET ${updates.join(', ')} WHERE user_id = ?`, vals);
    }

    // Also keep users table in sync (first_name used for business_name)
    const uUpdates = [];
    const uVals = [];
    if (business_name !== undefined) { uUpdates.push('first_name = ?'); uVals.push(business_name); }
    if (email !== undefined) { uUpdates.push('email = ?'); uVals.push(email); }
    if (uUpdates.length > 0) {
      uVals.push(userId);
      await db.query(`UPDATE users SET ${uUpdates.join(', ')} WHERE id = ?`, uVals);
    }

    // Return updated center profile
    const [rows] = await db.query(
      `SELECT rc.id, rc.business_name, rc.email, rc.address, rc.logo_url, rc.description,
              rc.programs, rc.achievements,
              IFNULL(AVG(t.rating), 0) AS avg_rating, COUNT(t.id) AS review_count
       FROM review_centers rc
       LEFT JOIN testimonials t ON t.center_id = rc.id AND t.is_approved = 1
       WHERE rc.user_id = ? GROUP BY rc.id`,
      [userId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Center not found.' });
    const center = rows[0];
    // Parse JSON fields if they exist
    if (center.programs && typeof center.programs === 'string') {
      try { center.programs = JSON.parse(center.programs); } catch(e) { center.programs = []; }
    }
    if (center.achievements && typeof center.achievements === 'string') {
      try { center.achievements = JSON.parse(center.achievements); } catch(e) { center.achievements = []; }
    }
    res.json(center);
  } catch (err) {
    console.error('Update center profile error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

const updateCenterLogo = async (req, res) => {
  const userId = req.user.id;
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const url = req.file.path || req.file.url || req.file.secure_url || null;
    if (!url) return res.status(500).json({ message: 'Upload failed.' });

    await db.query('UPDATE review_centers SET logo_url = ? WHERE user_id = ?', [url, userId]);

    const [rows] = await db.query(
      `SELECT rc.id, rc.business_name, rc.email, rc.address, rc.logo_url,
              IFNULL(AVG(t.rating), 0) AS avg_rating, COUNT(t.id) AS review_count
       FROM review_centers rc
       LEFT JOIN testimonials t ON t.center_id = rc.id AND t.is_approved = 1
       WHERE rc.user_id = ? GROUP BY rc.id`,
      [userId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Center not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Update center logo error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

const getMyCenterProfile = async (req, res) => {
  const userId = req.user.id;
  try {
    const [rows] = await db.query(
      `SELECT rc.id, rc.business_name, rc.email, rc.address, rc.logo_url, rc.description,
              rc.programs, rc.achievements,
              IFNULL(AVG(t.rating), 0) AS avg_rating, COUNT(t.id) AS review_count
       FROM review_centers rc
       LEFT JOIN testimonials t ON t.center_id = rc.id AND t.is_approved = 1
       WHERE rc.user_id = ? GROUP BY rc.id`,
      [userId]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'Center not found.' });
    const center = rows[0];
    // Parse JSON fields if they exist
    if (center.programs && typeof center.programs === 'string') {
      try { center.programs = JSON.parse(center.programs); } catch(e) { center.programs = []; }
    }
    if (center.achievements && typeof center.achievements === 'string') {
      try { center.achievements = JSON.parse(center.achievements); } catch(e) { center.achievements = []; }
    }
    res.json(center);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getApprovedCenters, getCenterById, getCentersNearby, searchCenters, updateCenterLocation, updateCenterProfile, updateCenterLogo, getMyCenterProfile };
