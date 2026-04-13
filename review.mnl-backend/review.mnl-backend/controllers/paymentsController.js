const db = require('../config/db');
require('dotenv').config();

// Manual payment enrollment flow for GCash, Maya, and Bank Transfer.
// It stores payment details and marks the transaction as pending for admin verification.
const createGcashEnrollment = async (req, res) => {
  let conn;
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ message: 'Authentication required.' });
    const userId = req.user.id;
    const centerId = Number(req.params.id);
    if (!Number.isInteger(centerId) || centerId <= 0) {
      return res.status(400).json({ message: 'Invalid review center id.' });
    }
    const amount = parseInt(req.body.amount, 10) || 1550; // default in PHP pesos

    const requestedMethod = String(req.body.payment_method || 'gcash').trim().toLowerCase();
    const normalizedMethod = (requestedMethod === 'maya')
      ? 'maya'
      : (requestedMethod === 'bank' || requestedMethod === 'bank transfer' || requestedMethod === 'bank_transfer')
        ? 'bank'
        : 'gcash';

    const methodConfig = normalizedMethod === 'maya'
      ? {
          provider: 'maya_manual',
          label: 'Maya',
          numberLabel: 'Maya number',
          nameLabel: 'Maya account name',
          referenceLabel: 'Maya reference number',
          metadataNameKey: 'maya_name',
          metadataNumberKey: 'maya_number_masked',
        }
      : normalizedMethod === 'bank'
        ? {
            provider: 'bank_transfer_manual',
            label: 'Bank Transfer',
            numberLabel: 'bank account number',
            nameLabel: 'bank account name',
            referenceLabel: 'bank transfer reference number',
            metadataNameKey: 'bank_account_name',
            metadataNumberKey: 'bank_account_number_masked',
          }
        : {
            provider: 'gcash_manual',
            label: 'GCash',
            numberLabel: 'GCash number',
            nameLabel: 'GCash account name',
            referenceLabel: 'GCash reference number',
            metadataNameKey: 'gcash_name',
            metadataNumberKey: 'gcash_number_masked',
          };

    const payerNumber = String(
      req.body.payer_number
      || req.body.gcash_number
      || req.body.maya_number
      || req.body.bank_account_number
      || ''
    ).trim();
    const payerName = String(
      req.body.payer_name
      || req.body.gcash_name
      || req.body.maya_name
      || req.body.bank_account_name
      || ''
    ).trim();

    const referenceNumber = String(req.body.reference_number || '').trim();
    const paymentProofUrl = req.file ? String(req.file.path || req.file.url || req.file.secure_url || '').trim() : '';
    const programEnrolled = String(req.body.program_enrolled || '').trim();     
    const enrollmentDateRaw = String(req.body.enrollment_date || '').trim();    
    const enrollmentDate = enrollmentDateRaw || new Date().toISOString().slice(0, 10);

    console.log('[Enrollment] Request received', {
      userId,
      reviewCenterId: centerId,
      amount,
      paymentMethod: methodConfig.label,
      programEnrolled,
      enrollmentDate,
      referenceNumber,
      hasPaymentProof: Boolean(paymentProofUrl)
    });

    if (!referenceNumber) {
      return res.status(400).json({ message: methodConfig.referenceLabel + ' is required.' });
    }

    if (!payerNumber || !payerName) {
      return res.status(400).json({ message: methodConfig.numberLabel + ' and ' + methodConfig.nameLabel + ' are required.' });
    }

    // Basic local validation
    if (normalizedMethod === 'gcash' || normalizedMethod === 'maya') {
      if (!/^09\d{9}$/.test(payerNumber)) {
        return res.status(400).json({ message: 'Please enter a valid ' + methodConfig.numberLabel + ' (e.g., 09XXXXXXXXX).' });
      }
    } else {
      const compactAccountNumber = payerNumber.replace(/\s+/g, '');
      if (compactAccountNumber.length < 6) {
        return res.status(400).json({ message: 'Please enter a valid bank account number.' });
      }
    }
    if (payerName.length < 2) {
      return res.status(400).json({ message: 'Please enter a valid account name.' });
    }
    if (amount <= 0) {
      return res.status(400).json({ message: 'Invalid payment amount.' });      
    }

    // Ensure center exists
    const [centerRows] = await db.query('SELECT id, user_id, business_name FROM review_centers WHERE id = ?', [centerId]);
    if (!centerRows || centerRows.length === 0) return res.status(404).json({ message: 'Center not found.' });
    const center = centerRows[0];

    const [studentRows] = await db.query('SELECT first_name, last_name, email FROM users WHERE id = ?', [userId]);
    const student = studentRows && studentRows.length ? studentRows[0] : null;
    const studentName = [student && student.first_name, student && student.last_name].filter(Boolean).join(' ').trim() || (student && student.email) || 'Student';

    // Manual references should be unique per provider.
    const [existingReferenceRows] = await db.query(
      'SELECT id, status, user_id, center_id FROM payments WHERE provider = ? AND provider_payment_id = ? LIMIT 1',
      [methodConfig.provider, referenceNumber]
    );
    if (existingReferenceRows.length > 0) {
      return res.status(409).json({ message: 'This ' + methodConfig.referenceLabel + ' has already been submitted. Please check your reference and try again.' });
    }

    const compactPayerNumber = payerNumber.replace(/\s+/g, '');
    const maskedNumber = compactPayerNumber.length > 4
      ? compactPayerNumber.replace(/.(?=.{4})/g, '*')
      : compactPayerNumber;
    
    // Status is 'pending' because the admin needs to verify the reference number manually
    const status = 'pending';
    const providerPaymentId = referenceNumber;

    conn = await db.getConnection();
    await conn.beginTransaction();

    // Store payment details (userId, amount, method/provider, transaction status, timestamp)
    const [result] = await conn.query(
      'INSERT INTO payments (user_id, center_id, provider, provider_payment_id, amount, currency, status, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        userId,
        centerId,
        methodConfig.provider,
        providerPaymentId,
        amount,
        'PHP',
        status,
        JSON.stringify({
          enrollment_id: null,
          student_id: userId,
          student_name: studentName,
          review_center_id: centerId,
          review_center_name: center.business_name,
          payment_method: methodConfig.label,
          payer_number_masked: maskedNumber,
          payer_name: payerName,
          [methodConfig.metadataNumberKey]: maskedNumber,
          [methodConfig.metadataNameKey]: payerName,
          reference_number: referenceNumber,
          payment_proof_url: paymentProofUrl || null,
          program_enrolled: programEnrolled,
          enrollment_date: enrollmentDate,
          payment_status: 'pending',
          enrollment_status: 'pending',
          manual_verification_required: true,
        }),
      ]
    );
    const paymentId = result.insertId;

    // Create the enrollment with payment_verified = 0 and status = pending
    const [enrollmentInsert] = await conn.query(
      'INSERT INTO enrollments (user_id, center_id, payment_id, status, review_status, payment_verified) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, centerId, paymentId, 'pending', 'pending', 0]
    );
    const enrollmentId = enrollmentInsert.insertId;

    await conn.query(
      'UPDATE payments SET metadata = JSON_SET(COALESCE(metadata, JSON_OBJECT()), "$.enrollment_id", ?, "$.created_at", ?) WHERE id = ?',
      [enrollmentId, new Date().toISOString(), paymentId]
    );

    const enrollmentConfirmationMessage = 'Your enrollment request was submitted successfully. Please wait while the review center verifies your payment.';
    await conn.query(
      `INSERT INTO chat_messages (student_id, center_id, enrollment_id, sender_id, receiver_id, message, is_read)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [userId, centerId, enrollmentId, center.user_id, userId, enrollmentConfirmationMessage]
    );

    console.log('[Enrollment] Saved Pending Manual Payment', {
      enrollmentId,
      userId,
      studentName,
      reviewCenterId: centerId,
      reviewCenterName: center.business_name,
      paymentId,
      transactionStatus: status,
      paymentMethod: methodConfig.label,
      programEnrolled,
      referenceNumber,
    });

    await conn.commit();
    return res.json({
      enrollmentId,
      studentId: userId,
      studentName,
      reviewCenterId: centerId,
      reviewCenterName: center.business_name,
      program: programEnrolled,
      paymentStatus: 'pending',
      enrollmentStatus: 'pending',
      createdAt: new Date().toISOString(),
      payment_id: paymentId,
      user_id: userId,
      review_center_id: Number(centerId),
      review_center_name: center.business_name,
      student_name: studentName,
      program_enrolled: programEnrolled,
      enrollment_status: 'pending',
      payment_status: 'pending',
      payment_proof_url: paymentProofUrl || null,
      amount,
      payment_method: methodConfig.label + ' Manual',
      transaction_status: status,
      message: 'Payment tracking saved. Please wait for the Center Admin to verify your ' + methodConfig.referenceLabel + '.',
    });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'This reference number has already been submitted for this payment method. Please use a unique reference number.' });
    }
    if (conn) try { await conn.rollback(); } catch (e) {}
    console.error('createGcashEnrollment error:', err);
    return res.status(500).json({ message: 'Server error.' });
  } finally {
    if (conn) try { conn.release(); } catch (e) {}
  }
};

// Render a small mock payment page where the user can "complete" the payment (for testing)
const getMockPaymentPage = async (req, res) => {
  const paymentId = req.params.id;
  try {
    const [rows] = await db.query(
      'SELECT p.*, u.email AS user_email, c.business_name FROM payments p JOIN users u ON u.id = p.user_id JOIN review_centers c ON c.id = p.center_id WHERE p.id = ?',
      [paymentId]
    );
    if (!rows || rows.length === 0) return res.status(404).send('Payment not found.');
    const p = rows[0];
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mock Payment</title>
      <style>body{font-family:Arial,Helvetica,sans-serif;background:#f6f9ff;color:#0d1b4b;padding:24px} .box{max-width:520px;margin:36px auto;background:#fff;padding:20px;border-radius:10px;box-shadow:0 8px 28px rgba(2,6,23,0.08)}button{background:#0a4cff;color:#fff;border:none;padding:10px 14px;border-radius:8px;cursor:pointer;font-weight:700}</style>
      </head><body><div class="box"><h2>Mock GCash Payment</h2>
      <p><strong>Center:</strong> ${String(p.business_name || '')}</p>
      <p><strong>Student:</strong> ${String(p.user_email || '')}</p>
      <p><strong>Amount:</strong> ₱ ${Number(p.amount).toLocaleString()}</p>
      <p style="color:#666;font-size:13px">This is a mock payment page for development. Click the button below to simulate a successful GCash payment.</p>
      <form method="POST" action="/api/payments/mock/${p.id}/complete"><button type="submit">Complete Payment (Mock)</button></form>
      </div></body></html>`;
    res.send(html);
  } catch (err) {
    console.error('getMockPaymentPage error:', err);
    return res.status(500).send('Server error.');
  }
};

