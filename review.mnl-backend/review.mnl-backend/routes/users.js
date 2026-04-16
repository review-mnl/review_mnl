const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
	getMyProfile,
	getMyEnrollments,
	getMyRatings,
	upsertMyRating,
	updateMyProfile,
	updateMyProfilePhoto,
} = require('../controllers/userController');

router.get('/me', protect, getMyProfile);
router.get('/me/enrollments', protect, getMyEnrollments);
router.get('/me/ratings', protect, getMyRatings);
router.put('/me/ratings/:centerId', protect, upsertMyRating);
router.put('/me', protect, updateMyProfile);
router.put('/me/photo', protect, upload.single('profile_picture'), updateMyProfilePhoto);

module.exports = router;

// Public endpoint to get a user's public profile by ID (for avatars)
router.get('/:id/public', async (req, res) => {
	try {
		const db = require('../config/db');
		const [rows] = await db.query(
			`SELECT id, first_name, last_name, profile_picture_url, role FROM users WHERE id = ?`,
			[req.params.id]
		);
		if (rows.length === 0) return res.status(404).json({ message: 'User not found.' });
		res.json({ user: rows[0] });
	} catch (err) {
		res.status(500).json({ message: 'Server error.' });
	}
});
