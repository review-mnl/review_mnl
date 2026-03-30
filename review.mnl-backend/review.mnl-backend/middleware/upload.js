const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const path = require('path');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const allowedFormats = ['jpg', 'jpeg', 'png', 'pdf'];

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'review-mnl-uploads',
    allowed_formats: allowedFormats,
    resource_type: 'auto',
    public_id: (req, file) => {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      return unique + path.extname(file.originalname);
    }
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (allowedFormats.includes(ext)) cb(null, true);
  else cb(new Error('Only PDF, JPG, and PNG files are allowed.'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = upload;
