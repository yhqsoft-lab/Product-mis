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
  'nasLink',
  'status',
  'manual',
  'qaDocument',
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
    as: 'mutualReplacementProducts',
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
      mutualReplacementIds: plain.mutualReplacementProducts?.map((mp) => mp.id) || [],
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
      const tokens = search.split(/[\s+＋]+/).filter(Boolean);
      const buildTokenClause = (token) => ({
        [Op.or]: [
          { model: { [Op.like]: `%${token}%` } },
          { sku: { [Op.like]: `%${token}%` } },
          { brand: { [Op.like]: `%${token}%` } },
          { productfccId: { [Op.like]: `%${token}%` } }
        ]
      });

      if (tokens.length > 1) {
        where[Op.and] = tokens.map(buildTokenClause);
      } else if (tokens.length === 1) {
        Object.assign(where, buildTokenClause(tokens[0]));
      }
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

const isSafeExternalLink = (rawLink) => {
  if (!rawLink) return true;
  const lower = String(rawLink).trim().toLowerCase();
  return !/^(javascript|vbscript|data):/.test(lower);
};

const cleanupUploadedFiles = async (files) => {
  if (!files) return;
  const targets = [
    ...(files.image || []),
    ...(files.manual || []),
    ...(files.qaDocument || [])
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
    const nasLink = String(req.body.nasLink || '').trim();
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
    if (!isSafeExternalLink(httpLink) || !isSafeExternalLink(nasLink)) {
      await cleanupUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: '链接协议不安全，请使用合法的链接地址' });
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
    let qaDocumentPath = null;

    if (req.files) {
      if (req.files.image && req.files.image[0]) {
        imagePath = `/uploads/${req.files.image[0].filename}`;
      }
      if (req.files.manual && req.files.manual[0]) {
        manualPath = `/uploads/${req.files.manual[0].filename}`;
      }
      if (req.files.qaDocument && req.files.qaDocument[0]) {
        qaDocumentPath = `/uploads/${req.files.qaDocument[0].filename}`;
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
      nasLink,
      status,
      manual: manualPath,
      qaDocument: qaDocumentPath,
      image: imagePath
    });

    // 自动将新输入的品牌/产品类型写入数据库下拉选项表
    await Promise.all([
      brand ? ensureOptionExists('brand', brand) : Promise.resolve(),
      productType ? ensureOptionExists('productType', productType) : Promise.resolve()
    ]);

    const plain = newProduct.toJSON ? newProduct.toJSON() : newProduct;
    res.status(201).json({
      ...plain,
      compatibleIds: [],
      upgradeIds: [],
      mutualReplacementIds: [],
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
    const brand = req.body.brand !== undefined ? String(req.body.brand).trim() : (product.brand || '');
    const rawFccId = req.body.productfccId !== undefined ? req.body.productfccId : req.body.fccId;
    const productfccId = rawFccId !== undefined ? String(rawFccId).trim() : (product.productfccId || '');
    const productType = req.body.productType !== undefined ? String(req.body.productType).trim() : product.productType;
    const httpLink = req.body.httpLink !== undefined ? String(req.body.httpLink).trim() : product.httpLink;
    const nasLink = req.body.nasLink !== undefined ? String(req.body.nasLink).trim() : (product.nasLink || '');

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
    if (!isSafeExternalLink(httpLink) || !isSafeExternalLink(nasLink)) {
      await cleanupUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: '链接协议不安全，请使用合法的链接地址' });
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

    // 动态处理文件路径（支持 JSON 传 null 以及 FormData 传 removeImage/removeManual/removeQaDocument）
    let imagePath = product.image;
    let manualPath = product.manual;
    let qaDocumentPath = product.qaDocument || null;

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

    if (req.files?.qaDocument?.[0]) {
      qaDocumentPath = `/uploads/${req.files.qaDocument[0].filename}`;
    } else if (req.body.qaDocument === null || req.body.removeQaDocument === 'true') {
      qaDocumentPath = null;
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
      if (qaDocumentPath !== product.qaDocument && product.qaDocument && isValidPath(product.qaDocument)) {
        await fs.unlink(path.join(__dirname, '../public', product.qaDocument));
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
      nasLink,
      status: statusValue,
      image: imagePath,
      manual: manualPath,
      qaDocument: qaDocumentPath
    });

    // 自动将新输入的品牌/产品类型写入数据库下拉选项表
    await Promise.all([
      brand ? ensureOptionExists('brand', brand) : Promise.resolve(),
      productType ? ensureOptionExists('productType', productType) : Promise.resolve()
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
      if (product.qaDocument) {
        const filePath = path.join(__dirname, '../public', product.qaDocument);
        await fs.access(filePath);
        await fs.unlink(filePath);
      }
    } catch (err) {
      console.error('删除文件失败:', err);
    }

    await sequelize.query(
      `DELETE FROM product_relations WHERE source_product_id = ? OR target_product_id = ?`,
      { replacements: [product.id, product.id] }
    );

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

    const [compatible, upgrade, mutualReplacement, replacement] = await Promise.all([
      product.getCompatibleProducts(),
      product.getUpgradeProducts(),
      product.getMutualReplacementProducts(),
      product.getReplacementProducts()
    ]);

    res.json({
      success: true,
      data: {
        compatible: compatible.map(p => p.toJSON()),
        upgrade: upgrade.map(p => p.toJSON()),
        mutualReplacement: mutualReplacement.map(p => p.toJSON()),
        replacement: replacement.map(p => p.toJSON())
      }
    });
  } catch (err) {
    console.error('获取关系失败:', err);
    res.status(500).json({ message: '服务器错误' });
  }
};
// 启动时幂等补齐历史单向的「互匹配」「互替代」双向记录（不覆盖已有冲突关系，不触碰单向可替代/升级款）
exports.syncSymmetricProductRelations = async () => {
  try {
    const [rows] = await sequelize.query(
      `SELECT source_product_id, target_product_id, relation_type
       FROM product_relations
       WHERE relation_type IN ('compatible', 'upgrade', 'mutual_replacement', 'replacement')`
    );

    if (!Array.isArray(rows) || rows.length === 0) return;

    const existingPairs = new Set();
    for (const row of rows) {
      existingPairs.add(`${Number(row.source_product_id)}:${Number(row.target_product_id)}`);
    }

    const missingReverseRows = [];
    for (const row of rows) {
      const src = Number(row.source_product_id);
      const tgt = Number(row.target_product_id);
      const type = row.relation_type;
      if (!src || !tgt || src === tgt) continue;
      if (type !== 'compatible' && type !== 'mutual_replacement') continue;

      const reverseKey = `${tgt}:${src}`;
      if (!existingPairs.has(reverseKey)) {
        existingPairs.add(reverseKey);
        missingReverseRows.push([tgt, src, type]);
      }
    }

    if (missingReverseRows.length > 0) {
      const placeholders = missingReverseRows.map(() => '(?, ?, ?)').join(', ');
      await sequelize.query(
        `INSERT INTO product_relations
         (source_product_id, target_product_id, relation_type)
         VALUES ${placeholders}`,
        { replacements: missingReverseRows.flat() }
      );
      console.log(`✅ 已自动补齐 ${missingReverseRows.length} 条历史双向产品关联记录`);
    }
  } catch (err) {
    console.warn('⚠️ 补齐双向产品关联失败:', err.message);
  }
};

// 设置产品关系（全量替换；compatible 互匹配 / mutual_replacement 互替代双向同步；upgrade 升级款 / replacement 可替代单向）
exports.setProductRelations = async (req, res) => {
  const sourceId = Number(req.params.id);
  if (!Number.isInteger(sourceId) || sourceId <= 0) {
    return res.status(400).json({ message: '无效的产品 ID' });
  }

  const body = req.body || {};
  const compatible = body.compatible ?? [];
  const upgrade = body.upgrade ?? [];
  const mutualReplacement = body.mutualReplacement ?? body.mutual_replacement ?? [];
  const replacement = body.replacement ?? [];

  if (
    !Array.isArray(compatible) ||
    !Array.isArray(upgrade) ||
    !Array.isArray(mutualReplacement) ||
    !Array.isArray(replacement)
  ) {
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
  const mutualReplacementIds = normalizeIds(mutualReplacement);
  const replacementIds = normalizeIds(replacement);

  if (!compatibleIds || !upgradeIds || !mutualReplacementIds || !replacementIds) {
    return res.status(400).json({ message: '无效的产品ID' });
  }

  try {
    const product = await Product.findByPk(sourceId);
    if (!product) {
      return res.status(404).json({ message: '产品不存在' });
    }

    // 校验目标产品是否存在，避免写入孤儿反向关联
    const candidateIds = Array.from(
      new Set(
        [...compatibleIds, ...upgradeIds, ...mutualReplacementIds, ...replacementIds].filter(
          (id) => id !== sourceId
        )
      )
    );
    let validTargetIdSet = new Set();
    if (candidateIds.length > 0) {
      const existingTargets = await Product.findAll({
        where: { id: { [Op.in]: candidateIds } },
        attributes: ['id']
      });
      validTargetIdSet = new Set(existingTargets.map((item) => Number(item.id)));
    }

    // 去重并排除自身，确保同一目标产品只关联一种关系类型
    const seenTargets = new Set([sourceId]);
    const forwardRelations = [];
    const newSymmetricMap = new Map(); // targetId -> 'compatible' | 'mutual_replacement'

    const appendRelations = (ids, type) => {
      for (const targetId of ids) {
        if (!seenTargets.has(targetId) && validTargetIdSet.has(targetId)) {
          seenTargets.add(targetId);
          forwardRelations.push([sourceId, targetId, type]);
          if (type === 'compatible' || type === 'mutual_replacement') {
            newSymmetricMap.set(targetId, type);
          }
        }
      }
    };

    appendRelations(compatibleIds, 'compatible');
    appendRelations(upgradeIds, 'upgrade');
    appendRelations(mutualReplacementIds, 'mutual_replacement');
    appendRelations(replacementIds, 'replacement');

    await sequelize.transaction(async (t) => {
      // 1. 查询当前产品原有的对称关系目标（用于检测被移除或改为单向关系的目标）
      const [oldSymmetricRows] = await sequelize.query(
        `SELECT target_product_id, relation_type
         FROM product_relations
         WHERE source_product_id = ?
         AND relation_type IN ('compatible', 'mutual_replacement')`,
        { replacements: [sourceId], transaction: t }
      );

      const oldSymmetricTargets = new Set(
        (Array.isArray(oldSymmetricRows) ? oldSymmetricRows : [])
          .map((row) => Number(row.target_product_id))
          .filter((id) => Number.isInteger(id) && id > 0 && id !== sourceId)
      );

      const upsertSymmetricTargets = Array.from(newSymmetricMap.keys());
      const removedSymmetricTargets = Array.from(oldSymmetricTargets).filter(
        (targetId) => !newSymmetricMap.has(targetId)
      );

      // 2. 全量替换正向关系（source_product_id = sourceId）
      await sequelize.query(
        `DELETE FROM product_relations
         WHERE source_product_id = ?
         AND relation_type IN ('compatible', 'upgrade', 'mutual_replacement', 'replacement')`,
        { replacements: [sourceId], transaction: t }
      );

      if (forwardRelations.length > 0) {
        const placeholders = forwardRelations.map(() => '(?, ?, ?)').join(', ');
        await sequelize.query(
          `INSERT INTO product_relations
           (source_product_id, target_product_id, relation_type)
           VALUES ${placeholders}`,
          { replacements: forwardRelations.flat(), transaction: t }
        );
      }

      // 3. 同步移除已被取消（或切换为单向升级款/单向可替代）的对称反向关系（B -> A）
      if (removedSymmetricTargets.length > 0) {
        const inPlaceholders = removedSymmetricTargets.map(() => '?').join(', ');
        await sequelize.query(
          `DELETE FROM product_relations
           WHERE target_product_id = ?
           AND source_product_id IN (${inPlaceholders})
           AND relation_type IN ('compatible', 'mutual_replacement')`,
          { replacements: [sourceId, ...removedSymmetricTargets], transaction: t }
        );
      }

      // 4. 同步新增/切换对称反向关系（B -> A）：先清理 B 指向 A 的旧关系，再写入新对称类型
      if (upsertSymmetricTargets.length > 0) {
        const inPlaceholders = upsertSymmetricTargets.map(() => '?').join(', ');
        await sequelize.query(
          `DELETE FROM product_relations
           WHERE target_product_id = ?
           AND source_product_id IN (${inPlaceholders})
           AND relation_type IN ('compatible', 'upgrade', 'mutual_replacement', 'replacement')`,
          { replacements: [sourceId, ...upsertSymmetricTargets], transaction: t }
        );

        const reverseRelations = upsertSymmetricTargets.map((targetId) => [
          targetId,
          sourceId,
          newSymmetricMap.get(targetId)
        ]);
        const reversePlaceholders = reverseRelations.map(() => '(?, ?, ?)').join(', ');
        await sequelize.query(
          `INSERT INTO product_relations
           (source_product_id, target_product_id, relation_type)
           VALUES ${reversePlaceholders}`,
          { replacements: reverseRelations.flat(), transaction: t }
        );
      }
    });

    res.json({ success: true, message: '关系更新成功（互匹配/互替代已双向同步）' });
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
