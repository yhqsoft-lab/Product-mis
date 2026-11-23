// middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.floor(Math.random() * 1000);

    if (file.fieldname === 'manual') {
      cb(null, 'manual-' + uniqueSuffix + ext);
    } else {
      cb(null, 'image-' + uniqueSuffix + ext);
    }
  }
});

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'manual') {
    if (file.mimetype === 'application/pdf') {
      return cb(null, true);
    }
    return cb(new Error('说明书仅允许上传 PDF 文件'), false);
  }

  if (file.fieldname === 'image') {
    if (ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error('产品图片仅允许上传 JPEG、PNG、GIF 或 WebP 格式'), false);
  }

  if (file.mimetype === 'application/pdf' || ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
    return cb(null, true);
  }
  return cb(new Error('仅允许上传 PDF 或图片文件 (JPEG, PNG, GIF, WebP)'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB 限制
});

// ✅ 导出完整的 multer 实例（不是 single）
module.exports = upload;
