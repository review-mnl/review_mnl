const express = require('express');
const router  = express.Router();
const { protect, optionalAuth, centerOnly, studentOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
	getApprovedCenters,
	getCenterById,
	getCentersNearby,
	searchCenters,
	updateCenterLocation,
	updateCenterProfile,
	updateCenterLogo,
	getMyCenterProfile,
	getMyCenterEnrollments,
	verifyEnrollmentPayment,
	updateEnrollmentReviewStatus,
} = require('../controllers/centerController');
const { postTestimonial, getMyCenterTestimonials } = require('../controllers/testimonialController');
const { createGcashEnrollment } = require('../controllers/paymentsController');

router.get('/',          getApprovedCenters);
router.get('/nearby',    getCentersNearby);
router.get('/search',    searchCenters);
router.get('/me',        protect, centerOnly, getMyCenterProfile);
router.get('/me/enrollments', protect, centerOnly, getMyCenterEnrollments);
router.put('/me/enrollments/:enrollmentId/payment/verify', protect, centerOnly, verifyEnrollmentPayment);
router.put('/me/enrollments/:enrollmentId/status', protect, centerOnly, updateEnrollmentReviewStatus);
router.get('/me/testimonials', protect, centerOnly, getMyCenterTestimonials);
router.get('/:id',       optionalAuth, getCenterById);
router.put('/me/location', protect, centerOnly, updateCenterLocation);
router.put('/me', protect, centerOnly, updateCenterProfile);
router.put('/me/logo', protect, centerOnly, upload.single('logo'), updateCenterLogo);
router.post('/:id/testimonials', protect, postTestimonial);
// Enrollment: student initiates a GCash payment to enroll in a center
router.post('/:id/enroll/gcash', protect, studentOnly, createGcashEnrollment);

module.exports = router;
