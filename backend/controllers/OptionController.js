// backend/controllers/OptionController.js
const { Op } = require('sequelize');
const { DropdownOption, Product, Fcc } = require('../models');

const VALID_CATEGORIES = ['brand', 'productType', 'speed', 'status', 'role'];
const SYSTEM_LOCKED_CATEGORIES = new Set(['role']);

// 仅在数据库 dropdown_options 表首次完全为空时用于初始化写入数据库
const INITIAL_DB_SEED = [
  // 品牌 (brand)
  { category: 'brand', value: 'Hunter', label: 'Hunter', sortOrder: 10 },
  { category: 'brand', value: 'Harbor Breeze', label: 'Harbor Breeze', sortOrder: 20 },
  { category: 'brand', value: 'Hampton Bay', label: 'Hampton Bay', sortOrder: 30 },
  { category: 'brand', value: 'CoreBay', label: 'CoreBay', sortOrder: 40 },
  // 产品类型 (productType)
  { category: 'productType', value: 'Ceiling Fan', label: 'Ceiling Fan', sortOrder: 10 },
  { category: 'productType', value: 'Control Kit', label: 'Control Kit', sortOrder: 20 },
  { category: 'productType', value: 'Remote', label: 'Remote', sortOrder: 30 },
  { category: 'productType', value: 'Receiver', label: 'Receiver', sortOrder: 40 },
  // AC/DC 规格 (speed)
  { category: 'speed', value: 'AC 3-speeds', label: 'AC 3-speeds', sortOrder: 10 },
  { category: 'speed', value: 'AC 3-speeds with Reverse', label: 'AC 3-speeds with Reverse', sortOrder: 20 },
  { category: 'speed', value: 'AC 4-speeds', label: 'AC 4-speeds', sortOrder: 30 },
  { category: 'speed', value: 'AC 4-speeds with Reverse', label: 'AC 4-speeds with Reverse', sortOrder: 40 },
  { category: 'speed', value: 'DC 6-speeds', label: 'DC 6-speeds', sortOrder: 50 },
  { category: 'speed', value: 'DC 6-speeds with Reverse', label: 'DC 6-speeds with Reverse', sortOrder: 60 },
  // 产品销售状态 (status)
  { category: 'status', value: 'active', label: '在售', sortOrder: 10 },
  { category: 'status', value: 'clearance', label: '清仓', sortOrder: 20 },
  { category: 'status', value: 'development', label: '开发中', sortOrder: 30 },
  { category: 'status', value: 'discontinued', label: '停产', sortOrder: 40 },
  // 账号角色 (role)
  {
    category: 'role',
    value: 'admin',
    label: '管理员',
    description: '全部权限（含删除、账号管理）',
    sortOrder: 10
  },
  {
    category: 'role',
    value: 'editor',
    label: '编辑员',
    description: '可进后台新增、编辑、管理关联（不可删除）',
    sortOrder: 20
  },
  {
    category: 'role',
    value: 'user',
    label: '成员',
    description: '仅浏览前台查询，无法进后台或写入',
    sortOrder: 30
  }
];

const toPlain = (row) => (row && typeof row.get === 'function' ? row.get({ plain: true }) : row);

// 确保某个值存在于 dropdown_options 表中（用于保存自定义输入或从历史字段同步）
const ensureOptionExists = async (category, rawValue, rawLabel = null, description = null) => {
  if (!DropdownOption || !VALID_CATEGORIES.includes(category)) return null;
  const value = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!value || value.length > 150) return null;

  const existing = await DropdownOption.findOne({
    where: { category, value }
  });
  if (existing) {
    return toPlain(existing);
  }

  const count = await DropdownOption.count({ where: { category } });
  const created = await DropdownOption.create({
    category,
    value,
    label: (typeof rawLabel === 'string' && rawLabel.trim()) ? rawLabel.trim() : value,
    description: description ? String(description).trim() : null,
    sortOrder: (count + 1) * 10,
    isActive: true
  });
  return toPlain(created);
};

// 从 products / fccs 现有数据库字段采集去重后的选项值
const collectFieldValuesFromDb = async () => {
  const collected = {
    brand: new Set(),
    productType: new Set(),
    speed: new Set()
  };

  try {
    const [products, fccs] = await Promise.all([
      Product.findAll({ attributes: ['brand', 'productType'] }),
      Fcc.findAll({ attributes: ['brand', 'productType', 'speed'] })
    ]);

    for (const p of products || []) {
      const plain = toPlain(p);
      if (plain?.brand && String(plain.brand).trim()) {
        collected.brand.add(String(plain.brand).trim());
      }
      if (plain?.productType && String(plain.productType).trim()) {
        collected.productType.add(String(plain.productType).trim());
      }
    }

    for (const f of fccs || []) {
      const plain = toPlain(f);
      if (plain?.brand && String(plain.brand).trim()) {
        collected.brand.add(String(plain.brand).trim());
      }
      if (plain?.productType && String(plain.productType).trim()) {
        collected.productType.add(String(plain.productType).trim());
      }
      if (plain?.speed && String(plain.speed).trim()) {
        collected.speed.add(String(plain.speed).trim());
      }
    }
  } catch (err) {
    console.warn('⚠️ 从现有数据表采集下拉选项失败:', err.message);
  }

  return collected;
};

