# Backend Dockerfile
FROM node:22-alpine as builder

WORKDIR /app/backend

# 构建阶段：配置淘宝镜像并安装依赖
RUN npm config set registry https://registry.npmmirror.com

COPY package*.json bunfig.toml* ./

# 使用淘宝镜像安装依赖
RUN npm install

# 复制源代码
COPY . .

# 运行阶段：使用 Bun
FROM oven/bun:latest

WORKDIR /app/backend

# 从builder阶段复制依赖
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/bunfig.toml* ./

# 复制应用代码
COPY . .

# 暴露端口（后端默认3000）
EXPOSE 3000

# 启动命令：使用--hot启用热重载
CMD ["bun", "--hot", "index.ts"]
