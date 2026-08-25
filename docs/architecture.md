# Architecture

NFCMS = 自研后端框架 **DYAPI** 之上的无头 CMS,加一个解耦的 Vue 前端(既是管理台又是展示站),外加后端驱动的公开站 SSG。

## 分层

```
┌─────────────────────────────────────────────────────────────┐
│ 前端 (frontend/, Vue3 SPA)                                    │
│  · /admin/*  管理台(RBAC、内容、角色、设置)                  │
│  · /、/a/*   展示站(消费 /api/content/*)                     │
│  · /preview  草稿预览(token)                                 │
└───────────────┬─────────────────────────────────────────────┘
                │ HTTP /api/*  (+ 公开站 SSG 静态 HTML)
┌───────────────▼─────────────────────────────────────────────┐
│ NFCMS 后端 (backend/app/)                                     │
│  控制器: Content / ContentLifecycle / User / System /         │
│          Upload / SchemaDev                                   │
│  ── CMS 核心层(本项目的关键设计)──                           │
│  lib/CMSModel.ts     内容模型基类:HTTP* 接管→RBAC+版本+生命周期│
│  services/PolicyService     RBAC 鉴权(唯一权威)              │
│  services/RevisionService   版本快照/回滚                     │
│  services/SchedulerService  定时发布(node-cron)             │
│  services/PrerenderService  公开站预渲染 + sitemap            │
│  services/HookManager       事件/过滤器总线                   │
│  services/ModelInjector     schema→运行时动态内容类型         │
└───────────────┬─────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────┐
│ DYAPI 3.3.1 框架 (npm: dyapi@~3.3.1)                          │
│  DYApp(Koa)/ Model / Container(SQLite)/ Controller /        │
│  装饰器(@CRUD/@Route/@Inject/@Auth/@ValidateBody)/ jwt      │
└──────────────────────────────────────────────────────────────┘
```

## 请求生命周期(HTTP → 数据)
1. Koa 收到请求。
2. **鉴权中间件**(`app/middlewares/authmiddleware.ts`):从 cookie `token`(或 `Authorization: Bearer`)解 JWT → `ctx.state.user` + `ctx.state.usertype`(默认 `PUBLIC`),然后调 `policy.resolve(ctx.state)` 展开有效角色/权限。
3. DYApp 的全局中间件:解析 `?filter=` JSON、`fields`、`hideFields`、`pops`;初始化 `ctx.state.settingsOverrides = {}`。
4. 路由分发到 Controller `@Route` 或 Model 的 `HTTP*`。
5. **内容模型**(CMSModel):`HTTP*` → `policy.can()` 鉴权 → 列表注入 `scopeFilter` / 单条取行后判 → 裸 `read/create/update/remove` → 容器 SQL。写操作快照版本 + 触发 hook。
6. 返回 `{code, data, ...}`;DYAPI 用 body.code 设**真实 HTTP 状态码**。

## CMS 核心层为什么这样设计
DYAPI 是通用框架;CMS 的横切能力(RBAC、版本、生命周期、定时、SSG)不塞进每个 Model,而是收敛到 **`CMSModel` 基类 + 一组单例服务**——这是唯一接缝。好处:内容模型只声明字段 + `ownerField`,自动获得全部能力;动态 schema 模型也复用同一套。

## 两条数据通路(重要)
- **裸方法** `model.read/create/update/remove`:无用户上下文、**不鉴权**。公开站(ContentController)、定时器、版本服务走这条。
- **HTTP 方法** `HTTP*(state,query,body)`:经 RBAC + 字段白名单 + 防批量赋值。`@CRUD` 生成的 REST 路由走这条。
> 心智:公开内容 = 裸读 + `status='visible'` 过滤;后台 CRUD = HTTP* + RBAC。

## 公开站 SSG(预渲染)

headless chromium 打开**真实 SPA URL**,等页面自报渲染完成(`html[data-ssg-ready]`),把 DOM 落成静态 HTML 写到 `backend/static/ssg/`,nginx 优先命中、未命中回落 SPA。生成的就是访客看到的那一页,主题零改造。

由 `content.saved/published/removed.articles`、`content.access_changed.articles`、`content.saved.categories` 五个 hook 驱动增量;冷启动按构建指纹决定是否全量。**只生成 `access_eff === 'public'`**。

完整机制、环境变量与测试方式见 [knowledge/ssg-prerender.md](knowledge/ssg-prerender.md)。

