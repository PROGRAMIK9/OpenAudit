const { cloudinary } = require('../config/cloudinary');
const { PassThrough } = require('stream');

function validateBuffer(buffer) {
  if (!buffer || !(buffer instanceof Buffer)) {
    throw new Error('A valid PDF buffer is required for upload.');
  }
}

async function uploadPdfBuffer(buffer) {
  validateBuffer(buffer);

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        folder: 'tax-docs',
        format: 'pdf'
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        if (!result || !result.secure_url) {
          return reject(new Error('Cloudinary upload did not return a secure URL.'));
        }
        resolve(result.secure_url);
      }
    );

    const passthrough = new PassThrough();
    passthrough.end(buffer);
    passthrough.pipe(uploadStream);
  });
}

module.exports = {
  uploadPdfBuffer
};
