const db = require('../config/db');
const { createUserNotification } = require('./notificationController');

const ALLOWED_TYPES = ['center', 'message', 'testimonial', 'rating'];
const ALLOWED_STATUSES = ['open', 'resolved', 'dismissed'];

const normalizeId = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? Math.trunc(num) : null;
};

const createReport = async (req, res) => {
  const reporterId = req.user && req.user.id;
  const reportType = String((req.body && req.body.report_type) || '').trim().toLowerCase();
  const reason = String((req.body && req.body.reason) || '').trim();
  const details = String((req.body && req.body.details) || '').trim();

  if (!reporterId) return res.status(401).json({ message: 'Not authenticated.' });
  if (!ALLOWED_TYPES.includes(reportType)) {
    return res.status(400).json({ message: 'Invalid report type.' });
  }
  if (!reason) return res.status(400).json({ message: 'Report reason is required.' });

  let centerId = normalizeId(req.body && req.body.center_id);
  let testimonialId = normalizeId(req.body && req.body.testimonial_id);
  let messageId = normalizeId(req.body && req.body.message_id);
  let reportedUserId = normalizeId(req.body && req.body.reported_user_id);

  try {
    if (reportType === 'center') {
      if (!centerId) return res.status(400).json({ message: 'Center id is required.' });
      const [rows] = await db.query('SELECT id, user_id FROM review_centers WHERE id = ? LIMIT 1', [centerId]);
      if (!rows.length) return res.status(404).json({ message: 'Review center not found.' });
      if (!reportedUserId) reportedUserId = normalizeId(rows[0].user_id);
    }

    if (reportType === 'testimonial' || reportType === 'rating') {
      if (!testimonialId) return res.status(400).json({ message: 'Testimonial id is required.' });
      const [rows] = await db.query('SELECT id, student_id, center_id FROM testimonials WHERE id = ? LIMIT 1', [testimonialId]);
      if (!rows.length) return res.status(404).json({ message: 'Review not found.' });
      if (!reportedUserId) reportedUserId = normalizeId(rows[0].student_id);
      if (!centerId) centerId = normalizeId(rows[0].center_id);
    }

    if (reportType === 'message') {
      if (!reportedUserId && !messageId) {
        return res.status(400).json({ message: 'Reported user or message id is required.' });
      }
      if (messageId && !reportedUserId) {
        const [rows] = await db.query('SELECT sender_id, center_id FROM chat_messages WHERE id = ? LIMIT 1', [messageId]);
        if (rows.length) {
          reportedUserId = normalizeId(rows[0].sender_id);
          if (!centerId) centerId = normalizeId(rows[0].center_id);
        }
      }
    }

    if (!centerId && !testimonialId && !messageId && !reportedUserId) {
      return res.status(400).json({ message: 'Report target is required.' });
    }

    const [result] = await db.query(
      `INSERT INTO reports
        (reporter_id, reported_user_id, center_id, testimonial_id, message_id, report_type, reason, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [reporterId, reportedUserId, centerId, testimonialId, messageId, reportType, reason, details || null]
    );

    return res.status(201).json({
      message: 'Report submitted successfully.',
      report_id: result.insertId,
    });
  } catch (err) {
    console.error('Create report error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

const getReports = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.id, r.report_type, r.reason, r.details, r.status, r.created_at, r.updated_at,
              r.reporter_id, r.reported_user_id, r.center_id, r.testimonial_id, r.message_id,
              CONCAT(COALESCE(rep.first_name, ''), ' ', COALESCE(rep.last_name, '')) AS reporter_name,
              CONCAT(COALESCE(target.first_name, ''), ' ', COALESCE(target.last_name, '')) AS reported_name,
              rc.business_name AS center_name,
              t.content AS testimonial_content,
              cm.message AS message_content
       FROM reports r
       LEFT JOIN users rep ON rep.id = r.reporter_id
       LEFT JOIN users target ON target.id = r.reported_user_id
       LEFT JOIN review_centers rc ON rc.id = r.center_id
       LEFT JOIN testimonials t ON t.id = r.testimonial_id
            LEFT JOIN chat_messages cm ON cm.id = r.message_id
       ORDER BY r.created_at DESC`
    );

    res.json({ reports: rows || [] });
  } catch (err) {
    console.error('Get reports error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

const updateReportStatus = async (req, res) => {
  const reportId = normalizeId(req.params && req.params.id);
  const status = String((req.body && req.body.status) || '').trim().toLowerCase();

  if (!reportId) return res.status(400).json({ message: 'Invalid report id.' });
  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Invalid report status.' });
  }

  try {
    const [rows] = await db.query('SELECT id FROM reports WHERE id = ? LIMIT 1', [reportId]);
    if (!rows.length) return res.status(404).json({ message: 'Report not found.' });

    await db.query('UPDATE reports SET status = ? WHERE id = ?', [status, reportId]);
    res.json({ message: 'Report updated.', status });
  } catch (err) {
    console.error('Update report status error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

const sendReportWarning = async (req, res) => {
  const reportId = normalizeId(req.params && req.params.id);
  const message = String((req.body && req.body.message) || '').trim();

  if (!reportId) return res.status(400).json({ message: 'Invalid report id.' });

  try {
    const [rows] = await db.query(
      `SELECT r.id, r.report_type, r.reason, r.details, r.reported_user_id,
              rc.business_name AS center_name,
              t.content AS testimonial_content,
              cm.message AS message_content
       FROM reports r
       LEFT JOIN review_centers rc ON rc.id = r.center_id
       LEFT JOIN testimonials t ON t.id = r.testimonial_id
       LEFT JOIN chat_messages cm ON cm.id = r.message_id
       WHERE r.id = ?
       LIMIT 1`,
      [reportId]
    );

    if (!rows.length) return res.status(404).json({ message: 'Report not found.' });

    const report = rows[0];
    const targetUserId = normalizeId(report.reported_user_id);
    if (!targetUserId) {
      return res.status(400).json({ message: 'Report has no reported user.' });
    }

    const base = 'Warning: Your account has been reported.';
    const reason = report.reason ? (' Reason: ' + report.reason + '.') : '';
    const type = report.report_type ? (' Type: ' + report.report_type + '.') : '';
    const details = report.details ? (' Details: ' + report.details + '.') : '';
    const finalMessage = message || (base + reason + type + details).trim();

    await createUserNotification(targetUserId, finalMessage, 'warning');

    return res.json({ message: 'Warning sent.', report_id: reportId });
  } catch (err) {
    console.error('Send report warning error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { createReport, getReports, updateReportStatus, sendReportWarning };
