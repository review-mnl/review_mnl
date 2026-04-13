const db = require('../config/db');
const path = require('path');

const formatUserName = (row) => {
  const full = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  return full || row.email || 'User';
};

const getCenterByUserId = async (userId) => {
  const [rows] = await db.query('SELECT id, user_id, business_name FROM review_centers WHERE user_id = ?', [userId]);
  return rows[0] || null;
};

const toStoredUploadPath = (fileObj) => {
  if (!fileObj) return null;
  if (fileObj.secure_url) return String(fileObj.secure_url);
  if (fileObj.url && /^https?:\/\//i.test(String(fileObj.url))) return String(fileObj.url);
  if (fileObj.path && /^https?:\/\//i.test(String(fileObj.path))) return String(fileObj.path);
  if (fileObj.filename) return '/uploads/' + String(fileObj.filename);
  if (fileObj.path) return '/uploads/' + path.basename(String(fileObj.path));
  return null;
};

const parseAttachmentPayload = (fileObj) => {
  const attachmentUrl = toStoredUploadPath(fileObj);
  if (!attachmentUrl) return null;
  return {
    attachment_url: attachmentUrl,
    attachment_name: String(fileObj.originalname || fileObj.filename || 'attachment').slice(0, 255),
    attachment_mime_type: String(fileObj.mimetype || '').slice(0, 120) || null,
    attachment_size: Number(fileObj.size || 0) || null,
  };
};

const resolveChatContext = async ({ sender, receiverId, enrollmentId }) => {
  if (!sender || !sender.id || !receiverId) return { error: 'Sender and receiver are required.' };

  if (sender.role === 'student') {
    const center = await getCenterByUserId(receiverId);
    if (!center) return { error: 'Receiver must be a review center account.' };

    let enrollment;
    if (enrollmentId) {
      const [rows] = await db.query(
        `SELECT id, user_id, center_id
         FROM enrollments
         WHERE id = ? AND user_id = ? AND center_id = ?`,
        [enrollmentId, sender.id, center.id]
      );
      enrollment = rows[0] || null;
    } else {
      const [rows] = await db.query(
        `SELECT id, user_id, center_id
         FROM enrollments
         WHERE user_id = ? AND center_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [sender.id, center.id]
      );
      enrollment = rows[0] || null;
    }

    if (!enrollment) {
      return { error: 'No enrollment relationship found for this student and review center.' };
    }

    return {
      studentId: sender.id,
      centerId: center.id,
      enrollmentId: enrollment.id,
      senderId: sender.id,
      receiverId,
    };
  }

  if (sender.role === 'review_center' || sender.role === 'admin') {
    const center = await getCenterByUserId(sender.id);
    if (!center) return { error: 'Only review center accounts can reply to students.' };

    const [studentRows] = await db.query('SELECT id, role FROM users WHERE id = ?', [receiverId]);
    if (!studentRows.length || studentRows[0].role !== 'student') {
      return { error: 'Receiver must be a student account.' };
    }

    let enrollment;
    if (enrollmentId) {
      const [rows] = await db.query(
        `SELECT id, user_id, center_id
         FROM enrollments
         WHERE id = ? AND user_id = ? AND center_id = ?`,
        [enrollmentId, receiverId, center.id]
      );
      enrollment = rows[0] || null;
    } else {
      const [rows] = await db.query(
        `SELECT id, user_id, center_id
         FROM enrollments
         WHERE user_id = ? AND center_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [receiverId, center.id]
      );
      enrollment = rows[0] || null;
    }

    if (!enrollment) {
      return { error: 'No enrollment relationship found for this student and review center.' };
    }

    return {
      studentId: receiverId,
      centerId: center.id,
      enrollmentId: enrollment.id,
      senderId: sender.id,
      receiverId,
    };
  }

  return { error: 'Only students and review centers can use chat.' };
};

const sendMessage = async (req, res) => {
  try {
    const sender = req.user;
    const receiverId = Number(req.body && req.body.receiver_id);
    const enrollmentId = req.body && req.body.enrollment_id ? Number(req.body.enrollment_id) : null;
    const message = String((req.body && req.body.message) || '').trim();
    const attachment = parseAttachmentPayload(req.file);

    if (!Number.isInteger(receiverId) || receiverId <= 0) {
      return res.status(400).json({ message: 'Valid receiver_id is required.' });
    }
    if (!message && !attachment) {
      return res.status(400).json({ message: 'Message content or attachment is required.' });
    }

    console.log('[Chat] Send message request', {
      senderId: sender.id,
      senderRole: sender.role,
      receiverId,
      enrollmentId,
      length: message.length,
      hasAttachment: Boolean(attachment),
      attachmentMimeType: attachment ? attachment.attachment_mime_type : null,
      attachmentSize: attachment ? attachment.attachment_size : null,
    });

    const ctx = await resolveChatContext({ sender, receiverId, enrollmentId });
    if (ctx.error) return res.status(400).json({ message: ctx.error });

    const [result] = await db.query(
      `INSERT INTO chat_messages (
         student_id,
         center_id,
         enrollment_id,
         sender_id,
         receiver_id,
         message,
         attachment_url,
         attachment_name,
         attachment_mime_type,
         attachment_size,
         is_read
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        ctx.studentId,
        ctx.centerId,
        ctx.enrollmentId,
        ctx.senderId,
        ctx.receiverId,
        message || '',
        attachment ? attachment.attachment_url : null,
        attachment ? attachment.attachment_name : null,
        attachment ? attachment.attachment_mime_type : null,
        attachment ? attachment.attachment_size : null,
      ]
    );

    console.log('[Chat] Message saved', {
      messageId: result.insertId,
      studentId: ctx.studentId,
      centerId: ctx.centerId,
      senderId: ctx.senderId,
      receiverId: ctx.receiverId,
    });

    return res.status(201).json({
      message_id: result.insertId,
      student_id: ctx.studentId,
      center_id: ctx.centerId,
      enrollment_id: ctx.enrollmentId,
      sender_id: ctx.senderId,
      receiver_id: ctx.receiverId,
      message,
      attachment_url: attachment ? attachment.attachment_url : null,
      attachment_name: attachment ? attachment.attachment_name : null,
      attachment_mime_type: attachment ? attachment.attachment_mime_type : null,
      attachment_size: attachment ? attachment.attachment_size : null,
      is_read: false,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Send message error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(
      `SELECT
         g.other_user_id,
         lm.student_id,
         lm.center_id,
         lm.enrollment_id,
         lm.message AS last_message,
         lm.attachment_url AS last_attachment_url,
         lm.attachment_name AS last_attachment_name,
         lm.attachment_mime_type AS last_attachment_mime_type,
         lm.created_at AS last_timestamp,
         lm.sender_id AS last_sender_id,
         (
           SELECT COUNT(*)
           FROM chat_messages uc
           WHERE uc.receiver_id = ?
             AND uc.sender_id = g.other_user_id
             AND uc.is_read = 0
         ) AS unread_count,
         u.first_name,
         u.last_name,
         u.email,
         u.role AS other_role,
         u.profile_picture_url AS other_profile_picture_url,
         rc.business_name AS other_center_name,
         rc.logo_url AS other_center_logo_url,
         COALESCE(rc.logo_url, u.profile_picture_url) AS other_avatar_url
       FROM (
         SELECT
           CASE WHEN cm.sender_id = ? THEN cm.receiver_id ELSE cm.sender_id END AS other_user_id,
           MAX(cm.id) AS latest_id
         FROM chat_messages cm
         WHERE cm.sender_id = ? OR cm.receiver_id = ?
         GROUP BY other_user_id
       ) g
       JOIN chat_messages lm ON lm.id = g.latest_id
       JOIN users u ON u.id = g.other_user_id
       LEFT JOIN review_centers rc ON rc.user_id = g.other_user_id
       ORDER BY lm.created_at DESC`,
      [userId, userId, userId, userId]
    );

    const conversations = rows.map((row) => {
      const fallbackPreview = row.last_attachment_url ? '[Attachment]' : '';
      const lastMessage = String(row.last_message || '').trim() || fallbackPreview;
      return {
        other_user_id: Number(row.other_user_id),
        student_id: Number(row.student_id),
        center_id: Number(row.center_id),
        enrollment_id: row.enrollment_id ? Number(row.enrollment_id) : null,
        last_message: lastMessage,
        last_attachment_url: row.last_attachment_url || null,
        last_attachment_name: row.last_attachment_name || null,
        last_attachment_mime_type: row.last_attachment_mime_type || null,
        last_timestamp: row.last_timestamp,
        last_sender_id: Number(row.last_sender_id),
        unread_count: Number(row.unread_count || 0),
        other_role: row.other_role,
        other_name: row.other_center_name || formatUserName(row),
        other_avatar_url: row.other_avatar_url || row.other_center_logo_url || row.other_profile_picture_url || null,
      };
    });

    console.log('[Chat] Conversations fetched', {
      userId,
      count: conversations.length,
    });

    return res.json({ conversations });
  } catch (err) {
    console.error('Get conversations error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

const getThreadMessages = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const withUserId = Number(req.query.withUserId);

    if (!Number.isInteger(withUserId) || withUserId <= 0) {
      return res.status(400).json({ message: 'Valid withUserId is required.' });
    }

    const params = [currentUserId, withUserId, withUserId, currentUserId];

    console.log('[Chat] Thread query', {
      currentUserId,
      withUserId,
      mode: 'pair-bidirectional',
      params,
    });

    let [rows] = await db.query(
      `SELECT
         cm.id AS message_id,
         cm.student_id,
         cm.center_id,
         cm.enrollment_id,
         cm.sender_id,
         cm.receiver_id,
         cm.message,
         cm.attachment_url,
         cm.attachment_name,
         cm.attachment_mime_type,
         cm.attachment_size,
         cm.is_read,
         cm.read_at,
         cm.created_at
       FROM chat_messages cm
       WHERE ((cm.sender_id = ? AND cm.receiver_id = ?) OR (cm.sender_id = ? AND cm.receiver_id = ?))
       ORDER BY cm.created_at ASC`,
      params
    );

    const messages = rows.map((row) => ({
      message_id: row.message_id,
      messageId: row.message_id,
      student_id: row.student_id,
      center_id: row.center_id,
      enrollment_id: row.enrollment_id,
      sender_id: row.sender_id,
      senderId: row.sender_id,
      receiver_id: row.receiver_id,
      receiverId: row.receiver_id,
      message: row.message,
      attachment_url: row.attachment_url || null,
      attachment_name: row.attachment_name || null,
      attachment_mime_type: row.attachment_mime_type || null,
      attachment_size: row.attachment_size != null ? Number(row.attachment_size) : null,
      is_read: Boolean(row.is_read),
      read_at: row.read_at,
      timestamp: row.created_at,
      created_at: row.created_at,
    }));

    const senderBreakdown = messages.reduce((acc, item) => {
      const key = String(item.sender_id);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    console.log('[Chat] Thread fetched', {
      currentUserId,
      withUserId,
      count: messages.length,
      senderBreakdown,
    });

    return res.json({ messages });
  } catch (err) {
    console.error('Get thread messages error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

const markThreadAsRead = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const withUserId = Number(req.body && req.body.with_user_id);

    if (!Number.isInteger(withUserId) || withUserId <= 0) {
      return res.status(400).json({ message: 'Valid with_user_id is required.' });
    }

    const params = [currentUserId, withUserId];

    const [result] = await db.query(
      `UPDATE chat_messages
       SET is_read = 1, read_at = NOW()
       WHERE receiver_id = ? AND sender_id = ? AND is_read = 0`,
      params
    );

    return res.json({ message: 'Thread marked as read.', updated: result.affectedRows || 0 });
  } catch (err) {
    console.error('Mark thread as read error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

const deleteConversation = async (req, res) => {
  try {
    const currentUserId = Number(req.user && req.user.id);
    const withUserId = Number(
      (req.body && req.body.with_user_id)
      || (req.query && req.query.withUserId)
      || 0
    );

    if (!Number.isInteger(withUserId) || withUserId <= 0) {
      return res.status(400).json({ message: 'Valid with_user_id is required.' });
    }
    if (withUserId === currentUserId) {
      return res.status(400).json({ message: 'Cannot delete a conversation with yourself.' });
    }

    const [result] = await db.query(
      `DELETE FROM chat_messages
       WHERE (sender_id = ? AND receiver_id = ?)
          OR (sender_id = ? AND receiver_id = ?)`,
      [currentUserId, withUserId, withUserId, currentUserId]
    );

    return res.json({
      message: 'Conversation deleted successfully.',
      deleted: Number(result.affectedRows || 0),
    });
  } catch (err) {
    console.error('Delete conversation error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = {
  sendMessage,
  getConversations,
  getThreadMessages,
  markThreadAsRead,
  deleteConversation,
};
