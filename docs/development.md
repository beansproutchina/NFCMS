# Development & Operations

## 前置
- Bun ≥ 1.2(本机在 `~/.bun/bin/bun`,可能不在 PATH → 用全路径或 `export PATH="$HOME/.bun/bin:$PATH"`)。
- Node ≥ 20 + npm(前端工具链)。
- DYAPI 与 dyapi-cli 从 npm 装(`~3.3.1` / `~0.3.0`,只吃补丁 —— dyapi 的 minor 版本里带 breaking change)。

## 环境变量(`backend/.env`,已 gitignore)
```
JWT_SECRET=<强随机>       # 必填,缺失 bootstrap 抛错;openssl rand -hex 32
PASSWORD_SALT=<强随机>    # 必填,HMAC 密钥
SITE_URL=http://localhost # 预渲染的 canonical / sitemap 用
# SSG_* 一族(生成开关、chromium 路径、目标站点…)见 backend/.env.example 末尾
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
- SQLite:`backend/data/test.db`(+ `-wal`/`-shm`)。上传:`backend/static/uploads`。预渲染产物:`backend/static/ssg`(含 `.manifest.json`)。均 gitignore。
- **迁移**:DYAPI 只增列不删列。改字段/删列时,dev 直接删 `data/test.db*` 重新 `/setup`。

## ⚠ 测试纪律(务必)
1. **动数据库前先备份、测完还原**。库是 **WAL 模式**,所以 `cp test.db` 会备出一份**不含未 checkpoint 数据的库**(极端情况下是空库),必须用 sqlite 自己的联机备份:
   ```bash
   mkdir -p backend/data/_bak && sqlite3 backend/data/test.db ".backup 'backend/data/_bak/test.db'"
   sqlite3 backend/data/_bak/test.db "select count(*) from articles;"   # 验一下不是空的
   # ...破坏性测试...
   ```
   还原:先 `pkill -9 -f index.ts`(SQLite 双开会炸),再把 `_bak/test.db` 连同 `-wal`/`-shm` 一起换回去。
   跑**整库级**的测试(如导入)时,更稳的做法是把现库整个挪走、让后端新建一个空库,测完再挪回来。**不要直接 `rm` 用户的 `data/test.db`**。
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

## 打包给运维(`node pack.js`)
`pack.js` 打出 `NFCMS-<实例>.tar.gz`(git 未忽略的全部文件 + 生成的部署配置),只服务**单容器**部署。

```bash
node pack.js                     # 交互:选/建实例 → 逐项确认 → 出包
node pack.js -i school-demo -y   # 复用该实例已存配置,不提问(CI 用)
node pack.js --list              # 列出本机已有的部署实例
node pack.js --adopt <部署目录>   # 从已部署目录的 .env + app.env 反向认领配置
```
`--adopt` 是密钥的救命通道:`.deploy/<实例>.json` 是 `PASSWORD_SALT` 的唯一本地副本,删了就再也生成不出同一套,而换 salt = 线上所有用户密码作废。但服务器的部署目录里还有一份 `app.env` —— 把它(和 `.env`)放进一个目录跑 `--adopt` 就能把配置认领回来,之后 `-i <实例> -y` 出的包密钥不变。**顺带:`.deploy/` 请纳入你的备份。**
- **一个部署实例 = 一份 `.deploy/<实例>.json`**(gitignore,`0600`)。下次打同一个站点选它就行,密钥/端口/数据库原样沿用。
- **不再快照 dyapi**。它和 dyapi-cli 都从 npm 装,镜像构建时自己拉 —— 原先那套(`vendor/dyapi/` 快照 + `--install-links` + 断链断言)是为了伺候仓库外的 `file:` 依赖,已整体删除。构建期仍有一条断言确认 `node_modules/dyapi` 装上了,免得跑到运行时才炸。
- 包里带生成好的配置,和 `docker-compose.single.yml` 同目录:
  - `.env` —— compose 插值用的容器形态:`COMPOSE_PROJECT_NAME`/`COMPOSE_FILE`/`NFCMS_CONTAINER_NAME`/`NFCMS_IMAGE`/`NFCMS_HTTP_PORT`/`NFCMS_THEME`/`NFCMS_EXTERNAL_NETWORK`。**同机多实例靠这几项隔离**,不用改 compose 文件。
  - `app.env` —— 经 `env_file` 原样注入容器的运行时变量:`JWT_SECRET`/`PASSWORD_SALT`/`SITE_URL`/`DB_DRIVER`/`MYSQL_*`。走 `env_file` 而不是 `${}` 插值,是为了让密码这类值免受 compose 插值影响。
  - `docker-compose.network.yml` —— **只在填了外部网络时才生成**。compose 没法用插值做条件网络(`external` 必须是字面量),所以拆成覆盖文件,由 `.env` 的 `COMPOSE_FILE` 自动叠加。1Panel / 外部 MySQL 场景填 `1panel-network` 这类**已存在**的网络名;服务声明了网络就不再接默认 bridge。
- **起服务只敲 `docker compose up -d --build`,别带 `-f`** —— 加载哪些文件由 `.env` 的 `COMPOSE_FILE` 决定,带了 `-f` 会漏掉网络覆盖文件(症状:容器连不上 MySQL),也可能误加载仓库里那份多容器 `docker-compose.yml`。
- **密钥**:新实例自动生成(`crypto.randomBytes(32)`);已有实例默认沿用,输 `new` 才重新生成。改 `PASSWORD_SALT` 会作废所有已存在用户的密码,脚本会先警告再让你确认。
- 密码里带 `$` 或 `'`:各 dotenv 实现处理不一致,脚本会警告并给出核对命令(`docker exec <容器> env | grep ...`),最省事是换个密码。
- `app.env` 与 `.deploy/*.json` 都是**明文密钥**,按机密文件对待:不进 git、不走公开渠道传输。
- 数据落在部署目录的 `data/`(`data/db` = sqlite 库,`data/uploads` = 上传件),备份就备它。

