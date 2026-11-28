// backend/models/mockDb.js
// In-memory mock implementation of Sequelize models for environments without a MySQL server
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');

const now = () => new Date();

// Seed users (default admin: admin / Admin123!)
const defaultPasswordHash = bcrypt.hashSync('Admin123!', 10);
const editorPasswordHash = bcrypt.hashSync('Editor123!', 10);
const memberPasswordHash = bcrypt.hashSync('Member123!', 10);

const usersData = [
  {
    id: 1,
    username: 'admin',
    password: defaultPasswordHash,
    email: 'admin@example.com',
    role: 'admin',
    isActive: true,
    refreshToken: null,
    lastActivity: now(),
    createdAt: now(),
    updatedAt: now()
  },
  {
    id: 2,
    username: 'editor',
    password: editorPasswordHash,
    email: 'editor@example.com',
    role: 'editor',
    isActive: true,
    refreshToken: null,
    lastActivity: now(),
    createdAt: now(),
    updatedAt: now()
  },
  {
    id: 3,
    username: 'member',
    password: memberPasswordHash,
    email: 'member@example.com',
    role: 'user',
    isActive: true,
    refreshToken: null,
    lastActivity: now(),
    createdAt: now(),
    updatedAt: now()
  }
];
let nextUserId = 4;

// Seed products referencing existing uploaded assets in backend/public/uploads
const productsData = [
  {
    id: 1,
    sku: 'CB-RF-001',
    model: 'CB-301R',
    brand: 'CoreBay',
    productfccId: 'KUJCE10311',
    productType: 'Remote',
    description: 'Universal 3-speed ceiling fan remote control with light dimmer and reverse function.',
    httpLink: 'https://example.com/products/cb-301r',
    nasLink: '',
    status: 'active',
    manual: null,
    qaDocument: null,
    image: '/uploads/image-1778489364816-537.jpg',
    createdAt: now(),
    updatedAt: now()
  },
  {
    id: 2,
    sku: 'CB-RCV-002',
    model: 'CB-301RX',
    brand: 'CoreBay',
    productfccId: 'KUJCE10311',
    productType: 'Receiver',
    description: 'AC 3-speed ceiling fan wireless receiver module compatible with CB-301R transmitter.',
    httpLink: 'https://example.com/products/cb-301rx',
    nasLink: '',
    status: 'active',
    manual: null,
    qaDocument: null,
    image: '/uploads/image-1778489369414-562.jpg',
    createdAt: now(),
    updatedAt: now()
  },
  {
    id: 3,
    sku: 'HT-KIT-003',
    model: 'HT-99123',
    brand: 'Hunter',
    productfccId: 'CHQ7083T',
    productType: 'Control Kit',
    description: 'Complete ceiling fan remote and receiver control kit with wall cradle for Hunter AC fans.',
    httpLink: 'https://example.com/products/ht-99123',
    nasLink: '',
    status: 'active',
    manual: null,
    qaDocument: null,
    image: '/uploads/image-1778500157679-243.png',
    createdAt: now(),
    updatedAt: now()
  },
  {
    id: 4,
    sku: 'HB-DC-004',
    model: 'HB-DC600',
    brand: 'Harbor Breeze',
    productfccId: '2AAZPFAN11T',
    productType: 'Remote',
    description: 'DC 6-speed ceiling fan remote with reversible airflow and comfort breeze timer.',
    httpLink: 'https://example.com/products/hb-dc600',
    nasLink: '',
    status: 'active',
    manual: null,
    qaDocument: null,
    image: '/uploads/image-1778501632977-943.jpg',
    createdAt: now(),
    updatedAt: now()
  }
];
let nextProductId = 5;

// Seed FCC records
const fccsData = [
  {
    id: 1,
    name: 'FCC-KUJCE10311',
    brand: 'CoreBay',
    productType: 'Control Kit',
    speed: 'AC 3-speeds with Reverse',
    description: '303.9MHz RF ceiling fan transmitter and receiver kit.',
    image: '/uploads/image-1778501660311-69.jpg',
    replacement: 'CB-301R',
    createdAt: now(),
    updatedAt: now()
  },
  {
    id: 2,
    name: 'FCC-CHQ7083T',
    brand: 'Hampton Bay',
    productType: 'Remote',
    speed: 'AC 3-speeds',
    description: 'Standard 4-DIP switch ceiling fan remote control.',
    image: '/uploads/image-1778508100240-32.jpg',
    replacement: 'HT-99123',
    createdAt: now(),
    updatedAt: now()
  }
];
let nextFccId = 3;

