const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { getActivityLogs, createActivityLog } = require('../controllers/activityLogController');

router.use(protect, adminOnly);

router.get('/', getActivityLogs);
router.post('/', createActivityLog);

module.exports = router;
