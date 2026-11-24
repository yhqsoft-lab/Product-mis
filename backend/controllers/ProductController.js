// controllers/ProductController.js
const { Op } = require('sequelize');
const fs = require('fs/promises');
const path = require('path');
const { Product, DropdownOption, sequelize } = require('../models');
const { ensureOptionExists } = require('./OptionController');

const parsePaginationParams = (query, defaultPageSize = 12, maxPageSize = 100) => {
  const hasPagination =
    query.page !== undefined || query.pageSize !== undefined || query.limit !== undefined;
  const rawPage = Number.parseInt(query.page, 10);
  const rawSize = Number.parseInt(query.pageSize ?? query.limit, 10);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize =
    Number.isInteger(rawSize) && rawSize > 0
      ? Math.min(rawSize, maxPageSize)
      : defaultPageSize;
  return { hasPagination, page, pageSize };
};

const RELATED_PRODUCT_ATTRIBUTES = [
  'id',
  'sku',
  'model',
  'brand',
  'productfccId',
  'productType',
  'description',
  'httpLink',
  'status',
  'manual',
  'image'
];

const buildProductIncludes = () => [
  {
    model: Product,
    as: 'compatibleProducts',
    attributes: RELATED_PRODUCT_ATTRIBUTES,
    through: { attributes: [] }
  },
  {
    model: Product,
    as: 'upgradeProducts',
    attributes: RELATED_PRODUCT_ATTRIBUTES,
    through: { attributes: [] }
  },
  {
    model: Product,
    as: 'replacementProducts',
    attributes: RELATED_PRODUCT_ATTRIBUTES,
    through: { attributes: [] }
  }
];

const formatProductList = (products) =>
  products.map((p) => {
    const plain = p.get({ plain: true });
    return {
      ...plain,
      compatibleIds: plain.compatibleProducts?.map((cp) => cp.id) || [],
      upgradeIds: plain.upgradeProducts?.map((cp) => cp.id) || [],
      replacementIds: plain.replacementProducts?.map((rp) => rp.id) || []
    };
  });

// 获取产品列表（支持模糊搜索与服务端分页）
exports.getProducts = async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const { hasPagination, page, pageSize } = parsePaginationParams(req.query, 12, 100);

  try {
    const where = {};
    if (search) {
      where[Op.or] = [
        { model: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } },
        { brand: { [Op.like]: `%${search}%` } },
        { productfccId: { [Op.like]: `%${search}%` } }
      ];
    }

    if (hasPagination) {
      const total = await Product.count({ where });
      const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
      const safePage = totalPages > 0 ? Math.min(page, totalPages) : 1;
      const offset = (safePage - 1) * pageSize;

      let products = [];
      if (total > 0) {
        const idRows = await Product.findAll({
          where,
          attributes: ['id'],
          order: [['id', 'DESC']],
          limit: pageSize,
          offset
        });
        const pageIds = idRows.map((row) => row.id);
        if (pageIds.length > 0) {
          products = await Product.findAll({
            where: { id: { [Op.in]: pageIds } },
            include: buildProductIncludes(),
            order: [['id', 'DESC']]
          });
        }
      }

      return res.status(200).json({
        items: formatProductList(products),
        pagination: {
          page: safePage,
          pageSize,
          total,
          totalPages
        }
      });
    }

    // 兼容未传分页参数的调用方（如关系选择器），上限保护 500 条
    const products = await Product.findAll({
      where,
      limit: 500,
      include: buildProductIncludes(),
      order: [['id', 'DESC']]
    });

    res.status(200).json(formatProductList(products));
  } catch (err) {
    console.error('获取产品列表失败:', err);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

const isValidProductStatus = async (statusValue) => {
  if (!statusValue) return false;
  if (!DropdownOption) return true;
  const matched = await DropdownOption.findOne({
    where: { category: 'status', value: statusValue }
  });
  return Boolean(matched);
};

const cleanupUploadedFiles = async (files) => {
  if (!files) return;
  const targets = [
    ...(files.image || []),
    ...(files.manual || [])
  ];
  await Promise.all(
    targets.map(async (f) => {
      if (f?.path) {
        try {
          await fs.unlink(f.path);
        } catch (_) {
          // 忽略已删除或不存在的文件
        }
      }
    })
  );
};

// 创建新产品
exports.createProduct = async (req, res) => {
  try {
    const sku = String(req.body.sku || '').trim();
    const model = String(req.body.model || '').trim();
    const description = String(req.body.description || '').trim();
    const brand = String(req.body.brand || '').trim();
    const productfccId = String(req.body.productfccId ?? req.body.fccId ?? '').trim();
    const productType = String(req.body.productType || '').trim();
    const httpLink = String(req.body.httpLink || '').trim();
    const status = req.body.status !== undefined && req.body.status !== ''
      ? String(req.body.status).trim()
      : 'active';

    if (!sku) {
      await cleanupUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: 'SKU 不能为空' });
    }
    if (!model) {
      await cleanupUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: '型号（Model）不能为空' });
    }
    if (!brand) {
      await cleanupUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: '完美替代品牌不能为空' });
    }
    if (!productfccId) {
      await cleanupUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: '完美替代型号（FCC ID）不能为空' });
    }
    if (!(await isValidProductStatus(status))) {
      await cleanupUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: '无效的产品销售状态' });
    }

    // 检查 SKU 是否已存在
    const existingSku = await Product.findOne({ where: { sku } });
    if (existingSku) {
      await cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'SKU 已存在，请使用其他 SKU'
      });
    }

    // 检查 Model 是否已存在
    const existingModel = await Product.findOne({ where: { model } });
    if (existingModel) {
      await cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: '型号（Model）已存在，请使用其他型号'
      });
    }

    let imagePath = null;
    let manualPath = null;

    if (req.files) {
      if (req.files.image && req.files.image[0]) {
        imagePath = `/uploads/${req.files.image[0].filename}`;
      }
      if (req.files.manual && req.files.manual[0]) {
        manualPath = `/uploads/${req.files.manual[0].filename}`;
      }
    }

    const newProduct = await Product.create({
      sku,
      model,
      description,
      brand,
      productfccId,
      productType,
      httpLink,
      status,
      manual: manualPath,
      image: imagePath
    });

    // 自动将新输入的品牌/产品类型写入数据库下拉选项表
    await Promise.all([
      ensureOptionExists('brand', brand),
      ensureOptionExists('productType', productType)
    ]);

    const plain = newProduct.toJSON ? newProduct.toJSON() : newProduct;
    res.status(201).json({
      ...plain,
      compatibleIds: [],
      upgradeIds: [],
      replacementIds: []
    });
  } catch (err) {
    await cleanupUploadedFiles(req.files);
    console.error('创建产品失败:', err.message);
    res.status(400).json({ message: err.message });
  }
};

