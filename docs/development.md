# Development & Operations

## 前置
- Bun ≥ 1.2(本机在 `~/.bun/bin/bun`,可能不在 PATH → 用全路径或 `export PATH="$HOME/.bun/bin:$PATH"`)。
- Node ≥ 20 + npm(前端工具链)。
- 本地 DYAPI 源码在 `../dyapi3/dyapi`(相对仓库根),`backend/package.json` 以 `file:../../dyapi3/dyapi` pin。

## 环境变量(`backend/.env`,已 gitignore)
```
JWT_SECRET=<强随机>       # 必填,缺失 bootstrap 抛错;openssl rand -hex 32
PASSWORD_SALT=<强随机>    # 必填,HMAC 密钥
SITE_URL=http://localhost # SSG canonical/OG 用
# SSG_DIR 可选,默认 backend/static/ssg
```
提交模板见 `backend/.env.example`。

## 本地运行
```bash
# 后端
cd backend && bun install        # 首次;dyapi 从本地路径拷贝安装
cd backend && bun index.ts       # 起在 :3000
# 前端
cd frontend && npm install
cd frontend && npm run dev        # :5173,代理 /api、/static → :3000
```
首次:`/setup` 建管理员 → `/login` → `/admin`。

## 数据与持久化
- SQLite:`backend/data/test.db`(+ `-wal`/`-shm`)。上传:`backend/static/uploads`。SSG 产物:`backend/static/ssg`。均 gitignore。
- **迁移**:DYAPI 只增列不删列。改字段/删列时,dev 直接删 `data/test.db*` 重新 `/setup`。

## ⚠ 测试纪律(务必)
1. **动数据库前先备份、测完还原**:
   ```bash
   cp backend/data/test.db{,.bak}          # 备份
   # ...破坏性测试...
   cp backend/data/test.db.bak backend/data/test.db   # 还原
   ```
   或用一次性库测,再还原备份。**不要直接 `rm` 用户的 `data/test.db`**。
2. **重启后端前杀干净旧进程**,否则 SQLite 双开 → `disk I/O error` + 假 403/416(是幻象,不是代码 bug):
   ```bash
   pkill -9 -f "index.ts"; lsof -ti tcp:3000 | xargs kill -9; sleep 1
   ```
3. **`bun index.ts` 必须先 `cd backend`**(否则 Module not found)。
4. 后台跑服务:`(cd backend && bun index.ts > /tmp/nf.log 2>&1 &)`,再 `curl` 验证;用完 `pkill`。

## 构建
- 前端:`cd frontend && npm run build`(`vue-tsc -b && vite build`)。产物 `frontend/dist/`。
- 后端无构建步骤(Bun 直接跑 TS)。

## 常见验证片段(curl)
```bash
B=http://localhost:3000/api
curl -s -X POST $B/system/setup -d '{"siteName":"T","adminUsername":"admin","adminPassword":"pass1234"}' -H 'Content-Type: application/json'
curl -s -c /tmp/c $B/user/login -X POST -d '{"username":"admin","password":"pass1234"}' -H 'Content-Type: application/json'
curl -s "$B/content/home"                       # 公开首页数据(应 200)
curl -s -b /tmp/c "$B/articles?limit=999"        # 后台列表
```

## Docker 部署
- **单容器(推荐)**:`docker compose -f docker-compose.single.yml up -d --build`。`Dockerfile.single` 三段构建(前端 build → 后端依赖 → oven/bun 运行时 + nginx + supervisor)。`docker/nginx.single.conf` 对 `/`、`/a/`、`/sitemap.xml` 优先命中 SSG,回落 SPA;`/api`、`/static` 代理到 :3000。主题用 `--build-arg THEME=<name>`。
- **多容器**:`docker-compose.yml`(backend + frontend-nginx)。注:SSG 静态文件在 backend 容器,多容器要让 nginx 能读到(共享卷),否则 SSG 只在单容器拓扑生效。
- 生产前:确认 `.env`(JWT_SECRET/PASSWORD_SALT/SITE_URL),把 `backend/Dockerfile` 的 `bun --hot` 改为 `bun index.ts`(热重载不该上生产),配置数据卷备份。

## 陷阱清单(复述)
- `dyapi3/dyapi` 改动后要 `cd backend && bun install`(file: 是拷贝)。
- `vue-i18n` 别升 12-alpha(构建挂)。
- 公开站不要打 `/api/articles`(RBAC 403),走 `/api/content/*`。
- 新 UI 文案进 i18n,别硬编码。
- 生命周期字段(status/publish_at/rev_version)不能经普通 CRUD 写,走 `/api/lifecycle`。
