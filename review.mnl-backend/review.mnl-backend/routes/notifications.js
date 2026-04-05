const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createNotification,
  getMyNotifications,
  markNotificationAsRead,
  streamMyNotifications,
} = require('../controllers/notificationController');

router.post('/', protect, createNotification);
router.get('/me', protect, getMyNotifications);
router.get('/stream', protect, streamMyNotifications);
router.put('/:id/read', protect, markNotificationAsRead);

module.exports = router;
