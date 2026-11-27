# ---- Stage 1: Build React Frontend ----
FROM node:20-alpine AS frontend-builder

WORKDIR /app/react-demo

COPY react-demo/package.json react-demo/package-lock.json* ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY react-demo/ ./
ENV CI=false
RUN npm run build

# ---- Stage 2: Production Runtime (Express + Built SPA) ----
FROM node:20-alpine AS runtime

WORKDIR /app

# 安装后端生产依赖
COPY backend/package.json backend/package-lock.json* ./backend/
RUN npm --prefix backend install --omit=dev --no-audit --no-fund

# 复制后端代码与前端构建产物
COPY backend/ ./backend/
COPY --from=frontend-builder /app/react-demo/build ./react-demo/build

# 确保上传目录存在
RUN mkdir -p /app/backend/public/uploads /app/backend/images

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV BACKEND_PORT=5000

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${BACKEND_PORT:-5000}/health" > /dev/null || exit 1

CMD ["node", "backend/app.js"]
