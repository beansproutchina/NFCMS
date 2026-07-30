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
│  services/StaticGenService  公开站 SSG + sitemap              │
│  services/HookManager       事件/过滤器总线                   │
│  services/ModelInjector     schema→运行时动态内容类型         │
└───────────────┬─────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────┐
│ DYAPI 3.1.0 框架 (dyapi3/dyapi, 本地 file: 依赖)              │
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
6. 返回 `{code, data, ...}`;DYAPI 3.1.0 用 body.code 设**真实 HTTP 状态码**。

## CMS 核心层为什么这样设计
DYAPI 是通用框架;CMS 的横切能力(RBAC、版本、生命周期、定时、SSG)不塞进每个 Model,而是收敛到 **`CMSModel` 基类 + 一组单例服务**——这是唯一接缝。好处:内容模型只声明字段 + `ownerField`,自动获得全部能力;动态 schema 模型也复用同一套。

## 两条数据通路(重要)
- **裸方法** `model.read/create/update/remove`:无用户上下文、**不鉴权**。公开站(ContentController)、定时器、版本服务走这条。
- **HTTP 方法** `HTTP*(state,query,body)`:经 RBAC + 字段白名单 + 防批量赋值。`@CRUD` 生成的 REST 路由走这条。
> 心智:公开内容 = 裸读 + `status='visible'` 过滤;后台 CRUD = HTTP* + RBAC。

## 公开站 SSG(当前已停用)
> **状态:接线已摘除。** 生成出来的页面质量远低于主题化 SPA 渲染,故 `backend/index.ts` 第 8 步的 hook 接线与初次全量生成、以及 `docker/nginx.single.conf` 里 `/`、`/a/`、`/sitemap.xml` 三条 SSG location 全部注释掉了 —— 公开站**完全由 SPA 渲染**。`StaticGenService` 代码保留,恢复时把这两处一起放回。以下描述的是恢复后的行为。

`StaticGenService` 监听 `content.published/saved.articles` hook,把可见文章/分类/首页渲染成带 SEO 头(title/OG/canonical/JSON-LD)+ Markdown 正文的静态 HTML,写到 `backend/static/ssg/`,并生成 `sitemap.xml`。有 `frontend/dist/index.html` 时以它为壳注入(爬虫拿内容,浏览器仍启动完整 SPA)。nginx 对 `/`、`/a/`、`/sitemap.xml` 优先命中 `ssg/`,否则回落 SPA(见 `docker/nginx.single.conf`)。
> 注:当前 SSG 渲染的是 Markdown→HTML,而非跑 Vue 主题组件的真 SSR;真 SSR 是可选演进(替换 `StaticGenService.renderBody`,需要 Vite SSR 双入口 + 公开视图 SSR 化)。

详见 [backend.md](backend.md)、[frontend.md](frontend.md)、[dyapi.md](dyapi.md)。
