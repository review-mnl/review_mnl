const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { getMyProfile, updateMyProfile, updateMyProfilePhoto } = require('../controllers/userController');

router.get('/me', protect, getMyProfile);
router.put('/me', protect, updateMyProfile);
router.put('/me/photo', protect, upload.single('profile_picture'), updateMyProfilePhoto);

module.exports = router;