// 更新产品
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      await cleanupUploadedFiles(req.files);
      return res.status(404).json({ message: '未找到该产品' });
    }

    const { id } = req.params;
    const sku = req.body.sku !== undefined ? String(req.body.sku).trim() : product.sku;
    const model = req.body.model !== undefined ? String(req.body.model).trim() : product.model;
    const description = req.body.description !== undefined ? String(req.body.description).trim() : product.description;
    const brand = req.body.brand !== undefined ? String(req.body.brand).trim() : product.brand;
    const rawFccId = req.body.productfccId !== undefined ? req.body.productfccId : req.body.fccId;
    const productfccId = rawFccId !== undefined ? String(rawFccId).trim() : (product.productfccId || '');
    const productType = req.body.productType !== undefined ? String(req.body.productType).trim() : product.productType;
    const httpLink = req.body.httpLink !== undefined ? String(req.body.httpLink).trim() : product.httpLink;

    // 校验并保留原有 status，避免未传时被误重置为 active
    const statusValue =
      req.body.status !== undefined && req.body.status !== ''
        ? String(req.body.status).trim()
        : product.status || 'active';

    if (!sku) {
      await cleanupUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: 'SKU 不能为空' });
    }
    if (!model) {
      await cleanupUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: '型号（Model）不能为空' });
    }
    if (!brand) {
      await cleanupUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: '完美替代品牌不能为空' });
    }
    if (!productfccId) {
      await cleanupUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: '完美替代型号（FCC ID）不能为空' });
    }
    if (!(await isValidProductStatus(statusValue))) {
      await cleanupUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: '无效的产品销售状态' });
    }

    // 检查 SKU（排除自身）
    const existingSku = await Product.findOne({
      where: {
        sku,
        id: { [Op.ne]: id }
      }
    });
    if (existingSku) {
      await cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'SKU 已存在，请使用其他 SKU'
      });
    }

    // 检查 Model（排除自身）
    const existingModel = await Product.findOne({
      where: {
        model,
        id: { [Op.ne]: id }
      }
    });
    if (existingModel) {
      await cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: '型号（Model）已存在，请使用其他型号'
      });
    }

    // 动态处理文件路径（支持 JSON 传 null 以及 FormData 传 removeImage/removeManual）
    let imagePath = product.image;
    let manualPath = product.manual;

    if (req.files?.image?.[0]) {
      imagePath = `/uploads/${req.files.image[0].filename}`;
    } else if (req.body.image === null || req.body.removeImage === 'true') {
      imagePath = null;
    }

    if (req.files?.manual?.[0]) {
      manualPath = `/uploads/${req.files.manual[0].filename}`;
    } else if (req.body.manual === null || req.body.removeManual === 'true') {
      manualPath = null;
    }

    // 安全删除旧文件
    const isValidPath = (p) =>
      p && p.startsWith('/uploads/') && !p.includes('..');

    try {
      if (imagePath !== product.image && product.image && isValidPath(product.image)) {
        await fs.unlink(path.join(__dirname, '../public', product.image));
      }
      if (manualPath !== product.manual && product.manual && isValidPath(product.manual)) {
        await fs.unlink(path.join(__dirname, '../public', product.manual));
      }
    } catch (err) {
      console.warn('删除旧文件失败:', err.message);
    }

    await product.update({
      sku,
      model,
      description,
      brand,
      productfccId,
      productType,
      httpLink,
      status: statusValue,
      image: imagePath,
      manual: manualPath
    });

    // 自动将新输入的品牌/产品类型写入数据库下拉选项表
    await Promise.all([
      ensureOptionExists('brand', brand),
      ensureOptionExists('productType', productType)
    ]);

    res.json(product);
  } catch (err) {
    await cleanupUploadedFiles(req.files);
    console.error('更新产品失败:', err);
    res.status(500).json({ message: err.message || '服务器内部错误' });
  }
};
// 删除产品
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ message: '未找到该产品' });
    }

    try {
      if (product.image) {
        const filePath = path.join(__dirname, '../public', product.image);
        await fs.access(filePath);
        await fs.unlink(filePath);
      }
      if (product.manual) {
        const filePath = path.join(__dirname, '../public', product.manual);
        await fs.access(filePath);
        await fs.unlink(filePath);
      }
    } catch (err) {
      console.error('删除文件失败:', err);
    }

    await product.destroy();
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error('删除失败:', err);
    res.status(500).json({ message: '删除失败，请重试' });
  }
};

