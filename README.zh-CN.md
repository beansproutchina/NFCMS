# NFCMS

[English](README.md)

NFCMS 是一个基于 DYAPI 构建的动态、可扩展、插件友好的 Headless CMS，并提供了解耦的 Vue 3 前端（包含前台展示与后台管理）。

它面向希望快速上线内容系统、同时保留架构灵活性的团队：支持基于 Schema 的动态模型、统一 CRUD API、模板驱动渲染与 Docker 优先部署。

## 项目特色

- 基于内容 Schema 的运行时动态模型注入。
- Headless 内容 API + 一体化后台管理面板。
- 首次安装向导（`/setup`）快速初始化站点与超级管理员。
- 基于角色的权限控制（`PUBLIC`、`admin`、`super_admin`）与 JWT 登录。
- Markdown 优先的文章编辑体验。
- 分类模板与文章模板可覆盖。
- 文件上传与附件管理。
- 前端主题可在 Docker 构建时切换（默认 `pear` / 可选 `school`）。
- 内置 Hook/Event 机制（actions + filters）便于扩展。

## 为什么选择 NFCMS

- 上手快：内置文章、分类、菜单、用户等核心模块。
- 扩展快：通过 Schema 记录注册新内容模型，无需重写核心逻辑。
- 前后端解耦：前端完全基于 API，可独立演进。
- 部署一致：本地开发与 Docker 生产流程一致。

## 架构概览

- 后端：Bun + DYAPI + SQLite（文件型数据库）
- 前端：Vue 3 + TypeScript + Vite + PrimeVue + Tailwind CSS
- 存储：
  - 数据库：`backend/data/test.db`
  - 上传文件：`backend/static/uploads`

## 仓库结构

```text
backend/           基于 DYAPI 的 API 服务与动态模型引擎
frontend/          Vue 3 应用（前台 + 后台 + 初始化流程）
frontend_themes/   前端主题模板（构建时注入）
bin/               Docker 辅助脚本（start/stop/rebuild/info）
docker-compose.yml 生产风格编排
```

## 技术栈

- 运行时/API 框架：Bun + DYAPI
- 前端：Vue 3 + TypeScript + Vite
- UI：PrimeVue + Tailwind CSS
- 数据存储：SQLite（`backend/data/test.db`）
- 静态文件：本地文件系统（`backend/static/uploads`）

## 环境要求

本地开发：

- Bun >= 1.2
- Node.js >= 20
- npm >= 9

容器部署：

- Docker + Docker Compose

## 快速开始（Docker）

在仓库根目录执行：

```bash
docker compose up -d --build
```

访问地址：

- 前端：`http://localhost`
- API：`http://localhost/api`
- 后端直连：`http://localhost:3000`

也可以使用脚本：

```bash
./bin/start
./bin/stop
./bin/rebuild
./bin/info
```

### 切换前端主题

`docker-compose.yml` 默认使用 `THEME=pear`。

如需切换（例如 `school`）：

1. 修改 `docker-compose.yml` 中的 `THEME` 构建参数后重建。
2. 或手动使用 `--build-arg THEME=school` 重建前端镜像。

### 单镜像部署（打包到服务器）

如果你希望前后端打成一个镜像并直接发到服务器运行，可以使用：

```bash
docker compose -f docker-compose.single.yml up -d --build
```

这会启动一个容器，并对外提供：

- 前端 + API 入口：`http://localhost:54380`

手动构建镜像：

```bash
docker build -f Dockerfile.single -t nfcms-allinone:latest --build-arg THEME=pear .
```

导出镜像并上传服务器：

```bash
docker save nfcms-allinone:latest | gzip > nfcms-allinone.tar.gz
```

服务器上执行：

```bash
docker load -i nfcms-allinone.tar.gz
docker run -d --name nfcms-allinone -p 80:80 \
  -v $(pwd)/backend-data:/app/backend/data \
  -v $(pwd)/backend-static:/app/backend/static \
  -v $(pwd)/upload:/app/backend/upload \
  --restart always \
  nfcms-allinone:latest
```