// Join tables
const fccProductsLinks = [
  { fccId: 1, productId: 1 },
  { fccId: 1, productId: 2 },
  { fccId: 2, productId: 3 }
];

const productRelations = [
  { source_product_id: 1, target_product_id: 2, relation_type: 'compatible' },
  { source_product_id: 1, target_product_id: 4, relation_type: 'upgrade' },
  { source_product_id: 1, target_product_id: 3, relation_type: 'mutual_replacement' },
  { source_product_id: 2, target_product_id: 1, relation_type: 'compatible' }
];

// Dropdown options table (initialized by OptionController.syncInitialOptions on server start)
const dropdownOptionsData = [];
let nextDropdownOptionId = 1;

function matchesCondition(recordValue, cond) {
  if (cond === null || cond === undefined) return recordValue === cond;
  if (typeof cond === 'object' && !(cond instanceof Date)) {
    const syms = Object.getOwnPropertySymbols(cond);
    for (const sym of syms) {
      if (sym === Op.like || sym === Op.iLike) {
        const pattern = String(cond[sym]).replace(/^%|%$/g, '').toLowerCase();
        if (!String(recordValue || '').toLowerCase().includes(pattern)) return false;
      } else if (sym === Op.ne) {
        if (String(recordValue) === String(cond[sym])) return false;
      } else if (sym === Op.in) {
        if (
          !Array.isArray(cond[sym]) ||
          !cond[sym].some((item) => String(item) === String(recordValue))
        ) {
          return false;
        }
      }
    }
    return true;
  }
  return String(recordValue) === String(cond);
}

function matchesWhere(record, where) {
  if (!where) return true;
  const syms = Object.getOwnPropertySymbols(where);
  for (const sym of syms) {
    if (sym === Op.or) {
      const clauses = where[sym];
      if (!clauses.some((clause) => matchesWhere(record, clause))) return false;
    } else if (sym === Op.and) {
      const clauses = where[sym];
      if (!clauses.every((clause) => matchesWhere(record, clause))) return false;
    }
  }
  for (const [key, val] of Object.entries(where)) {
    if (!matchesCondition(record[key], val)) return false;
  }
  return true;
}

function pickAttributes(record, attributes) {
  if (!attributes) return { ...record };
  if (Array.isArray(attributes)) {
    const res = {};
    for (const k of attributes) res[k] = record[k];
    return res;
  }
  if (attributes.exclude) {
    const res = { ...record };
    for (const k of attributes.exclude) delete res[k];
    return res;
  }
  return { ...record };
}

function wrapUser(raw) {
  if (!raw) return null;
  return Object.assign(Object.create({
    async save() {
      raw.updatedAt = now();
      Object.assign(raw, this);
      return this;
    },
    async update(vals) {
      Object.assign(raw, vals, { updatedAt: now() });
      Object.assign(this, raw);
      return this;
    },
    async destroy() {
      const idx = usersData.findIndex((u) => u.id === raw.id);
      if (idx !== -1) usersData.splice(idx, 1);
    },
    toJSON() {
      return { ...raw };
    },
    get() {
      return { ...raw };
    }
  }), raw);
}

function wrapProduct(raw, extras = {}) {
  if (!raw) return null;
  const instance = Object.assign(Object.create({
    get() {
      return { ...raw, ...extras };
    },
    toJSON() {
      return { ...raw, ...extras };
    },
    async update(vals) {
      Object.assign(raw, vals, { updatedAt: now() });
      Object.assign(this, raw);
      return this;
    },
    async destroy() {
      const idx = productsData.findIndex((p) => p.id === raw.id);
      if (idx !== -1) productsData.splice(idx, 1);
      for (let i = fccProductsLinks.length - 1; i >= 0; i--) {
        if (fccProductsLinks[i].productId === raw.id) fccProductsLinks.splice(i, 1);
      }
      for (let i = productRelations.length - 1; i >= 0; i--) {
        if (productRelations[i].source_product_id === raw.id || productRelations[i].target_product_id === raw.id) {
          productRelations.splice(i, 1);
        }
      }
    },
    async getCompatibleProducts() {
      return getRelated(raw.id, 'compatible').map((p) => wrapProduct(p));
    },
    async getUpgradeProducts() {
      return getRelated(raw.id, 'upgrade').map((p) => wrapProduct(p));
    },
    async getMutualReplacementProducts() {
      return getRelated(raw.id, 'mutual_replacement').map((p) => wrapProduct(p));
    },
    async getReplacementProducts() {
      return getRelated(raw.id, 'replacement').map((p) => wrapProduct(p));
    }
  }), raw, extras);
  return instance;
}

