const express = require('express');
const router = express.Router();
const { protect, centerOnly } = require('../middleware/auth');
const { getCenterEnrollmentsByCenterId } = require('../controllers/enrollmentController');

router.get('/center/:centerId', protect, centerOnly, getCenterEnrollmentsByCenterId);

module.exports = router;