// 服务启动时执行：确保 dropdown_options 表有初始数据并吸收既有库中的字段值
const syncInitialOptions = async () => {
  if (!DropdownOption) return;
  try {
    const totalCount = await DropdownOption.count();
    if (totalCount === 0) {
      for (const item of INITIAL_DB_SEED) {
        await ensureOptionExists(item.category, item.value, item.label, item.description);
      }
      const fieldValues = await collectFieldValuesFromDb();
      for (const category of ['brand', 'productType', 'speed']) {
        for (const val of fieldValues[category]) {
          await ensureOptionExists(category, val, val);
        }
      }
      console.log('✅ 已初始化 dropdown_options 数据库选项表');
      return;
    }

    // 如果表已存在，确保核心系统分类（status / role）至少有记录
    for (const coreCat of ['status', 'role']) {
      const catCount = await DropdownOption.count({ where: { category: coreCat } });
      if (catCount === 0) {
        for (const item of INITIAL_DB_SEED.filter((s) => s.category === coreCat)) {
          await ensureOptionExists(item.category, item.value, item.label, item.description);
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ 初始化 dropdown_options 失败:', err.message);
  }
};

// GET /api/options — 读取启用中的下拉选项（默认按 category 分组返回）
exports.getOptions = async (req, res) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const includeInactive = req.query.includeInactive === 'true';

    const where = {};
    if (category) {
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({ success: false, message: '无效的选项分类' });
      }
      where.category = category;
    }
    if (!includeInactive) {
      where.isActive = true;
    }

    const rows = await DropdownOption.findAll({
      where,
      order: [
        ['sortOrder', 'ASC'],
        ['id', 'ASC']
      ]
    });

    const plainRows = rows.map(toPlain);

    if (category) {
      return res.json({
        success: true,
        data: plainRows
      });
    }

    const grouped = {
      brand: [],
      productType: [],
      speed: [],
      status: [],
      role: []
    };

    for (const item of plainRows) {
      if (grouped[item.category]) {
        grouped[item.category].push(item);
      }
    }

    res.json({
      success: true,
      data: grouped
    });
  } catch (err) {
    console.error('❌ 获取下拉选项失败:', err);
    res.status(500).json({ success: false, message: '获取下拉选项失败' });
  }
};

// GET /api/options/manage — 后台选项管理列表（支持分类筛选、关键词搜索与分页）
exports.listOptionsForAdmin = async (req, res) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const rawPage = Number.parseInt(req.query.page, 10);
    const rawSize = Number.parseInt(req.query.pageSize ?? req.query.limit, 10);
    const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
    const pageSize = Number.isInteger(rawSize) && rawSize > 0 ? Math.min(rawSize, 100) : 20;

    const where = {};
    if (category && category !== 'all') {
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({ success: false, message: '无效的选项分类' });
      }
      where.category = category;
    }
    if (search) {
      where[Op.or] = [
        { value: { [Op.like]: `%${search}%` } },
        { label: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const total = await DropdownOption.count({ where });
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const safePage = totalPages > 0 ? Math.min(page, totalPages) : 1;
    const offset = (safePage - 1) * pageSize;

    const rows =
      total > 0
        ? await DropdownOption.findAll({
            where,
            order: [
              ['category', 'ASC'],
              ['sortOrder', 'ASC'],
              ['id', 'ASC']
            ],
            limit: pageSize,
            offset
          })
        : [];

    res.json({
      success: true,
      data: rows.map(toPlain),
      pagination: {
        page: safePage,
        pageSize,
        total,
        totalPages
      }
    });
  } catch (err) {
    console.error('❌ 获取选项管理列表失败:', err);
    res.status(500).json({ success: false, message: '获取选项列表失败' });
  }
};

// POST /api/options — 新增下拉选项（editor / admin）
exports.createOption = async (req, res) => {
  try {
    const category = typeof req.body?.category === 'string' ? req.body.category.trim() : '';
    const value = typeof req.body?.value === 'string' ? req.body.value.trim() : '';
    const label =
      typeof req.body?.label === 'string' && req.body.label.trim()
        ? req.body.label.trim()
        : value;
    const description =
      typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const sortOrder = Number.isInteger(Number(req.body?.sortOrder))
      ? Number(req.body.sortOrder)
      : 0;
    const isActive = req.body?.isActive !== undefined ? Boolean(req.body.isActive) : true;

    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: '无效的选项分类' });
    }
    if (SYSTEM_LOCKED_CATEGORIES.has(category)) {
      return res.status(400).json({ success: false, message: '系统角色分类不支持手动新增' });
    }
    if (!value || value.length > 150) {
      return res.status(400).json({ success: false, message: '选项值不能为空且不超过 150 字' });
    }
    if (!label || label.length > 150) {
      return res.status(400).json({ success: false, message: '显示名称不能为空且不超过 150 字' });
    }

    const existing = await DropdownOption.findOne({ where: { category, value } });
    if (existing) {
      return res.status(400).json({ success: false, message: '该分类下已存在相同的选项值' });
    }

    const created = await DropdownOption.create({
      category,
      value,
      label,
      description: description || null,
      sortOrder,
      isActive
    });

    res.status(201).json({
      success: true,
      message: '选项已添加',
      data: toPlain(created)
    });
  } catch (err) {
    console.error('❌ 创建下拉选项失败:', err);
    res.status(500).json({ success: false, message: '创建下拉选项失败' });
  }
};

