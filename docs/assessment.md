# 项目现状评估 (Assessment)

对 NFCMS 当前状态的一份坦诚评估,按最初约定的五个维度:①DYAPI 心智模型 ②总体架构 ③后端 ④前端 ⑤打包/部署/二次开发。评估随代码演进,记录**强项**与**待还的债**,便于后续取舍。基准:分类级权限 + 设计系统统一之后(提交 `87ac4de` 时间点附近)。

> 这份评估最初是纯"读代码给结论";过程中大量当初会被标红的短板(RBAC、内容生命周期、hook、SSG、设计系统一致性)已经落地实现。故本文是**实现后的现状**,不是原型期的体检。

---

## ① DYAPI 心智模型

**清晰**:`Model / Container / Controller / DYApp` + `@CRUD` 七路由;两层 API——裸 `create/read/update/remove`(无鉴权,内部/公开站用)vs `HTTP*(state,query,body)`(过鉴权 + 字段白名单,`@CRUD` 路由用)。`pops` 关系展开在 MySQL container 是 LEFT JOIN,SQLite 走 N+1 兜底。

**必知的坑(仍在,详见 [dyapi.md](dyapi.md))**:
- 类字段遮蔽:动态模型必须在构造函数里赋 `datafields`,否则被原型默认值覆盖。
- `param.id` 短路 `filter`:`/:id` 路由不能靠注入 filter 做行级鉴权 → CMSModel 改为取出行后显式 `policy.can(state,action,model,row)`。
- **`maxLimit` 默认 100**:管理台列表习惯 `limit:999`,凡未在模型里 `HTTPReadMany` 放开的模型都会 **416**(这次 `categories`/`resource_grants` 就是踩这个)。属于"框架默认值咬人 + 靠每模型手动放开"的重复劳动,易漏。

## ② 总体架构

分层站得住:
```
DYAPI(HTTP/CRUD/容器/字段级权限)
  ↑ CMSModel 基类:HTTP* 全接管 → RBAC + 版本快照 + 生命周期字段保护(唯一接缝)
  ↑ 服务层:PolicyService(鉴权唯一权威)· RevisionService · SchedulerService · StaticGenService · HookManager
  ↑ 数据模型:Role/RolePermission/UserRole/ResourceGrant/Revision + Article/Category/Menu/User/Attachment/SystemConfig
前端:Vue SPA(admin+展示)+ 公开站后端 SSG
```
授权模型现在相当完整,优先级:`super_admin → 角色 any → (own 属主 · 行级 ACL · 分类授权[级联子树])`。分类授权/行级 ACL 是**独立路径**,无基础角色权限也生效;create(C)不认 own。

## ③ 后端

**强项**:PolicyService 单一权威、无回退;分类授权用合成 `model="articles_category"` 复用 ResourceGrant,级联整棵子树;`HTTPCreate` 用具体 item 复核目标分类;通用 `/acl` 控制器 + 生命周期 `manageable-categories` 下发可管理分类。

**待还的债**:
- `PolicyService.resolve()` **每请求查库**(角色/权限/分类树),明确标注"无缓存,以后再加"。用户量/请求量上来后需加短 TTL 缓存 + `rbac_changed` 失效。
- 调度器曾因"遍历所有 `instanceof CMSModel` 的模型"把无 `status/publish_at` 列的表也查了而崩溃(已加字段过滤)——同类"遍历所有模型"的逻辑要保持防御性。
- `assert(cond, ErrorType, msg)` 的 TS 类型偏松(dyapi 侧 JS),IDE 报警但 bun 运行无碍。
- 密码为确定性 `HMAC-SHA256(env salt)`,适配等值匹配登录,非 bcrypt/argon2。

## ④ 前端

**强项**:管理台表单控件已统一到设计系统预设 [`frontend/src/ui/presets.ts`](../frontend/src/ui/presets.ts)(`INPUT_CLASS`/`SELECT_PT`/`DATEPICKER_PT`/`BTN`),消灭了原生 `<select>` 和内联大 `:pt`;能力驱动导航(后端 `loginInfo` 下发权限);可复用 `AclEditor` + 分页搜索 `UserPicker`;回滚用全局 `ConfirmDialog`。

**待还的债**:
- 主题模板对 `article.content` 用 `v-html` **未消毒**(存储型 XSS 面);SSG 侧仅基础 strip。上线前接 DOMPurify 或后端消毒(可挂 `content.pre_save` hook)。
- 路由守卫是"装饰性"的,真正鉴权在后端(设计如此,但要认知清楚)。
- 类型仅在 `vue-tsc -b`(build)时把关,无独立 lint 门禁。
- 展示站是后端 SSG 静态页,未上前端 SSR(当初讨论过,判定 SSG 足够)。

## ⑤ 打包/部署/二次开发

**强项**:单容器 `Dockerfile.single`(supervisor + nginx,推荐)或多容器 compose;二次开发路径清晰——继承 `CMSModel`、声明 `ownerField`/`categoryField`,自动获得 RBAC + 三态生命周期 + 版本 + 分类授权。

**待还的债**:
- `dyapi` 以 `file:../../dyapi3/dyapi` 本地路径 pin,改框架源码后 `backend/` 要重新 `bun install`(file: 是拷贝非软链)。
- 环境变量强依赖 `JWT_SECRET`/`PASSWORD_SALT`(缺则 `bootstrap()` 直接抛)。
- 测试纪律靠人肉自觉(备份 DB、杀干净进程),见 [development.md](development.md)。

---

## 优先级建议(下一步值得做的)

1. **上线前必做**:内容消毒(DOMPurify / 后端 hook),堵住存储型 XSS。
2. **随规模做**:`PolicyService` 加缓存(短 TTL + `rbac_changed` 失效),避免每请求查库。
3. **体验/健壮**:`maxLimit` 这类"框架默认值咬人"——考虑给管理台模型统一一个基类或约定,少写重复的 `HTTPReadMany`。
4. **可选**:更强的密码哈希(需改登录流程)。

## 元观察

这轮工作从"评估"很快切到"实现",中途未与需求方对齐节奏就大幅扩张范围(设计系统全量替换、分类权限体系),属于流程问题;好在改动均已提交、每步有真实请求验证。后续大改动前应先对齐范围与优先级。
