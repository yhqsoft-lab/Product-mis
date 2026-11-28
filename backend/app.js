// backend/app.js
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// ✅ 最先加载环境变量（兼容从根目录或 backend 目录启动）
const rootEnvPath = path.resolve(__dirname, '../.env');
const backendEnvPath = path.resolve(__dirname, '.env');
if (fs.existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath });
if (fs.existsSync(backendEnvPath)) dotenv.config({ path: backendEnvPath });
dotenv.config();

const express = require('express');
const app = express();
app.set('trust proxy', 1);
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const multer = require('multer');

// ✅ 从 models/index.js 导入数据库连接
const { sequelize } = require('./models');

// 导入路由
const FccRoutes = require('./routes/FccRoutes');
const ProductRoutes = require('./routes/ProductRoutes');
const LoginRoutes = require('./routes/authRoutes');
const OptionRoutes = require('./routes/OptionRoutes');
const { syncInitialOptions } = require('./controllers/OptionController');
const { syncSymmetricProductRelations } = require('./controllers/ProductController');

// ✅ 安全中间件（注意顺序！）
app.use(morgan('dev'));
app.use(helmet({
  contentSecurityPolicy: false,
  frameguard: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  originAgentCluster: false,
  referrerPolicy: false,
  hsts: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ✅ CORS 配置
app.use(cors({
  origin: process.env.FRONTEND_URL || true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));

// ✅ 禁止 API 响应被代理或浏览器错误缓存
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// ✅ JSON 解析（必须在所有路由之前，但不会影响 Multer 路由）
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ✅ 静态文件服务（上传文件名含唯一时间戳，启用浏览器长缓存避免重复加载）
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads'), {
  maxAge: '7d',
  etag: true
}));
app.use('/images', express.static(path.join(__dirname, 'images'), {
  maxAge: '7d',
  etag: true
}));

// ✅ 健康检查路由
app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    });
  }
});

// ✅ API 路由（Multer 将在 ProductRoutes 内部按需使用）
app.use('/api/fccs', FccRoutes);
app.use('/api/auth', LoginRoutes);
app.use('/api/products', ProductRoutes); // 文件上传逻辑在此路由内部处理
app.use('/api/options', OptionRoutes);

// ✅ API 未匹配路由返回 JSON 404
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: '请求的资源不存在',
    path: req.originalUrl,
    method: req.method
  });
});

// ✅ 前端 SPA 静态资源与回退路由（在 API 路由之后）
const frontendBuildPath = path.join(__dirname, '../react-demo/build');
const frontendIndexPath = path.join(frontendBuildPath, 'index.html');
app.use(express.static(frontendBuildPath));

app.use((req, res, next) => {
  if (
    req.method === 'GET' &&
    !req.path.startsWith('/api') &&
    !req.path.startsWith('/uploads') &&
    !req.path.startsWith('/images') &&
    !req.path.startsWith('/static')
  ) {
    if (fs.existsSync(frontendIndexPath)) {
      return res.sendFile(frontendIndexPath);
    }
  }
  res.status(404).json({
    success: false,
    message: '请求的资源不存在',
    path: req.path,
    method: req.method
  });
});

// ✅ 全局错误处理（必须放在所有路由之后）
app.use((err, req, res, next) => {
  // Multer 错误处理
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: '文件大小不能超过 10MB',
        error: 'FILE_SIZE_LIMIT_EXCEEDED'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: '文件字段名不正确',
        error: 'INVALID_FIELD_NAME'
      });
    }
    return res.status(400).json({
      success: false,
      message: '文件上传失败',
      error: 'UPLOAD_FAILED'
    });
  }

  // 自定义文件类型错误
  if (err.message?.includes('PDF') || err.message?.includes('图片') || err.message?.includes('QA')) {
    return res.status(400).json({
      success: false,
      message: err.message,
      error: 'INVALID_FILE_TYPE'
    });
  }

  // 其他错误
  console.error('服务器错误:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  const statusCode = err.status || 500;
  const response = {
    success: false,
    message: err.message || '服务器内部错误'
  };

  if (process.env.NODE_ENV === 'development') {
    response.error = err.message;
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
});

