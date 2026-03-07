const express = require('express');
const router  = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { getPendingCenters, getAllCenters, updateCenterStatus, getAllStudents, deleteUser, deleteCenter } = require('../controllers/adminController');
const { getPendingTestimonials, approveTestimonial, deleteTestimonial } = require('../controllers/testimonialController');

router.use(protect, adminOnly);

router.get('/centers/pending',          getPendingCenters);
router.get('/centers',                  getAllCenters);
router.put('/centers/:id/status',       updateCenterStatus);
router.delete('/centers/:id',           deleteCenter);
router.get('/students',                 getAllStudents);
router.delete('/users/:id',             deleteUser);
router.get('/testimonials/pending',     getPendingTestimonials);
router.put('/testimonials/:id/approve', approveTestimonial);
router.delete('/testimonials/:id',      deleteTestimonial);

module.exports = router;
