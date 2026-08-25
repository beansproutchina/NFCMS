# CLAUDE.md — NFCMS working guide

NFCMS 是基于自研框架 **DYAPI** 的无头 CMS:Bun + SQLite 后端 + Vue3 管理/展示前端。本文件是给 AI/开发者的**高信号操作指南**;完整细节见 [`docs/`](docs/)。

## 快速定位
- 架构总览与"CMS 核心层" → [docs/architecture.md](docs/architecture.md)
- DYAPI 框架心智模型与**坑** → [docs/dyapi.md](docs/dyapi.md)
- 后端(RBAC/生命周期/动态模型/端点) → [docs/backend.md](docs/backend.md)
- 前端(admin/api 约定/i18n/主题) → [docs/frontend.md](docs/frontend.md)
- 本地运行/构建/测试/踩坑、**打包部署(`node pack.js`)** → [docs/development.md](docs/development.md)
- 项目现状评估(强项/技术债/优先级) → [docs/assessment.md](docs/assessment.md)
- 公开站页面权限「受众轴」设计(**已定稿未实现**) → [docs/public-access.md](docs/public-access.md)

## 技术栈
- **后端**:Bun + Koa + DYAPI **3.3.1**(自研框架,从 npm 装,`~3.3.1` 只吃补丁 —— 它的 minor 版本里带 breaking change)+ SQLite(`backend/data/test.db`)。3.2 起 DYApp **不再拥有 Koa 实例**(`index.ts` 自己 `new Koa()` → `app.bindKoa(koa)` → `koa.listen()`),模块清单也改成构建期产物,见下。
- **前端**:Vue 3 + Vite 8(rolldown)+ PrimeVue(unstyled + Tailwind 4)+ vue-router 5 + **vue-i18n `^11`**(注意:不要升到 12-alpha,它需要 Vue 3.6)。
- **部署**:Docker(单容器 `Dockerfile.single` + supervisor/nginx,推荐;或 `docker-compose.yml` 多容器)。交付运维用 `node pack.js`:按实例问一遍容器名/端口/数据库/密钥,存成 `.deploy/<实例>.json`(gitignore)复用,产出带 `.env` + `app.env` 的 `NFCMS-<实例>.tar.gz`。

## 跑起来(最常用)
```bash
# 后端(必须先 cd,且 backend/.env 要有 JWT_SECRET 和 PASSWORD_SALT)
cd backend && npm run scan && bun index.ts   # bun 在 ~/.bun/bin/bun
# 前端(vite 已代理 /api、/static 到 :3000)
cd frontend && npm run dev
# 前端构建校验
cd frontend && npm run build        # = vue-tsc -b && vite build
```
首次:浏览器开 `/setup` 建管理员 → `/login` → `/admin`。

## 必须记住的坑(踩过的)
1. **测试前备份 DB、测后还原**:`cp data/test.db{,.bak}`。破坏性测试用一次性库,别 `rm` 用户的 `data/test.db`。
2. **重启后端前先杀干净**:`pkill -9 -f "index.ts"; lsof -ti tcp:3000 | xargs kill -9`。否则 SQLite 双开 → `disk I/O error` + 假 403/416,全是幻象不是 bug。
3. **`bun index.ts` 前必须 `cd backend`**,否则 "Module not found index.ts"。
4. **env 必填**:没有 `JWT_SECRET`/`PASSWORD_SALT` 时 DYApp `bootstrap()` 直接抛错(见 `.env.example`)。
5. **公开站只能走 `/api/content/*`**,绝不要打 `/api/articles`(已被 RBAC 管控,匿名 403)。
6. **dyapi / dyapi-cli 从 npm 装**,不再是本地 `file:` 路径。要试框架的未发布改动,用 `npm link` 或临时改 `package.json`,别把 `file:` 提交回来 —— 那套(pack.js 快照 `vendor/dyapi`、Dockerfile 的 `--install-links` 与断链断言)已经整体删除。
6b. **重新构建前端会让已生成的静态页全部失效**,而且是**静默**失效:预渲染页里写死了带哈希的 bundle 名(`/assets/index-XXXX.js`),重新构建后那个文件就没了 —— 页面**看起来完美**(静态 HTML 照常渲染)但一行 JS 都跑不起来:没有 SPA 接管、点站内链接是整页跳转、登录态永远不纠正。服务端零报错,只有浏览器控制台一条 404。
   后端会按 `dist/index.html` 的 hash 周期性自查并自动重生成(默认 60s,`SSG_WATCH_MS`),但**别等它** —— 本地验收直接 `cd frontend && npm run ssg:preview`。判断静态页是不是活的:`document.getElementById('app').__vue_app__` 为 `undefined` 就是这个病。
