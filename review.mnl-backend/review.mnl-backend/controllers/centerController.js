const db = require('../config/db');

const toReviewStatus = (reviewStatus, legacyStatus) => {
  if (reviewStatus === 'approved' || reviewStatus === 'rejected' || reviewStatus === 'pending') return reviewStatus;
  if (legacyStatus === 'active') return 'approved';
  if (legacyStatus === 'cancelled') return 'rejected';
  return 'pending';
};

const parseMetadata = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
};

const parseJsonArray = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
};

const parseJsonObject = (raw) => {
  if (!raw) return {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (e) {
      return {};
    }
  }
  return {};
};

const clipText = (value, maxLen) => String(value || '').trim().slice(0, maxLen);

const getUploadedFileUrl = (file) => {
  if (!file) return '';
  if (file.secure_url) return String(file.secure_url).trim();
  if (file.url) return String(file.url).trim();
  if (file.path && /^https?:\/\//i.test(String(file.path))) return String(file.path).trim();
  if (file.filename) return `/uploads/${file.filename}`;
  return '';
};

const canonicalPaymentMethod = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'gcash') return 'GCash';
  if (normalized === 'maya') return 'Maya';
  if (normalized === 'bank' || normalized === 'bank transfer' || normalized === 'bank_transfer' || normalized === 'bank-transfer') return 'Bank Transfer';
  if (normalized === 'over-the-counter' || normalized === 'over the counter' || normalized === 'over_the_counter' || normalized === 'otc') return 'Over-the-Counter';
  return '';
};

