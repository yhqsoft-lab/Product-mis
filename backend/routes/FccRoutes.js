// routes/FccRoutes.js
const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const FccController = require('../controllers/FccController');
const { authMiddleware, editorMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

// ✅ 修复关键：使用 .single() 将文件挂载到 req.file，与控制器的读取逻辑匹配
const fccUpload = upload.single('image');

// 🔧 Multer 错误拦截中间件（防止上传失败时返回丑陋的 500 错误）
const handleMulterError = (err, req, res, next) => {
  if (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: '文件大小不能超过 5MB' });
    }
    if (err.message.includes('仅允许')) {
      return res.status(400).json({ message: err.message });
    }
    return res.status(400).json({ message: `上传错误: ${err.message}` });
  }
  next();
};

// 🔥 0. 热门查询统计（公开接口，必须在 /:id 之前定义）
router.get('/hot-searches', FccController.getHotSearches);

// 📦 1. 适配控制器管理路由（必须在 /:id 之前定义）
router.route('/:id/products')
  .get(FccController.getProductsByFcc)
  .post(authMiddleware, editorMiddleware, FccController.addProductToFcc);

router.delete(
  '/:id/products/:productId',
  authMiddleware,
  editorMiddleware,
  FccController.removeProductFromFcc
);

// 📝 2. 单个 FCC 管理
router.route('/:id')
  .put(authMiddleware, editorMiddleware, fccUpload, handleMulterError, FccController.updateFcc)
  .delete(authMiddleware, adminMiddleware, FccController.deleteFcc);

// 📋 3. 列表获取 + 创建
router.route('/')
  .get(FccController.getFccs)
  .post(authMiddleware, editorMiddleware, fccUpload, handleMulterError, FccController.createFcc);

module.exports = router;
