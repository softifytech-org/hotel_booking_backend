const cloudinary = require('../config/cloudinary');
const { createError } = require('../middleware/errorHandler');

// POST /api/images/upload
// Accepts: multipart/form-data with field "images" (multiple files supported)
const uploadImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return next(createError('No files uploaded', 400));
    }

    const folder = req.body.folder || 'hotel-saas';

    const uploadPromises = req.files.map(file =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: 'image',
            transformation: [
              { width: 1200, height: 800, crop: 'fill', quality: 'auto', fetch_format: 'auto' }
            ]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve({
              url: result.secure_url,
              public_id: result.public_id,
              width: result.width,
              height: result.height,
              format: result.format,
              size: result.bytes
            });
          }
        );
        stream.end(file.buffer);
      })
    );

    const results = await Promise.all(uploadPromises);
    const urls = results.map(r => r.url);

    res.json({
      success: true,
      message: `${results.length} image(s) uploaded`,
      data: { urls, details: results }
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/images  (delete from Cloudinary by public_id)
const deleteImage = async (req, res, next) => {
  try {
    const { public_id } = req.body;
    if (!public_id) return next(createError('public_id is required', 400));

    await cloudinary.uploader.destroy(public_id);
    res.json({ success: true, message: 'Image deleted from Cloudinary' });
  } catch (err) {
    next(err);
  }
};

module.exports = { uploadImages, deleteImage };
