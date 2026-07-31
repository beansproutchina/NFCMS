# Backend (NFCMS on DYAPI)

代码在 `backend/`。入口 `backend/index.ts`。

## 启动流程(index.ts)
1. 读 `JWT_SECRET`/`PASSWORD_SALT`(缺则抛错);`new DYApp({ jwtSecret, enableFileUpload:true, passwordHash })`。
2. `hooks.doAction("app_init")`。
3. `scanFiles(app, "app")` 自动注册 `app/**` 下的默认导出模型/控制器/容器。
4. `policy.bind(app)`。**注意:默认角色/权限不在启动时播种**——由 `/system/setup` 调 `seedDefaultRbac(app)`(`app/services/RbacSeedService.ts`)播种 super_admin/admin/editor/author 及默认权限,幂等(roles 非空即跳过)。放在 setup 而非 boot 是因为 setup 可能是「导入站点数据」:若 boot 先占了 role id 1..4,导入的角色只能落到新 id(重复且无权限),而导入的 `role_permissions`/`user_roles`/`resource_grants` 仍按原 id 引用 → 角色列表出现两份、权限错挂。

   **播种是一次性的开箱起点,不是持续生效的契约**:没有 boot 时"按 name 补齐缺失角色"的逻辑(那会让所有者删掉的角色复活、让新版本静默改写已有站点数据)。

   **`super_admin` 是唯一被代码硬依赖的角色名**(`policy.isSuper` + 各模型静态 `permission`,20 处),所以只有它 `is_system: 1`;`admin`/`editor`/`author`/`member` 都可改名可删除,代码不认它们的名字。`admin` 原先有 5 处名字耦合,已全部去掉:
   - `RevisionModel` / `ContentSchemaModel` 的 `"admin": "R"` 静态键 → 改为 **RBAC 读闸门**(`hasAnyScope`),权限变成 `role_permissions` 里 `revisions:R any` / `schemas:R any` 两行数据。顺带修掉一个真实不对称:DYAPI 静态 map 匹配的 `state.usertype` **只取 JWT 主角色**,所以改造前把角色作为「附加角色」授出去时静态 map 看不见它;PolicyService 的 `state.roles` 是主 ∪ 附加,没这个毛病。
   - `UserModel` 的 `"admin": "R,U"` → 与其上一行 `DEFAULT: "R,U"` 完全重复(`getPermission` 找不到 usertype 会回落 DEFAULT),是死代码,已删。
   - `UserModel.role` 字段默认值 `"admin"` → 改成 `""`。"不传 role 就当 admin" 是提权方向的默认值。前端新建用户也不再预选角色。
   - `seedDynamicPerms` 按名字找 admin → 改为按**能力**找(所有持 `articles:C any` 的角色)。

   写入侧仍只有 `super_admin`(留在模型静态 map 里),所以两套机制不重叠:**读走 RBAC,写走静态 map**。
5. `app.use(ContentSchemaModel)` + 加载已存在的动态 schema + 注册 `schema_inserted` 热注入监听。
6. `app.koa.use(authMiddlewareFactory(app))` → `app.bootstrap()` → `hooks.doAction("app_ready")`。
7. `scheduler.start(app)`(定时发布)。
8. ~~`staticgen.bind(app)` + hook 接线 + 初次全量 SSG~~ —— **已停用**(整块注释),见 [architecture.md](architecture.md) 的「公开站 SSG」。

## CMS 核心层
- **`app/lib/CMSModel.ts`**(命名导出,非 `app/models/`):内容模型基类。
  - 重写 `HTTPReadMany/ReadOne/Create/Update/Delete`,鉴权全走 `PolicyService`。
  - `ownerField`(如 `"author_id"`):启用 `own` 行级范围。
  - `lifecycleFields = ["status","publish_at","rev_version","access_eff"]`:这些字段**不接受**普通 CRUD 写入(前三个由生命周期控制器/调度器写,`access_eff` 由 `AudienceService` 派生 —— 见 [public-access.md](public-access.md))。
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
- `CategoryModel(categories)`(**PUBLIC 已降为空**,公开侧走 `/api/content/categories` 按受众过滤;`article_data_fields` 声明该栏目下文章的自定义字段,`editor_hint` 是给作者看的一段 markdown,渲染在文章编辑器**正文上方** —— 用来说明正文里该按什么格式写,如 neo 主题成员页要求的 `:::works` 块)、`MenuModel(menus)`(公开可读 PUBLIC:R,菜单刻意不做受众过滤)、`AttachmentModel(attachments)`(锁死:PUBLIC/DEFAULT 空,admin R,super CRUD)、`SystemConfigModel(system_config, 无 @CRUD,仅 SystemController 管)`、`UserModel(users)`。
- `UserModel`:`password` 字段 `setPermission("DEFAULT","w")`(可写不可读,登录走裸读);`PUBLIC:""`;`HTTPUpdate` 阻止非 super 改 role/改他人。