// PUT /api/options/:id — 编辑下拉选项（editor / admin）
exports.updateOption = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: '无效的选项 ID' });
    }

    const option = await DropdownOption.findByPk(id);
    if (!option) {
      return res.status(404).json({ success: false, message: '未找到该选项' });
    }

    const updates = {};
    const isLockedRole = SYSTEM_LOCKED_CATEGORIES.has(option.category);

    if (req.body?.value !== undefined && !isLockedRole) {
      const nextValue = String(req.body.value).trim();
      if (!nextValue || nextValue.length > 150) {
        return res.status(400).json({ success: false, message: '选项值不能为空且不超过 150 字' });
      }
      if (nextValue !== option.value) {
        const dup = await DropdownOption.findOne({
          where: {
            category: option.category,
            value: nextValue,
            id: { [Op.ne]: id }
          }
        });
        if (dup) {
          return res.status(400).json({ success: false, message: '该分类下已存在相同的选项值' });
        }
      }
      updates.value = nextValue;
    }

    if (req.body?.label !== undefined) {
      const nextLabel = String(req.body.label).trim();
      if (!nextLabel || nextLabel.length > 150) {
        return res.status(400).json({ success: false, message: '显示名称不能为空且不超过 150 字' });
      }
      updates.label = nextLabel;
    }

    if (req.body?.description !== undefined) {
      const nextDesc = String(req.body.description || '').trim();
      updates.description = nextDesc ? nextDesc.slice(0, 255) : null;
    }

    if (req.body?.sortOrder !== undefined) {
      const nextSort = Number(req.body.sortOrder);
      if (!Number.isInteger(nextSort)) {
        return res.status(400).json({ success: false, message: '排序值必须为整数' });
      }
      updates.sortOrder = nextSort;
    }

    if (req.body?.isActive !== undefined) {
      if (isLockedRole && !req.body.isActive) {
        return res.status(400).json({ success: false, message: '系统角色选项不能禁用' });
      }
      updates.isActive = Boolean(req.body.isActive);
    }

    await option.update(updates);

    res.json({
      success: true,
      message: '选项已更新',
      data: toPlain(option)
    });
  } catch (err) {
    console.error('❌ 更新下拉选项失败:', err);
    res.status(500).json({ success: false, message: '更新下拉选项失败' });
  }
};

// DELETE /api/options/:id — 删除下拉选项（仅 admin）
exports.deleteOption = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: '无效的选项 ID' });
    }

    const option = await DropdownOption.findByPk(id);
    if (!option) {
      return res.status(404).json({ success: false, message: '未找到该选项' });
    }

    if (SYSTEM_LOCKED_CATEGORIES.has(option.category)) {
      return res.status(400).json({ success: false, message: '系统角色选项不可删除' });
    }

    await option.destroy();
    res.json({ success: true, message: '选项已删除' });
  } catch (err) {
    console.error('❌ 删除下拉选项失败:', err);
    res.status(500).json({ success: false, message: '删除下拉选项失败' });
  }
};

// POST /api/options/sync — 从现有产品/FCC 数据库字段一键同步补充缺失选项（editor / admin）
exports.syncFromRecords = async (req, res) => {
  try {
    const fieldValues = await collectFieldValuesFromDb();
    let added = 0;

    for (const category of ['brand', 'productType', 'speed']) {
      for (const val of fieldValues[category]) {
        const existing = await DropdownOption.findOne({ where: { category, value: val } });
        if (!existing) {
          await ensureOptionExists(category, val, val);
          added += 1;
        }
      }
    }

    res.json({
      success: true,
      message: added > 0 ? `已从数据库现有记录同步新增 ${added} 个选项` : '数据库选项已是最新，无需补充',
      added
    });
  } catch (err) {
    console.error('❌ 同步数据库字段选项失败:', err);
    res.status(500).json({ success: false, message: '同步失败，请稍后重试' });
  }
};

exports.syncInitialOptions = syncInitialOptions;
exports.ensureOptionExists = ensureOptionExists;
exports.VALID_CATEGORIES = VALID_CATEGORIES;
