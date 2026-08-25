# plan 001 — 公开站 SSG 预渲染

> 对应 [spec/001-ssg-prerender.md](../spec/001-ssg-prerender.md)（18 条 story + 10 条边界）
> 状态：待审

---

## 0. 已完成的可行性验证

写 plan 前把整条路线唯一的未知数验掉了：

```
bun add playwright-core          → 1.62.1，安装正常
bun t.ts (launch → setContent → waitForSelector → outerHTML)
                                 → OK len=232 hasH1=true
```

**结论：`playwright-core` 在 bun 下能正常驱动 chromium，`html[data-ssg-ready]` 就绪信号可用。** 后端依赖用 `playwright-core`（不是 `playwright`——后者会在 install 时下载浏览器，信创离线环境不可接受）；浏览器二进制由镜像的 `apk add chromium` 提供，用 `executablePath` 指过去。

动线层工具：`agent-browser`。禁 JS 用它 help 里给的标准写法：

```bash
agent-browser batch \
  '["open"]' \
  '["network","route","*","--abort","--resource-type","script"]' \
  '["navigate","http://localhost:4174/a/news/hello"]'
```

外部 script 全部 abort → SPA 永不启动 → 屏幕上剩下的**就是**静态 HTML 的渲染结果。这正是 SSG 唯一诚实的检验方式。

---

## 1. 架构落点

### 1.1 就绪信号（整套设计的地基）

生成器怎么知道「页面渲染完了」？三个候选：

| | 问题 |
|---|---|
| `networkidle` | **E3 直接判死**：neo 主题往 head 插了 `fonts.googleapis.com` 的 link，离线内网里这个请求永远挂着，每一页都超时 |
| 固定 `waitForTimeout(2000)` | 慢的页面截半张，快的页面白等；不可证伪 |
| **应用自报就绪** ✅ | 确定性，与网络无关，与耗时无关 |

采用第三种：[`DynamicView.vue`](../../frontend/src/views/front/DynamicView.vue) 的 `resolveTemplate()` 完成后 `await nextTick()`，在 `<html>` 上打 `data-ssg-ready="1"`；渲染失败则打 `data-ssg-error="1"`。生成器 `waitForSelector('html[data-ssg-ready]')`，见到 error 就**不写文件**（S14 / E6 由此天然成立）。导航开始时先清掉这两个属性，避免快照到上一页（层 2 用例 26）。

### 1.2 URL → 文件 → nginx

生成物一律落在 `backend/static/ssg/`，文件名即 URL 加 `.html`：

| URL | 文件 |
|---|---|
| `/` | `index.html` |
| `/a/news` | `a/news.html` |
| `/a/news/hello` | `a/news/hello.html` |
| `/about`（主题自定义路由） | `about.html` |
| `/sitemap.xml` | `sitemap.xml` |

nginx 不需要按路由逐条配置——**只要我们只写允许的文件，就没有别的东西能被静态命中**：

```nginx
map $http_x_ssg_bypass $ssg_root {
    default  /app/backend/static/ssg;
    "1"      /var/empty/ssg-bypass;      # 不存在 → try_files 全落空 → @spa
}

location = / {
    root $ssg_root;
    try_files /index.html @spa;
}
location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ @ssg;           # 先让真实静态资源（/assets/*.js）命中
}
location @ssg {
    root $ssg_root;
    try_files $uri.html @spa;            # 再看有没有预渲染页
}
location @spa {
    root /usr/share/nginx/html;
    try_files /index.html =404;
}
```

- **E7 结构性成立**：我们从不写 `admin.html` / `login.html`，所以它们必然落到 `@spa`，不需要任何排除列表。
- **E6 结构性成立**：没生成的路径落 `@spa`，返回 200 + SPA 壳，不是 404。
- **E1 靠 `map`**：生成器带 `X-SSG-Bypass: 1`，`$ssg_root` 指向不存在的目录，nginx 必然回落 SPA——快照不会吃到自己的旧快照。用 `map` 而不是 `if`，因为 nginx 的 `if` in location 是著名的坑。
- `/api/` `/static/` 是前缀 location，最长匹配优先，不受影响。