## 权限模型(RBAC)
- **角色**:`roles`;**能力**:`role_permissions` 每行 = (role_id, model=表名, action ∈ C/R/U/D/publish, scope ∈ any/own)。
- **用户角色**:主角色在 `users.role`(进 JWT);附加角色在 `user_roles`。有效 = 并集。
- **资源 ACL**:`resource_grants`(把某条内容共享给 user/role,access 如 `R` / `R,U`)。合成 model 两个:`articles_category`(管辖轴,可管理该分类子树的文章)、`articles_audience`(受众轴,动作 `V`,可在公开站查看该分类子树的受限文章)。
- `super_admin` 全放行(硬编码);未授权动作默认拒绝。
- **附加角色给的 `super_admin` 与主角色列的 `super_admin` 同级**:`state.usertype` 只有一个值(来自 JWT 的主角色列),dyapi 的静态 permission map 与 `@Auth()` 都只看它。所以 `authmiddleware` 在 `policy.resolve` 之后,若 `policy.isSuper(state)` 就把 `usertype` 抬成 `super_admin` —— 否则"通过 user_roles 授予 super_admin"的人在所有非 CMSModel 的表上都不被当 super,同一个角色因来路不同而权限不同。代码里判超管一律用 `policy.isSuper(state)`,不要读 `state.user.role`。

### RBAC 到底管哪些表(**三档**,别被权限面板误导)

| 档 | 表 | 机制 |
|---|---|---|
| **全量 RBAC** | `articles`、`attachments`、**所有动态内容类型** | 继承 `CMSModel`,`HTTP*` 全接管 → PolicyService |
| **只读 RBAC** | `revisions`、`schemas` | 普通 `Model`,但在重写的 `HTTPRead*` 里 `assert(policy.hasAnyScope(...))`;写仍只有 super_admin |
| **不进 RBAC**(刻意) | `users`、`categories`、`menus`、`system_config`、`roles`、`role_permissions`、`user_roles` | dyapi 静态 permission map,键是 `state.usertype` |

不进 RBAC 是决定,不是遗漏:配置类表由 super_admin 独占;**RBAC 自身那三张表必须永久 super-only**,否则"能改权限的角色"可以给自己提权,形成闭环。`users` 的自助场景由模型重写覆盖(见下)。

**模型自报判据,面板照着列**:`CMSModel.rbacActions` 给出"这张表上真的会被判定的动作"(有 `status` 字段才含 `publish`);`ownerField` 决定 `own` 是否可选。`/api/schematools/all` 把两者一并返回,`Roles.vue` 据此过滤 —— 以前面板列出全部 13 张表、固定 5 个动作、固定两种 scope,给 `users`/`menus` 配的行没人读,给没有属主列的表配 `own` 静默无效。**新增模型时不要在前端加白名单,声明 `rbacActions` 即可。**

**属主列**:`articles.author_id`、`attachments.uploader_id`(本次新增)、动态内容类型固定 `author_id`(由 `ModelInjector` 的 `OWNER_FIELD` 保证存在 —— 固化而非推断,建模型的人不需要知道任何隐式命名规则)。`CMSModel.HTTPCreate` 一律记录属主:受限创建者强制写自己,全站创建者缺省写自己。**升级注意**:历史行的属主列为 NULL,只有 `any` 管得到。

**用户自助**:`UserModel` 的 `HTTPReadOne`/`HTTPUpdate` 对非超管把 `query.id` 锁成本人并 `delete body.role`,所以"改自己的资料"不经 RBAC 也成立;后台入口是 `/admin/profile`(侧栏底部,对所有登录用户可见,零权限账号也放行 —— 能登录的人总该能改自己的密码)。

