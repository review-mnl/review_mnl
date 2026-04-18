const db = require('../config/db');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const sseClientsByUser = new Map();

const addClient = (userId, res) => {
  const key = String(userId);
  if (!sseClientsByUser.has(key)) sseClientsByUser.set(key, new Set());
  sseClientsByUser.get(key).add(res);
};

const removeClient = (userId, res) => {
  const key = String(userId);
  if (!sseClientsByUser.has(key)) return;
  const set = sseClientsByUser.get(key);
  set.delete(res);
  if (set.size === 0) sseClientsByUser.delete(key);
};

const broadcastToUser = (userId, payload) => {
  const key = String(userId);
  const set = sseClientsByUser.get(key);
  if (!set || set.size === 0) return;
  const message = 'data: ' + JSON.stringify(payload || {}) + '\n\n';
  set.forEach((res) => {
    try { res.write(message); } catch (e) {}
  });
};

const createUserNotification = async (userId, message, kind) => {
  const uid = Number(userId);
  const text = String(message || '').trim();
  const type = String(kind || 'info').trim().toLowerCase() || 'info';

  if (!Number.isInteger(uid) || uid <= 0) {
    throw new Error('Invalid user id.');
  }
  if (!text) {
    throw new Error('Notification message is required.');
  }

  const [result] = await db.query(
    'INSERT INTO user_notifications (user_id, kind, message, is_read) VALUES (?, ?, ?, 0)',
    [uid, type, text]
  );

  broadcastToUser(uid, {
    type: 'notification_created',
    notification_id: result.insertId,
    status: type,
    message: text,
    is_read: false,
    timestamp: new Date().toISOString(),
  });

  return {
    id: result.insertId,
    user_id: uid,
    kind: type,
    message: text,
    is_read: false,
  };
};

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
    broadcastToUser(userId, {
      type: 'notification_created',
      notification_id: result.insertId,
      enrollment_id: enrollmentId,
      status,
      message: finalMessage,
      is_read: false,
      timestamp: new Date().toISOString(),
    });
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
         rc.business_name AS center_name,
         u.id AS student_user_id,
         CONCAT(u.first_name, ' ', u.last_name) AS student_name
       FROM enrollment_notifications en
       LEFT JOIN review_centers rc ON rc.id = en.center_id
       LEFT JOIN enrollments e ON e.id = en.enrollment_id
       LEFT JOIN users u ON u.id = e.user_id
       WHERE en.user_id = ?
       ORDER BY en.created_at DESC`,
      [userId]
    );

    const [userRows] = await db.query(
      `SELECT
         un.id AS notification_id,
         un.user_id,
         un.kind,
         un.message,
         un.is_read,
         un.read_at,
         un.created_at
       FROM user_notifications un
       WHERE un.user_id = ?
       ORDER BY un.created_at DESC`,
      [userId]
    );

    const enrollmentNotifications = rows.map((row) => ({
      notification_id: row.notification_id,
      user_id: row.user_id,
      center_id: row.center_id,
      center_user_id: row.center_user_id,
      center_name: row.center_name,
      student_user_id: row.student_user_id,
      student_name: row.student_name,
      enrollment_id: row.enrollment_id,
      status: row.status,
      message: row.message,
      is_read: Boolean(row.is_read),
      read_at: row.read_at,
      created_at: row.created_at,
    }));

    const userNotifications = (userRows || []).map((row) => ({
      notification_id: row.notification_id,
      user_id: row.user_id,
      center_id: null,
      center_user_id: null,
      center_name: null,
      student_user_id: null,
      student_name: null,
      enrollment_id: null,
      status: row.kind || 'info',
      message: row.message,
      is_read: Boolean(row.is_read),
      read_at: row.read_at,
      created_at: row.created_at,
    }));

    const notifications = enrollmentNotifications.concat(userNotifications).sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return db - da;
    });

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
    if (rows.length) {
      if (!rows[0].is_read) {
        await db.query(
          'UPDATE enrollment_notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?',
          [notificationId, userId]
        );
        broadcastToUser(userId, {
          type: 'notification_read',
          notification_id: notificationId,
          timestamp: new Date().toISOString(),
        });
      }
      return res.json({ message: 'Notification marked as read.', notification_id: notificationId });
    }

    const [userRows] = await db.query(
      'SELECT id, user_id, is_read FROM user_notifications WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );
    if (!userRows.length) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    if (!userRows[0].is_read) {
      await db.query(
        'UPDATE user_notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?',
        [notificationId, userId]
      );
      broadcastToUser(userId, {
        type: 'notification_read',
        notification_id: notificationId,
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({ message: 'Notification marked as read.', notification_id: notificationId });
  } catch (err) {
    console.error('Mark notification read error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

const markAllMyNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    const [resultEnroll] = await db.query(
      'UPDATE enrollment_notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0',
      [userId]
    );

    const [resultUser] = await db.query(
      'UPDATE user_notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0',
      [userId]
    );

    const updated = (Number(resultEnroll && resultEnroll.affectedRows) || 0)
      + (Number(resultUser && resultUser.affectedRows) || 0);
    if (updated > 0) {
      broadcastToUser(userId, {
        type: 'notifications_read_all',
        updated,
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({ message: 'Notifications marked as read.', updated });
  } catch (err) {
    console.error('Mark all notifications read error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

const clearMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const [resultEnroll] = await db.query('DELETE FROM enrollment_notifications WHERE user_id = ?', [userId]);
    const [resultUser] = await db.query('DELETE FROM user_notifications WHERE user_id = ?', [userId]);
    const deleted = (Number(resultEnroll && resultEnroll.affectedRows) || 0)
      + (Number(resultUser && resultUser.affectedRows) || 0);

    broadcastToUser(userId, {
      type: 'notifications_cleared',
      deleted,
      timestamp: new Date().toISOString(),
    });

    return res.json({ message: 'Notifications cleared.', deleted });
  } catch (err) {
    console.error('Clear notifications error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

const streamMyNotifications = async (req, res) => {
  try {
    let userId = req.user && req.user.id;
    if (!userId) {
      const authHeader = req.headers.authorization;
      const queryToken = String((req.query && req.query.token) || '').trim();
      const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : '';
      const token = headerToken || queryToken;
      if (!token) {
        return res.status(401).json({ message: 'No token. Access denied.' });
      }

      let user;
      try {
        user = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token.' });
      }
      userId = user.id;
    }

    if (!userId) {
      return res.status(401).json({ message: 'Invalid token payload.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    if (res.flushHeaders) res.flushHeaders();

    addClient(userId, res);
    res.write('data: ' + JSON.stringify({ type: 'connected', ts: new Date().toISOString() }) + '\n\n');

    const keepAlive = setInterval(() => {
      try { res.write(': ping\n\n'); } catch (e) {}
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
      removeClient(userId, res);
      try { res.end(); } catch (e) {}
    });
  } catch (err) {
    console.error('Stream notifications error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = {
  createNotification,
  createUserNotification,
  getMyNotifications,
  markNotificationAsRead,
  markAllMyNotificationsAsRead,
  clearMyNotifications,
  streamMyNotifications,
  broadcastToUser,
};
