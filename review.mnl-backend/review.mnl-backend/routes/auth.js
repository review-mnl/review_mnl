const express = require('express');
const router  = express.Router();
const upload  = require('../middleware/upload');
const { registerStudent, registerCenter, verifyEmail, login, forgotPassword } = require('../controllers/authController');

router.post('/register/student', registerStudent);
router.post('/register/center',
  upload.fields([
    { name: 'business_permit', maxCount: 1 },
    { name: 'dti_sec_reg', maxCount: 1 },
  ]),
  registerCenter
);
router.get('/verify-email', verifyEmail);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);

module.exports = router;
