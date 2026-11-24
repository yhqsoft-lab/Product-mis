// controllers/authController.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

// ✅ 从 models/index.js 导入 User 模型
const { User } = require('../models');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-local-jwt-secret';

// 用户登录
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 验证输入
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空'
      });
    }

    console.log('🔍 查询用户:', username);

    // 检查 User 模型是否已正确加载
    if (!User || typeof User.findOne !== 'function') {
      console.error('🔥 User 模型未正确初始化');
      return res.status(500).json({
        success: false,
        message: '服务器配置错误'
      });
    }

    // 查找用户（包括密码字段）
    const user = await User.findOne({
      where: { username },
      attributes: ['id', 'username', 'password', 'role', 'email', 'isActive']
    });

    console.log('🔍 查询结果:', user ? `找到用户 ID: ${user.id}` : '用户不存在');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 检查用户是否激活
    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: '账号已被禁用'
      });
    }

    console.log('🔍 验证密码...');

    // 验证密码
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('🔍 密码验证结果:', isMatch);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 生成 JWT Token（短期令牌，24小时）
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        loginTime: Date.now() // 记录登录时间，用于超时检测
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // 生成 Refresh Token（长期令牌，7天）
    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET || JWT_SECRET + '_refresh',
      { expiresIn: '7d' } // 7天过期
    );

    // 更新用户最后活动时间和刷新令牌（可选）
    try {
      await User.update(
        {
          lastActivity: new Date(),
          refreshToken
        },
        { where: { id: user.id } }
      );
    } catch (updateError) {
      console.warn('⚠️ 更新用户活动时间失败:', updateError.message);
      // 不影响主要登录流程
    }

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      }
    });

  } catch (err) {
    console.error('🔥 登录错误详情:', err);
    console.error('🔥 错误消息:', err.message);
    console.error('🔥 错误堆栈:', err.stack);

    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// 用户注册
exports.register = async (req, res) => {
  try {
    const { username, password, confirmPassword, email } = req.body;

    // 验证必填字段
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空'
      });
    }

    // 验证两次密码是否一致
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: '两次输入的密码不一致'
      });
    }

    // 检查用户名是否已存在
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '用户名已存在'
      });
    }

    // 检查邮箱是否已存在（如果提供了邮箱）
    if (email) {
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: '邮箱已被注册'
        });
      }
    }

    // 加密密码
    console.log('🔍 加密密码...');
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建新用户
    console.log('🔍 创建用户...');
    const newUser = await User.create({
      username,
      password: hashedPassword,
      email: email || null,
      role: 'user', // 默认用户角色
      isActive: true,
      lastActivity: new Date()
    });

    const token = jwt.sign(
      {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        loginTime: Date.now()
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // 生成 Refresh Token
    const refreshToken = jwt.sign(
      { id: newUser.id },
      process.env.JWT_REFRESH_SECRET || JWT_SECRET + '_refresh',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        token,
        refreshToken,
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role
        }
      }
    });

  } catch (err) {
    console.error('🔥 注册错误:', err);
    res.status(500).json({
      success: false,
      message: '注册失败',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// 刷新访问令牌
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: '刷新令牌不能为空'
      });
    }

    console.log('🔍 刷新令牌请求...');

    // 验证刷新令牌
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || JWT_SECRET + '_refresh'
    );

    // 查找用户并验证刷新令牌
    const user = await User.findOne({
      where: {
        id: decoded.id,
        isActive: true
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在或已被禁用'
      });
    }

    // 可选：检查刷新令牌是否与存储的一致
    if (user.refreshToken && user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: '无效的刷新令牌'
      });
    }

    // 检查最后活动时间（可选安全措施）
    if (user.lastActivity) {
      const lastActivity = new Date(user.lastActivity);
      const now = new Date();
      const daysDiff = (now - lastActivity) / (1000 * 60 * 60 * 24);

      // 如果超过30天无活动，要求重新登录
      if (daysDiff > 30) {
        return res.status(401).json({
          success: false,
          message: '会话已过期，请重新登录'
        });
      }
    }

    // 生成新的访问令牌
    const newToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        loginTime: Date.now()
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // 可选：更新最后活动时间
    await User.update(
      { lastActivity: new Date() },
      { where: { id: user.id } }
    );

    res.json({
      success: true,
      message: '令牌刷新成功',
      data: {
        token: newToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      }
    });

  } catch (err) {
    console.error('🔥 刷新令牌错误:', err);

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: '刷新令牌已过期，请重新登录'
      });
    }

    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: '无效的刷新令牌'
      });
    }

    res.status(500).json({
      success: false,
      message: '令牌刷新失败'
    });
  }
};

