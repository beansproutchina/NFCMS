# 公开站预渲染(SSG)

> 现状文档:写「是什么」。设计取舍见 [spec/001](../spec/001-ssg-prerender.md),实施步骤见 [plan/001](../plan/001-ssg-prerender.md)。

## 一句话

headless chromium 打开**真实 SPA URL**,等页面自报渲染完成,把 DOM 落成静态 HTML 写到 `backend/static/ssg/`,nginx 优先命中。生成的就是访客看到的那一页,主题零改造。

## 数据流

```
编辑发布/保存/删除   AudienceService 重算   栏目改 slug/受众
        │                    │                    │
   content.saved.*    content.access_changed.*   content.saved.categories
   content.removed.*
        └────────────────────┴────────────────────┘
                             ↓
                    PrerenderService
                    ├─ 算「期望产物」(ssgPaths)
                    ├─ 与 manifest diff → 删陈旧 / 排队新的
                    └─ PrerenderQueue(去重·串行·容错)
                             ↓
                    BrowserPool → chromium
                    打开 http://127.0.0.1/<url>  带 X-SSG-Bypass: 1
                             ↓
                    等 html[data-ssg-ready]
                             ↓
                    ssgSanitize 清洗 → 落盘
```

## 文件

| 文件 | 职责 |
|---|---|
| `backend/app/lib/ssgPaths.ts` | URL ↔ 文件路径;`shouldPrerenderArticle` / `shouldPrerenderCategory` 判定 |
| `backend/app/lib/ssgSanitize.ts` | 清洗快照;`data-ssg-ready` → `data-ssg` |
| `backend/app/lib/ssgManifest.ts` | `planArticleWrites` —— stale 文件的 diff |
| `backend/app/services/BrowserPool.ts` | chromium 懒启动 / 串行开页 / 空闲自关 / 定期重启 |
| `backend/app/services/PrerenderQueue.ts` | 去重 + 串行 + 容错 |
| `backend/app/services/PrerenderService.ts` | 编排、manifest 读写、sitemap、全量 |
| `frontend/src/views/front/templateLoader.ts` | 模板名 → 组件(router 在导航完成前解析好) |
| `frontend/src/entry.ts` | 预渲染页走 `createSSRApp` 水合,其余走 `createApp` |
| `frontend/src/errorToast.ts` | 全局错误提示的投递口,与挂载时机解耦(见机制 6) |
| `frontend/scripts/ssg-routes-plugin.ts` | 构建期导出主题自定义路由 → `dist/ssg-routes.json` |
| `frontend/scripts/ssg-preview.mjs` | 开发环境预览服务器(复刻 nginx 优先级 + 旁路) |

## 六个关键机制

### 1. 就绪信号:应用自报,不用 networkidle

`DynamicView` 渲染完在 `<html>` 上打 `data-ssg-ready`,渲染不出来打 `data-ssg-error`,数据未到位时两者都无。生成器只认这三态。

**为什么不能用 networkidle**:neo 主题往 `<head>` 插了指向 `fonts.googleapis.com` 的 link。离线内网里那个请求永远挂着,等网络空闲就是每页必超时。

**`error` 态的作用**:生成器见到它就**删掉陈旧文件**(不是"不写")。一个刚被收紧为 `restricted` 的栏目,它那张列着全部文章标题的旧列表页还留在磁盘上,就是实打实的越权泄漏。区分对待:`error-signal` 是页面权威判定 → 删;`timeout`/`launch-failed` 是基础设施抖动 → 保留旧文件。

### 2. nginx 不需要排除列表

```
location = /          → $ssg_root/index.html   → @spa
location /            → dist/$uri              → @ssg
location @ssg         → $ssg_root/$uri.html    → @spa
location @spa         → dist/index.html
```

`/admin`、`/login`、`/setup` 永远走 SPA,**不是因为有名单挡着,而是因为预渲染器从不写这些文件**。少一份需要手工维护、漏一条就出事的名单。

### 3. 旁路:生成器不能吃自己的快照

`map $http_x_ssg_bypass $ssg_root` —— 带这个头时 root 指向不存在的目录,try_files 全落空、回落 SPA。没有它,chromium 会命中上一轮的静态文件,**内容永远停在第一次**。用 `map` 而不是 `if`(nginx 的 `if` in location 是著名的坑)。

### 4. manifest:一个 diff 覆盖五条 story

`planArticleWrites(manifest, [{id, rel}])`,`rel = null` 表示"这一页不该存在"。撤下 / 转受限 / 删除 / 栏目改名 / 改 slug —— 差别只在调用方算出来的 `rel`,算法完全相同。

**路径未变时不产出删除项**:天真的「先删 prev 再写 want」会在生成失败时把线上能用的页面弄没。

### 5. 指纹比对:冷启动查一次,之后每 60s 再查

`manifest.fingerprint` = `dist/index.html` 的 hash。变了(换主题/重新构建前端)或 manifest 缺失才全量,否则普通重启不白跑几分钟。

**为什么不能只在启动时查:** 预渲染页里写死了带哈希的 bundle 名(`/assets/index-D14wq3_j.js`)。前端一重新构建,哈希就变、旧文件被删 —— 每一张已生成的静态页都指向一个**不存在的脚本**。