function getRelated(sourceId, relationType) {
  const targetIds = productRelations
    .filter((r) => Number(r.source_product_id) === Number(sourceId) && r.relation_type === relationType)
    .map((r) => Number(r.target_product_id));
  return productsData.filter((p) => targetIds.includes(p.id));
}

function wrapFcc(raw, extras = {}) {
  if (!raw) return null;
  return Object.assign(Object.create({
    get() {
      return { ...raw, ...extras };
    },
    toJSON() {
      return { ...raw, ...extras };
    },
    async update(vals) {
      Object.assign(raw, vals, { updatedAt: now() });
      Object.assign(this, raw);
      return this;
    },
    async destroy() {
      const idx = fccsData.findIndex((f) => f.id === raw.id);
      if (idx !== -1) fccsData.splice(idx, 1);
      for (let i = fccProductsLinks.length - 1; i >= 0; i--) {
        if (fccProductsLinks[i].fccId === raw.id) fccProductsLinks.splice(i, 1);
      }
    },
    async hasProduct(product) {
      const pid = typeof product === 'object' ? product.id : Number(product);
      return fccProductsLinks.some((l) => l.fccId === raw.id && l.productId === pid);
    },
    async addProduct(product) {
      const pid = typeof product === 'object' ? product.id : Number(product);
      if (!fccProductsLinks.some((l) => l.fccId === raw.id && l.productId === pid)) {
        fccProductsLinks.push({ fccId: raw.id, productId: pid });
      }
    },
    async removeProduct(product) {
      const pid = typeof product === 'object' ? product.id : Number(product);
      const idx = fccProductsLinks.findIndex((l) => l.fccId === raw.id && l.productId === pid);
      if (idx !== -1) fccProductsLinks.splice(idx, 1);
    }
  }), raw, extras);
}

const User = {
  name: 'User',
  async findAll({ where, attributes, order, limit, offset } = {}) {
    let list = usersData.filter((u) => matchesWhere(u, where));
    if (order && order[0]) {
      const [col, dir] = order[0];
      list = [...list].sort((a, b) =>
        dir === 'DESC' ? (b[col] > a[col] ? 1 : -1) : (a[col] > b[col] ? 1 : -1)
      );
    }
    const start = Number.isInteger(offset) && offset > 0 ? offset : 0;
    if (Number.isInteger(limit) && limit >= 0) {
      list = list.slice(start, start + limit);
    } else if (start > 0) {
      list = list.slice(start);
    }
    return list.map((u) => wrapUser(pickAttributes(u, attributes)));
  },
  async count({ where } = {}) {
    return usersData.filter((u) => matchesWhere(u, where)).length;
  },
  async findOne({ where, attributes } = {}) {
    const found = usersData.find((u) => matchesWhere(u, where));
    return found ? wrapUser(pickAttributes(found, attributes)) : null;
  },
  async findByPk(id, { attributes } = {}) {
    const found = usersData.find((u) => String(u.id) === String(id));
    if (!found) return null;
    if (attributes) return wrapUser(pickAttributes(found, attributes));
    return wrapUser(found);
  },
  async create(data) {
    let password = data.password;
    if (password && !password.startsWith('$2')) {
      password = await bcrypt.hash(password, 10);
    }
    const record = {
      id: nextUserId++,
      username: data.username,
      password,
      email: data.email || null,
      role: data.role || 'user',
      isActive: data.isActive !== undefined ? data.isActive : true,
      refreshToken: data.refreshToken || null,
      lastActivity: data.lastActivity || now(),
      createdAt: now(),
      updatedAt: now()
    };
    usersData.push(record);
    return wrapUser(record);
  },
  async update(values, { where } = {}) {
    let count = 0;
    for (const u of usersData) {
      if (matchesWhere(u, where)) {
        Object.assign(u, values, { updatedAt: now() });
        count++;
      }
    }
    return [count];
  }
};

