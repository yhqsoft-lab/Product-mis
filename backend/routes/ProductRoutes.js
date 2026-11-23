//routes/ProductRoutes.js
const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const ProductController = require('../controllers/ProductController');
const { authMiddleware } = require('../middleware/authMiddleware');

const ProductUpload = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'manual', maxCount: 1 }
]);



// ✅ 公开：获取产品列表（product catalog）
router.get('/', ProductController.getProducts);

// ✅ 静态路由放在动态 /:id 路由之前
router.get('/check-unique', ProductController.checkUnique);

// 🔒 受保护：创建产品（先校验登录态再接收文件上传）
router.post('/', authMiddleware, ProductUpload, ProductController.createProduct);

// 🔒 受保护：更新产品
router.put('/:id', authMiddleware, ProductUpload, ProductController.updateProduct);

// 🔒 受保护：删除产品
router.delete('/:id', authMiddleware, ProductController.deleteProduct);

// ✅ 公开：获取产品关联关系（兼容/升级/替代）
router.get('/:id/relations', ProductController.getProductRelations);

// 🔒 受保护：设置产品关联关系
router.put('/:id/relations', authMiddleware, ProductController.setProductRelations);

module.exports = router;