// 心跳检测 - 更新用户最后活动时间
exports.heartbeat = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('❤️ 心跳请求来自用户:', userId);

    // 更新用户最后活动时间
    await User.update(
      { lastActivity: new Date() },
      { where: { id: userId } }
    );

    res.json({
      success: true,
      message: '活动已记录',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🔥 心跳请求失败:', error);
    res.status(500).json({
      success: false,
      message: '心跳请求失败'
    });
  }
};

// 获取当前用户信息
exports.getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password', 'refreshToken'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          lastActivity: user.lastActivity,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    });

  } catch (err) {
    console.error('🔥 获取用户信息错误:', err);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败'
    });
  }
};

// 用户登出
exports.logout = async (req, res) => {
  try {
    const userId = req.user.id;

    // 清除用户的刷新令牌（可选）
    await User.update(
      { refreshToken: null },
      { where: { id: userId } }
    );

    console.log('👋 用户登出:', userId);

    res.json({
      success: true,
      message: '登出成功'
    });

  } catch (err) {
    console.error('🔥 登出错误:', err);
    res.status(500).json({
      success: false,
      message: '登出失败'
    });
  }
};

// 检查用户名是否可用
exports.checkUsername = async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: '请提供用户名'
      });
    }

    const existingUser = await User.findOne({ where: { username } });

    res.json({
      success: true,
      data: {
        available: !existingUser
      }
    });

  } catch (err) {
    console.error('🔥 检查用户名失败:', err);
    res.status(500).json({
      success: false,
      message: '检查用户名失败'
    });
  }
};

// 更新用户信息
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { email, currentPassword, newPassword } = req.body;

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 更新邮箱
    if (email && email !== user.email) {
      // 检查邮箱是否已被使用
      const existingEmail = await User.findOne({
        where: { email },
        attributes: ['id']
      });

      if (existingEmail && existingEmail.id !== userId) {
        return res.status(400).json({
          success: false,
          message: '邮箱已被其他用户使用'
        });
      }

      user.email = email;
    }

    // 更新密码（如果提供了当前密码和新密码）
    if (currentPassword && newPassword) {
      // 验证当前密码
      const isMatch = await bcrypt.compare(currentPassword, user.password);

      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: '当前密码不正确'
        });
      }

      // 加密新密码
      user.password = await bcrypt.hash(newPassword, 10);
    } else if (newPassword && !currentPassword) {
      // 如果没有提供当前密码
      return res.status(400).json({
        success: false,
        message: '需要提供当前密码才能修改密码'
      });
    }

    await user.save();

    // 返回更新后的用户信息（排除敏感字段）
    const updatedUser = await User.findByPk(userId, {
      attributes: { exclude: ['password', 'refreshToken'] }
    });

    res.json({
      success: true,
      message: '个人信息更新成功',
      data: {
        user: updatedUser
      }
    });

  } catch (err) {
    console.error('🔥 更新个人信息失败:', err);
    res.status(500).json({
      success: false,
      message: '更新个人信息失败'
    });
  }
};

// 初始化管理员用户（开发用）
exports.initAdmin = async (req, res) => {
  try {
    // 只在开发环境允许
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({
        success: false,
        message: '此功能仅在开发环境可用'
      });
    }

    const { username, password, email } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空'
      });
    }

    // 检查是否已存在管理员
    const existingAdmin = await User.findOne({ where: { username } });

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: '用户已存在'
      });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建管理员用户
    const adminUser = await User.create({
      username,
      password: hashedPassword,
      email: email || 'admin@example.com',
      role: 'admin',
      isActive: true,
      lastActivity: new Date()
    });

    console.log('✅ 管理员用户创建成功:', username);

    res.status(201).json({
      success: true,
      message: '管理员用户创建成功',
      data: {
        user: {
          id: adminUser.id,
          username: adminUser.username,
          email: adminUser.email,
          role: adminUser.role
        }
      }
    });

  } catch (err) {
    console.error('🔥 初始化管理员失败:', err);
    res.status(500).json({
      success: false,
      message: '初始化管理员失败'
    });
  }
};