const normalizePaymentMethods = (value) => {
  let arr = parseJsonArray(value);
  if (!arr.length && typeof value === 'string') {
    arr = String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const normalized = arr
    .map((item) => canonicalPaymentMethod(item))
    .filter(Boolean);
  if (!normalized.length) return ['GCash'];
  return Array.from(new Set(normalized)).slice(0, 8);
};

const normalizePaymentDetails = (value) => {
  const raw = parseJsonObject(value);
  const gcash = parseJsonObject(raw.gcash);
  const maya = parseJsonObject(raw.maya);
  const bankTransfer = parseJsonObject(raw.bank_transfer);
  const overTheCounter = parseJsonObject(raw.over_the_counter);
  const pricing = parseJsonObject(raw.pricing);
  const preferredMethod = canonicalPaymentMethod(clipText(raw.preferred_method, 40)) || 'GCash';
  const parsedPricingAmount = Number(pricing.amount !== undefined ? pricing.amount : raw.pricing_amount);
  const pricingAmount = Number.isFinite(parsedPricingAmount) && parsedPricingAmount > 0
    ? Math.round(parsedPricingAmount)
    : 1550;

  return {
    preferred_method: preferredMethod,
    gcash: {
      account_name: clipText(gcash.account_name, 120),
      number: clipText(gcash.number, 32),
      qr_url: clipText(gcash.qr_url, 500),
    },
    maya: {
      account_name: clipText(maya.account_name, 120),
      number: clipText(maya.number, 32),
      qr_url: clipText(maya.qr_url, 500),
    },
    bank_transfer: {
      bank_name: clipText(bankTransfer.bank_name, 120),
      account_name: clipText(bankTransfer.account_name, 120),
      account_number: clipText(bankTransfer.account_number, 64),
      qr_url: clipText(bankTransfer.qr_url, 500),
    },
    over_the_counter: {
      instructions: clipText(overTheCounter.instructions, 500),
    },
    pricing: {
      amount: pricingAmount,
    },
  };
};

const toPaymentMethodLabel = (provider, metadata) => {
  const fromMetadata = metadata && typeof metadata.payment_method === 'string'
    ? metadata.payment_method.trim()
    : '';
  if (fromMetadata) return fromMetadata;

  const normalized = String(provider || '').trim().toLowerCase();
  if (!normalized) return 'Not set';
  if (normalized.indexOf('gcash') >= 0) return 'GCash';

  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
};

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
              rc.description, rc.programs, rc.achievements, rc.schedule, rc.payment_methods, rc.payment_details,
              IFNULL(AVG(t.rating), 0) AS avg_rating, COUNT(t.id) AS review_count
       FROM review_centers rc
       LEFT JOIN testimonials t ON t.center_id = rc.id AND t.is_approved = 1
       WHERE rc.id = ? AND rc.status = 'approved' GROUP BY rc.id`, [id]
    );
    if (center.length === 0)
      return res.status(404).json({ message: 'Review center not found.' });
    const [testimonials] = await db.query(
      `SELECT t.id, t.student_id, t.content, t.rating, t.created_at, t.updated_at, u.first_name, u.last_name
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

    const payload = { ...center[0], testimonials, isEnrolled };
    payload.payment_methods = normalizePaymentMethods(payload.payment_methods);
    payload.payment_details = normalizePaymentDetails(payload.payment_details);

    res.json(payload);
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
  const { business_name, email, address, description, programs, achievements, schedule, review_schedule, payment_methods, payment_details } = req.body;
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
    if (schedule !== undefined) { updates.push('schedule = ?'); vals.push(JSON.stringify(schedule)); }
    if (review_schedule !== undefined) { updates.push('review_schedule = ?'); vals.push(JSON.stringify(review_schedule)); }
    if (payment_methods !== undefined) {
      updates.push('payment_methods = ?');
      vals.push(JSON.stringify(normalizePaymentMethods(payment_methods)));
    }
    if (payment_details !== undefined) {
      updates.push('payment_details = ?');
      vals.push(JSON.stringify(normalizePaymentDetails(payment_details)));
    }

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
              rc.programs, rc.achievements, rc.schedule, rc.review_schedule, rc.payment_methods, rc.payment_details,
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
    if (center.review_schedule && typeof center.review_schedule === 'string') {
      try { center.review_schedule = JSON.parse(center.review_schedule); } catch(e) { center.review_schedule = []; }
    }
    center.payment_methods = normalizePaymentMethods(center.payment_methods);
    center.payment_details = normalizePaymentDetails(center.payment_details);
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
    const url = getUploadedFileUrl(req.file) || null;
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

const uploadCenterPaymentQr = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No QR image uploaded.' });
    const qrUrl = getUploadedFileUrl(req.file);
    if (!qrUrl) return res.status(500).json({ message: 'Upload failed.' });

    return res.json({
      message: 'QR image uploaded.',
      qr_url: qrUrl,
    });
  } catch (err) {
    console.error('Upload payment QR error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

const getMyCenterProfile = async (req, res) => {
  const userId = req.user.id;
  try {
    const [rows] = await db.query(
      `SELECT rc.id, rc.business_name, rc.email, rc.address, rc.logo_url, rc.description,
              rc.programs, rc.achievements, rc.schedule, rc.review_schedule, rc.payment_methods, rc.payment_details,
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
    if (center.review_schedule && typeof center.review_schedule === 'string') {
      try { center.review_schedule = JSON.parse(center.review_schedule); } catch(e) { center.review_schedule = []; }
    }
    center.payment_methods = normalizePaymentMethods(center.payment_methods);
    center.payment_details = normalizePaymentDetails(center.payment_details);
    res.json(center);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

const getMyCenterEnrollments = async (req, res) => {
  try {
    const userId = req.user.id;
    const statusFilter = String(req.query.status || 'all').toLowerCase();
    const sortOrder = String(req.query.sort || 'latest').toLowerCase() === 'oldest' ? 'ASC' : 'DESC';

    const [rows] = await db.query(
      `SELECT
         e.id AS enrollment_id,
         e.user_id,
         e.center_id AS review_center_id,
         rc.business_name AS review_center_name,
         e.status AS enrollment_legacy_status,
         e.review_status,
         e.payment_verified,
         e.created_at AS date_submitted,
         e.reviewed_at,
         u.first_name,
         u.last_name,
         u.email AS student_email,
         p.id AS payment_id,
         p.amount,
         p.provider AS payment_method,
         p.status AS payment_status,
         p.created_at AS payment_uploaded_at,
         p.metadata,
         COALESCE((
           SELECT en.message
           FROM enrollment_notifications en
           WHERE en.enrollment_id = e.id
           ORDER BY en.created_at DESC
           LIMIT 1
         ), NULL) AS latest_notification,
         COALESCE((
           SELECT en.created_at
           FROM enrollment_notifications en
           WHERE en.enrollment_id = e.id
           ORDER BY en.created_at DESC
           LIMIT 1
         ), NULL) AS latest_notification_at
       FROM enrollments e
       JOIN review_centers rc ON rc.id = e.center_id
       JOIN users u ON u.id = e.user_id
       LEFT JOIN payments p ON p.id = e.payment_id
       WHERE rc.user_id = ?
       ORDER BY e.created_at ${sortOrder}`,
      [userId]
    );

    const enrollments = rows
      .map((row) => {
        const metadata = parseMetadata(row.metadata);
        const reviewStatus = toReviewStatus(row.review_status, row.enrollment_legacy_status);
        const documents = metadata.submitted_documents || metadata.documents || [];
        const createdAt = row.date_submitted;
        const studentName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || row.student_email || 'Student';
        const paymentMethodLabel = toPaymentMethodLabel(row.payment_method, metadata);
        return {
          enrollmentId: row.enrollment_id,
          enrollment_id: row.enrollment_id,
          studentId: row.user_id,
          user_id: row.user_id,
          studentName,
          student_name: studentName,
          student_email: row.student_email,
          reviewCenterId: row.review_center_id,
          review_center_id: row.review_center_id,
          reviewCenterName: row.review_center_name,
          review_center_name: row.review_center_name,
          program: metadata.program_enrolled || 'Program not specified',
          program_enrolled: metadata.program_enrolled || 'Program not specified',
          teacher: metadata.teacher || metadata.teacher_name || metadata.professor || null,
          teacher_name: metadata.teacher || metadata.teacher_name || metadata.professor || null,
          teacher_from: metadata.teacher_from || null,
          teacher_to: metadata.teacher_to || null,
          teacher_program: metadata.teacher_program || null,
          teacher_label: metadata.teacher_label || null,
          enrollment_date: metadata.enrollment_date || null,
          submitted_documents: Array.isArray(documents) ? documents : (documents ? [documents] : []),
          paymentStatus: row.payment_status || 'pending',
          payment_method: paymentMethodLabel,
          payment: {
            payment_id: row.payment_id,
            amount: row.amount || 0,
            method: paymentMethodLabel,
            status: row.payment_status || 'pending',
            verified: Boolean(row.payment_verified),
            reference_number: metadata.reference_number || null,
            student_reference_number: metadata.student_reference_number || metadata.reference_number || null,
            site_reference: metadata.site_reference || null,
            gcash_name: metadata.gcash_name || null,
            gcash_number_masked: metadata.gcash_number_masked || null,
            payment_screenshot_url: metadata.payment_proof_url || null,
            uploaded_at: row.payment_uploaded_at || metadata.created_at || null,
            review_reason: metadata.payment_review_reason || null,
          },
          enrollmentStatus: reviewStatus,
          status: reviewStatus,
          createdAt,
          date_submitted: row.date_submitted,
          reviewed_at: row.reviewed_at,
          latest_notification: row.latest_notification,
          latest_notification_at: row.latest_notification_at,
        };
      })
      .filter((item) => statusFilter === 'all' ? true : item.status === statusFilter);

    console.log('[Enrollment][Center] getMyCenterEnrollments', {
      reviewCenterUserId: userId,
      requestedStatus: statusFilter,
      sortOrder,
      count: enrollments.length,
      sampleReviewCenterId: enrollments[0] ? enrollments[0].review_center_id : null,
    });

    return res.json({ enrollments });
  } catch (err) {
    console.error('Get my center enrollments error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

const verifyEnrollmentPayment = async (req, res) => {
  let conn;
  try {
    const userId = req.user.id;
    const enrollmentId = Number(req.params.enrollmentId);
    const requestedPaymentStatus = req.body && req.body.payment_status ? String(req.body.payment_status).toLowerCase() : null;
    const paymentReason = req.body && req.body.payment_reason ? String(req.body.payment_reason).trim() : '';
    const allowedPaymentStatuses = ['pending', 'paid', 'failed', 'cancelled'];

    if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) {
      return res.status(400).json({ message: 'Invalid enrollment id.' });
    }
    if (requestedPaymentStatus && !allowedPaymentStatuses.includes(requestedPaymentStatus)) {
      return res.status(400).json({ message: 'Invalid payment status.' });
    }
    if ((requestedPaymentStatus === 'failed' || requestedPaymentStatus === 'cancelled') && !paymentReason) {
      return res.status(400).json({ message: 'Please provide a reason when rejecting a payment.' });
    }
    if (paymentReason.length > 500) {
      return res.status(400).json({ message: 'Payment reason is too long (maximum 500 characters).' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT e.id, e.user_id, e.center_id, e.payment_id, e.payment_verified, p.status AS payment_status, rc.business_name
       FROM enrollments e
       JOIN review_centers rc ON rc.id = e.center_id
       LEFT JOIN payments p ON p.id = e.payment_id
       WHERE e.id = ? AND rc.user_id = ?
       FOR UPDATE`,
      [enrollmentId, userId]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Enrollment not found.' });
    }

    const enrollment = rows[0];
    const currentPaymentStatus = enrollment.payment_status || 'pending';
    let nextPaymentStatus = requestedPaymentStatus || currentPaymentStatus;

    if (!enrollment.payment_id) {
      await conn.rollback();
      return res.status(400).json({ message: 'No payment record is linked to this enrollment.' });
    }

    if (String(currentPaymentStatus).toLowerCase() === 'paid' && nextPaymentStatus !== 'paid') {
      await conn.rollback();
      return res.status(400).json({ message: 'Paid payments cannot be downgraded through this endpoint.' });
    }

    if (requestedPaymentStatus) {
      if (paymentReason) {
        await conn.query(
          `UPDATE payments
           SET status = ?,
               metadata = JSON_SET(
                 COALESCE(metadata, JSON_OBJECT()),
                 '$.payment_review_reason', ?,
                 '$.payment_reviewed_by', ?,
                 '$.payment_reviewed_at', ?
               )
           WHERE id = ?`,
          [requestedPaymentStatus, paymentReason, userId, new Date().toISOString(), enrollment.payment_id]
        );
      } else {
        await conn.query('UPDATE payments SET status = ? WHERE id = ?', [requestedPaymentStatus, enrollment.payment_id]);
      }
    }

    if ((nextPaymentStatus === 'failed' || nextPaymentStatus === 'cancelled') && paymentReason) {
      const rejectionMessage = 'Your payment was marked as ' + nextPaymentStatus + '. Reason: ' + paymentReason;

      await conn.query(
        'INSERT INTO enrollment_notifications (enrollment_id, user_id, center_id, status, message, is_read) VALUES (?, ?, ?, ?, ?, 0)',
        [enrollmentId, enrollment.user_id, enrollment.center_id, 'rejected', rejectionMessage]
      );

      await conn.query(
        `INSERT INTO chat_messages (student_id, center_id, enrollment_id, sender_id, receiver_id, message, is_read)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [enrollment.user_id, enrollment.center_id, enrollmentId, userId, enrollment.user_id, rejectionMessage]
      );
    }

    const shouldVerify = nextPaymentStatus === 'paid' ? 1 : 0;
    await conn.query('UPDATE enrollments SET payment_verified = ? WHERE id = ?', [shouldVerify, enrollmentId]);

    console.log('[EnrollmentPayment] verifyEnrollmentPayment', {
      enrollmentId,
      reviewerUserId: userId,
      studentUserId: enrollment.user_id,
      centerId: enrollment.center_id,
      previousPaymentStatus: currentPaymentStatus,
      nextPaymentStatus,
      paymentVerified: Boolean(shouldVerify),
      paymentReason: paymentReason || null,
    });

    await conn.commit();
    return res.json({
      message: nextPaymentStatus === 'paid' ? 'Payment verified successfully.' : 'Payment status updated successfully.',
      enrollment_id: enrollmentId,
      payment_status: nextPaymentStatus,
      payment_verified: Boolean(shouldVerify),
      payment_reason: paymentReason || null,
    });
  } catch (err) {
    if (conn) try { await conn.rollback(); } catch (e) {}
    console.error('Verify enrollment payment error:', err);
    return res.status(500).json({ message: 'Server error.' });
  } finally {
    if (conn) try { conn.release(); } catch (e) {}
  }
};

const updateEnrollmentReviewStatus = async (req, res) => {
  let conn;
  try {
    const userId = req.user.id;
    const enrollmentId = Number(req.params.enrollmentId);
    const requestedStatus = String((req.body && req.body.status) || '').toLowerCase();

    if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) {
      return res.status(400).json({ message: 'Invalid enrollment id.' });
    }
    if (!['approved', 'rejected'].includes(requestedStatus)) {
      return res.status(400).json({ message: 'Status must be approved or rejected.' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT e.id, e.user_id, e.center_id, e.payment_verified, e.review_status, e.status AS enrollment_legacy_status,
              p.status AS payment_status, rc.business_name, rc.address
       FROM enrollments e
       JOIN review_centers rc ON rc.id = e.center_id
       LEFT JOIN payments p ON p.id = e.payment_id
       WHERE e.id = ? AND rc.user_id = ?
       FOR UPDATE`,
      [enrollmentId, userId]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Enrollment not found.' });
    }

    const enrollment = rows[0];
    console.log('[EnrollmentReview] Request received', {
      enrollmentId,
      reviewerUserId: userId,
      requestedStatus,
      studentUserId: enrollment.user_id,
      centerId: enrollment.center_id,
    });

    if (requestedStatus === 'approved') {
      // Approval is allowed based on review center decision without blocking on payment verification.
    }

    const nextLegacyStatus = requestedStatus === 'approved' ? 'active' : 'cancelled';
    const centerName = enrollment.business_name || 'the review center';
    const centerAddress = String(enrollment.address || '').trim();
    const mapsQuery = [centerName, centerAddress].filter(Boolean).join(' ').trim();
    const mapsUrl = mapsQuery
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
      : '';
    const notificationMessage = requestedStatus === 'approved'
      ? (centerAddress
          ? `Congratulations! You are now successfully enrolled in ${centerName}. Location: ${centerAddress}.${mapsUrl ? ` Google Maps: ${mapsUrl}` : ''}`
          : `Congratulations! You are now successfully enrolled in ${centerName}.${mapsUrl ? ` Google Maps: ${mapsUrl}` : ''}`)
      : 'Your enrollment has been rejected.';

    await conn.query(
      'UPDATE enrollments SET review_status = ?, status = ?, reviewed_at = NOW(), reviewed_by = ? WHERE id = ?',
      [requestedStatus, nextLegacyStatus, userId, enrollmentId]
    );

    await conn.query(
      'INSERT INTO enrollment_notifications (enrollment_id, user_id, center_id, status, message, is_read) VALUES (?, ?, ?, ?, ?, 0)',
      [enrollmentId, enrollment.user_id, enrollment.center_id, requestedStatus, notificationMessage]
    );

    // Also write to chat so approval/rejection appears in the two-way thread.
    await conn.query(
      `INSERT INTO chat_messages (student_id, center_id, enrollment_id, sender_id, receiver_id, message, is_read)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [enrollment.user_id, enrollment.center_id, enrollmentId, userId, enrollment.user_id, notificationMessage]
    );

    await conn.commit();
    console.log('[EnrollmentReview] Saved decision message to notifications and chat', {
      enrollmentId,
      status: requestedStatus,
      senderId: userId,
      receiverId: enrollment.user_id,
    });

    return res.json({
      message: `Enrollment ${requestedStatus}.`,
      enrollment_id: enrollmentId,
      status: requestedStatus,
    });
  } catch (err) {
    if (conn) try { await conn.rollback(); } catch (e) {}
    console.error('Update enrollment review status error:', err);
    return res.status(500).json({ message: 'Server error.' });
  } finally {
    if (conn) try { conn.release(); } catch (e) {}
  }
};

module.exports = {
  getApprovedCenters,
  getCenterById,
  getCentersNearby,
  searchCenters,
  updateCenterLocation,
  updateCenterProfile,
  updateCenterLogo,
  uploadCenterPaymentQr,
  getMyCenterProfile,
  getMyCenterEnrollments,
  verifyEnrollmentPayment,
  updateEnrollmentReviewStatus,
};