const Product = {
  name: 'Product',
  async count({ where } = {}) {
    return productsData.filter((p) => matchesWhere(p, where)).length;
  },
  async findAll({ where, attributes, limit, offset, include, order } = {}) {
    let list = productsData.filter((p) => matchesWhere(p, where));
    if (order && order[0]) {
      const [col, dir] = order[0];
      list = [...list].sort((a, b) => (dir === 'DESC' ? (b[col] > a[col] ? 1 : -1) : (a[col] > b[col] ? 1 : -1)));
    }
    const start = Number.isInteger(offset) && offset > 0 ? offset : 0;
    if (Number.isInteger(limit) && limit >= 0) {
      list = list.slice(start, start + limit);
    } else if (start > 0) {
      list = list.slice(start);
    }
    return list.map((p) => {
      const extras = {};
      if (Array.isArray(include)) {
        for (const inc of include) {
          if (inc.as === 'compatibleProducts') {
            extras.compatibleProducts = getRelated(p.id, 'compatible').map((r) =>
              pickAttributes(r, inc.attributes)
            );
          } else if (inc.as === 'upgradeProducts') {
            extras.upgradeProducts = getRelated(p.id, 'upgrade').map((r) =>
              pickAttributes(r, inc.attributes)
            );
          } else if (inc.as === 'mutualReplacementProducts') {
            extras.mutualReplacementProducts = getRelated(p.id, 'mutual_replacement').map((r) =>
              pickAttributes(r, inc.attributes)
            );
          } else if (inc.as === 'replacementProducts') {
            extras.replacementProducts = getRelated(p.id, 'replacement').map((r) =>
              pickAttributes(r, inc.attributes)
            );
          }
        }
      }
      return wrapProduct(pickAttributes(p, attributes), extras);
    });
  },
  async findOne({ where } = {}) {
    const found = productsData.find((p) => matchesWhere(p, where));
    return found ? wrapProduct(found) : null;
  },
  async findByPk(id) {
    const found = productsData.find((p) => String(p.id) === String(id));
    return found ? wrapProduct(found) : null;
  },
  async create(data) {
    const record = {
      id: nextProductId++,
      sku: data.sku,
      model: data.model,
      description: data.description || '',
      brand: data.brand || '',
      productfccId: data.productfccId || '',
      productType: data.productType || '',
      httpLink: data.httpLink || '',
      nasLink: data.nasLink || '',
      status: data.status || 'active',
      manual: data.manual || null,
      qaDocument: data.qaDocument || null,
      image: data.image || null,
      createdAt: now(),
      updatedAt: now()
    };
    productsData.push(record);
    return wrapProduct(record);
  }
};

const Fcc = {
  name: 'Fcc',
  async count({ where } = {}) {
    return fccsData.filter((f) => matchesWhere(f, where)).length;
  },
  async findAll({ where, attributes, limit, offset, include, order } = {}) {
    let list = fccsData.filter((f) => matchesWhere(f, where));
    if (order && order[0]) {
      const [col, dir] = order[0];
      list = [...list].sort((a, b) => (dir === 'DESC' ? (b[col] > a[col] ? 1 : -1) : (a[col] > b[col] ? 1 : -1)));
    }
    const start = Number.isInteger(offset) && offset > 0 ? offset : 0;
    if (Number.isInteger(limit) && limit >= 0) {
      list = list.slice(start, start + limit);
    } else if (start > 0) {
      list = list.slice(start);
    }
    const includeProducts =
      Array.isArray(include) && include.some((inc) => inc.as === 'Products' || inc.model === Product);
    return list.map((f) => {
      const extras = {};
      if (includeProducts) {
        const pids = fccProductsLinks.filter((l) => l.fccId === f.id).map((l) => l.productId);
        extras.Products = productsData.filter((p) => pids.includes(p.id)).map((p) => ({ ...p }));
      }
      return wrapFcc(pickAttributes(f, attributes), extras);
    });
  },
  async findByPk(id, { include } = {}) {
    const found = fccsData.find((f) => String(f.id) === String(id));
    if (!found) return null;
    const extras = {};
    if (Array.isArray(include)) {
      const hasProducts = include.some((inc) => inc.as === 'Products' || inc.model === Product);
      if (hasProducts) {
        const pids = fccProductsLinks.filter((l) => l.fccId === found.id).map((l) => l.productId);
        extras.Products = productsData.filter((p) => pids.includes(p.id)).map((p) => ({ ...p }));
      }
    }
    return wrapFcc(found, extras);
  },
  async create(data) {
    const record = {
      id: nextFccId++,
      name: data.name,
      description: data.description || null,
      brand: data.brand || null,
      productType: data.productType || null,
      speed: data.speed || null,
      image: data.image || null,
      replacement: data.replacement || null,
      createdAt: now(),
      updatedAt: now()
    };
    fccsData.push(record);
    return wrapFcc(record);
  }
};