## Docker 部署
- **单容器(推荐)**:先 `node pack.js` 出包,服务器上解包后 `cd` 进去 `docker compose up -d --build`(读同目录的 `.env` + `app.env`,文件清单来自 `COMPOSE_FILE`;缺 `app.env` 直接报错)。`Dockerfile.single` 三段构建(前端 build → 后端依赖 → oven/bun 运行时 + nginx + supervisor)。`docker/nginx.single.conf` 的命中顺序是「真实静态资源 → 预渲染页 → SPA 壳」,并用 `map $http_x_ssg_bypass` 给生成器留了旁路;`/api`、`/static` 代理到 :3000。运行时镜像另装了 chromium 与 CJK 字体供预渲染用(见 [knowledge/ssg-prerender.md](knowledge/ssg-prerender.md))。主题由 `.env` 的 `NFCMS_THEME` 传给构建参数 `THEME`,换主题要重新 `--build`。
- **容器里的持久化**:后端 cwd 是 `/app/backend`,所以 sqlite 在 `/app/backend/data`、上传件在 `/app/backend/static/uploads`,compose 就挂这两个到宿主机 `./data/db`、`./data/uploads`。
- **密钥不进镜像**:`.dockerignore` 用 `**/.env` 挡掉 `backend/.env`(否则开发密钥会被 `COPY backend/` 带进镜像);容器里的密钥只从 compose 的 `env_file: app.env` 来。同理 `**/node_modules`(不带 `**` 只挡根目录那份,`frontend/node_modules` 会被 `COPY frontend/` 拖进镜像 —— 宿主机编译的原生二进制进 linux 容器必炸)。
- **基础镜像 pin 了版本**:`node:24.10.0-alpine`(两个构建阶段)+ `oven/bun:1.3.13-alpine`(运行时)。**必须都是 alpine** —— 构建阶段的 `node_modules` 会 `COPY` 进运行时,glibc 基底(如 `1panel/node:24.10.0`,该仓库没有 alpine 变体)装出来的原生依赖在 musl 里会炸;现在后端依赖恰好全是纯 JS,但别赌下一个依赖也是。要极致可复现再钉 digest(`node:24.10.0-alpine@sha256:775ba24d…`)。后端依赖走 `npm ci --omit=dev`,读的是随仓库提交的 `backend/package-lock.json`(与本地开发用的 `bun.lock` 并存:bun 管开发机,npm 管镜像)。改了 `backend/package.json` 记得两份 lock 都更新。
- **多容器**:`docker-compose.yml`(backend + frontend-nginx)。**`pack.js` 不管它**,端口/容器名/密钥仍是文件里写死的,要用得自己改。注:预渲染产物在 backend 容器的 `static/ssg`,多容器要让 nginx 能读到(共享卷),否则**只有单容器拓扑能用预渲染**;而且生成器要访问得到站点自身(`SSG_BASE_URL`)。这条至今未处理 —— 单容器是推荐拓扑。
- 生产前:把 `backend/Dockerfile` 的 `bun --hot` 改为 `bun index.ts`(热重载不该上生产),配置 `data/` 备份。

## 陷阱清单(复述)
- 升 dyapi 的 minor 版本是一次**有意的迁移**,不是 `npm update`(3.1→3.3 那次改了 Koa 装配、模块清单、pop 目标唯一性、注册表类型)。
- `vue-i18n` 别升 12-alpha(构建挂)。
- 公开站不要打 `/api/articles`(RBAC 403),走 `/api/content/*`。
- 新 UI 文案进 i18n,别硬编码。
- 生命周期字段(status/publish_at/rev_version)不能经普通 CRUD 写,走 `/api/lifecycle`。
