const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// 1. Configure Cloudinary with keys from .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Configure Storage Settings
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'open_audit_docs', // The folder name in your Cloudinary dashboard
    allowed_formats: ['jpg', 'png', 'jpeg', 'pdf'], // Restrict file types
    resource_type: 'auto', // Auto-detect (important for PDFs!)
  },
});

module.exports = { cloudinary, storage };
