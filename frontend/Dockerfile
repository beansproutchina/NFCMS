# Frontend Dockerfile
# 使用 ARG THEME 来选择主题: docker build --build-arg THEME=pear .

FROM node:22-alpine as builder

# 构建参数：选择主题（pear 或 school）
ARG THEME=pear

WORKDIR /app/frontend

# 配置淘宝镜像
RUN npm config set registry https://registry.npmmirror.com

# 复制package文件
COPY package*.json ./

# 构建阶段：使用淘宝镜像安装依赖
RUN npm install

# 复制源代码和主题
COPY . .
COPY ../frontend_themes/${THEME} ./src/views/front/templates/

# 构建项目
RUN npm run build

# 运行阶段：使用Nginx
FROM nginx:alpine

# 复制Nginx配置文件
COPY nginx.conf /etc/nginx/nginx.conf

# 从builder阶段复制构建结果
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 启动Nginx
CMD ["nginx", "-g", "daemon off;"]
