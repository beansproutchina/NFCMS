# DYAPI 框架心智模型与坑

DYAPI 是自研的、约定优于配置的后端框架:**声明一个带类型字段和权限矩阵的 Model,自动得到一套带鉴权/自动建表/关系展开的 REST CRUD;需要自定义逻辑再写 Controller。** 跑在 Bun + Koa 上,TS 原生,无构建步骤。

源码位置(本地 pin):`dyapi3/dyapi/`(相对 backend 是 `../../dyapi3/dyapi`)。当前版本 **3.1.0**。

## 四个原语
- **Container**:持久化驱动,抽象 `create/read/update/remove/setField`。内置 SQLite/MySQL/MongoDB/JSON。NFCMS 用 `SQLiteContainer`(`backend/app/containers/testContainer.ts`,`./data/test.db`)。
- **Model**:一张表 = `datafields`(用 `F` 构建器)+ `permission` 矩阵 + `container`(`@Inject`)。`@CRUD("route")` 自动挂 7 条 REST。
- **Controller**:自定义端点。`@ControllerRoute("x")` + 方法 `@Route("post","/y")`。
- **DYApp**:持有 Koa、`settings`、注册表(`instanceDict`/`models`/...)、`bootstrap()`。

## `@CRUD` 的路由映射
```
GET    /api/<route>       → HTTPReadMany   (列表, 分页/过滤)
GET    /api/<route>/:id   → HTTPReadOne
POST   /api/<route>       → HTTPCreate
PUT    /api/<route>/:id   → HTTPUpdate
DELETE /api/<route>/:id   → HTTPDelete
PUT/DELETE /api/<route>   → 批量(默认关闭:multiUpdate/multiDelete=0)
```

## 两层 API(务必分清)
- **裸层** `create/read/update/remove`:仅字段类型转换/校验,**无权限检查**。给服务端内部用。
- **HTTP 层** `HTTP*(state,query,body)`:`assert(getPermission(...))` + 按字段权限投影 + 删除未知字段(防批量赋值)+ 删除用户传入的 `id`。
> NFCMS 的 `CMSModel` **完全重写了 HTTP\***,改用 `PolicyService` 鉴权(不调 DYAPI 的 `getPermission`),所以内容模型不写静态 `permission`。基础设施模型(Role 等)仍用 DYAPI 原生 HTTP* + 静态 `permission`。

## 权限模型(DYAPI 原生,用于非 CMSModel)
- 模型级:`permission = { "<usertype>": "C,R,U,D" }`,字母 C/R/U/D(还有 RO 读一条 / RL 读列表 / CO / CL)。查不到 usertype → 回落 `permission["DEFAULT"]` → `settings.defaultModelPermission`。
- 字段级:每个 `DataField` 有 `r,w,p`(读/写/可 pop)。`setPermission("DEFAULT","w")` 可让字段可写不可读(如 UserModel 的 password)。
- usertype 来自 JWT 的 `role`;鉴权中间件设 `ctx.state.usertype`,匿名为 `PUBLIC`。

## 查询能力
- 前端可传 Mongo 风格 `?filter={"a":1,"b":{"$gte":2}}`,编译为参数化 SQL。支持 `$and/$or/$not/$in/$nin/$eq/$ne/$gt(e)/$lt(e)/$contains/$start/$end/$regex`。
- **同字段多条件用后缀区分**:`{ "$or": {...}, "$or2": {...} }`(键以 `$or`/`$and` 开头即生效)。
- 分页 `limit/page/offset`;`orderBy/orderDesc`;`fields`/`hideFields`/`pops`。

## 3.1.0 的安全/正确性基线(已内置,别重复造)
- `jwtSecret` 为空或默认 `"nihao"` → `bootstrap()` 抛错(必须配置)。
- `defaultModelPermission` 收紧为 `"R,"`(fail-closed:未声明即只读)。
- **真实 HTTP 状态码**(依 body.code 设置,不再一律 200)。
- `@ValidateBody` 必须是标准 jsonschema(旧 `{k:"string"}` 简写会抛错)。
- 文件上传默认关闭(`enableFileUpload=false`),需显式开。
- cookie 带 `SameSite=Lax;HttpOnly`;JWT 校验用 `timingSafeEqual`;`$in/$nin` 与带 filter 的 count 已修;日期以 **ISO 8601 文本**存储。

## 必须知道的坑
1. **`param.id` 短路 `filter`**(`containers/SqlUtility.js` `genSqlSuffix`):`/:id` 路由会忽略注入的过滤条件。→ 行级鉴权不能靠注入 filter,要**取出该行再判**(`CMSModel.HTTPReadOne/Update/Delete` 就是这么做的)。
2. **类字段遮蔽**:`Model` 用 `tablename;`/`datafields=[]` 声明实例字段,其初始化器会**覆盖**你 `Object.assign(prototype,...)` 设的值。动态生成 Model 必须在**构造函数**里设 `this.tablename/datafields`(见 `ModelInjector.injectDynamicModel`)。
3. **`maxLimit` 默认 100**:`limit>100` → 416。配置类模型在 `HTTPReadMany` 里设 `state.settingsOverrides.maxLimit = 9999`(Role/RolePermission/UserRole/User/Menu 都这么做)。
4. **日期比较用 ISO 字符串**(存储是 ISO 文本),如定时发布 `publish_at:{$lte: new Date().toISOString()}`。
5. **迁移只增不减**:`setField` 只会 `CREATE TABLE` / `ADD COLUMN`,不删列/不改类型/不加唯一约束。schema 变更在 dev 直接重置 DB。
6. **无应用级 cron / SQLite 无 `rawSQLQuery`**:定时用应用层 `node-cron`;需要聚合/批量时走 ORM 读或自算。
7. `@CRUD` 的 route 名与 Controller 名不要撞(历史约定:控制器名别以复数 `s` 结尾)。
8. 注册顺序:`scanFiles` 只注册**默认导出**且含 `init` 的类(所以 `CMSModel` 用**命名导出**且放在 `app/lib/` 而非 `app/models/`,避免被自动注册出空表)。运行时新增路由用 `app.use(Class)`(会跑 `init`→`bindCRUD`)。

## 本项目修过的 dyapi 行为(改了 `dyapi3/dyapi` 源码,记得在 `backend/` 重新 `bun install`)

- **`Model.restore(item)` + 容器 `createWithId(table, item)`(新增)**:插入并**保留自带 id**。`create` 里
  写死了 `delete item.id`("ID由系统生成"),容器里又跳过一次 —— 恢复数据必须绕开这两处,否则 id 重新编号、
  交叉引用全错位。容器不支持时 `restore` 直接抛错,**不静默降级**(悄悄回退等于把恢复变成数据损坏)。
- **真正的 `null` 不再被 JSON.stringify**:`create`/`update` 里 `typeof (item[field]) === "object"` 会把
  `null` 也算进去,于是可空的 Date / Object 列写进库的是**4 个字符的文本 `"null"`**。读出来是字符串,Date 列
  经 `process()` 变成 Invalid Date 并在下次插入时炸成一句莫名的 `Invalid Date`,Object 列则永远是那个字符串
  (前端 DatePicker 显示满屏 NaN 也是它)。已在 SQLite 与 MySQL 两个容器的 create/update 路径改成先判 null。
