# Backend (NFCMS on DYAPI)

代码在 `backend/`。入口 `backend/index.ts`。

## 启动流程(index.ts)
1. 读 `JWT_SECRET`/`PASSWORD_SALT`(缺则抛错);`new DYApp({ jwtSecret, enableFileUpload:true, passwordHash })`。
2. `hooks.doAction("app_init")`。
3. `scanFiles(app, "app")` 自动注册 `app/**` 下的默认导出模型/控制器/容器。
4. `policy.bind(app)` + `seedRbac(app)`(播种 super_admin/admin/editor/author 角色与默认权限,幂等)。
5. `app.use(ContentSchemaModel)` + 加载已存在的动态 schema + 注册 `schema_inserted` 热注入监听。
6. `app.koa.use(authMiddlewareFactory(app))` → `app.bootstrap()` → `hooks.doAction("app_ready")`。
7. `scheduler.start(app)`(定时发布);`staticgen.bind(app)` + hook 接线 + 初次全量 SSG。

## CMS 核心层
- **`app/lib/CMSModel.ts`**(命名导出,非 `app/models/`):内容模型基类。
  - 重写 `HTTPReadMany/ReadOne/Create/Update/Delete`,鉴权全走 `PolicyService`。
  - `ownerField`(如 `"author_id"`):启用 `own` 行级范围。
  - `lifecycleFields = ["status","publish_at","rev_version"]`:这些字段**不接受**普通 CRUD 写入。
  - HTTP create/update 后 `revisions.snapshot(...)` + `hooks.doAction("content.saved.<t>")`。
- **`app/services/PolicyService.ts`**(单例 `policy`,唯一鉴权权威,**无缓存**每请求读库):
  - `resolve(state)`:有效角色 = JWT 主角色 ∪ `user_roles`;构建 `state.perms: Map<"model:action", scope>`。
  - `can(state, action, model, row?)`:默认拒绝;`super_admin` 短路放行;`own` 校验 `row[ownerField]===user.id` 或 ACL 授权。
  - `scopeFilter(state, model, action)`:列表用,`own` → `{$or:{[ownerField]:me, id:{$in: aclIds}}}`。
  - `aclIds(...)`:查 `resource_grants`(user 或其角色被授予、且 access 含该动作)。
- **`app/services/RevisionService.ts`**(`revisions`):`snapshot/list/get/rollback/diff`。`version_no` = 该内容最大版本 +1。回滚只还原内容字段(不动 status),且先把当前态存为新版本(可再撤销)。
- **`app/services/SchedulerService.ts`**(`scheduler`):`node-cron` 每分钟把到期 `scheduled` 翻 `visible`,复用 hook+快照,幂等 + 进程内锁。
- **`app/services/StaticGenService.ts`**(`staticgen`):见 [architecture.md](architecture.md) SSG 段。
- **`app/services/HookManager.ts`**(`hooks`):`addAction/doAction`、`addFilter/applyFilters`。约定事件:`app_init`/`app_ready`、`content.pre_save|saved|published.<tablename>`、`rbac_changed`、`schema_inserted`/`schema_updated`。
- **`app/services/ModelInjector.ts`**:`ContentSchemaModel`(存 schema 定义)+ `injectDynamicModel(app, rec)`:用**构造函数**派生 `CMSModel` 子类(避免类字段遮蔽),自动补 `status/publish_at/rev_version`,`app.use()` 注册,给 `admin` 角色播种该模型全权限。启动加载 + `schema_inserted` 运行时热注入(免重启)。

## 数据模型
基础设施(普通 `Model` + 静态 permission,super_admin only):
- `RoleModel(roles)`、`RolePermissionModel(role_permissions: role_id/model/action/scope)`、`UserRoleModel(user_roles)`、`ResourceGrantModel(resource_grants)`、`RevisionModel(revisions, 仅 admin 可读)`。
- 这几个 + `UserModel` 的 `HTTPReadMany` 都设了 `maxLimit=9999`(后台一次拉全量)。

内容/系统:
- `ArticleModel(articles)` — `extends CMSModel`,`ownerField="author_id"`,字段含 `status/publish_at/rev_version`(**无** `visible`,已废弃)。
- `CategoryModel(categories)`、`MenuModel(menus)`(公开可读 PUBLIC:R)、`AttachmentModel(attachments)`(锁死:PUBLIC/DEFAULT 空,admin R,super CRUD)、`SystemConfigModel(system_config, 无 @CRUD,仅 SystemController 管)`、`UserModel(users)`。
- `UserModel`:`password` 字段 `setPermission("DEFAULT","w")`(可写不可读,登录走裸读);`PUBLIC:""`;`HTTPUpdate` 阻止非 super 改 role/改他人。

## 权限模型(RBAC)
- **角色**:`roles`;**能力**:`role_permissions` 每行 = (role_id, model=表名, action ∈ C/R/U/D/publish/share, scope ∈ any/own)。
- **用户角色**:主角色在 `users.role`(进 JWT);附加角色在 `user_roles`。有效 = 并集。
- **资源 ACL**:`resource_grants`(把某条内容共享给 user/role,access 如 `R` / `R,U`)。
- `super_admin` 全放行(硬编码);未授权动作默认拒绝。

## 内容生命周期
- 状态:`hidden` / `scheduled` / `visible`。
- 切换只经 `ContentLifecycleController`:`POST /api/lifecycle/:type/:id/transition {to, publish_at?, note?}`,校验 + `policy.can(...,'publish'|'U')`,委托 `model.update` 触发快照/hook;→visible 时置 `published_at` 并 fire `content.published`。
- 版本:`GET /api/lifecycle/:type/:id/revisions`、`POST .../rollback {version_no}`。
- 共享:`POST .../share`、`GET .../grants`、`DELETE .../share/:grantId`(需能 `U` 该行)。
- 预览:`POST /api/content/preview-token {id}` 签发短 token → `GET /api/content/preview?id=&pt=` 裸读绕过状态过滤。

## 端点速查
- 认证:`POST /api/user/login`
- 系统:`GET/POST /api/system/config`、`GET /api/system/status`、`POST /api/system/setup`、`POST /api/system/restart`
- 公开内容:`GET /api/content/home`、`/api/content/category?slug=`、`/api/content/article?slug=`、`/api/content/preview`
- 生命周期:`/api/lifecycle/:type/:id/{transition,revisions,rollback,share,grants}`
- 上传:`POST /api/upload`、`DELETE /api/upload/:id`
- CRUD(RBAC 管控):`/api/articles|categories|menus|users|attachments|roles|role_permissions|user_roles|resource_grants|revisions|schemas`
- schema 工具:`GET /api/schematools/all`(super_admin)

## 安全要点 & 待硬化
- 已做:fail-closed 权限、jwtSecret 强制、密码字段不可读、attachments 锁死、真实状态码、password 从 MD5+硬编码盐换成 `HMAC-SHA256(env salt)`。
- 待做:内容 HTML 消毒(前端 `v-html` 未消毒,建议挂 `content.pre_save` filter 或前端 DOMPurify);密码升级 bcrypt/argon2(需改等值匹配登录为 verify);CSRF(cookie 认证下)。
