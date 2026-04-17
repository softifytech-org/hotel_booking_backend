const router = require('express').Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { uploadImages, deleteImage } = require('../controllers/imageController');

// Use memory storage — buffer is passed directly to Cloudinary stream
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max per file
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

router.post('/upload', authenticate, upload.array('images', 10), uploadImages);
router.delete('/', authenticate, deleteImage);

module.exports = router;
