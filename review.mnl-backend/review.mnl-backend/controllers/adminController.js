const db = require('../config/db');
const { sendCenterStatusEmail } = require('../config/mailer');

const getPendingCenters = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, business_name, email, business_permit, dti_sec_reg, status, created_at
       FROM review_centers WHERE status = 'pending' ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

const getAllCenters = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, business_name, email, business_permit, dti_sec_reg, logo_url, status, created_at
       FROM review_centers ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

const updateCenterStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['approved', 'rejected', 'suspended'].includes(status))
    return res.status(400).json({ message: 'Status must be approved, rejected, or suspended.' });
  try {
    const [rows] = await db.query('SELECT * FROM review_centers WHERE id = ?', [id]);
    if (rows.length === 0)
      return res.status(404).json({ message: 'Review center not found.' });
    await db.query('UPDATE review_centers SET status = ? WHERE id = ?', [status, id]);
    // Try to send email notification but don't fail if it errors
    try {
      await sendCenterStatusEmail(rows[0].email, rows[0].business_name, status);
    } catch (emailErr) {
      console.log('Email notification skipped (not configured):', emailErr.message);
    }
    res.json({ message: `Review center ${status} successfully.` });
  } catch (err) {
    console.error('Update center status error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

const getAllStudents = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, first_name, last_name, email, is_verified, created_at
       FROM users WHERE role = 'student' ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT id, role FROM users WHERE id = ? FOR UPDATE', [id]);
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'User not found.' });
    }
    if (rows[0].role === 'superadmin') {
      await conn.rollback();
      return res.status(403).json({ message: 'Cannot delete superadmin account.' });
    }

    // Remove related data explicitly to ensure cleanup across schemas that may not
    // have full cascading rules. Order: sessions, testimonials (as student), centers (if owner), then user.
    try {
      await conn.query('DELETE FROM user_sessions WHERE user_id = ?', [id]);
    } catch (e) { /* ignore */ }

    try {
      await conn.query('DELETE FROM testimonials WHERE student_id = ?', [id]);
    } catch (e) { /* ignore */ }

    // If this user owns a review center, delete the center record(s) which will
    // also remove center-related testimonials via FK cascade where applicable.
    try {
      await conn.query('DELETE FROM review_centers WHERE user_id = ?', [id]);
    } catch (e) { /* ignore */ }

    // Finally delete the user row
    await conn.query('DELETE FROM users WHERE id = ?', [id]);

    await conn.commit();
    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    if (conn) try { await conn.rollback(); } catch (e) {}
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Server error.' });
  } finally {
    if (conn) conn.release();
  }
};

const deleteCenter = async (req, res) => {
  const { id } = req.params;
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT id, user_id FROM review_centers WHERE id = ? FOR UPDATE', [id]);
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Review center not found.' });
    }

    const userId = rows[0].user_id;

    // Delete center (will remove related center testimonials via FK cascade if configured)
    await conn.query('DELETE FROM review_centers WHERE id = ?', [id]);

    // If a linked user account exists, delete it as well (and related data)
    if (userId) {
      try { await conn.query('DELETE FROM user_sessions WHERE user_id = ?', [userId]); } catch (e) {}
      try { await conn.query('DELETE FROM testimonials WHERE student_id = ?', [userId]); } catch (e) {}
      await conn.query('DELETE FROM users WHERE id = ?', [userId]);
    }

    await conn.commit();
    res.json({ message: 'Review center deleted successfully.' });
  } catch (err) {
    if (conn) try { await conn.rollback(); } catch (e) {}
    console.error('Delete center error:', err);
    res.status(500).json({ message: 'Server error.' });
  } finally {
    if (conn) conn.release();
  }
};

const getSiteSettings = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, site_name, maintenance_mode, allow_center_registrations, allow_student_registrations, updated_at FROM site_settings ORDER BY id ASC LIMIT 1'
    );

    if (rows.length) {
      return res.json(rows[0]);
    }

    const defaults = {
      site_name: 'Review.MNL',
      maintenance_mode: 0,
      allow_center_registrations: 1,
      allow_student_registrations: 1,
    };

    const [result] = await db.query(
      'INSERT INTO site_settings (site_name, maintenance_mode, allow_center_registrations, allow_student_registrations) VALUES (?, ?, ?, ?)',
      [defaults.site_name, defaults.maintenance_mode, defaults.allow_center_registrations, defaults.allow_student_registrations]
    );

    return res.json(Object.assign({ id: result.insertId }, defaults));
  } catch (err) {
    console.error('Get site settings error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

const updateSiteSettings = async (req, res) => {
  try {
    const payload = req.body || {};
    const siteName = String(payload.site_name || '').trim() || 'Review.MNL';
    const maintenanceMode = payload.maintenance_mode ? 1 : 0;
    const allowCenters = payload.allow_center_registrations ? 1 : 0;
    const allowStudents = payload.allow_student_registrations ? 1 : 0;

    const [rows] = await db.query('SELECT id FROM site_settings ORDER BY id ASC LIMIT 1');
    if (!rows.length) {
      const [result] = await db.query(
        'INSERT INTO site_settings (site_name, maintenance_mode, allow_center_registrations, allow_student_registrations) VALUES (?, ?, ?, ?)',
        [siteName, maintenanceMode, allowCenters, allowStudents]
      );
      return res.json({
        id: result.insertId,
        site_name: siteName,
        maintenance_mode: maintenanceMode,
        allow_center_registrations: allowCenters,
        allow_student_registrations: allowStudents,
      });
    }

    const settingsId = rows[0].id;
    await db.query(
      'UPDATE site_settings SET site_name = ?, maintenance_mode = ?, allow_center_registrations = ?, allow_student_registrations = ? WHERE id = ?',
      [siteName, maintenanceMode, allowCenters, allowStudents, settingsId]
    );

    return res.json({
      id: settingsId,
      site_name: siteName,
      maintenance_mode: maintenanceMode,
      allow_center_registrations: allowCenters,
      allow_student_registrations: allowStudents,
    });
  } catch (err) {
    console.error('Update site settings error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

const getCenterDocuments = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      'SELECT id, business_name, email, business_permit, dti_sec_reg, status, created_at FROM review_centers WHERE id = ?',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Review center not found.' });
    const c = rows[0];
    const documents = [];
    if (c.business_permit) documents.push({ type: 'business_permit', url: c.business_permit, filename: String(c.business_permit).split('/').pop() });
    if (c.dti_sec_reg) documents.push({ type: 'dti_sec_reg', url: c.dti_sec_reg, filename: String(c.dti_sec_reg).split('/').pop() });
    res.json({ center_id: c.id, business_name: c.business_name, email: c.email, status: c.status, created_at: c.created_at, documents });
  } catch (err) {
    console.error('Get center documents error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = {
  getPendingCenters,
  getAllCenters,
  updateCenterStatus,
  getAllStudents,
  deleteUser,
  deleteCenter,
  getCenterDocuments,
  getSiteSettings,
  updateSiteSettings,
};