那个失效模式极毒:页面看起来完美(静态 HTML 照常渲染),但**一行 JS 都跑不起来** —— 没有 SPA 接管、点站内链接走整页跳转、登录态永远不会被纠正。服务端零报错,只有浏览器控制台里一条 404。

一句话诊断:

```js
document.getElementById('app').__vue_app__   // undefined = SPA 没挂上,静态页是惰性的
```

单容器生产环境不太会遇到(换镜像 = 换容器 = 后端也重启),但开发环境天天遇到,任何「重建前端 + reload nginx 但不重启后端」的部署流程也会中招。所以 `startWatchingBuild()` 每 60s(`SSG_WATCH_MS`,0 关闭)复查一次指纹。

**指纹必须在全量跑完之后写**。写在开头的话,全量跑到一半进程被杀(部署重启、OOM),磁盘上会留下「指纹最新但一页没有」的 manifest —— 下次启动看指纹相符直接返回,**站点永远是空的且没有任何报错**。

### 6. 挂载被推迟,于是「挂载前」变成了一段真实的窗口

预渲染页要等 `router.isReady()` 才 `mount()`(否则首帧空 DOM 与静态内容对不上,水合退化成整页重渲染)。代价是:**初次导航的全部 prefetch 都跑在挂载之前**。这个窗口是整个初次导航的长度 —— 实测本机约 550ms,足够十几个请求打完一个来回。

```
t=0    bundle 执行 → app.use(router) → 初次导航开始
t=526  某个 prefetch 404 → dispatch('app-error')      ← 此刻还没有任何 Vue 组件存在
t=553  isReady() resolve → app.mount() → onMounted
```

任何注册在 `onMounted` 里的全局处理器,在这 500 多毫秒里都是不存在的。**真实症状**:neo 首页预取了一个「登录可见」栏目 → 匿名 404;**直开首页**静默无提示,**从别的页面路由过来**却弹 "Category Not Found" —— 同一个错误两种表现。

处置:`frontend/src/errorToast.ts` 在**模块加载时**(早于 `app.use(router)`)就挂上监听并缓冲,`App.vue` 挂载后接上真正的 toast 并领走缓冲。新增全局副作用时要同样考虑这个窗口。

配套的:`main.ts` 里 `router.isReady()` **必须带 `.catch()`**。守卫抛错会让它 reject,不挂载就等于把页面永久留在惰性静态 HTML 上 —— 与 bundle 陈旧是同一种「看着正常但全死」的失效。

## 受众轴在静态侧的执行点

**只生成 `access_eff === 'public'`**,判定收口在 `shouldPrerenderArticle`(未知值 fail closed)。teaser 两态看着"匿名也能看到点东西",但它们能看到的只是摘要,而快照落盘的是渲染出来的整页。

栏目层面由渲染本身兜底:非公开栏目对匿名访客返回 404 → 页面报 `data-ssg-error` → 不写且删旧。

sitemap **按磁盘实际产物**生成,不读 manifest —— manifest 是"打算生成什么",而一页可能渲染失败最终没落盘。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `SSG_ENABLED` | 开 | `=0` 整体关掉 |
| `SSG_BASE_URL` | `http://127.0.0.1` | 生成器访问哪个站点 |
| `SSG_CHROMIUM_PATH` | playwright 自找 | 镜像里是 `/usr/bin/chromium-browser` |
| `SSG_SPA_DIST` | `../frontend/dist` | 读 `ssg-routes.json` + 算指纹 |
| `SSG_DIR` | `backend/static/ssg` | 产物目录 |
| `SSG_DEBOUNCE_MS` | 400 | 合并窗口 |
| `SSG_WATCH_MS` | 60000 | 复查构建指纹的间隔;`0` 关闭 |
| `SSG_TRACE` | 关 | `=1` 打开逐页 trace 日志 |

## 怎么测

```bash
cd backend && bun index.ts          # 后端要活着
cd frontend && npm run ssg:preview  # 构建 → 起 :4174 → 触发全量
```

预览服务器复刻 nginx 的命中优先级与旁路,**本地看到的就是生产行为**。

禁 JS 验收(这是 SSG 唯一诚实的检验方式):

```bash
agent-browser batch --bail \
  "open" \
  "network route * --abort --resource-type script" \
  "navigate http://localhost:4174/a/works/work-1" \
  "screenshot /tmp/x.png"
```

## 已知代价与残留

- **镜像 +~300MB**(chromium + CJK 字体)。字体不能省:没有它 headless chromium 渲染中文是方块。
- **约 2 秒/页**。单篇发布只重算「该页 + 首页 + 栏目链 + sitemap」,全量才慢。
- **水合仍有 1 条 mismatch**(`Hydration completed but contains mismatches`)。已不再造成可见闪白(实测最小帧 = 终态),但没有做到零 mismatch。生产构建的 Vue 不输出细节,要定位需要 dev 构建。
- **首屏是匿名视角**。登录用户会看到一次内容变化,由 SPA 接管纠正 —— 这是刻意接受的取舍。
- **主题若在 `onMounted` 里自己取数**,就绪信号会早于它。本轮只保证"框架渲染完成"。真需要时可开放 `context.ssgHold()` 契约。
