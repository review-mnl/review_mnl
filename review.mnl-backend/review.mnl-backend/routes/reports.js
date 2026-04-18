const express = require('express');
const multer = require('multer');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { createReport } = require('../controllers/reportController');

router.post(
	'/',
	protect,
	(req, res, next) => {
		upload.array('evidence_files', 5)(req, res, (err) => {
			if (!err) return next();

			if (err instanceof multer.MulterError) {
				if (err.code === 'LIMIT_FILE_SIZE') {
					return res.status(400).json({ message: 'Each attachment must be 5MB or smaller.' });
				}
				return res.status(400).json({ message: err.message || 'Invalid attachment upload.' });
			}

			return res.status(400).json({ message: err.message || 'Invalid attachment upload.' });
		});
	},
	createReport
);

module.exports = router;