7. DYAPI 迁移是**只增不减**;改字段/删列时,dev 直接重置 `data/test.db` 重新 `/setup`(允许 breaking change)。
8. **动了 `backend/app/` 下的文件就要重新 `npm run scan`**。dyapi 3.2 起模块清单是构建期产物 `app/_scanFiles.js`(提交进仓库),忘了重新生成的症状**不是报错,而是新加的 Model 静默不注册** —— 表不建、路由不挂。pre-commit 会拦。
9. **`@PopTarget` 声明的是「别的模型用哪个字段名指向本模型」,不是本模型自己的字段。** 全库只有 `UserModel` 有一条(`author_id`)。同名在同一作用域只能有一个,3.3 起撞名直接启动报错。加之前先回答「谁会 `?pops=<字段名>` 指过来」。
10. **别用 `Object.values(app.models)` / `app.instanceDict`**:3.3 起注册表是 `Map`,那么写会**静默拿到空数组**。按 tablename 找模型一律走 `app/lib/registry.ts`。

## 架构一句话
```
DYAPI(HTTP/CRUD/容器/字段级权限)
  ↑  CMSModel 基类(backend/app/lib/CMSModel.ts):HTTP* 全接管 → RBAC + 版本快照 + 生命周期
  ↑  服务层:PolicyService(鉴权唯一权威)/ RevisionService / SchedulerService / PrerenderService / HookManager
  ↑  数据模型:Role/RolePermission/UserRole/ResourceGrant/Revision + Article/Category/Menu/User/Attachment/SystemConfig
前端:Vue SPA(admin + 展示)  ← 公开站由 chromium 预渲染成静态页,nginx 优先命中(index.ts 第 8 步)
```

## 核心约定
- **内容模型继承 `CMSModel`、声明 `ownerField`、不写静态 `permission`**——权限完全由 RBAC(PolicyService)决定。基础设施模型(Role 等)仍用普通 `Model` + 静态 `permission`。
- **RBAC 只管 `CMSModel`**:`articles` / `attachments` / 动态内容类型是全量,`revisions` / `schemas` 只读接入,其余(users/categories/menus/system_config + RBAC 自身三张表)走 dyapi 静态 permission map、只认 super_admin —— 这是决定不是遗漏。判超管一律 `policy.isSuper(state)`(附加角色给的 super 与主角色列同级,`authmiddleware` 会把 `usertype` 抬上去),别读 `state.user.role`。权限面板按模型自报的 `rbacActions`/`ownerField` 列项,新增模型只需声明这两样。详见 [docs/backend.md](docs/backend.md)。
- **鉴权优先级(PolicyService)**:`super_admin` → 角色权限 `any` → 独立授权路径(`own` 属主 · 行级 ACL · **分类授权**)。任一路径命中即放行,分类授权/行级 ACL **不需要**基础角色权限也能生效。
- **分类授权(文章按目录管辖)**:`ResourceGrant` 用合成 `model="articles_category"`、`resource_id=分类id`、`access=C,R,U,...`,表示"可管理该分类(**级联整棵子树**)下的文章"。`ArticleModel.categoryField="category_id"` 触发此逻辑。角色与权限页可按角色分配,分类编辑弹窗可按用户/角色分配。
- **create(`C`)不认 `own`**:创建出来的必属于自己,`own C` 无意义。全站创建=`articles:C any`;受限创建=对应分类的分类授权(含 C)。后端 `HTTPCreate` 会用具体 item 复核目标分类。
- **通用 ACL**:`/acl/:model/:resourceId`(`AclController`)+ 前端可复用组件 `components/AclEditor.vue`(内含分页搜索的 `components/UserPicker.vue`)。行级分享(`model=articles`)需该行 `U` 权限;分类授权(`articles_category`)仅 `super_admin`。
- **两层 API**:裸 `create/read/update/remove`(无鉴权,内部/公开站用)vs `HTTP*`(经 RBAC,`@CRUD` 路由用)。控制器里直接调裸方法会绕过权限——公开站正是这么用的。
- **生命周期字段**(`status`/`publish_at`/`rev_version`)不可经普通 CRUD 写,只能走 `ContentLifecycleController`。
- **状态三态**:`hidden` / `scheduled` / `visible`(取代旧 `visible` 字段)。
- **前端 i18n**:新文案一律加进 `frontend/src/i18n.ts` 的 en+zh,别硬编码中文。
- **api 响应**:2xx 返回 body;错误 reject 一个带 `.message`/`.code` 的 `Error`(见 `frontend/src/api.ts`)。
- **前端 API 层是生成的**:`frontend/src/api.gen.ts` 由 `npm run gen:api`(dyapi-cli)从后端 model/controller 生成,**不要手改**;改了后端接口就重新生成并一起提交。`api.ts` 只放 axios 实例 + 拦截器 + 接线 + 语义封装。接线两条铁律:`baseURL` 必须为空串(生成的是含 `/api` 前缀的绝对路径),`configureApi` 必须带 `unwrap: false`(拦截器已解包一次)。细节见 [docs/frontend.md](docs/frontend.md)。