function compareByOrder(a, b, order) {
  if (!Array.isArray(order) || order.length === 0) return 0;
  for (const [col, dir] of order) {
    const va = a[col];
    const vb = b[col];
    if (va === vb) continue;
    const asc = String(dir || 'ASC').toUpperCase() !== 'DESC';
    if (typeof va === 'number' && typeof vb === 'number') {
      return asc ? va - vb : vb - va;
    }
    const sa = String(va ?? '');
    const sb = String(vb ?? '');
    if (sa < sb) return asc ? -1 : 1;
    if (sa > sb) return asc ? 1 : -1;
  }
  return 0;
}

function wrapDropdownOption(raw) {
  if (!raw) return null;
  return Object.assign(Object.create({
    get() {
      return { ...raw };
    },
    toJSON() {
      return { ...raw };
    },
    async update(vals) {
      Object.assign(raw, vals, { updatedAt: now() });
      Object.assign(this, raw);
      return this;
    },
    async destroy() {
      const idx = dropdownOptionsData.findIndex((o) => o.id === raw.id);
      if (idx !== -1) dropdownOptionsData.splice(idx, 1);
    }
  }), raw);
}

const DropdownOption = {
  name: 'DropdownOption',
  async count({ where } = {}) {
    return dropdownOptionsData.filter((o) => matchesWhere(o, where)).length;
  },
  async findAll({ where, attributes, order, limit, offset } = {}) {
    let list = dropdownOptionsData.filter((o) => matchesWhere(o, where));
    if (Array.isArray(order) && order.length > 0) {
      list = [...list].sort((a, b) => compareByOrder(a, b, order));
    }
    const start = Number.isInteger(offset) && offset > 0 ? offset : 0;
    if (Number.isInteger(limit) && limit >= 0) {
      list = list.slice(start, start + limit);
    } else if (start > 0) {
      list = list.slice(start);
    }
    return list.map((o) => wrapDropdownOption(pickAttributes(o, attributes)));
  },
  async findOne({ where } = {}) {
    const found = dropdownOptionsData.find((o) => matchesWhere(o, where));
    return found ? wrapDropdownOption(found) : null;
  },
  async findByPk(id) {
    const found = dropdownOptionsData.find((o) => String(o.id) === String(id));
    return found ? wrapDropdownOption(found) : null;
  },
  async create(data) {
    const record = {
      id: nextDropdownOptionId++,
      category: data.category,
      value: data.value,
      label: data.label || data.value,
      description: data.description || null,
      sortOrder: Number.isInteger(Number(data.sortOrder)) ? Number(data.sortOrder) : 0,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      createdAt: now(),
      updatedAt: now()
    };
    dropdownOptionsData.push(record);
    return wrapDropdownOption(record);
  }
};

const ProductWorkWith = {
  name: 'ProductWorkWith',
  async findAll() {
    return [];
  }
};

