const express = require('express');
const router = express.Router();
const { protect, centerOnly } = require('../middleware/auth');
const { getCenterEnrollmentsByCenterId, deleteMyEnrollment } = require('../controllers/enrollmentController');

router.get('/center/:centerId', protect, centerOnly, getCenterEnrollmentsByCenterId);
router.delete('/:id', protect, deleteMyEnrollment);

module.exports = router;
