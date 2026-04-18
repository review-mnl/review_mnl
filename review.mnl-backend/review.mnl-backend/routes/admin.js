const express = require('express');
const router  = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { getPendingCenters, getAllCenters, updateCenterStatus, getAllStudents, deleteUser, deleteCenter, getCenterDocuments, getSiteSettings, updateSiteSettings } = require('../controllers/adminController');
const { getPendingTestimonials, approveTestimonial, deleteTestimonial } = require('../controllers/testimonialController');
const { getReports, updateReportStatus, sendReportWarning } = require('../controllers/reportController');

router.use(protect, adminOnly);

router.get('/centers/pending',          getPendingCenters);
router.get('/centers',                  getAllCenters);
router.get('/centers/:id/documents',    getCenterDocuments);
router.put('/centers/:id/status',       updateCenterStatus);
router.delete('/centers/:id',           deleteCenter);
router.get('/students',                 getAllStudents);
router.delete('/users/:id',             deleteUser);
router.get('/testimonials/pending',     getPendingTestimonials);
router.put('/testimonials/:id/approve', approveTestimonial);
router.delete('/testimonials/:id',      deleteTestimonial);
router.get('/reports',                  getReports);
router.put('/reports/:id/status',       updateReportStatus);
router.post('/reports/:id/warn',        sendReportWarning);
router.get('/settings',                 getSiteSettings);
router.put('/settings',                 updateSiteSettings);

module.exports = router;
