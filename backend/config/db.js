const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

const rootEnvPath = path.resolve(__dirname, '../../.env');
const backendEnvPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath });
if (fs.existsSync(backendEnvPath)) dotenv.config({ path: backendEnvPath });
dotenv.config();

const useRealDb =
  process.env.USE_REAL_DB === 'true' ||
  (process.env.USE_MOCK_DB !== 'true' && Boolean(process.env.DB_HOST && process.env.DB_NAME));

if (!useRealDb) {
  const { sequelize } = require('../models/mockDb');
  module.exports = sequelize;
} else {
  const sequelize = new Sequelize({
    dialect: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306
  });
  sequelize.authenticate()
    .then(() => console.log('✅ Sequelize 连接成功'))
    .catch(err => console.error('❌ Sequelize 连接失败:', err));
  module.exports = sequelize;
}