// Complete the mock payment: mark as paid and create an enrollment record
const completeMockPayment = async (req, res) => {
  let conn;
  const paymentId = req.params.id;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM payments WHERE id = ? FOR UPDATE', [paymentId]);
    if (!rows || rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Payment not found.' });
    }
    const p = rows[0];
    if (p.status === 'paid') {
      await conn.rollback();
      return res.json({ message: 'Payment already completed.' });
    }

    // Update payment status
    const providerPaymentId = 'MOCK_GCASH_' + Date.now();
    await conn.query('UPDATE payments SET status = ?, provider_payment_id = ? WHERE id = ?', ['paid', providerPaymentId, paymentId]);

    // Create enrollment
    const [enrollmentInsert] = await conn.query(
      'INSERT INTO enrollments (user_id, center_id, payment_id, status, review_status, payment_verified) VALUES (?, ?, ?, ?, ?, ?)',
      [p.user_id, p.center_id, paymentId, 'pending', 'pending', 0]
    );
    const enrollmentId = enrollmentInsert.insertId;

    const [centerRows] = await conn.query('SELECT user_id FROM review_centers WHERE id = ? LIMIT 1', [p.center_id]);
    if (centerRows.length > 0) {
      const enrollmentConfirmationMessage = 'Your enrollment request was submitted successfully. Please wait while the review center verifies your payment.';
      await conn.query(
        `INSERT INTO chat_messages (student_id, center_id, enrollment_id, sender_id, receiver_id, message, is_read)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [p.user_id, p.center_id, enrollmentId, centerRows[0].user_id, p.user_id, enrollmentConfirmationMessage]
      );
    }

    await conn.commit();
    return res.json({ message: 'Payment completed and enrollment created.' });
  } catch (err) {
    if (conn) try { await conn.rollback(); } catch (e) {}
    console.error('completeMockPayment error:', err);
    return res.status(500).json({ message: 'Server error.' });
  } finally {
    if (conn) try { conn.release(); } catch (e) {}
  }
};

module.exports = { createGcashEnrollment, getMockPaymentPage, completeMockPayment };
