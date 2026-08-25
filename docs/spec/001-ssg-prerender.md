# spec 001 — 公开站 SSG 预渲染

> 状态：已审（clarify 定稿）；§3-E 三条为 plan 环节补充
> 目标：把当前**完全停用且设计错误**的 SSG 换成一套可用、可测、可运维的预渲染方案。

---

## 0. 为什么重做而不是修

现有 [`StaticGenService`](../../backend/app/services/StaticGenService.ts) 有三处独立的硬伤，任何一处都足以让它不可用：

1. **接线被摘。** [`backend/index.ts` 第 8 步](../../backend/index.ts#L81) 整块注释，[`docker/nginx.single.conf`](../../docker/nginx.single.conf#L38) 三条 location 也注释。一行不跑。
2. **生产环境下开了比不开更坏。** SPA 壳的路径是 `process.cwd()/../frontend/dist/index.html`；supervisord 里 `directory=/app/backend`，容器里算出来是 `/app/frontend/dist/index.html`——不存在（dist 在 `/usr/share/nginx/html`）。于是静默回落到极简壳：无 `<script>`、无 CSS。放开 nginx 那三条，访客会永久停在一个裸 `<h1>` + `<ul>` 上，SPA 永不启动。
3. **渲染路径与主题无关。** `marked.parse(content)` 套个 `<article><h1>`，主题的 Layout、模板、prefetch 链、Tailwind 全程未参与。
4. **受众轴未接（安全）。** 只判 `status !== "visible"`，`access_eff = restricted` 的文章会被**全文**写成人人可读的静态文件。

第 3 条在现有设计里修不了——它需要真正执行 Vue 主题组件。所以是重做。

## 1. 目标与非目标

**目标**

- **首屏速度**：访客第一次绘制的就是完整的主题化页面，不等 JS bundle。
- **信创合规**：JS 不可用 / 被策略禁用 / 爬虫不执行 JS 时，公开内容仍然完整可读。离线内网可部署，运行时不联外网。
- **可测**：开发环境一条命令生成 + 本地预览，能肉眼验收；生产环境行为与开发环境一致。

**非目标（本轮明确不做，见 §5）**

后台状态面板、teaser 页静态化、登录态 cookie 绕过、动态内容类型、多容器拓扑。

## 2. 技术路线（clarify 已定）

**playwright 快照 + 运行时增量。**

后端在 `content.published.*` / `content.saved.*` hook 里，用 headless chromium 打开**真实 SPA URL**，等页面渲染完成，把 DOM 落成静态 HTML 写到 `backend/static/ssg/`，nginx 优先命中。

选它的理由：保真度 100%（生成的就是用户看到的那个页面），主题零改造，且不给主题作者增加「必须 SSR 安全」这条隐性长期纪律。代价是镜像 +~300MB 的 chromium——已接受；且不额外收窄信创适配面（bun 本来就把架构框在 x64/arm64，alpine 的 chromium 这两个架构都有包）。

被否掉的两条：

- **vite-ssg**：生成动作包含一次完整 `vite build`。生产镜像里没有 node/npm/vite/源码，且全站重建三十秒起步，挂不到单篇发布的 hook 上。
- **vite SSR bundle 常驻**：技术上成立（这才是「运行时增量版的 vite-ssg」），但要求 router / api / store / 全部主题 SSR 安全化，且是永久纪律——违反了不报错，只在生成时崩。

**SPA 接管语义**：`#app` 里有预渲染内容时用 `createSSRApp` 并 `await router.isReady()` 后挂载；否则维持 `createApp`。对得上的子树无缝复用，对不上的 Vue 自行重渲染。（[`main.ts:32`](../../frontend/src/main.ts#L32) 现在是立即 `mount`，首帧 `<router-view>` 必空——这是必须修的前置条件。）

---

## 3. Story

### A —— 访客看到什么

**S1 匿名访客首屏就是完整的主题化页面**

一篇 `access_eff = public` 的已发布文章，其 URL 在 JS 不可用时仍完整可读：主题的 header / footer / 正文 / 配色 / 排版全部在位，而不是无样式的裸 HTML。

> 验收：DevTools 里勾上 Disable JavaScript → 打开 `/a/news/hello` → 屏幕上出现带主题页眉页脚、样式完整的文章页，正文文字可读。

**S2 SPA 接管过程中不出现空白帧**

静态 HTML 绘制后到 SPA 接管完成之间，页面内容不得先消失再出现。

> 验收：正常开 JS 打开 `/a/news/hello` → DevTools Performance 录制并看屏幕截图帧序列 → 内容首次出现之后的每一帧都有内容，没有任何一帧是空白页。

**S3 首页与分类页同样静态化**

> 验收：禁 JS 打开 `/` → 出现站点名与最新文章列表；禁 JS 打开 `/a/news` → 出现该栏目名与其文章列表。

**S4 主题声明的自定义路由页也静态化**

主题 `theme.config.ts` 的 `pages[].routes`（neo 的 `/about`、`/contact`，school 的 `/search`）属于公开站的一部分。

> 验收：neo 主题下禁 JS 打开 `/about` → 出现「关于」页的正文内容，而不是空壳。

**S5 登录用户先看到匿名版，SPA 接管后被纠正**

nginx 命中静态文件时不看 cookie，所以登录用户拿到的第一屏是匿名视角。允许闪烁。

> 验收：以一个能看到受限文章的 member 身份登录 → 打开 `/` → 首屏列表里**没有**那篇受限文章 → 约半秒后 SPA 接管，列表里**出现**那篇受限文章。

### B —— 编辑的动作如何反映到静态站

**S6 发布一篇文章，静态页立刻存在**

> 验收：后台新建一篇 public 文章、点「发布」→ 无痕窗口禁 JS 打开 `/a/news/<slug>` → 出现该文章正文。

**S7 撤下一篇文章，静态页立刻消失**

> 验收：把上面那篇改回 hidden → 无痕窗口禁 JS 刷新同一 URL → 页面上不再出现正文（只剩 SPA 空壳）。

**S8 修改已发布文章，静态页内容随之更新**

> 验收：把已发布文章的标题从「Hello」改成「Hello 2」并保存 → 无痕窗口禁 JS 刷新该 URL → 屏幕上的标题是「Hello 2」。

**S9 定时发布到点后静态页出现**

`SchedulerService` 已经在发 `content.published.*`（[SchedulerService.ts:48](../../backend/app/services/SchedulerService.ts#L48)），预渲染应当天然接上。

> 验收：把一篇文章设为 1 分钟后定时发布 → 等到点 → 无痕窗口禁 JS 打开该 URL → 出现正文。

### C —— 受众轴（安全红线）

**S10 非 public 受众的内容永不落静态盘**

> 验收：新建一篇文章、受众设为「登录可见」、发布 → 匿名无痕窗口禁 JS 打开其 URL → 屏幕上**不出现**正文任何一个字。

**S11 内容从 public 改成受限时，已生成的静态文件被删除**

这是 [public-access.md:414](../public-access.md#L414) 点名的缺口：现在只在 `status` 变化时删。

> 验收：一篇已生成静态页的 public 文章 → 编辑其受众为「登录可见」→ 保存 → 匿名无痕窗口禁 JS 刷新该 URL → 屏幕上不再出现正文。

**S12 列表页与 sitemap 只含 public**

> 验收：站内有 3 篇 public + 1 篇 restricted → 禁 JS 打开 `/` → 列表出现 3 个标题，restricted 那篇的标题不出现；打开 `/sitemap.xml` → 只列出 3 篇文章的 URL。

### D —— 运维与开发

**S13 冷启动时全量生成**

换主题（重新构建镜像）后旧快照全部作废，必须重新生成。

> 验收：删掉 `backend/static/ssg/` 整个目录 → 重启后端 → 日志出现「full regenerate complete, N pages」→ 禁 JS 打开首页与任意文章页，都有内容。

**S14 预渲染失败不影响发布**

> 验收：把 chromium 可执行路径配错 → 后台点「发布」→ 页面提示发布成功、文章状态变为已发布 → 后端日志出现一条 `[ssg]` 失败告警 → 正常开 JS 打开该文章 URL，页面正常显示（走 SPA）。

**S15 开发环境一条命令生成并预览**

Q6-(a)：本地能生成，并起一个复刻 nginx 优先级（静态优先、未命中回落 SPA）的服务器供肉眼验收。

> 验收：终端跑 `npm run ssg:preview` → 输出「generated N pages」并打印本地地址 → 浏览器打开该地址下的 `/a/news/hello` 并禁 JS → 出现完整文章页；打开 `/admin` → 出现后台登录/首页（SPA 正常工作）。

### E —— 静默失效（plan 环节调研 hook 接线时发现，spec 补充）

这三条的共同点：内容的**可见性或 URL 变了，但没有任何 hook 通知 SSG**，静态文件于是永久停留在旧状态。S17 是安全红线——比 S11 严重，因为它是批量的。

**S16 删除文章后静态页消失**

[`CMSModel.HTTPDelete`](../../backend/app/lib/CMSModel.ts#L121) 不发任何 hook（`HTTPCreate`/`HTTPUpdate` 都发 `content.saved.*`，唯独删除没有）。

> 验收：后台删除一篇已生成静态页的文章 → 匿名无痕窗口禁 JS 打开其 URL → 屏幕上不再出现正文。

**S17 栏目受众收紧后，其下所有文章的静态页消失**

改栏目受众 → [`CategoryModel.update`](../../backend/app/models/CategoryModel.ts#L53) 调 `audience.recomputeSubtree` → [裸 `articles.update` 写 `access_eff`](../../backend/app/services/AudienceService.ts#L204)，刻意绕过 hook（注释写明「派生值变化不是一次内容编辑」）。对版本快照来说这是对的，对 SSG 来说这是**整棵子树的静态全文继续对匿名访客敞开**。

> 验收：一个栏目下有 3 篇 public 且已生成静态页的文章 → 把该栏目受众改为「仅被授权者」→ 保存 → 匿名无痕窗口禁 JS 逐个打开这 3 个 URL → 都不再出现正文。

**S18 栏目 slug 改名后，旧 URL 失效、新 URL 生效**

文章 URL 是 `/a/<栏目slug>/<文章slug>`，栏目改名会让其下每一篇文章的 URL 都变，同样没有 hook。

> 验收：把某栏目 slug 从 `news` 改成 `press` → 匿名无痕窗口禁 JS 打开 `/a/news/hello` → 不再出现正文；打开 `/a/press/hello` → 出现正文。

---

## 4. 边界情形

**E1 生成器不能吃到自己的旧快照**

chromium 打开 `http://127.0.0.1/a/x/y` 时，nginx 会优先命中已有的静态文件——那样快照的就是快照，内容永远停在第一次。必须有旁路。

> 验收：一篇已生成静态页的文章，把标题改掉并重新保存 → 无痕窗口禁 JS 打开该 URL → 屏幕上是**新**标题（若命中此坑，会一直是旧标题）。

**E2 连续发布多篇不崩**

> 验收：后台快速连续发布 3 篇文章（间隔小于一次生成耗时）→ 三个 URL 禁 JS 打开都有各自的内容 → 后端日志无未捕获异常，进程存活。

**E3 外部资源不可达时不卡住（信创离线场景）**

neo 主题在 `init()` 里往 `<head>` 插了一个指向 `fonts.googleapis.com` 的 `<link>`（[theme.config.ts:25](../../frontend_themes/neo/theme.config.ts#L25)）。离线内网里这个请求会挂起——如果生成器等「网络空闲」，每一页都会超时。

> 验收：在 hosts 里把 `fonts.googleapis.com` 指到 `127.0.0.1:1` → 点发布 → 5 秒内后端日志出现该页生成成功 → 禁 JS 打开该 URL，内容完整（字体回落系统字体，不影响可读）。

**E4 快照里不含运行时垃圾**

nprogress 的进度条 DOM、PrimeVue 的 toast 容器、dev 下的 `/@vite/client`，都可能被一起序列化进去。

> 验收：查看生成的 HTML 源码（`view-source:`）→ 搜不到 `/@vite/client`；禁 JS 打开该页 → 屏幕顶部没有卡住不动的蓝色进度条。

**E5 slug 含中文**

> 验收：建一篇 slug 为 `你好-world` 的 public 文章并发布 → 禁 JS 打开 `/a/news/你好-world` → 出现正文。

**E6 未生成的路径回落 SPA，不是 404**

> 验收：禁 JS 打开 `/a/news/根本不存在的slug` → 开回 JS 刷新 → 出现 SPA 渲染的「内容不存在」提示，而不是 nginx 的白底 404。

**E7 后台与认证页永不静态化**

> 验收：`ls backend/static/ssg` → 没有 `admin/`、`login.html`、`setup.html` → 打开 `/admin` → 出现后台，且每次刷新都拿到最新数据（不是快照）。

**E8 静态页里的图片与样式仍然可用**

快照序列化时若把相对路径改写成 `http://127.0.0.1/...`，换个域名访问就全挂。

> 验收：一篇带封面图的文章 → 换用局域网 IP（如 `http://192.168.x.x/a/news/hello`）禁 JS 打开 → 封面图正常显示，页面有样式。

**E9 分类未配 `list_template` 时不生成分类页**

该分类在面包屑里本来就是 disabled 的，它没有列表页这个概念。

> 验收：把某分类的 `list_template` 清空 → 触发重新生成 → 禁 JS 打开 `/a/<该分类slug>` → 不出现列表页内容（回落 SPA 的处理）；`backend/static/ssg/` 下没有对应文件。

**E10 反复发布同一篇不留残留文件**

比如改了 slug 之后重新发布，旧 slug 的文件必须删掉，否则旧 URL 会永久返回一份僵尸页面。

> 验收：一篇已生成的文章，把 slug 从 `hello` 改成 `hello-2` 并保存 → 禁 JS 打开 `/a/news/hello` → 不再出现正文；打开 `/a/news/hello-2` → 出现正文。

---

## 5. 明确不做（及理由）

| 不做 | 理由 |
|---|---|
| 后台 SSG 状态面板 / 手动全量重生成按钮 | Q6 只要开发环境的 (a)。全量重生成由「重启后端」覆盖（S13），换主题本来就要重新构建镜像。日志足够定位问题。 |
| teaser 页静态化（`auth_teaser` / `restricted_teaser`） | Q3 定为只生成 `public`。teaser 静态化需要渲染器切「匿名视角」并裁剪正文，收益小于风险。 |
| 登录 cookie 绕过静态页 | Q5 定为允许闪烁，由 SPA 接管纠正（S5）。加 nginx cookie 判断会让缓存行为变得不可预测。 |
| 动态内容类型（schemas 注入的模型） | 已核实：它们只注册 API 路由（`/{routePath}`），前端没有任何公开页面路由指向它们，没有可生成的页面。 |
| 多容器拓扑（`docker-compose.yml`） | nginx 容器读不到 backend 容器里的 `static/ssg`，要共享卷。`pack.js` 本来就不管它（[development.md:87](../development.md#L87)）。单容器是推荐拓扑。 |
| 真·无缝水合 | playwright 快照拿到的是页面跑完之后的 DOM，与客户端首次渲染必然有差异。做「尽力水合 + Vue 自动回落」，不承诺零 mismatch。 |

## 6. 已知代价

- **镜像体积** +~300MB（chromium）。
- **内存峰值**：生成期间 chromium 约 200–400MB，与 bun + nginx 共享容器内存。小内存机器需要注意。
- **全量重生成耗时**：约每页 0.5–2 秒，1000 篇文章约 10–30 分钟。单篇发布不受影响（只生成 1 页 + 首页 + 该分类页 + sitemap）。
- **首屏是匿名视角**：登录用户会看到一次内容变化（S5，已接受）。
- **`main.ts` 挂载时机要改**：`await router.isReady()` 会让 SPA 首帧稍晚，但换来无空白帧（S2）。