// 获取产品的所有关联产品
exports.getProductRelations = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ message: '产品不存在' });
    }

    const [compatible, upgrade, replacement] = await Promise.all([
      product.getCompatibleProducts(),
      product.getUpgradeProducts(),
      product.getReplacementProducts()
    ]);

    // ✅ 修复：添加 "data" 键名
    res.json({
      success: true,
      data: {
        compatible: compatible.map(p => p.toJSON()),
        upgrade: upgrade.map(p => p.toJSON()),
        replacement: replacement.map(p => p.toJSON())
      }
    });
  } catch (err) {
    console.error('获取关系失败:', err);
    res.status(500).json({ message: '服务器错误' });
  }
};
// 设置产品关系（全量替换）
exports.setProductRelations = async (req, res) => {
  const sourceId = Number(req.params.id);
  if (!Number.isInteger(sourceId) || sourceId <= 0) {
    return res.status(400).json({ message: '无效的产品 ID' });
  }

  const { compatible = [], upgrade = [], replacement = [] } = req.body || {};

  if (!Array.isArray(compatible) || !Array.isArray(upgrade) || !Array.isArray(replacement)) {
    return res.status(400).json({ message: '关系列表格式不正确，必须为数组' });
  }

  const normalizeIds = (list) => {
    const parsed = [];
    for (const pid of list) {
      const num = Number(pid);
      if (!Number.isInteger(num) || num <= 0) {
        return null;
      }
      parsed.push(num);
    }
    return parsed;
  };

  const compatibleIds = normalizeIds(compatible);
  const upgradeIds = normalizeIds(upgrade);
  const replacementIds = normalizeIds(replacement);

  if (!compatibleIds || !upgradeIds || !replacementIds) {
    return res.status(400).json({ message: '无效的产品ID' });
  }

  try {
    const product = await Product.findByPk(sourceId);
    if (!product) {
      return res.status(404).json({ message: '产品不存在' });
    }

    // 去重并排除自身，确保同一目标产品只关联一种关系类型
    const seenTargets = new Set([sourceId]);
    const relations = [];

    const appendRelations = (ids, type) => {
      for (const targetId of ids) {
        if (!seenTargets.has(targetId)) {
          seenTargets.add(targetId);
          relations.push([sourceId, targetId, type]);
        }
      }
    };

    appendRelations(compatibleIds, 'compatible');
    appendRelations(upgradeIds, 'upgrade');
    appendRelations(replacementIds, 'replacement');

    await sequelize.transaction(async (t) => {
      await sequelize.query(
        `DELETE FROM product_relations
         WHERE source_product_id = ?
         AND relation_type IN ('compatible','upgrade', 'replacement')`,
        { replacements: [sourceId], transaction: t }
      );

      if (relations.length > 0) {
        const placeholders = relations.map(() => '(?, ?, ?)').join(', ');
        const flatValues = relations.flat();

        await sequelize.query(
          `INSERT INTO product_relations
           (source_product_id, target_product_id, relation_type)
           VALUES ${placeholders}`,
          { replacements: flatValues, transaction: t }
        );
      }
    });

    res.json({ success: true, message: '关系更新成功' });
  } catch (err) {
    console.error('设置关系失败:', err);
    res.status(500).json({ message: '服务器错误' });
  }
};

// 检查 SKU/Model 唯一性
exports.checkUnique = async (req, res) => {
  try {
    const { sku, model, excludeId } = req.query;

    if (!sku && !model) {
      return res.status(400).json({
        success: false,
        message: '必须提供 sku 或 model 参数'
      });
    }

    let exists = false;

    if (sku) {
      const where = { sku };
      if (excludeId) where.id = { [Op.ne]: excludeId };
      exists = await Product.findOne({ where });
    } else if (model) {
      const where = { model };
      if (excludeId) where.id = { [Op.ne]: excludeId };
      exists = await Product.findOne({ where });
    }

    res.json({
      success: true,
      unique: !exists
    });
  } catch (err) {
    console.error('检查唯一性失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};