const sequelize = {
  async authenticate() {
    return true;
  },
  async sync() {
    return true;
  },
  async close() {
    return true;
  },
  async transaction(fn) {
    return fn({});
  },
  async query(sql, options = {}) {
    const rawSql = String(sql).trim();
    const normalized = rawSql.replace(/\s+/g, ' ').toUpperCase();
    const parseAllowedTypes = () => {
      const match = rawSql.match(/relation_type\s+IN\s*\(([^)]+)\)/i);
      if (!match) return null;
      return match[1]
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    };

    if (normalized.startsWith('SHOW TABLES')) {
      return [[
        { Tables_in_mock: 'users' },
        { Tables_in_mock: 'products' },
        { Tables_in_mock: 'fccs' },
        { Tables_in_mock: 'fcc_products' },
        { Tables_in_mock: 'product_relations' },
        { Tables_in_mock: 'dropdown_options' }
      ]];
    }

    if (normalized.startsWith('SELECT') && normalized.includes('FROM FCC_PRODUCTS')) {
      const hasFccIn = normalized.includes('WHERE FCCID IN');
      const fccIdSet = hasFccIn
        ? new Set((options.replacements || []).map((v) => Number(v)))
        : null;
      const rows = fccProductsLinks
        .filter((l) => !fccIdSet || fccIdSet.has(Number(l.fccId)))
        .map((l) => ({ fccId: l.fccId, productId: l.productId }));
      return [rows];
    }

    if (normalized.startsWith('SELECT') && normalized.includes('FROM PRODUCT_RELATIONS')) {
      const allowedTypes = parseAllowedTypes();
      const hasSourceEq = normalized.includes('WHERE SOURCE_PRODUCT_ID = ?');
      const hasSourceIn = normalized.includes('WHERE SOURCE_PRODUCT_ID IN');
      const sourceId = hasSourceEq ? Number(options.replacements?.[0]) : null;
      const sourceIdSet = hasSourceIn
        ? new Set((options.replacements || []).map((v) => Number(v)))
        : null;
      const rows = productRelations
        .filter((r) => {
          if (hasSourceEq && Number(r.source_product_id) !== sourceId) return false;
          if (sourceIdSet && !sourceIdSet.has(Number(r.source_product_id))) return false;
          if (allowedTypes && !allowedTypes.includes(r.relation_type)) return false;
          return true;
        })
        .map((r) => ({ ...r }));
      return [rows];
    }

    if (normalized.startsWith('DELETE FROM PRODUCT_RELATIONS')) {
      const allowedTypes = parseAllowedTypes();
      const vals = options.replacements || [];

      if (normalized.includes('WHERE SOURCE_PRODUCT_ID = ? OR TARGET_PRODUCT_ID = ?')) {
        const srcId = Number(vals[0]);
        const tgtId = Number(vals[1]);
        let affected = 0;
        for (let i = productRelations.length - 1; i >= 0; i--) {
          if (
            Number(productRelations[i].source_product_id) === srcId ||
            Number(productRelations[i].target_product_id) === tgtId
          ) {
            productRelations.splice(i, 1);
            affected++;
          }
        }
        return [{ affectedRows: affected }];
      }

      if (normalized.includes('WHERE TARGET_PRODUCT_ID = ? AND SOURCE_PRODUCT_ID IN')) {
        const targetId = Number(vals[0]);
        const sourceIdSet = new Set(vals.slice(1).map((v) => Number(v)));
        let affected = 0;
        for (let i = productRelations.length - 1; i >= 0; i--) {
          const r = productRelations[i];
          if (
            Number(r.target_product_id) === targetId &&
            sourceIdSet.has(Number(r.source_product_id)) &&
            (!allowedTypes || allowedTypes.includes(r.relation_type))
          ) {
            productRelations.splice(i, 1);
            affected++;
          }
        }
        return [{ affectedRows: affected }];
      }

      const sourceId = Number(vals[0]);
      let affected = 0;
      for (let i = productRelations.length - 1; i >= 0; i--) {
        const r = productRelations[i];
        if (
          Number(r.source_product_id) === sourceId &&
          (!allowedTypes || allowedTypes.includes(r.relation_type))
        ) {
          productRelations.splice(i, 1);
          affected++;
        }
      }
      return [{ affectedRows: affected }];
    }

    if (normalized.startsWith('INSERT INTO PRODUCT_RELATIONS')) {
      const vals = options.replacements || [];
      let inserted = 0;
      for (let i = 0; i < vals.length; i += 3) {
        const src = Number(vals[i]);
        const tgt = Number(vals[i + 1]);
        const type = vals[i + 2];
        const exists = productRelations.some(
          (r) =>
            Number(r.source_product_id) === src &&
            Number(r.target_product_id) === tgt &&
            r.relation_type === type
        );
        if (!exists) {
          productRelations.push({
            source_product_id: src,
            target_product_id: tgt,
            relation_type: type
          });
          inserted++;
        }
      }
      return [{ affectedRows: inserted }];
    }

    return [[]];
  }
};

module.exports = {
  User,
  Product,
  Fcc,
  DropdownOption,
  ProductWorkWith,
  sequelize
};
