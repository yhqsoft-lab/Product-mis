// middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const decodeOriginalName = (rawName = '') => {
  if (!rawName || typeof rawName !== 'string') return '';
  if (/[^\u0000-\u00FF]/.test(rawName)) {
    return rawName;
  }
  if (/[\u0080-\u00FF]/.test(rawName)) {
    try {
      const decoded = Buffer.from(rawName, 'latin1').toString('utf8');
      if (decoded && !decoded.includes('\uFFFD')) {
        return decoded;
      }
    } catch {
      // ignore and fall back
    }
  }
  return rawName;
};

const sanitizeDisplayBaseName = (originalName = '', ext = '') => {
  const decoded = decodeOriginalName(originalName);
  const rawBase = ext ? decoded.slice(0, Math.max(0, decoded.length - ext.length)) : decoded;
  const cleaned = rawBase
    .replace(/[\u0000-\u001F\u007F/\\:*?"<>|#%&?+]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '')
    .trim();

  if (!cleaned) return '';

  let result = '';
  let byteLen = 0;
  for (const ch of cleaned) {
    const chBytes = Buffer.byteLength(ch, 'utf8');
    if (result.length >= 60 || byteLen + chBytes > 140) break;
    result += ch;
    byteLen += chBytes;
  }
  return result.trim();
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.floor(Math.random() * 1000);

    if (file.fieldname === 'manual') {
      const safeBase = sanitizeDisplayBaseName(file.originalname, ext);
      const namePart = safeBase ? `__${safeBase}` : '';
      cb(null, `manual-${uniqueSuffix}${namePart}${ext}`);
    } else if (file.fieldname === 'qaDocument') {
      const safeBase = sanitizeDisplayBaseName(file.originalname, ext);
      const namePart = safeBase ? `__${safeBase}` : '';
      cb(null, `qa-${uniqueSuffix}${namePart}${ext}`);
    } else {
      cb(null, 'image-' + uniqueSuffix + ext);
    }
  }
});

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_QA_EXTS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];
const ALLOWED_QA_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-office',
  'application/octet-stream'
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (file.fieldname === 'manual') {
    if (file.mimetype === 'application/pdf' || ext === '.pdf') {
      return cb(null, true);
    }
    return cb(new Error('说明书仅允许上传 PDF 文件'), false);
  }

  if (file.fieldname === 'qaDocument') {
    if (ALLOWED_QA_EXTS.includes(ext) && ALLOWED_QA_MIMES.includes(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error('QA 文档仅允许上传 PDF、DOC、DOCX、XLS 或 XLSX 文件'), false);
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
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB 限制
});

// ✅ 导出完整的 multer 实例（不是 single）
module.exports = upload;
