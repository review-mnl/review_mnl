const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect, studentOnly } = require('../middleware/auth');
const { getMockPaymentPage, completeMockPayment, createGcashEnrollment } = require('../controllers/paymentsController');

// Student enrollment payment endpoint (primary route).
router.post('/gcash/:id', protect, studentOnly, upload.single('payment_proof'), createGcashEnrollment);

// Public mock payment page (development/testing)
router.get('/mock/:id', getMockPaymentPage);
// Mock completion endpoint (POST) — used by the mock page
router.post('/mock/:id/complete', completeMockPayment);

module.exports = router;
