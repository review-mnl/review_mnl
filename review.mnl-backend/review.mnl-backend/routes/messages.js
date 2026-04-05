const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  sendMessage,
  getConversations,
  getThreadMessages,
  markThreadAsRead,
} = require('../controllers/messagesController');

router.get('/conversations', protect, getConversations);
router.get('/thread', protect, getThreadMessages);
router.post('/', protect, sendMessage);
router.put('/thread/read', protect, markThreadAsRead);

module.exports = router;
