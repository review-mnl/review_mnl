const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/auth');
const chatUpload = require('../middleware/chatUpload');
const {
  sendMessage,
  getConversations,
  getThreadMessages,
  markThreadAsRead,
  deleteConversation,
} = require('../controllers/messagesController');

router.get('/conversations', protect, getConversations);
router.get('/thread', protect, getThreadMessages);
router.post(
  '/',
  protect,
  (req, res, next) => {
    chatUpload.single('attachment')(req, res, (err) => {
      if (!err) return next();

      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'Attachment must be 8MB or smaller.' });
        }
        return res.status(400).json({ message: err.message || 'Invalid attachment upload.' });
      }

      return res.status(400).json({ message: err.message || 'Invalid attachment upload.' });
    });
  },
  sendMessage
);
router.put('/thread/read', protect, markThreadAsRead);
router.delete('/thread', protect, deleteConversation);

module.exports = router;
