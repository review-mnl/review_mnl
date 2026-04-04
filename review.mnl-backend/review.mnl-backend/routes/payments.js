const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getMockPaymentPage, completeMockPayment } = require('../controllers/paymentsController');

// Public mock payment page (development/testing)
router.get('/mock/:id', getMockPaymentPage);
// Mock completion endpoint (POST) — used by the mock page
router.post('/mock/:id/complete', completeMockPayment);

module.exports = router;