// ✅ 服务器启动逻辑
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');

    const syncOptions = process.env.NODE_ENV === 'development'
      ? { force: false }
      : { alter: false };
    await sequelize.sync(syncOptions);
    console.log('✅ 数据库同步成功');

    // ✅ 自动补齐真实 MySQL 中 products 表的新增字段与状态枚举（幂等安全）
    if (typeof sequelize.getDialect === 'function' && sequelize.getDialect() === 'mysql') {
      try {
        const [columns] = await sequelize.query('SHOW COLUMNS FROM `products`');
        const colNames = columns.map((c) => c.Field);
        const hasExactProductFccId = colNames.includes('productfccId');

        if (!hasExactProductFccId) {
          const legacyCol = colNames.find(
            (name) => name.toLowerCase() === 'fccid' || name.toLowerCase() === 'productfccid'
          );
          if (legacyCol) {
            await sequelize.query(
              `ALTER TABLE \`products\` CHANGE COLUMN \`${legacyCol}\` \`productfccId\` VARCHAR(255) NULL`
            );
            console.log(`✅ 已自动将 products.${legacyCol} 字段重命名为 productfccId`);
          } else {
            await sequelize.query(
              'ALTER TABLE `products` ADD COLUMN `productfccId` VARCHAR(255) NULL AFTER `brand`'
            );
            console.log('✅ 已自动为 products 表添加 productfccId 字段');
          }
        }

        const statusCol = columns.find((c) => c.Field === 'status');
        if (statusCol && !String(statusCol.Type || '').includes('clearance')) {
          await sequelize.query(
            "ALTER TABLE `products` MODIFY COLUMN `status` ENUM('active','discontinued','development','clearance') NOT NULL DEFAULT 'active'"
          );
          console.log('✅ 已自动更新 products.status 枚举（补充 clearance）');
        }

        if (!colNames.includes('nasLink')) {
          await sequelize.query(
            'ALTER TABLE `products` ADD COLUMN `nasLink` VARCHAR(500) NULL AFTER `httpLink`'
          );
          console.log('✅ 已自动为 products 表添加 nasLink 字段');
        }

        if (!colNames.includes('qaDocument')) {
          await sequelize.query(
            'ALTER TABLE `products` ADD COLUMN `qaDocument` VARCHAR(255) NULL AFTER `manual`'
          );
          console.log('✅ 已自动为 products 表添加 qaDocument 字段');
        }
      } catch (migrateErr) {
        console.warn('⚠️ 自动校验 products 表字段失败:', migrateErr.message);
      }

      // ✅ 自动扩展 product_relations.relation_type 并补充索引以加速产品关联查询
      try {
        const [relCols] = await sequelize.query("SHOW COLUMNS FROM `product_relations` LIKE 'relation_type'");
        const relTypeCol = Array.isArray(relCols) ? relCols[0] : null;
        const typeStr = String(relTypeCol?.Type || '').toLowerCase();
        if (typeStr.startsWith('enum(') && !typeStr.includes('mutual_replacement')) {
          await sequelize.query(
            "ALTER TABLE `product_relations` MODIFY COLUMN `relation_type` ENUM('compatible','upgrade','replacement','mutual_replacement') NOT NULL"
          );
          console.log('✅ 已自动扩展 product_relations.relation_type 枚举（补充 mutual_replacement）');
        }

        const [relIndexes] = await sequelize.query('SHOW INDEX FROM `product_relations`');
        const indexedCols = new Set((relIndexes || []).map((idx) => idx.Column_name));
        if (!indexedCols.has('source_product_id')) {
          await sequelize.query(
            'CREATE INDEX `idx_product_relations_source` ON `product_relations` (`source_product_id`)'
          );
          console.log('✅ 已自动为 product_relations.source_product_id 添加索引');
        }
        if (!indexedCols.has('target_product_id')) {
          await sequelize.query(
            'CREATE INDEX `idx_product_relations_target` ON `product_relations` (`target_product_id`)'
          );
          console.log('✅ 已自动为 product_relations.target_product_id 添加索引');
        }
      } catch (relMigrateErr) {
        console.warn('⚠️ 自动校验 product_relations 表字段/索引失败:', relMigrateErr.message);
      }

      // ✅ 自动为 fcc_products 关联表补充索引以加速 /fccs 与 /fccview 查询
      try {
        const [fccLinkIndexes] = await sequelize.query('SHOW INDEX FROM `fcc_products`');
        const indexedFccCols = new Set((fccLinkIndexes || []).map((idx) => idx.Column_name));
        if (!indexedFccCols.has('fccId')) {
          await sequelize.query(
            'CREATE INDEX `idx_fcc_products_fccId` ON `fcc_products` (`fccId`)'
          );
          console.log('✅ 已自动为 fcc_products.fccId 添加索引');
        }
        if (!indexedFccCols.has('productId')) {
          await sequelize.query(
            'CREATE INDEX `idx_fcc_products_productId` ON `fcc_products` (`productId`)'
          );
          console.log('✅ 已自动为 fcc_products.productId 添加索引');
        }
      } catch (fccIdxErr) {
        console.warn('⚠️ 自动校验 fcc_products 表索引失败:', fccIdxErr.message);
      }

      // ✅ 确保 fcc_search_stats 热词统计表存在（用于 /fccview 快捷检索）
      try {
        await sequelize.query(`
          CREATE TABLE IF NOT EXISTS \`fcc_search_stats\` (
            \`id\` INT NOT NULL AUTO_INCREMENT,
            \`keywordKey\` VARCHAR(100) NOT NULL,
            \`keyword\` VARCHAR(100) NOT NULL,
            \`searchCount\` INT NOT NULL DEFAULT 1,
            \`lastSearchedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (\`id\`),
            UNIQUE KEY \`uniq_fcc_search_stats_keyword_key\` (\`keywordKey\`),
            KEY \`idx_fcc_search_stats_hot\` (\`searchCount\`, \`lastSearchedAt\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
      } catch (hotTableErr) {
        console.warn('⚠️ 自动校验 fcc_search_stats 表失败:', hotTableErr.message);
      }
    }

    // ✅ 初始化并同步数据库下拉选项表（dropdown_options）
    await syncInitialOptions();

    // ✅ 幂等补齐历史单向的「互匹配」「互替代」双向关联记录
    await syncSymmetricProductRelations();

    const [tables] = await sequelize.query('SHOW TABLES');
    if (tables.length > 0) {
      console.log('📊 数据库中的表:');
      tables.forEach(table => {
        console.log(`   - ${Object.values(table)[0]}`);
      });
    }
  } catch (error) {
    console.warn('⚠️ 数据库初始化警告，继续启动服务:', error.message);
  }

  const PORT = Number(process.env.BACKEND_PORT || process.env.DEFAULT_APP_PORT) || 3000;
  const HOST = process.env.HOST || '0.0.0.0';
  const server = app.listen(PORT, HOST, () => {
    console.log(`🚀 服务运行在 http://${HOST}:${PORT}`);
    console.log(`📁 静态文件目录: ${path.join(__dirname, 'public/uploads')}`);
    console.log(`🌐 API 地址: http://${HOST}:${PORT}/api`);
    console.log(`🔧 健康检查: http://${HOST}:${PORT}/health`);
    console.log(`🔌 FCC 管理: http://${HOST}:${PORT}/api/fccs`);
    console.log(`📦 产品管理: http://${HOST}:${PORT}/api/products`);
  });
  // Keep-alive timeout higher than reverse proxy / Cloud Run default (60s) to prevent TCP RST
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
};

// 优雅关闭
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
const shutdown = async (signal) => {
  console.log(`收到 ${signal} 信号，正在关闭服务器...`);
  try {
    await sequelize.close();
    console.log('✅ 数据库连接已关闭');
    process.exit(0);
  } catch (err) {
    console.error('❌ 关闭数据库时出错:', err.message);
    process.exit(1);
  }
};

startServer();
module.exports = app;