## 代码组织规范(别把代码写成一坨)
- **入口文件只做装配**:`main.ts`、`index.ts` 只负责 `app.use(...)`/接线,**不放数据字面量、不放业务逻辑、不内联大对象**。要配置什么,先问「这块数据/逻辑归属哪个模块」,放过去再 `import` 进来。
- **数据/常量按归属就近落到对应模块**:i18n 文案与 locale 数据(含 PrimeVue calendar 的 `primevueLocale`)集中在 `frontend/src/i18n.ts`;RBAC/生命周期常量在对应 service/model。同一类东西**单一出处**,不要在多处各写一份。
- **超过几行的常量对象**别内联进使用点,提成命名常量或独立模块导出;判断标准:它是「配置/数据」而非「此处的控制流」,就抽出去。
- 复用现有模式而非另起一套:新组件的 Tailwind/`:pt` 写法、api 调用、toast/confirm 用法,先看邻近文件怎么写,保持一致。
- **管理后台 UI 走设计系统**:令牌在 `frontend/src/style.css` 的 `@theme`,预设在 `frontend/src/ui/presets.ts`。外观(颜色/字号/圆角/阴影/边框)一律取令牌或 preset,布局按需内联。常用:`:class="INPUT_CLASS"`、`TEXTAREA_CLASS`、`:pt="SELECT_PT"`、`:class="BTN.primary|secondary|danger"`(行内密集 `BTN_SM.*`,独立表单卡片的提交键 `BTN_LG.*`)、`LABEL`、`PAGE.*`、`CARD`、`CHIP.*`、`LINK.*`。单实例宽度/flex 写到组件自己的 `class`(会并入 root),尺寸与内边距由 preset 决定。确认框 `useConfirm()`、提示 `useToast()`。**完整清单与规则见 [docs/frontend.md](docs/frontend.md) 的「设计系统」一节。**
- **提交门槛**:`pre-commit` 自动跑 `npm run lint`(设计系统规则)+ `vue-tsc` + `vite build`,约 5 秒。拦下时按提示修;确实合理的例外加进 `frontend/scripts/lint-baseline.json`(进 review),不要 `--no-verify`。

## 已知待硬化(非阻塞)
- 后台文章编辑器把分类的 `editor_hint` 用 `v-html` 渲染(作者是 super_admin,风险低于正文,但同一处面)。
- 前端主题模板对 `article.content` 用 `v-html` **未消毒**(存储型 XSS 面);SSG 侧只做了基础 strip。上线前接 DOMPurify 或后端消毒(可挂 `content.pre_save` hook)。
- 密码哈希是 `HMAC-SHA256(env salt)`(确定性,适配等值匹配登录),非 bcrypt/argon2;更强需改登录流程。
- 前端路由守卫是"装饰性"的,真正鉴权在后端。
