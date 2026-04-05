const db = require('../config/db');

const normalizeStatus = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'approved' || s === 'rejected' || s === 'pending') return s;
  return null;
};

const buildDefaultMessage = (status) => {
  if (status === 'approved') return 'Your enrollment has been approved.';
  if (status === 'rejected') return 'Your enrollment has been rejected.';
  return 'Your enrollment is pending review.';
};

const createNotification = async (req, res) => {
  let conn;
  try {
    const actorRole = req.user && req.user.role;
    if (!actorRole || !['review_center', 'admin', 'superadmin'].includes(actorRole)) {
      return res.status(403).json({ message: 'Not allowed to create notifications.' });
    }

    const userId = Number(req.body && req.body.user_id);
    const enrollmentId = Number(req.body && req.body.enrollment_id);
    const status = normalizeStatus(req.body && req.body.status);
    const message = String((req.body && req.body.message) || '').trim();

    if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(enrollmentId) || enrollmentId <= 0) {
      return res.status(400).json({ message: 'Valid user_id and enrollment_id are required.' });
    }
    if (!status) {
      return res.status(400).json({ message: 'Status must be pending, approved, or rejected.' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [enrollmentRows] = await conn.query(
      `SELECT e.id, e.user_id, e.center_id, rc.user_id AS center_user_id
       FROM enrollments e
       JOIN review_centers rc ON rc.id = e.center_id
       WHERE e.id = ? FOR UPDATE`,
      [enrollmentId]
    );
    if (!enrollmentRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Enrollment not found.' });
    }

    const enrollment = enrollmentRows[0];
    if (enrollment.user_id !== userId) {
      await conn.rollback();
      return res.status(400).json({ message: 'Enrollment does not belong to the provided user_id.' });
    }
    if (actorRole === 'review_center' && Number(enrollment.center_user_id) !== Number(req.user.id)) {
      await conn.rollback();
      return res.status(403).json({ message: 'You can only create notifications for your own center enrollments.' });
    }

    const finalMessage = message || buildDefaultMessage(status);
    const [result] = await conn.query(
      `INSERT INTO enrollment_notifications (enrollment_id, user_id, center_id, status, message, is_read)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [enrollmentId, userId, enrollment.center_id, status, finalMessage]
    );

    await conn.commit();
    return res.status(201).json({
      notification_id: result.insertId,
      enrollment_id: enrollmentId,
      user_id: userId,
      status,
      message: finalMessage,
      is_read: false,
    });
  } catch (err) {
    if (conn) try { await conn.rollback(); } catch (e) {}
    console.error('Create notification error:', err);
    return res.status(500).json({ message: 'Server error.' });
  } finally {
    if (conn) try { conn.release(); } catch (e) {}
  }
};

const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await db.query(
      `SELECT
         en.id AS notification_id,
         en.user_id,
         en.center_id,
         en.enrollment_id,
         en.status,
         en.message,
         en.is_read,
         en.read_at,
         en.created_at,
         rc.user_id AS center_user_id,
         rc.business_name AS center_name
       FROM enrollment_notifications en
       LEFT JOIN review_centers rc ON rc.id = en.center_id
       WHERE en.user_id = ?
       ORDER BY en.created_at DESC`,
      [userId]
    );

    const notifications = rows.map((row) => ({
      notification_id: row.notification_id,
      user_id: row.user_id,
      center_id: row.center_id,
      center_user_id: row.center_user_id,
      center_name: row.center_name,
      enrollment_id: row.enrollment_id,
      status: row.status,
      message: row.message,
      is_read: Boolean(row.is_read),
      read_at: row.read_at,
      created_at: row.created_at,
    }));

    return res.json({ notifications });
  } catch (err) {
    console.error('Get notifications error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

const markNotificationAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = Number(req.params.id);

    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      return res.status(400).json({ message: 'Invalid notification id.' });
    }

    const [rows] = await db.query(
      'SELECT id, user_id, is_read FROM enrollment_notifications WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    if (!rows[0].is_read) {
      await db.query(
        'UPDATE enrollment_notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?',
        [notificationId, userId]
      );
    }

    return res.json({ message: 'Notification marked as read.', notification_id: notificationId });
  } catch (err) {
    console.error('Mark notification read error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = {
  createNotification,
  getMyNotifications,
  markNotificationAsRead,
};
