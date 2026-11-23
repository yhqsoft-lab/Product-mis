# Product CMS — 产品与 FCC 管理平台

基于 **React + Express + Sequelize** 构建的产品目录、FCC 认证管理与后台仪表盘系统。

- **GitHub 仓库**：[https://github.com/yhqsoft-lab/product_cms](https://github.com/yhqsoft-lab/product_cms)
- **问题反馈**：[https://github.com/yhqsoft-lab/product_cms/issues](https://github.com/yhqsoft-lab/product_cms/issues)

## 项目结构

```text
product_cms/
├── backend/        # Express 5 API 服务、JWT 认证、图片上传、Sequelize 模型与内存 Mock 数据库
├── react-demo/     # React + Tailwind CSS 前端应用与 Dashboard 布局
├── .env.example    # 环境变量示例配置
└── package.json    # 根目录构建与启动脚本
```

## 快速开始

### 1. 安装依赖

```bash
npm install
npm --prefix react-demo install --legacy-peer-deps
```

### 2. 构建前端

```bash
npm run build
```

### 3. 启动服务

```bash
npm run dev
# 或生产启动
npm start
```

服务默认监听 `http://0.0.0.0:3000`，同时提供前端静态页面与 `/api/*` 接口。

## 默认演示账号（内存模式）

未配置外部 MySQL 时，后端默认使用内置内存数据库（`backend/models/mockDb.js`）启动：

- **用户名**：`admin`
- **密码**：`Admin123!`

## 连接真实 MySQL 数据库

参考 `.env.example` 配置以下环境变量并设置 `USE_REAL_DB=true`：

- `USE_REAL_DB=true`
- `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME`
- `JWT_SECRET`