// 检查会话状态
exports.checkSession = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId, {
      attributes: ['id', 'username', 'lastActivity']
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 检查最后活动时间
    let sessionStatus = 'active';
    let minutesSinceLastActivity = 0;

    if (user.lastActivity) {
      const lastActivity = new Date(user.lastActivity);
      const now = new Date();
      minutesSinceLastActivity = Math.floor((now - lastActivity) / (1000 * 60));

      if (minutesSinceLastActivity > 30) {
        sessionStatus = 'expired';
      } else if (minutesSinceLastActivity > 25) {
        sessionStatus = 'warning';
      }
    }

    res.json({
      success: true,
      data: {
        sessionStatus,
        minutesSinceLastActivity,
        user: {
          id: user.id,
          username: user.username,
          lastActivity: user.lastActivity
        }
      }
    });

  } catch (err) {
    console.error('🔥 检查会话状态失败:', err);
    res.status(500).json({
      success: false,
      message: '检查会话状态失败'
    });
  }
};

const VALID_ROLES = ['admin', 'editor', 'user'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateNewPassword = (password) => {
  if (typeof password !== 'string' || password.length < 6) {
    return '新密码长度至少为 6 位';
  }
  if (password.length > 128) {
    return '新密码长度不能超过 128 位';
  }
  return null;
};

// 修改当前登录用户自己的密码
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '当前密码和新密码不能为空'
      });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: '两次输入的新密码不一致'
      });
    }

    const passwordError = validateNewPassword(newPassword);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: '当前密码不正确'
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: '新密码不能与当前密码相同'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.update(
      { password: hashedPassword, refreshToken: null },
      { where: { id: userId } }
    );

    res.json({
      success: true,
      message: '密码修改成功'
    });
  } catch (err) {
    console.error('🔥 修改密码失败:', err);
    res.status(500).json({
      success: false,
      message: '修改密码失败'
    });
  }
};

// ================= 管理员：账号与角色管理 =================

// 获取账号列表（支持关键词搜索与服务端分页）
exports.listUsers = async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const hasPagination =
      req.query.page !== undefined ||
      req.query.pageSize !== undefined ||
      req.query.limit !== undefined;
    const rawPage = Number.parseInt(req.query.page, 10);
    const rawSize = Number.parseInt(req.query.pageSize ?? req.query.limit, 10);
    const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
    const pageSize =
      Number.isInteger(rawSize) && rawSize > 0 ? Math.min(rawSize, 100) : 10;

    const where = {};
    if (search) {
      const orClauses = [
        { username: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { role: { [Op.like]: `%${search}%` } }
      ];
      if ('管理员'.includes(search)) orClauses.push({ role: 'admin' });
      if ('编辑员'.includes(search)) orClauses.push({ role: 'editor' });
      if ('成员'.includes(search)) orClauses.push({ role: 'user' });
      where[Op.or] = orClauses;
    }

    if (hasPagination) {
      const total = await User.count({ where });
      const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
      const safePage = totalPages > 0 ? Math.min(page, totalPages) : 1;
      const offset = (safePage - 1) * pageSize;

      const users =
        total > 0
          ? await User.findAll({
              where,
              attributes: { exclude: ['password', 'refreshToken'] },
              order: [['id', 'ASC']],
              limit: pageSize,
              offset
            })
          : [];

      return res.json({
        success: true,
        data: users,
        pagination: {
          page: safePage,
          pageSize,
          total,
          totalPages
        }
      });
    }

    const users = await User.findAll({
      where,
      attributes: { exclude: ['password', 'refreshToken'] },
      order: [['id', 'ASC']]
    });

    res.json({
      success: true,
      data: users
    });
  } catch (err) {
    console.error('🔥 获取用户列表失败:', err);
    res.status(500).json({
      success: false,
      message: '获取账号列表失败'
    });
  }
};

// 管理员创建新账号
exports.createUser = async (req, res) => {
  try {
    const { username, password, email, role = 'user', isActive = true } = req.body || {};
    const trimmedUsername = typeof username === 'string' ? username.trim() : '';
    const trimmedEmail = typeof email === 'string' ? email.trim() : '';

    if (!trimmedUsername || trimmedUsername.length < 3 || trimmedUsername.length > 50) {
      return res.status(400).json({
        success: false,
        message: '用户名长度须在 3 到 50 个字符之间'
      });
    }

    const passwordError = validateNewPassword(password);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError
      });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: '无效的角色类型'
      });
    }

    if (trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: '邮箱格式不正确'
      });
    }

    const existingUser = await User.findOne({ where: { username: trimmedUsername } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '用户名已存在'
      });
    }

    if (trimmedEmail) {
      const existingEmail = await User.findOne({ where: { email: trimmedEmail } });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: '邮箱已被使用'
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const created = await User.create({
      username: trimmedUsername,
      password: hashedPassword,
      email: trimmedEmail || null,
      role,
      isActive: Boolean(isActive),
      lastActivity: new Date()
    });

    res.status(201).json({
      success: true,
      message: '账号创建成功',
      data: {
        id: created.id,
        username: created.username,
        email: created.email,
        role: created.role,
        isActive: created.isActive,
        lastActivity: created.lastActivity,
        createdAt: created.createdAt
      }
    });
  } catch (err) {
    console.error('🔥 创建用户失败:', err);
    res.status(500).json({
      success: false,
      message: '创建账号失败'
    });
  }
};

