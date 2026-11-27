// react-demo/src/setupProxy.js
// Create React App 的 package.json "proxy" 不会代理浏览器新标签页打开的
// Accept: text/html 请求（导致 /uploads/*.pdf 等直链被重定向到 index.html）。
// 通过 setupProxy.js 在 historyApiFallback 之前显式代理 /api、/uploads、/images。
const fs = require('fs');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

function readBackendPortFromEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return '';
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/^\s*BACKEND_PORT\s*=\s*(\d+)/m);
    return match ? match[1].trim() : '';
  } catch {
    return '';
  }
}

function resolveBackendTarget() {
  const apiBase = (process.env.REACT_APP_API_BASE || '').trim();
  if (/^https?:\/\//i.test(apiBase)) {
    return apiBase.replace(/\/+$/, '');
  }

  const envPort =
    (process.env.BACKEND_PORT || '').trim() ||
    readBackendPortFromEnvFile(path.resolve(__dirname, '../../backend/.env')) ||
    readBackendPortFromEnvFile(path.resolve(__dirname, '../../.env'));

  if (envPort) {
    return `http://localhost:${envPort}`;
  }

  try {
    const pkg = require('../package.json');
    if (typeof pkg.proxy === 'string' && /^https?:\/\//i.test(pkg.proxy.trim())) {
      return pkg.proxy.trim().replace(/\/+$/, '');
    }
  } catch {
    // 忽略读取失败
  }

  return 'http://localhost:3000';
}

module.exports = function setupProxy(app) {
  const target = resolveBackendTarget();
  app.use(
    createProxyMiddleware(['/api', '/uploads', '/images'], {
      target,
      changeOrigin: true
    })
  );
};
