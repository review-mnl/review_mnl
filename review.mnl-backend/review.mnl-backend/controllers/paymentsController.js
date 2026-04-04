const db = require('../config/db');
require('dotenv').config();

// Create a payment record and return a payment URL (mock by default)
const createGcashEnrollment = async (req, res) => {
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ message: 'Authentication required.' });
    const userId = req.user.id;
    const centerId = req.params.id;
    const amount = parseInt(req.body.amount, 10) || 1550; // default in PHP pesos

    // Ensure center exists
    const [centerRows] = await db.query('SELECT id, business_name FROM review_centers WHERE id = ?', [centerId]);
    if (!centerRows || centerRows.length === 0) return res.status(404).json({ message: 'Center not found.' });

    // Insert payment record (mock provider)
    const [result] = await db.query(
      'INSERT INTO payments (user_id, center_id, provider, amount, currency, status, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, centerId, 'mock_gcash', amount, 'PHP', 'pending', JSON.stringify({ source: 'gcash_mock' })]
    );
    const paymentId = result.insertId;

    const host = process.env.BACKEND_URL || (`http://localhost:${process.env.PORT || 5000}`);
    const paymentUrl = host.replace(/\/\/$/, '') + '/api/payments/mock/' + paymentId;

    return res.json({ payment_id: paymentId, payment_url: paymentUrl, message: 'Mock GCash payment created.' });
  } catch (err) {
    console.error('createGcashEnrollment error:', err);
    return res.status(500).json({ message: 'Server error.' });
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