## 快速开始（本地开发）

### 1) 启动后端

```bash
cd backend
npm install
bun --hot index.ts
```

后端默认地址：`http://localhost:3000`

### 2) 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端默认地址：`http://localhost:5173`

Vite 已配置将 `/api` 与 `/static` 代理到 `http://localhost:3000`。

## 首次初始化

1. 打开 `http://localhost:5173/setup`（Docker 环境为 `http://localhost/setup`）。
2. 输入站点名称、管理员用户名、管理员密码。
3. 提交后系统会自动初始化：
   - `super_admin` 账号
   - 站点默认配置
   - 默认分类
   - 欢迎文章
   - 默认菜单
4. 访问 `/login` 登录，再进入 `/admin` 管理后台。

前端路由守卫默认行为：

- 系统未初始化时，所有路由重定向到 `/setup`。
- 初始化完成后，再访问 `/setup` 会重定向到 `/`。

## 使用说明

### 内容管理

- 文章：编辑 Markdown 内容、可见性、slug、发布时间。
- 分类：层级分类管理，绑定列表/详情模板。
- 菜单：支持嵌套菜单结构。
- 文件：上传与附件管理。

### 动态 Schema 与 CRUD

- 在后台 Schema 工具中创建内容模型定义。
- NFCMS 读取 Schema 后在运行时注入模型类。
- 每个动态模型都可暴露对应 CRUD 路由。
- 后台动态 CRUD 页面：`/admin/crud/:modelName`

### 前台模板解析规则

- 首页模板由系统配置项 `home_template` 控制。
- 分类页模板优先级：
  - 分类 `list_template`（为空时禁用列表页）
- 文章页模板优先级：
  - 文章 `content_template` > 分类 `content_template` > `DefaultArticle`

模板统一接收 `context`（`config`、`menus`、`user`、`api` 及页面数据）。

## API 概览

代表性端点：

- 登录认证：
  - `POST /api/user/login`
- 系统管理：
  - `GET /api/system/status`
  - `GET /api/system/config`
  - `POST /api/system/config`
  - `POST /api/system/setup`
- 前台内容：
  - `GET /api/content/category?slug=...`
  - `GET /api/content/article?slug=...`
- 上传管理：
  - `POST /api/upload`
  - `DELETE /api/upload/:id`
- Schema 工具：
  - `GET /api/schematools/all`（`super_admin`）

内置模型默认 CRUD 路由示例：

- `/api/articles`
- `/api/categories`
- `/api/menus`
- `/api/users`
- `/api/attachments`
- `/api/schemas`

## 开发说明

建议前后端分别在两个终端运行：

```bash
# terminal 1
cd backend
npm install
bun --hot index.ts

# terminal 2
cd frontend
npm install
npm run dev
```

关键代码位置：

- 动态模型注入：`backend/app/services/ModelInjector.ts`
- Hook 管理器：`backend/app/services/HookManager.ts`
- 前端路由守卫与预取：`frontend/src/router/index.ts`
- 前台模板目录：`frontend/src/views/front/templates`
- 主题预设目录：`frontend_themes/`

## 贡献建议

推荐流程：

1. Fork 仓库并创建功能分支。
2. 将改动尽量限定在单一范围（backend、frontend 或 theme）。
3. 提交 PR 前验证 setup 流程和后台管理流程。
4. 若涉及 Schema/数据行为变化，请附带迁移说明。

## 当前状态

NFCMS 已具备可用能力，且扩展结构清晰，但仍在持续演进。

开源或生产前建议重点加固：

- 认证策略与密码安全策略
- 监控、日志与备份恢复流程
- 自定义扩展下的权限边界与安全审计

## License

当前仓库尚未提供 License 文件。

若准备对外开源，建议先补充 `LICENSE`（如 MIT / Apache-2.0 / GPL-3.0）。
