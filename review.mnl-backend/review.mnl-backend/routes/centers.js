const express = require('express');
const router  = express.Router();
const { protect, centerOnly } = require('../middleware/auth');
const { getApprovedCenters, getCenterById, getCentersNearby, searchCenters, updateCenterLocation, getMyCenterProfile } = require('../controllers/centerController');
const { postTestimonial } = require('../controllers/testimonialController');

router.get('/',          getApprovedCenters);
router.get('/nearby',    getCentersNearby);
router.get('/search',    searchCenters);
router.get('/me',        protect, centerOnly, getMyCenterProfile);
router.get('/:id',       getCenterById);
router.put('/me/location', protect, centerOnly, updateCenterLocation);
router.post('/:id/testimonials', protect, postTestimonial);

module.exports = router;
