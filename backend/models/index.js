// models/index.js
const path = require('path');
const fs = require('fs');
const { Sequelize, DataTypes } = require('sequelize');

// ✅ 加载环境变量（兼容从根目录或 backend 目录启动）
const dotenv = require('dotenv');
const rootEnvPath = path.resolve(__dirname, '../../.env');
const backendEnvPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath });
if (fs.existsSync(backendEnvPath)) dotenv.config({ path: backendEnvPath });
dotenv.config();

// 默认在无 MySQL 配置的在线预览环境使用内存模拟数据库；
// 本地只要配置了 DB_HOST 与 DB_NAME（且未显式设 USE_MOCK_DB=true），或显式设置 USE_REAL_DB=true，即自动连接真实 MySQL
const useRealDb =
  process.env.USE_REAL_DB === 'true' ||
  (process.env.USE_MOCK_DB !== 'true' && Boolean(process.env.DB_HOST && process.env.DB_NAME));

if (!useRealDb) {
  console.warn('[DB] Using in-memory mock database (set USE_REAL_DB=true for MySQL)');
  const mockDb = require('./mockDb');
  mockDb.Sequelize = Sequelize;
  module.exports = mockDb;
} else {
  // ✅ 创建 Sequelize 实例（统一连接）
  const sequelize = new Sequelize(
    process.env.DB_NAME || 'your_database',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      dialect: 'mysql',
      dialectModule: require('mysql2'), // 使用 mysql2 驱动
      logging: process.env.NODE_ENV === 'development' ?
        (msg) => console.log(`[Sequelize] ${msg}`) :
        false,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      define: {
        timestamps: true,
        underscored: false,
        freezeTableName: true
      },
      timezone: '+08:00' // 设置时区（如果需要）
    }
  );

  // ✅ 自动加载所有模型
  const db = {};

  // 读取当前目录下的所有 .js 文件（除了 index.js 和 mockDb.js）
  fs.readdirSync(__dirname)
    .filter(file => {
      return (
        file !== 'index.js' &&
        file !== 'mockDb.js' &&
        file.slice(-3) === '.js' &&
        file !== 'ProductWorkWith.js'
      );
    })
    .forEach(file => {
      const model = require(path.join(__dirname, file))(sequelize, DataTypes);
      db[model.name] = model;
    });

  // ✅ 手动添加 ProductWorkWith 模型（如果有的话）
  try {
    const ProductWorkWithPath = path.join(__dirname, 'ProductWorkWith.js');
    if (fs.existsSync(ProductWorkWithPath)) {
      const ProductWorkWith = require(ProductWorkWithPath)(sequelize, DataTypes);
      db[ProductWorkWith.name] = ProductWorkWith;
    }
  } catch (err) {
    console.log('ProductWorkWith 模型加载失败或不存在:', err.message);
  }

  // ✅ 建立模型关联
  Object.keys(db).forEach(modelName => {
    if (db[modelName] && typeof db[modelName].associate === 'function') {
      db[modelName].associate(db);
    }
  });

  // ✅ 添加 sequelize 和 Sequelize 到 db 对象
  db.sequelize = sequelize;
  db.Sequelize = Sequelize;

  // ✅ 导出所有模型
  module.exports = db;
}