### 1.3 manifest：stale 文件的唯一真相

`backend/static/ssg/.manifest.json`

```json
{ "version": 1,
  "fingerprint": "<dist/index.html 的 hash>",
  "articles":   { "12": "a/news/hello.html" },
  "categories": { "3":  "a/news.html" },
  "custom":     ["about.html", "contact.html"] }
```

单篇重生成的算法就是一次 diff：

```
want = shouldPrerenderArticle(row) ? articleRelPath(catSlug, row.slug) : null
prev = manifest.articles[id]
prev && prev !== want  → 删 prev
want                   → 生成并写 want，manifest[id] = want
!want                  → delete manifest[id]
```

这一个算法同时覆盖 **S7**（撤下）、**S11**（转受限）、**S16**（删除）、**S18**（栏目改名）、**E10**（改 slug）——它们的差别只在 `want` 算出来是什么。这是本轮最值钱的收敛点：五条 story 一份实现、一组单测。

### 1.4 队列：串行 + 去重 + 异步

`doAction` 是**串行 await** 的（[HookManager.ts:44](../../backend/app/services/HookManager.ts#L44)），hook 里直接跑预渲染会把发布请求阻塞 1–2 秒。所以 hook 只 `enqueue()` 立即返回，队列在后台按 rel 去重、串行消费（同时只开一个 page）。

- **E2** 连续发布 3 篇 → 3 个文章页各一次 + 首页/栏目页/sitemap 各**合并成一次**。
- **S14** 单个任务抛错只记日志，不影响队列后续任务，更不影响发布本身。
- 代价：S6 的「点发布 → 立刻打开 URL」有 1–2 秒竞态。可接受，动线用例里显式等待。

### 1.5 冷启动策略（S13）

启动就跑全量 = 每次重启都花 20 分钟。改成**指纹比对**：manifest 里的 `fingerprint`（`dist/index.html` 的 hash，换主题/换构建必变）与当前不符、或 manifest 缺失 → 后台异步全量重生成（不阻塞启动）。删掉 `ssg/` 目录 → manifest 没了 → 全量重生成，S13 的验收动线成立。

### 1.6 自定义路由怎么被后端知道（S4）

主题的 `pages[].routes` 是前端资产，后端读不到。构建期由一个 vite 插件把它落成 `dist/ssg-routes.json`，后端从 `SSG_SPA_DIST` 读。文件缺失时只是不生成自定义路由页，不报错。

### 1.7 文件清单

**后端**

| 文件 | 动作 |
|---|---|
| `app/lib/ssgPaths.ts` | **新** 纯函数：URL↔文件路径、`shouldPrerender*` 判定 |
| `app/lib/ssgSanitize.ts` | **新** 纯函数：快照清洗 |
| `app/lib/ssgManifest.ts` | **新** 纯函数：manifest diff |
| `app/services/BrowserPool.ts` | **新** chromium 懒启动 / 串行开页 / 空闲关闭 |
| `app/services/PrerenderQueue.ts` | **新** 去重 + 串行 + 容错 |
| `app/services/PrerenderService.ts` | **新** 编排；取代 StaticGenService |
| `app/services/StaticGenService.ts` | **删** |
| `app/lib/CMSModel.ts` | 改：`HTTPDelete` 补发 `content.removed.<table>`（带删除前的行） |
| `app/services/AudienceService.ts` | 改：`recomputeSubtree` 收尾发 `content.access_changed.articles`（带变更 id 列表） |
| `app/models/CategoryModel.ts` | 改：`update` 里 slug / list_template 变化时发 `content.saved.categories` |
| `index.ts` | 改：第 8 步换成 prerender 接线 |
| `package.json` / `.env.example` | 加 `playwright-core`；加 `SSG_ENABLED` / `SSG_BASE_URL` / `SSG_CHROMIUM_PATH` / `SSG_SPA_DIST` |

**前端**

| 文件 | 动作 |
|---|---|
| `src/main.ts` | 改：判定逻辑抽成可导入的 `createEntryApp(el)`；`await router.isReady()` 后挂载 |
| `src/views/front/DynamicView.vue` | 改：就绪/失败信号 |
| `vite.config.ts` | 改：加 `ssgRoutesPlugin()` |
| `scripts/ssg-preview.mjs` | **新** S15 的预览服务器（复刻 nginx 优先级 + 旁路） |
| `vitest.config.ts` | **新** |
| `package.json` | 加 vitest / @vue/test-utils / happy-dom；加 `test` / `ssg:preview` |

**部署**

| `Dockerfile.single` | `apk add chromium nss freetype ttf-freefont` + `SSG_CHROMIUM_PATH` |
| `docker/nginx.single.conf` | §1.2 的 map + 四条 location |

---

## 2. 开发步骤

| # | 步骤 | 产出 | 覆盖 |
|---|---|---|---|
| 0 | **测试基建**：frontend 装 vitest/@vue/test-utils/happy-dom + `npm run test` + `vitest.config.ts`；写幂等种子脚本 `backend/scripts/seed-ssg-fixture.ts` | 能跑测试 | — |
| 1 | **dev(红)**：层 1/2 用例全部写出来跑全红；层 3 用 agent-browser 对现状取证截图 | 红清单 + 现状截图 | 全部 |
| 2 | 纯函数三件套 `ssgPaths` / `ssgSanitize` / `ssgManifest` | 层 1 #1–20 转绿 | S10 S11 S16 S18 E4 E5 E8 E9 E10 |
| 3 | 前端就绪信号 + `createEntryApp` 抽取 | 层 2 #24–28 转绿 | S2 S14 E6 |
| 4 | `BrowserPool` + `PrerenderQueue` | 层 1 #21–23 转绿 | E2 S14 |
| 5 | `PrerenderService` 编排（单页/栏目/首页/sitemap/全量 + manifest 读写） | — | S1 S3 S12 S13 |
| 6 | **hook 补洞**：`HTTPDelete` / `recomputeSubtree` / `CategoryModel.update` | — | S16 S17 S18 |
| 7 | `index.ts` 第 8 步接线 + 指纹冷启动 | 本地可用 | S6–S9 S13 |
| 8 | `ssgRoutesPlugin` → `dist/ssg-routes.json` | — | S4 |
| 9 | `scripts/ssg-preview.mjs` | `npm run ssg:preview` 可用 | S15 |
| 10 | nginx + Dockerfile | 生产可用 | E1 E7 |
| 11 | **层 3 动线全绿**，逐条截图 | 验收证据 | 全部 |
| 12 | 删 `StaticGenService`，更新 `docs/architecture.md` `backend.md` `development.md` | — | — |

步骤 6 有一个需要小心的地方：`recomputeSubtree` 的注释明确写了「派生值变化不是一次内容编辑」，刻意绕过 hook 以免污染版本快照和 `updated_at`。**这个判断对版本快照是对的，不能推翻。** 所以新 hook 用独立名字 `content.access_changed.*`，只有 SSG 订阅，`RevisionService` 不订阅——两个诉求各自成立，不互相牵扯。

---

## 3. 测试用例

### 层 1 — 纯函数（`bun test`，backend）

**`backend/test/ssgPaths.test.ts`**

| # | 用例名 | story |
|---|---|---|
| 1 | `articleRelPath 用栏目 slug 与文章 slug 拼出 a/<cat>/<slug>.html` | S1 |
| 2 | `articleRelPath 对无栏目文章回落 uncategorized` | — |
| 3 | `articleRelPath 保留中文 slug 原样，不做 percent-encode` | E5 |
| 4 | `shouldPrerenderArticle 仅在 status=visible 且 access_eff=public 时为真` | S10 |
| 5 | `shouldPrerenderArticle 对 auth/auth_teaser/restricted/restricted_teaser 四值一律为假` | S10 |
| 6 | `shouldPrerenderArticle 对未知 access_eff 为假（fail closed）` | S10 |
| 7 | `shouldPrerenderCategory 对空串与纯空格 list_template 为假` | E9 |
| 8 | `relPathToUrl 把 a/news/hello.html 还原成 /a/news/hello` | — |
| 9 | `relPathToUrl 把 index.html 还原成 /` | S3 |

**`backend/test/ssgSanitize.test.ts`**

| # | 用例名 | story |
|---|---|---|
| 10 | `移除 /@vite/client 的 script 标签` | E4 |
| 11 | `移除 #nprogress 残留节点` | E4 |
| 12 | `移除 PrimeVue toast / confirmdialog 的挂载容器` | E4 |
| 13 | `保留 /assets/*.js 的 module script（否则 SPA 起不来）` | S2 |
| 14 | `不改写相对 src / href（相对路径原样保留）` | E8 |
| 15 | `保留 <html data-ssg> 标记但清掉 data-ssg-ready` | S2 |

**`backend/test/ssgManifest.test.ts`**

| # | 用例名 | story |
|---|---|---|
| 16 | `文章 slug 变更 → 产出旧路径删除项 + 新路径写入项` | E10 |
| 17 | `文章转为非 public → 只产出删除项，无写入项` | S11 |
| 18 | `文章被删除（want=null）→ 产出删除项` | S16 |
| 19 | `栏目 slug 变更 → 其下每篇文章各产出一对「删旧/写新」` | S18 |
| 20 | `条目未变化 → 既不写也不删（避免全站无谓重写）` | — |

**`backend/test/ssgQueue.test.ts`**

| # | 用例名 | story |
|---|---|---|
| 21 | `同一 rel 在 debounce 窗口内入队三次只执行一次` | E2 |
| 22 | `队列串行执行，任意时刻并发数为 1` | E2 |
| 23 | `单个任务抛错后队列继续消费剩余任务` | S14 |

### 层 2 — 组件渲染（vitest + @vue/test-utils + happy-dom，frontend）

**`frontend/test/ssgReady.spec.ts`**

| # | 用例名 | story |
|---|---|---|
| 24 | `DynamicView 渲染成功后 <html> 带 data-ssg-ready` | S1 |
| 25 | `fetchedData.success=false 时打 data-ssg-error，不打 ready` | S14 E6 |
| 26 | `导航到新路由时先清掉 ready 属性再重新打` | E1 |

**`frontend/test/hydrateEntry.spec.ts`**

| # | 用例名 | story |
|---|---|---|
| 27 | `#app 有预渲染子节点时 createEntryApp 走 createSSRApp` | S2 |
| 28 | `#app 为空时走 createApp` | S2 |

> 这一层**测不到**样式是否生效、也测不到帧序列。happy-dom 不计算样式。S1「样式完整」和 S2「无空白帧」的红必须红在层 3。

### 层 3 — 动线（agent-browser，真浏览器）

前置：`backend/scripts/seed-ssg-fixture.ts` 种出

- 栏目 `news`（public，有 list_template）、`press`（public）、`inner`（restricted）、`bare`（public，list_template 为空）
- 文章 `hello`（news/public）、`world`（news/public）、`带图`（news/public，有 thumbnail）、`secret`（news，文章级 audience=authenticated）、`inner-doc`（inner）、`你好-world`（news/public）
- 用户 `member`（member 角色，对 `inner` 有 V 授权）

禁 JS harness（下称 **NOJS**）：

```bash
agent-browser batch --bail \
  '["open"]' \
  '["network","route","*","--abort","--resource-type","script"]' \
  '["navigate","<URL>"]' \
  '["screenshot","<path>"]' \
  '["get","text","body"]'
```

| # | 用例名 | 动线 | story |
|---|---|---|---|
| 29 | `禁JS-文章页-完整主题渲染` | NOJS 打开 `/a/news/hello` → 截图里有页眉页脚、有正文、**有配色与排版**（非白底裸 HTML） | S1 |
| 30 | `开JS-接管无空白帧` | `record start` 录像 → 打开 `/a/news/hello` → 逐帧检查，内容出现后不再有空白帧 | S2 |
| 31 | `禁JS-首页有文章列表` | NOJS 打开 `/` → 出现站点名 + hello/world 标题 | S3 |
| 32 | `禁JS-栏目页有列表` | NOJS 打开 `/a/news` → 出现栏目名 + 其下文章标题 | S3 |
| 33 | `禁JS-自定义路由页` | neo 主题下 NOJS 打开 `/about` → 出现关于页正文 | S4 |
| 34 | `登录用户先匿名后纠正` | 以 member 登录 → 打开 `/` → 首屏列表无 `inner-doc` → 等 SPA 接管 → 出现 `inner-doc` | S5 |
| 35 | `发布即生成` | 后台建文章点发布 → 等 3s → NOJS 打开其 URL → 出现正文 | S6 |
| 36 | `撤下即消失` | 同一篇改回 hidden → 等 3s → NOJS 刷新 → 正文消失 | S7 |
| 37 | `改标题即更新` | 标题改成 `Hello 2` 保存 → 等 3s → NOJS 刷新 → 屏幕上是 `Hello 2` | S8 E1 |
| 38 | `定时发布到点即生成` | 设 1 分钟后发布 → 等到点 → NOJS 打开 → 出现正文 | S9 |
| 39 | `非public永不落盘` | `secret` 发布后 → `ls ssg/a/news/` 无 `secret.html` → NOJS 打开其 URL → 正文一个字都没有 | S10 |
| 40 | `转受限即删文件` | `hello` 受众改 authenticated 保存 → 等 3s → NOJS 打开 → 正文消失 | S11 |
| 41 | `列表与sitemap只含public` | NOJS 打开 `/` → 无 `secret` 标题；打开 `/sitemap.xml` → 无 secret 的 URL | S12 |
| 42 | `冷启动全量生成` | `rm -rf backend/static/ssg` → 重启后端 → 日志出现 `full regenerate complete, N pages` → NOJS 打开首页与文章页都有内容 | S13 |
| 43 | `生成失败不挡发布` | `SSG_CHROMIUM_PATH` 指到不存在的路径 → 点发布 → 界面提示成功、文章变已发布 → 日志有 `[ssg]` 告警 → 开 JS 打开该页正常 | S14 |
| 44 | `一条命令生成并预览` | `npm run ssg:preview` → 输出 `generated N pages` + 地址 → NOJS 打开 `/a/news/hello` 有完整页面；打开 `/admin` 出现后台 | S15 |
| 45 | `删文章即删静态页` | 后台删除 `world` → 等 3s → NOJS 打开其 URL → 正文消失 | S16 |
| 46 | `栏目收紧即批量消失` | `news` 栏目受众改 restricted 保存 → 等 5s → NOJS 逐个打开 hello/world/带图 → **三个都**没有正文 | S17 |
| 47 | `栏目改名旧URL失效新URL生效` | `news` slug 改 `press2` → 等 5s → NOJS 打开 `/a/news/hello` 无正文；打开 `/a/press2/hello` 有正文 | S18 |
| 48 | `连续发布三篇不崩` | 快速连发 3 篇 → 三个 URL NOJS 都有各自内容 → `agent-browser errors` 空、后端进程存活 | E2 |
| 49 | `外部字体不可达也能5秒内生成` | `network route **fonts.googleapis.com** --abort` 等价的 hosts 屏蔽 → 点发布 → 5s 内日志报成功 → NOJS 打开内容完整 | E3 |
| 50 | `快照不含运行时垃圾` | `curl` 生成的 HTML → 不含 `/@vite/client`；NOJS 打开 → 顶部无卡住的 nprogress 进度条 | E4 |
| 51 | `中文slug可访问` | NOJS 打开 `/a/news/你好-world` → 出现正文 | E5 |
| 52 | `不存在的slug回落SPA` | NOJS 打开 `/a/news/nope` → 非 404；开 JS 刷新 → 出现 SPA 的「内容不存在」提示 | E6 |
| 53 | `后台页永不静态化` | `ls ssg` 无 admin/login/setup → 打开 `/admin` 正常且数据实时 | E7 |
| 54 | `换域名图片样式仍在` | 用局域网 IP NOJS 打开带图文章 → 封面图显示、页面有样式 | E8 |
| 55 | `无list_template栏目不生成` | NOJS 打开 `/a/bare` → 无列表内容；`ls ssg/a/` 无 `bare.html` | E9 |
| 56 | `改slug清旧文件` | `hello` → `hello-2` 保存 → NOJS 打开 `/a/news/hello` 无正文；`/a/news/hello-2` 有正文 | E10 |

**28 条动线用例。** 其中 29 / 30 / 34 / 54 这四条**只能**在真浏览器里判——它们分别依赖 CSS 是否生效、帧序列、登录态时序、跨域名相对路径解析，层 1/2 里怎么断言都是绿的。

---

## 4. dev(红) 的门禁

按纪律三条，红之前逐条确认：

1. **确认红的原因是对的。** 每条红都要跑一遍看报错：层 1 应该是 `Cannot find module '../app/lib/ssgPaths'`（功能没实现），不是 typo；层 3 应该是「截图白屏 / body 文本为空」，不是「agent-browser 连不上」。
2. **照用户动作写。** 动线用例里出现的每个 URL、每个选择器、每次点击，都要能对应到「用户在界面上做什么」。特别是 35–38、40、45–47 这几条，必须**真的在后台点发布/保存/删除**，不能直接改数据库——绕过 HTTP 就绕过了 hook，而 hook 接线正是本轮要修的东西，那样测出来的绿是假的。
3. **实现之后补的测试只防回归。** 层 1 的 20 条纯函数用例在步骤 2 之前必须已经写完并全红。

红清单会在 dev(红) 环节整理成表格呈递。

---

## 5. 与 spec 的偏差，需要你裁决

**偏差 1 — 加一个 `POST /api/system/ssg/regenerate` 端点（super_admin only，无 UI）。**

spec §5 写了「不做后台状态面板 / 手动重生成按钮」。但 S15 的 `npm run ssg:preview` 需要一个触发点：生成必须在后端做（要读库），而预览服务器在前端起。备选是写一个 `bun scripts/ssg.ts` 独立进程，但那会二次打开同一个 SQLite——正是 CLAUDE.md 坑 #2 点名的 `disk I/O error` 陷阱。

所以计划加这个端点：**只有 HTTP 接口，不加任何后台 UI**。「不做面板」的意图我理解是不做界面工程，端点是 15 行。如果你要的是连端点也不加，说一声，我改成让 `ssg:preview` 走「重启后端触发指纹全量」这条路（开发体感差一截）。

**偏差 2 — 新增 hook 名字进入公共契约。**

`content.removed.<table>` 与 `content.access_changed.<table>` 是两个新的 hook 名，第三方将来可以订阅。`content.access_changed` 刻意不叫 `content.saved`，因为 `RevisionService` 订阅了后者——混用会让改一次栏目受众就给整棵子树刷一堆版本快照。

**偏差 3 — S13 从「每次启动全量」改成「指纹变化才全量」。**

spec 的验收动线（删目录 → 重启 → 全量）仍然成立，但语义更准确：不删目录的普通重启不会白跑 20 分钟。

---

## 6. 风险

| 风险 | 处置 |
|---|---|
| chromium 在 alpine+bun 下的实际行为与 macOS 不同（沙箱、字体、共享内存） | 步骤 10 单独验一次 `docker build` + 容器内生成，不留到最后 |
| 全量重生成期间内存峰值与 bun 争抢 | 串行开页 + 每 N 页重启一次 browser；空闲 60s 关闭 |
| 主题在 `onMounted` 里做自己的异步取数，就绪信号早于它 | 已知缺口。本轮只保证「框架渲染完成」；主题若需延后，后续可开放一个 `context.ssgHold()` 契约。不在本轮范围，但要写进 knowledge |
| `agent-browser` 的 script abort 拦不住内联脚本 | 生成物里不应有有意义的内联脚本；用例 50 顺带验证 |