// 管理员修改账号角色、状态或邮箱
exports.updateUser = async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({
        success: false,
        message: '无效的用户 ID'
      });
    }

    const targetUser = await User.findByPk(targetId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: '账号不存在'
      });
    }

    const { role, isActive, email } = req.body || {};
    const updates = {};

    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({
          success: false,
          message: '无效的角色类型'
        });
      }
      if (targetUser.id === req.user.id && role !== 'admin') {
        return res.status(400).json({
          success: false,
          message: '不能降低当前登录管理员自身的权限'
        });
      }
      if (targetUser.role === 'admin' && role !== 'admin') {
        const activeAdmins = await User.count({ where: { role: 'admin', isActive: true } });
        if (activeAdmins <= 1) {
          return res.status(400).json({
            success: false,
            message: '系统至少需要保留一名启用状态的管理员'
          });
        }
      }
      updates.role = role;
    }

    if (isActive !== undefined) {
      const nextActive = Boolean(isActive);
      if (targetUser.id === req.user.id && !nextActive) {
        return res.status(400).json({
          success: false,
          message: '不能禁用当前登录的管理员账号'
        });
      }
      if (targetUser.role === 'admin' && targetUser.isActive && !nextActive) {
        const activeAdmins = await User.count({ where: { role: 'admin', isActive: true } });
        if (activeAdmins <= 1) {
          return res.status(400).json({
            success: false,
            message: '系统至少需要保留一名启用状态的管理员'
          });
        }
      }
      updates.isActive = nextActive;
      if (!nextActive) {
        updates.refreshToken = null;
      }
    }

    if (email !== undefined) {
      const trimmedEmail = typeof email === 'string' ? email.trim() : '';
      if (trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)) {
        return res.status(400).json({
          success: false,
          message: '邮箱格式不正确'
        });
      }
      if (trimmedEmail && trimmedEmail !== targetUser.email) {
        const existingEmail = await User.findOne({ where: { email: trimmedEmail } });
        if (existingEmail && existingEmail.id !== targetUser.id) {
          return res.status(400).json({
            success: false,
            message: '邮箱已被其他账号使用'
          });
        }
      }
      updates.email = trimmedEmail || null;
    }

    await User.update(updates, { where: { id: targetId } });

    const updated = await User.findByPk(targetId, {
      attributes: { exclude: ['password', 'refreshToken'] }
    });

    res.json({
      success: true,
      message: '账号信息已更新',
      data: updated
    });
  } catch (err) {
    console.error('🔥 更新账号失败:', err);
    res.status(500).json({
      success: false,
      message: '更新账号失败'
    });
  }
};

// 管理员重置指定账号密码
exports.adminResetPassword = async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({
        success: false,
        message: '无效的用户 ID'
      });
    }

    const { newPassword, confirmPassword } = req.body || {};
    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: '两次输入的密码不一致'
      });
    }

    const passwordError = validateNewPassword(newPassword);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError
      });
    }

    const targetUser = await User.findByPk(targetId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: '账号不存在'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.update(
      { password: hashedPassword, refreshToken: null },
      { where: { id: targetId } }
    );

    res.json({
      success: true,
      message: `已重置账号「${targetUser.username}」的密码`
    });
  } catch (err) {
    console.error('🔥 重置密码失败:', err);
    res.status(500).json({
      success: false,
      message: '重置密码失败'
    });
  }
};

// 管理员删除账号
exports.deleteUser = async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({
        success: false,
        message: '无效的用户 ID'
      });
    }

    if (targetId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: '不能删除当前登录的管理员账号'
      });
    }

    const targetUser = await User.findByPk(targetId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: '账号不存在'
      });
    }

    if (targetUser.role === 'admin' && targetUser.isActive) {
      const activeAdmins = await User.count({ where: { role: 'admin', isActive: true } });
      if (activeAdmins <= 1) {
        return res.status(400).json({
          success: false,
          message: '系统至少需要保留一名启用状态的管理员'
        });
      }
    }

    await targetUser.destroy();

    res.json({
      success: true,
      message: '账号已删除'
    });
  } catch (err) {
    console.error('🔥 删除账号失败:', err);
    res.status(500).json({
      success: false,
      message: '删除账号失败'
    });
  }
};
