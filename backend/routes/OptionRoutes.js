// backend/routes/OptionRoutes.js
const express = require('express');
const router = express.Router();
const OptionController = require('../controllers/OptionController');
const {
  authMiddleware,
  editorMiddleware,
  adminMiddleware
} = require('../middleware/authMiddleware');

// 公开读取启用中的下拉选项（供前台状态展示与后台表单下拉使用）
router.get('/', OptionController.getOptions);

// 后台选项字典管理（editor 可查询/新增/编辑/同步，仅 admin 可删除）
router.get('/manage', authMiddleware, editorMiddleware, OptionController.listOptionsForAdmin);
router.post('/sync', authMiddleware, editorMiddleware, OptionController.syncFromRecords);
router.post('/', authMiddleware, editorMiddleware, OptionController.createOption);
router.put('/:id', authMiddleware, editorMiddleware, OptionController.updateOption);
router.delete('/:id', authMiddleware, adminMiddleware, OptionController.deleteOption);

module.exports = router;
