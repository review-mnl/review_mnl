const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');

const hasCloudinaryConfig = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (hasCloudinaryConfig) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const allowedFormats = ['jpg', 'jpeg', 'png', 'pdf'];

let storage;
if (hasCloudinaryConfig) {
  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      let folderName = 'review-mnl-uploads/misc';
      
      // Determine the specific Cloudinary folder based on the field name
      if (file.fieldname === 'business_permit' || file.fieldname === 'dti_sec_reg') {
        folderName = 'review-mnl-uploads/documents submission';
      } else if (file.fieldname === 'logo') {
        folderName = 'review-mnl-uploads/center logos';
      } else if (file.fieldname === 'profile_picture') {
        folderName = 'review-mnl-uploads/profile pictures';
      }

      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);      
      return {
        folder: folderName,
        allowed_formats: allowedFormats,
        resource_type: 'auto',
        // In params as a function format, providing an extension in public_id can sometimes cause 
        // trailing duplicates. We replace the dot with an underscore just to be safe.
        public_id: unique + path.extname(file.originalname).replace('.', '_')
      };
    },
  });
} else {
  const uploadDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, unique + path.extname(file.originalname));
    }
  });
}

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