## 受众轴(公开站门禁)
内容除生命周期外还有一根**正交**的受众维度:`categories.audience/teaser` + `articles.audience/teaser` → 物化成 `articles.access_eff`,由 `policy.canView/viewFilter` 判定 `full|locked|hidden`。完整设计与判定矩阵见 **[public-access.md](public-access.md)**。

## 内容生命周期
- 状态:`hidden` / `scheduled` / `visible`。
- 切换只经 `ContentLifecycleController`:`POST /api/lifecycle/:type/:id/transition {to, publish_at?, note?}`,校验 + `policy.can(...,'publish'|'U')`,委托 `model.update` 触发快照/hook;→visible 时置 `published_at` 并 fire `content.published`。
- 版本:`GET /api/lifecycle/:type/:id/revisions`、`POST .../rollback {version_no}`。
- 共享:`POST .../share`、`GET .../grants`、`DELETE .../share/:grantId`(需能 `U` 该行)。
- 预览:`POST /api/content/preview-token {id}` 签发短 token → `GET /api/content/preview?id=&pt=` 裸读绕过状态过滤。

## 数据导出 / 导入(`/system/export`、`/system/setup` 的 importData 分支)
恢复语义靠三条不变式撑住,任何一条破了都会**静默**出错:

1. **保留原 id** —— 用 `model.restore(item)`(dyapi `Model.restore` + 容器 `createWithId`),不是 `create`。
   `create` 会丢掉 id 让它重新自增,只要源库删过东西(id 有空洞),重新编号后**所有按 id 的交叉引用同时错位**:
   `articles.category_id/author_id`、`categories.parent_id`、`role_permissions.role_id`、`user_roles.*`、
   `resource_grants.grantee_id/resource_id`、`revisions.content_id`,以及藏在 JSON 里的 `menus.items[].refId`。
   保 id 是唯一**不需要穷举引用图**就正确的做法。
2. **密码原样搬运,不加解密** —— 存的是 `HMAC-SHA256(env PASSWORD_SALT)`,而导入走裸 `restore()`(不经
   `HTTPCreate`),所以哈希直接落库、不会被二次哈希。**别把这里改成 `HTTPCreate`**:那会再哈希一次,
   现象是"导入成功但密码就是不对"。
3. **salt 指纹决定密码还能不能用** —— 导出的 `_meta.saltFingerprint = passwordHash("nfcms-salt-fingerprint-v1")`。
   导入时比对本机指纹:`match` 原样保留;`mismatch` 说明 salt 换过、那些哈希全废,**把所有账号重置为随机密码
   并在响应里一次性返回**(向导必须显示 —— 导入模式不创建新管理员,不显示就没人能登录);`unknown`(旧版导出
   无指纹)保留 + 警告,不销毁数据。

> 一次性凭据**只在 HTTP 响应里**。曾经 `authmiddleware` 有一行 `console.log(ctx.response.body)` 把每个响应体
> 都打进日志(含明文密码与用户列表),已删。凡"只出现一次"的东西一旦进日志就不再是一次性的。

## 端点速查
- 认证:`POST /api/user/login`
- 系统:`GET/POST /api/system/config`、`GET /api/system/status`、`POST /api/system/setup`、`POST /api/system/restart`
- 公开内容(全部经 `readPublic` → 强制 `status=visible` + 受众轴 filter):`GET /api/content/home`、`/api/content/articles`、`/api/content/category?slug=`、`/api/content/categories`、`/api/content/article?slug=`、`/api/content/preview`
- 生命周期:`/api/lifecycle/:type/:id/{transition,revisions,rollback,share,grants}`
- 上传:`POST /api/upload`、`DELETE /api/upload/:id`
- CRUD(RBAC 管控):`/api/articles|categories|menus|users|attachments|roles|role_permissions|user_roles|resource_grants|revisions|schemas`
- schema 工具:`GET /api/schematools/all`(super_admin)

## 安全要点 & 待硬化
- 已做:fail-closed 权限、jwtSecret 强制、密码字段不可读、attachments 锁死、真实状态码、password 从 MD5+硬编码盐换成 `HMAC-SHA256(env salt)`。
- 待做:内容 HTML 消毒(前端 `v-html` 未消毒,建议挂 `content.pre_save` filter 或前端 DOMPurify);密码升级 bcrypt/argon2(需改等值匹配登录为 verify);CSRF(cookie 认证下)。
