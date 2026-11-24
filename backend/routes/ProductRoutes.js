//routes/ProductRoutes.js
const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const ProductController = require('../controllers/ProductController');
const { authMiddleware, editorMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

const ProductUpload = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'manual', maxCount: 1 }
]);

// ✅ 公开：获取产品列表（product catalog）
router.get('/', ProductController.getProducts);

// 🔒 受保护（编辑员/管理员）：唯一性校验
router.get('/check-unique', authMiddleware, editorMiddleware, ProductController.checkUnique);

// 🔒 受保护（编辑员/管理员）：创建产品（先校验登录态与角色再接收文件上传）
router.post('/', authMiddleware, editorMiddleware, ProductUpload, ProductController.createProduct);

// 🔒 受保护（编辑员/管理员）：更新产品
router.put('/:id', authMiddleware, editorMiddleware, ProductUpload, ProductController.updateProduct);

// 🔒 受保护（仅管理员）：删除产品
router.delete('/:id', authMiddleware, adminMiddleware, ProductController.deleteProduct);

// ✅ 公开：获取产品关联关系（兼容/升级/替代）
router.get('/:id/relations', ProductController.getProductRelations);

// 🔒 受保护（编辑员/管理员）：设置产品关联关系
router.put('/:id/relations', authMiddleware, editorMiddleware, ProductController.setProductRelations);

module.exports = router;
