const db = require('../config/db');
require('dotenv').config();

// Simple API-based GCash processing flow (mock/sandbox behavior).
// It stores payment details and returns success/failed immediately.
const createGcashEnrollment = async (req, res) => {
  let conn;
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ message: 'Authentication required.' });
    const userId = req.user.id;
    const centerId = req.params.id;
    const amount = parseInt(req.body.amount, 10) || 1550; // default in PHP pesos
    const gcashNumber = String(req.body.gcash_number || '').trim();
    const gcashName = String(req.body.gcash_name || '').trim();
    const simulateFail = Boolean(req.body.simulate_fail);
    const programEnrolled = String(req.body.program_enrolled || '').trim();
    const enrollmentDateRaw = String(req.body.enrollment_date || '').trim();
    const enrollmentDate = enrollmentDateRaw || new Date().toISOString().slice(0, 10);

    console.log('[Enrollment] Request received', {
      userId,
      centerId,
      amount,
      programEnrolled,
      enrollmentDate,
    });

    if (!gcashNumber || !gcashName) {
      return res.status(400).json({ message: 'GCash number and account name are required.' });
    }

    // Basic local validation for PH mobile format (11 digits starting with 09)
    if (!/^09\d{9}$/.test(gcashNumber)) {
      return res.status(400).json({ message: 'Please enter a valid GCash number (e.g., 09XXXXXXXXX).' });
    }
    if (amount <= 0) {
      return res.status(400).json({ message: 'Invalid payment amount.' });
    }

    // Ensure center exists
    const [centerRows] = await db.query('SELECT id, business_name FROM review_centers WHERE id = ?', [centerId]);
    if (!centerRows || centerRows.length === 0) return res.status(404).json({ message: 'Center not found.' });

    const maskedNumber = gcashNumber.replace(/\d(?=\d{4})/g, '*');
    const shouldFail = simulateFail;
    const status = shouldFail ? 'failed' : 'paid';
    const providerPaymentId = 'GCASH_MOCK_' + Date.now();

    conn = await db.getConnection();
    await conn.beginTransaction();

    // Store payment details (userId, amount, method/provider, transaction status, timestamp)
    const [result] = await conn.query(
      'INSERT INTO payments (user_id, center_id, provider, provider_payment_id, amount, currency, status, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        userId,
        centerId,
        'gcash',
        providerPaymentId,
        amount,
        'PHP',
        status,
        JSON.stringify({
          payment_method: 'GCash',
          gcash_number_masked: maskedNumber,
          gcash_name: gcashName,
          program_enrolled: programEnrolled,
          enrollment_date: enrollmentDate,
          mock: true,
        }),
      ]
    );
    const paymentId = result.insertId;

    // On successful payment, activate enrollment.
    if (!shouldFail) {
      await conn.query('INSERT INTO enrollments (user_id, center_id, payment_id, status) VALUES (?, ?, ?, ?)', [userId, centerId, paymentId, 'active']);
    }

    console.log('[Enrollment] Saved', {
      userId,
      centerId,
      paymentId,
      transactionStatus: status,
      programEnrolled,
      enrollmentDate,
    });

    await conn.commit();
    return res.json({
      payment_id: paymentId,
      user_id: userId,
      review_center_id: Number(centerId),
      program_enrolled: programEnrolled,
      enrollment_date: enrollmentDate,
      amount,
      payment_method: 'GCash',
      transaction_status: status,
      timestamp: new Date().toISOString(),
      message: shouldFail ? 'GCash payment failed. Please try again.' : 'GCash payment successful.',
    });
  } catch (err) {
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
    await conn.query('INSERT INTO enrollments (user_id, center_id, payment_id, status) VALUES (?, ?, ?, ?)', [p.user_id, p.center_id, paymentId, 'active']);

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
