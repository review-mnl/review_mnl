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
      `SELECT id, business_name, email, status, created_at
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
  try {
    const [rows] = await db.query('SELECT id, role FROM users WHERE id = ?', [id]);
    if (rows.length === 0)
      return res.status(404).json({ message: 'User not found.' });
    if (rows[0].role === 'superadmin')
      return res.status(403).json({ message: 'Cannot delete superadmin account.' });
    await db.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

const deleteCenter = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT id, user_id FROM review_centers WHERE id = ?', [id]);
    if (rows.length === 0)
      return res.status(404).json({ message: 'Review center not found.' });
    // Delete the center and associated user account
    await db.query('DELETE FROM review_centers WHERE id = ?', [id]);
    if (rows[0].user_id) {
      await db.query('DELETE FROM users WHERE id = ?', [rows[0].user_id]);
    }
    res.json({ message: 'Review center deleted successfully.' });
  } catch (err) {
    console.error('Delete center error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getPendingCenters, getAllCenters, updateCenterStatus, getAllStudents, deleteUser, deleteCenter };
