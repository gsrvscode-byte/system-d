const path = require('path');
const multer = require('multer');
const { ApiError } = require('../utils/error');

const allowedMimes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads', 'tasks')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  },
});

const fileFilter = (req, file, cb) => {
  if (allowedMimes.includes(file.mimetype)) return cb(null, true);
  cb(new ApiError(`File type ${file.mimetype} is not allowed. Allowed: PDF, DOCX, PNG, JPG, JPEG`, 400));
};

const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10);

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxSize },
});

module.exports = { upload };
