const express = require('express');
const router = express.Router();
const { protect, centerOnly } = require('../middleware/auth');
const { getCenterEnrollmentsByCenterId, deleteEnrollment } = require('../controllers/enrollmentController');

router.get('/center/:centerId', protect, centerOnly, getCenterEnrollmentsByCenterId);
router.delete('/:id', protect, deleteEnrollment);

module.exports = router;
