# neo 主题「中国宝宝体质」改造 · 设计文档(待审)

> transport_theme 工作流第 3 步产出,**已过两轮用户修订**。审批通过后由第 5 步照此施工、第 6 步据此重做 demo 数据。
> 本文件本身**不改任何代码**;文中所有"改成/新增"都是待执行项。
>
> **第二轮修订要点**:① `MemberLayout` 改为**显式登记**进 `pages`(§1 / §7.4,理由=可读性);② §14 N1 定为**保留"参与作品"区块**;③ 后台编辑器自定义字段渲染定为**接线现成 `EditorPanel.vue`** 并顺手清掉 `thumbnailInput` 反模式(§5A.6A / §5A.7);④ 原 F3/R11 未知项(`article_data_fields` 取数途径)**已查实落为确定结论**(新增 §5A.7A)。
> **本节之后全文不再有待用户确认的悬空项**(§14)。

---

## 0. 范围与总原则

> ⚠ **本次不再是纯主题改动。** 除 `frontend_themes/neo/` 外,还包含**一处核心应用重构**:抽象通用 `FileUploader.vue` 组件并接入管理后台 4 处(§5A)。该部分**排在主题改造之前**施工(§16),因为主题的运营录入(成员社交二维码、站点级图片配置)依赖它才真正可用。

| 项 | 结论 |
|---|---|
| 主题 | `neo`(优化现有,非新建) |
| 定位/风格 | 不变 —— Neo-Brutalist 虚构工作室 ORBIT;3px 黑描边 + `8px 8px 0` 硬阴影 + 米色纸底 `#F4F1EA` + 朱红 `#D64933`;**无暗色模式** |
| 后端 | **零改动**(不加表、不加字段、不加端点、不动 `PREFETCH_APIS`)—— 含 `FileUploader` 部分,它只消费既有 `/api/upload` 与 `/api/attachment` |
| 核心应用前端 | **有改动**(§5A):新增 `frontend/src/components/FileUploader.vue`;改 `Files.vue` / `Editor.vue` / `EditorPanel.vue` / `Settings.vue` / `i18n.ts`。`router/index.ts`、`DynamicView.vue`、`theme-runtime.ts` 仍 **不动**;`frontend/index.html` 仅一行 preconnect |
| 新增能力 | ① 通用文件上传/选择器(管理后台,§5A) ② 社交矩阵国内化(7 项,含微信二维码弹层) ③ 成员个人主页(裸页,无 header/footer) |
| 顺手修 | 仅 3 项:分页进 URL · 响应式/样式泄露 · 补齐 `article_data_fields`(**注意**:第 3 项另有一个新发现的前置阻塞,见 §2.1 与 §5A.7) |
| 明确延后 | v-html 消毒(XSS)、字体自托管、公安网安备号、其余 P1/P2(见 §15) |

设计准则(沿用 patterns.md):**约定优于兜底** —— 每个展示位没有数据时**干净隐藏或明确空态**,绝不"抓别的顶上"、绝不假数据。

---

## 1. 信息架构表

| 页面 | 模板文件 | 路由 / 机制 | 数据来源 | 可配项 |
|---|---|---|---|---|
| 首页 | `DefaultHome.vue` | `/`,`config.home_template` | prefetch `categories` + 全站最新 `articles`;分区按 `list_template` 自动发现 | tagline / hero CTA |
| 作品列表 | `WorkGrid.vue` | `/a/works`,`category.list_template` | prefetch `articles`(按 `category_id`) | 分类 `data.description` |
| 作品详情 | `ProjectArticle.vue` | `/a/works/:slug`,`category.content_template` | `article` + `article.data` | — |
| 服务列表 | `ServiceList.vue` | `/a/services` | 同上 | 分类 `data.description` |
| 服务详情 | `DefaultArticle.vue` | `/a/services/:slug` | `article` | — |
| 团队列表 | `TeamGrid.vue` | `/a/team` | 同上 | 分类 `data.description` |
| **成员个人主页** | **`MemberPage.vue`**(新增) | **`/a/team/:slug`**,`category.content_template='MemberPage'` | `article`(成员) + `article.data` + prefetch `memberWorks` | 无(全部来自文章字段) |
| 动态列表 | `DefaultCategory.vue` | `/a/journal` | 同上 | 分类 `data.description` |
| 动态详情 | `DefaultArticle.vue` | `/a/journal/:slug` | `article` | — |
| 关于 | `AboutPage.vue` | `/about`(`pages.routes`) | 模板内 `getArticle(theme_neo_about_slug)` | about_slug / avatar |
| 联系 | `ContactPage.vue` | `/contact`(`pages.routes`) | 全部来自 config | email / phone / location |
| 通用外壳 | `Layout.vue`(改) | `layout:'Layout'` | prefetch `menus` | — |
| **裸页外壳** | **`MemberLayout.vue`**(新增) | `MemberPage` 声明 `layout:'MemberLayout'`;**`MemberLayout` 显式登记为 `pages.MemberLayout = {}`** | 仅用 `context.article` | — |

**成员页机制要点(第 2 步已核实,施工时按此写)**
- `router/index.ts:131-141` 从 templateName 沿 `pages[x].layout` 逐级上溯收集 `layouts[]`。机制上,一个 layout 只有在自己需要 `prefetch` 或 `title` 时**才必须**有 `pages` 条目;现有 `Layout` 登记的唯一原因就是挂 `menus` 预取(`theme.config.ts:72-75`)。
- **本设计定案:`MemberLayout` 仍然显式登记 `MemberLayout: {}`。** 理由是**可读性** —— `pages` 是这套主题布局链的唯一索引,布局出现在链上却不在索引里,后来人得先读懂 `router/index.ts` 的 `while` 循环才敢确认"这不是漏写"。用一行空条目换掉这份阅读负担是划算的。
- 两种写法**运行结果完全等价,一次预取也省不掉**:`{}` 既无 `prefetch` 也无 `layout`,循环进去一轮后走 `else` 分支置 `currentTemplate=''` 退出(`router/index.ts:138-140`);不登记则是 `pages[currentTemplate]` 取到 `undefined` 直接不进循环(`:131`)。省掉 `menus` 预取靠的是"`MemberLayout` 不继承 `Layout`",与"是否登记"无关。
- 附带收益:显式登记后**不再依赖"查表落空"这一条隐式终止路径**,走的是常规的"有条目、无 `layout` 字段 → 正常退出"分支。
- ⚠ **唯一真正的约束是一条禁令**:`MemberLayout` 的 `pages` 条目**绝不能带 `layout: 'Layout'`**,否则通用外壳会被套回来,`AHeader`/`AFooter` 全部回归,裸页设计失效。条目必须保持为空对象。
- `layouts = ['MemberLayout']`,通用 `Layout` 不介入(它只在显式 `layout:'Layout'` 时出现)。
- `MemberLayout.vue` **必须放主题根目录** —— 发现机制是 `import.meta.glob('./templates/*.vue')`(`DynamicView.vue:102`),只扫顶层 `.vue`。
- 必须渲染 `<slot/>`;`NestedLayouts` 以 `h(Comp, { context }, { default })` 挂载(`DynamicView.vue:22-33`)→ **layout 也能拿到完整 `context`**(含 `article`),返回链接无需硬编码。
- 附带好处:`layoutKey = layouts.join('>')` 变化 → 布局链重建(`DynamicView.vue:140-149`)→ 进出成员页时 `AHeader`/`AFooter` 真正卸载/重挂,不会残留。
- 后端模板决议:`article.content_template || category.content_template || 'DefaultArticle'`(`ArticleModel.ts:73`)。所以把 **team 分类的 `content_template` 改为 `MemberPage`** 即可,单篇仍可用文章级 `content_template` 覆盖。
- ⚠ 后端**不校验 `category_slug`**(`ContentController.ts:79-90`),`/a/任意/member-1` 都能打开成员页。**接受此现状**(与其他文章页同构,不额外治理)。

---

## 2. 分类约定表(5 个,id 为 demo 数据插入序)

| id | name | slug | weight | list_template | content_template | 变更 |
|---|---|---|---|---|---|---|
| 1 | 作品 | `works` | 10 | `WorkGrid` | `ProjectArticle` | 补 `article_data_fields`(+`members`) |
| 2 | 服务 | `services` | 20 | `ServiceList` | `DefaultArticle` | 补 `article_data_fields` |
| 3 | 团队 | `team` | 30 | `TeamGrid` | **`MemberPage`**(原 `DefaultArticle`) | 补 `article_data_fields` |
| 4 | 动态 | `journal` | 40 | `DefaultCategory` | `DefaultArticle` | 无 |
| 5 | 关于 | `about` | 50 | `DefaultCategory` | `DefaultArticle` | 无 |

`weight` 决定首页分区/导航顺序(小在前),不变。

### 2.1 `article_data_fields` 逐分类声明

⚠ 后台 `CategoryEditor.vue:111-116` 的字段类型**只有 4 种**:`text` / `textarea` / `number` / `attachment`(**没有 image**)。

> 🔴 **本轮复核发现的阻塞前提(修正第一版文档的错误陈述)**
> 第一版此处写"`attachment` 有真上传器(`EditorPanel.vue` → `Editor.vue`)"。**这是错的。** 实测:
> - `frontend/src/views/admin/EditorPanel.vue` **是孤儿组件 —— 全仓无人 import**(`grep -rn EditorPanel frontend/src` 零命中)。它内部的自定义字段渲染器(含 `:117` 的 attachment 隐藏 file input)和两个 `emit`(`upload-thumbnail` / `upload-attachment`)**没有任何接收方**。
> - `Editor.vue` 的 `form` 里**根本没有 `data` 字段**(`Editor.vue:30-32`:`category_id / content_template / is_top / title / slug / description / thumbnail / content`),全文也没有 `articleDataFields` / `form.data` 的任何引用。缩略图上传是 `Editor.vue` 自己内联的(`:293` 的 file input → `:182-202` `onThumbnailSelected`),与 `EditorPanel` 无关。
>
> **结论**:今天的文章编辑器**完全不渲染 `article_data_fields`**,任何类型的自定义字段都无法在后台录入。这意味着本设计里 `members` / `role` / `skills` / `social_*` **全部只能靠导入 demo 数据落库**,运营无法维护 —— §12.3"补齐 `article_data_fields`"这一修是**必要但不充分**的。
> **处置(用户已拍板,既定范围)**:把"让 `Editor.vue` 真正渲染自定义字段"并入 §5A 的核心应用批次(§5A.7 · §16 批次 A 第 3 步),**做法 = 接线现成的 `EditorPanel.vue`**(它的 UI 已写好,只是没接线),而不是在 `Editor.vue` 里重写一份。**这是本设计能否落地的前提,不是可选优化。** 接线时同步清掉 `thumbnailInput` prop 这个反模式(§5A.6A),取数途径见 §5A.7A。
> **顺带定案**:`social_wechat_qr` **仍用 `attachment` 类型** —— 不是因为"只有它有上传器"(该理由已被证伪),而是因为 `article_data_fields` 的类型枚举里**根本没有 `image`**(`CategoryEditor.vue:111-116`),`attachment` 是唯一能承载文件的选项。接入 `FileUploader` 后它会获得真上传器 + 文件库选择。

**works(id=1)**
```json
{
  "client":      { "title": "客户",     "type": "text" },
  "year":        { "title": "年份",     "type": "text" },
  "role":        { "title": "承担角色", "type": "text" },
  "tech":        { "title": "技术栈",   "type": "text" },
  "link_live":   { "title": "在线预览", "type": "text" },
  "link_source": { "title": "源码地址", "type": "text" },
  "gallery":     { "title": "图集(图片 URL,英文逗号分隔)", "type": "textarea" },
  "members":     { "title": "参与成员(成员文章 slug,英文逗号分隔,如 member-1,member-2)", "type": "text" }
}
```
**services(id=2)**
```json
{ "icon": { "title": "图标 Emoji(留空显示 ✦)", "type": "text" } }
```
**team(id=3)**
```json
{
  "role":              { "title": "职位",                    "type": "text" },
  "skills":            { "title": "技能标签(英文逗号分隔)",  "type": "text" },
  "social_github":     { "title": "GitHub 链接",             "type": "text" },
  "social_bilibili":   { "title": "哔哩哔哩链接",            "type": "text" },
  "social_douyin":     { "title": "抖音链接",                "type": "text" },
  "social_xiaohongshu":{ "title": "小红书链接",              "type": "text" },
  "social_zhihu":      { "title": "知乎链接",                "type": "text" },
  "social_email":      { "title": "邮箱",                    "type": "text" },
  "social_wechat_qr":  { "title": "微信二维码图片",          "type": "attachment" }
}
```
**journal(id=4) / about(id=5)**:模板不消费任何自定义字段 → **保持 `null`**。这是明确结论,不是遗漏;不发明无人消费的字段(违反"约定优于兜底")。

> **头像不新增字段**:沿用内置 `article.thumbnail`(编辑器自带上传器,`TeamGrid` 已在用)。避免"avatar 与 thumbnail 两个真源"。

---

## 3. `article.data` 字段约定(消费方)

`article.data` 由 DYAPI 在读取时 `JSON.parse`(`dyapi/core/model.js:139-154`,try/catch 吞错)。三态实测:`{...}` → 对象;DB 存字面文本 `"null"` → `null`;空串 `""` → 原样 `""`。**模板一律 `a.data?.x`,且 MemberPage 用**
```ts
const d = computed<any>(() => (article?.data && typeof article.data === 'object' ? article.data : {}));
```
兜住 `""` 的情况(对 `""` 取 `?.x` 会得到 `undefined`,不报错,但 `computed` 归一后更省心)。

| 分类 | 键 | 含义 | 示例 | 消费方 | 空时表现 |
|---|---|---|---|---|---|
| works | `client` / `year` / `role` / `tech` | 项目元信息 | `Aurora 咖啡` / `2026` | `WorkGrid` `ProjectArticle` | 该行隐藏 |
| works | `link_live` / `link_source` | 外链按钮 | `https://…` | `ProjectArticle` | 按钮隐藏 |
| works | `gallery` | 图集 | `url1,url2` | `ProjectArticle` | 图集区隐藏 |
| works | **`members`** | 参与成员 slug | `member-1,member-3` | **`MemberPage`(反查)** | 该作品不出现在任何成员页 |
| services | `icon` | Emoji | `🎨` | `ServiceList` | 显示 `✦` |
| team | `role` | 职位 | `创始人 / 设计负责人` | `TeamGrid` `MemberPage` | 隐藏 |
| team | `skills` | 技能标签 | `品牌,UI,策略` | `TeamGrid` `MemberPage` | 标签区隐藏 |
| team | `social_*` | 各平台链接 | `https://space.bilibili.com/…` | `MemberPage`(经 `Socials`) | 该图标不渲染 |
| team | `social_wechat_qr` | 二维码图片 URL | `/static/uploads/ab12.png` | `MemberPage` | 微信按钮不渲染 |

**删除**:`team` 的 `social_x`(X/Twitter)—— demo 数据里一并去掉。

### 3.1 作品 ↔ 成员反查(方案 A,已实测)

> **先说清"参与作品"的数据从哪来 —— 这是一项持续性运营成本,请据此判断该区块是否值得保留。**
>
> | 问题 | 回答 |
> |---|---|
> | 数据源 | **works 分类新增的 `article_data_fields` 字段 `members`**:逗号分隔的成员文章 slug,如 `member-1,member-3` |
> | 谁填 | **运营在每一篇作品的编辑页手工填写**。不是自动推导,没有任何后台任务会补它 |
> | 何时填 | 每次新建/编辑作品都要维护一次;成员离职或改 slug 时要回头改所有相关作品 |
> | 不填的后果 | 该作品不出现在任何成员页;某成员一条都没有 → 该成员页的"参与作品"**整段不渲染**(不显示"暂无作品") |
>
> **为什么不能自动关联(已论证,非偷懒)**
> 1. 文章的 `author_id` 指向**登录用户**(`users` 表),而团队成员在本设计里是 **team 分类下的文章**。两者不是同一实体,数据库层没有任何关联。
> 2. 成员的头像/职位/技能都存在成员**文章**的 `data` 里,用户表拿不到 —— 即便按 `author_id` 反查,也只能拿到用户名,渲染不出成员卡。
> 3. 要做到自动关联,必须让"成员 = 真实用户"(给 `users` 加 profile 字段或建成员表 + 关联表),属**后端改造**,**第 2 步已否决**(本次后端零改动)。
>
> ⚠ **这是本方案唯一的持续性运营录入成本。** 其余所有内容(社交链接、技能、简介)都是"填一次就长期有效"的静态资料;只有 `members` 需要随作品增删而持续维护。
> ✅ **用户已在第二轮拍板:该区块保留**,这项成本被接受(§14 #7)。留档:若将来改主意,删掉 `members` 字段 + `MemberPage` 的 `memberWorks` prefetch + §8.2 ④ 区块即可,其余设计不受影响。
> **前置依赖**:运营要能填这个字段,必须先完成 §5A.7(让文章编辑器真正渲染自定义字段)—— 见 §2.1 的红框。

`MemberPage` 的 prefetch:
```ts
prefetch: [
  { key: 'memberWorks', api: 'contentAPI.listArticles',
    args: [{ filter: { data: { $contains: '$data.article.slug' } },
             orderBy: 'published_at', orderDesc: true, page: 0, limit: 24 }] },
]
```
硬约束与理由:
1. **必须用整列 `data` 做 LIKE,不要写 `data.members` 点号路径**。实测地雷:只要 `articles` 表存在任意一行 `data=''`,`json_extract` 就抛 malformed JSON,**整条查询失败**;而 prefetch 的 catch 会把失败静默变成"这一区空着",极难排查。整列 LIKE 是纯文本比较,不受影响。
2. prefetch 参数注入**递归进嵌套对象**(`router/index.ts:182-190`),`$data.article.slug` 在 prefetch 执行前已就位(实体取用 `:107` 早于 prefetch `:124`)。
3. `listArticles` 的 `limit` 被服务端**硬顶 50**(`ContentController.ts:103`),24 安全。

**两处客户端收尾(必写)**
```ts
const works = computed(() => (context.memberWorks || []).filter((w:any) =>
  w?.category?.list_template === 'WorkGrid' &&                        // ② 只保留作品(富化文章自带 category)
  String(w?.data?.members || '').split(',').map(s => s.trim()).includes(article?.slug)  // ① 精确复筛
));
```
- ① `$contains` 是 LIKE:`member-1` 会误命中 `member-10`,必须精确复筛。
- ② 顺带滤掉非作品(万一别的分类文章的 data 里出现了该 slug)。用 `list_template` 判定而**不需要 works 分类 id** —— 因为配置派生的数据进不了 prefetch args。

---

## 4. `configSchema` 最终 key 全集

改 `theme.config.ts` 的 `configSchema`。key 规则 `^theme_[a-z0-9]+_[a-z0-9_]+$`(后端 `isThemeConfigKey` 放行);`type` 可选值仅 `'text' | 'textarea' | 'number' | 'image'`(`theme-runtime.ts:64`)。

| # | key | label | type | group | hint / placeholder | 状态 |
|---|---|---|---|---|---|---|
| 1 | `theme_neo_hero_cta_text` | 首页 CTA 文案 | text | 首页 | ph: `查看作品` | 保留 |
| 2 | `theme_neo_hero_cta_link` | 首页 CTA 链接 | text | 首页 | ph: `/a/works` | 保留 |
| 3 | `theme_neo_nav_cta_text` | 导航 CTA 文案 | text | 导航 | hint: 留空则不显示导航按钮。 | 保留 |
| 4 | `theme_neo_nav_cta_link` | 导航 CTA 链接 | text | 导航 | ph: `/contact` | 保留 |
| 6 | `theme_neo_about_slug` | 关于页文章 slug | text | 关于 | ph: `about` | 保留 |
| 7 | `theme_neo_contact_email` | 联系邮箱 | text | 联系 | hint: 联系页表单的收件地址(mailto),也是页眉页脚邮件图标的地址。 | 保留 |
| 8 | `theme_neo_contact_phone` | 联系电话 | text | 联系 | — | 保留 |
| 9 | `theme_neo_contact_location` | 所在地 | text | 联系 | ph: `上海` | 保留 |
| 10 | `theme_neo_social_github` | GitHub | text | 社交 | ph: `https://github.com/…` | 保留 |
| 11 | **`theme_neo_social_bilibili`** | 哔哩哔哩 | text | 社交 | ph: `https://space.bilibili.com/…` | **新增** |
| 12 | **`theme_neo_social_douyin`** | 抖音 | text | 社交 | ph: `https://www.douyin.com/user/…` | **新增** |
| 13 | **`theme_neo_social_xiaohongshu`** | 小红书 | text | 社交 | ph: `https://www.xiaohongshu.com/user/profile/…` | **新增** |
| 14 | **`theme_neo_social_zhihu`** | 知乎 | text | 社交 | ph: `https://www.zhihu.com/people/…` | **新增** |
| 15 | **`theme_neo_social_wechat_qr`** | 微信公众号 / 个人二维码 | image | 社交 | hint: 站点级二维码,访客点击图标弹出。留空则不显示微信图标。 | **新增** |
| 16 | `theme_neo_footer_note` | 页脚附言 | text | 页脚 | ph: `Made with care.` | 保留 |

**共 16 项。** 两条 `image` 类型的 hint(#5 `theme_neo_avatar`、#15 `theme_neo_social_wechat_qr`)第一版里是"请先到 /admin/files 上传,再把 `/static/uploads/xxx.png` 粘到此处(文件页没有复制链接按钮,点开图片从地址栏拷)"这种又长又窝囊的操作说明 —— **接入 §5A 的 `FileUploader` 后,`image` 类型在"设置 → 主题设置"里获得真上传器 + 文件库选择,这两条 hint 简化为正常的功能说明**。这是 §5A 对本节的直接收益回填。

---

## 5. 菜单 location 约定

不变,demo 数据保持:
- `header`(主导航):作品 `/a/works` · 服务 `/a/services` · 团队 `/a/team` · 动态 `/a/journal` · 关于 `/about` · 联系 `/contact`
- `footer`:作品 · 服务 · 关于 · 联系(`AFooter` 会把一层 children 拍平)
- `top` / `quicklinks`:本主题**不消费**,demo 不生成。
- 自定义路由页:仅 `/about`、`/contact`(不做 `/search`)。**成员页不新增自定义路由**,走 `/a/team/:slug`。

---

## 5A. 通用 `FileUploader` 组件(核心应用改动,**排在主题改造之前**)

> 本节是本轮新增。它**不在 `frontend_themes/neo/` 内**,属核心应用重构。用户已拍板:**先做组件,再做主题**。
> 动机:全仓有 3 处各写一遍 FormData 上传、1 处孤儿实现、1 处**根本没有上传器**;而主题的图片类配置(`theme_neo_avatar` / `theme_neo_social_wechat_qr`)与成员二维码字段全都落在最缺的那一处。

### 5A.1 现状盘点(已逐处复核,行号为本轮实测)

| 位置 | 现状 | 处置 |
|---|---|---|
| `frontend/src/views/admin/Files.vue:69-91` + `:128-131` | 自拼 FormData(`:74-77`)、`uploadAPI.upload`(`:80`)、多选上传;`uploading` 态自己管 | 换 `FileUploader`(button 模式) |
| `frontend/src/views/admin/Editor.vue:182-202` + `:293` | 缩略图上传,第二遍自拼 FormData(`:187-188`);file input 内联在 Editor 自己的模板里 | 换 `FileUploader`(field 模式) |
| `frontend/src/views/admin/Editor.vue:168-179` | `onUploadImg` —— md-editor-v3 的 `@onUploadImg` 回调(`:240`),第三遍自拼 FormData | **保留回调**(它是 md-editor 的契约,不是 UI 控件),但改用共享的 `uploadAPI.uploadFiles()`(§5A.3) |
| `frontend/src/views/admin/EditorPanel.vue:56` 与 `:117` | 两个隐藏 file input,靠 `emit('upload-thumbnail')` / `emit('upload-attachment')` 冒泡。**但该组件全仓无人 import** —— emit 没有接收方,整份是死代码(详见 §2.1 红框) | 先接线进 `Editor.vue`(§5A.7),再把两个 input 换成 `FileUploader`,**两个 emit 与 `thumbnailInput` prop 一并删除** |
| `frontend/src/views/admin/Settings.vue:331-337` | **没有上传器**:`image` 类型走 `:334` 的 `<InputText>`(手贴 URL)+ `:335` 一个只读 `<img>` 预览 —— **真缺口** | 加 `FileUploader`(field 模式) |

**明确排除:`frontend/src/views/setup/SetupWizard.vue`**(`:24-54` + `:162` 的 file input)。
理由:① 它是 `await file.text()`(`:37`)**在本地读 JSON 文本**再随 `systemAPI.setup` POST,**从不上传文件**,全文无 `FormData`、无 `uploadAPI`;② 它发生在创建管理员**之前**,无 token,`/api/upload` 受 RBAC 管控根本调不通;③ 它的语义是"导入数据",不是"选一个附件"。**只是长得像 file input,施工时不要误并。**

### 5A.2 落点与组成

| 文件 | 职责 |
|---|---|
| `frontend/src/components/FileUploader.vue` | 字段控件:预览 + 「上传新文件」/「从文件库选择」/「移除」 |
| `frontend/src/components/FilePicker.vue` | 文件库选择弹层(分页 + 搜索),**照 `components/UserPicker.vue` 的模式写**(同为"分页搜索选择器 + `visible`/`select` 契约") |

与 `AclEditor.vue` / `UserPicker.vue` 同级同风格:`<script setup lang="ts">`、PrimeVue `unstyled` + `frontend/src/ui/presets.ts`(`BTN` / `INPUT_CLASS`)、Lucide 图标、`useToast` 报错、`$t()` 出文案。

### 5A.3 先落一个共享上传函数(消掉 4 处 FormData)

`FormData` 的拼装是**语义封装**,归 `frontend/src/api.ts`(CLAUDE.md:api.ts 只放 axios 实例 + 拦截器 + 接线 + **语义封装**)。在 `uploadAPI`(`api.ts:146-153`)里加一项:

```ts
export const uploadAPI = {
  getList: (params: ReadQuery = {}) => listAttachment(params),
  // axios sets the multipart boundary itself when the payload is a FormData.
  upload: (formData: FormData) => uploadUploadFile(formData),
  /** Build the multipart body for you — the only place that knows the 'file' field name. */
  uploadFiles: (files: File[] | FileList) => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('file', f));
    return uploadUploadFile(fd);
  },
  remove: (id: number) => uploadDeleteFile(id),
  // …
};
```
返回形状(`api.gen.ts:953`):`{ code, data: any[] }`,每项是 attachment 行(`url` / `filename` / `size` / `mime_type` / `id`)。落盘 `backend/static/uploads/`,公开 URL `/static/uploads/<hex>.<ext>`。
保留 `upload(formData)` 原样(向后兼容,且 `uploadFiles` 内部就走它)。

### 5A.4 `FileUploader.vue` 契约

```ts
const props = withDefaults(defineProps<{
  /** Bound URL(s). string when multiple=false, string[] when multiple=true. Unused in mode='button'. */
  modelValue?: string | string[];
  /** 'field' = preview box + actions (default). 'button' = bare upload button, no preview, no v-model write. */
  mode?: 'field' | 'button';
  multiple?: boolean;                    // default false
  accept?: string;                       // e.g. 'image/*'; '' = any
  /** Offer the "choose from library" path. Default true. */
  library?: boolean;
  /** Preview size. 'lg' = 16:9 dropzone (thumbnail), 'md' = 96px square, 'sm' = one-line row. */
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  /** Override the button label; defaults to $t('action.upload'). */
  label?: string;
}>(), { mode: 'field', multiple: false, library: true, size: 'md', disabled: false });

const emit = defineEmits<{
  (e: 'update:modelValue', v: string | string[]): void;
  /** Raw attachment rows just uploaded or picked — for callers needing id/filename (Files.vue refresh). */
  (e: 'uploaded', rows: any[]): void;
}>();
```

**行为规则**
| 场景 | 行为 |
|---|---|
| `multiple=false` 上传/选中 | `emit('update:modelValue', rows[0].url)` —— 只取第一个 |
| `multiple=true` 上传/选中 | **追加**:`emit('update:modelValue', [...(modelValue as string[] ?? []), ...rows.map(r => r.url)])` |
| `mode='button'` | 不读不写 `modelValue`,只 `emit('uploaded', rows)`;渲染单个 `BTN.primary` 按钮 |
| 上传中 | 内部 `uploading` ref → 按钮 `disabled` + 文案切 `$t('fileUploader.uploading')`;**不向外暴露 loading prop**(调用方不必再自己管一个 `uploading`) |
| 上传失败 | `try/catch` + `toast.add({ severity:'error', … })`,`modelValue` 不变;`finally` 里清空 `input.value`(否则同一文件二次选择不触发 `change`) |
| `disabled` | 按钮与拖放区均禁用,预览仍显示 |
| 移除 | field 模式下预览旁一个「移除」;**走全局 `useConfirm`**(`frontend/src/main.ts` 已装 `ConfirmDialog`),**不用原生 `confirm()`**。仅清空绑定值,**不删服务器文件**(删文件是 `/admin/files` 的职责) |
| 预览类型判定 | 复用现成正则 `/\.(jpg\|jpeg\|png\|gif\|webp\|svg)$/i`(`EditorPanel.vue:108`)→ 图片出 `<img>`,否则出 `LucideFile` + 文件名 + 可点链接 |
| 空态 | field 模式出虚线 dropzone(沿用 `EditorPanel.vue:54-64` 的观感:`border-2 border-dashed` + hover `border-apple-blue`),内含两个动作 |

**为什么用 `v-model` 而不是 `emit('change', url)`**:四处接入点都是"把一个 URL 存进某个响应式字段"(`form.thumbnail` / `form.data[key]` / `themeConfig[key]`),`v-model` 让接入点变成一行,且天然支持 `v-model="form.data[field.key]"` 这种索引绑定。

### 5A.5 `FilePicker.vue` 契约(照 `UserPicker.vue`)

```ts
const props = defineProps<{ visible: boolean; accept?: string; multiple?: boolean }>();
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void;
  (e: 'select', rows: any[]): void;      // 数组:multiple 时可多选,单选时长度 1
}>();
```
- 数据:`uploadAPI.getList({ page, limit: 12, filter, orderBy:'id', orderDesc:true })` —— 与 `Files.vue:34-44` 同一套参数;搜索用 `filter = { $or: { filename: { $contains: q } } }`(抄 `Files.vue:26-32`)。
- 分页:`page` 0-based + `total` 算总页数,`prev`/`next` 两个按钮 —— 与 `UserPicker.vue:19-34` **同构**。
- `watch(() => props.visible)` 打开时重置 `q`/`page` 并 `load()`(`UserPicker.vue:40`)。
- 布局:网格缩略图(图片出 `<img>`,其余出 `LucideFile`),点一项即 `emit('select', [row])` 并关闭;`multiple` 时点选累积、底部「确定」提交。
- `accept` 只做**客户端软过滤**(按 `mime_type` 前缀),不改服务端查询 —— 后端 `listAttachment` 没有 mime 过滤参数,不为此改后端。
- 遮罩 `fixed inset-0 z-[60]` + `@click.self="close"`,与 `UserPicker.vue:44` 一致。

### 5A.6 四处接入的逐处改法

**① `Files.vue`(button 模式)**
- 删:`fileInput` ref(`:17`)、`uploading` ref(`:15`)、`handleUpload`(`:69-91`)、`triggerUpload`(`:105-107`)、模板里的 `<input type="file">`(`:128`)与 `<Button>`(`:129-131`)。
- 加:`<FileUploader mode="button" multiple :library="false" @uploaded="onUploaded" />`(`library=false`:文件库页自己就是文件库,再给"从文件库选择"是循环)。
  ```ts
  const onUploaded = async () => { lazyParams.value.page = 0; await fetchFiles(); };
  ```
- **顺带补上真正的缺口 —— 「复制链接」按钮**:`Files.vue:149-156` 的 hover 浮层现在只有「新窗口打开」(`:150` `openUrl`)和「删除」。加第三个按钮 `LucideLink` → `navigator.clipboard.writeText(file.url)` + toast `$t('fileUploader.copied')`。
  ⚠ `navigator.clipboard` 需要安全上下文(https 或 localhost);`catch` 里降级为 toast 提示 + 把 URL 填进一个只读 `InputText` 供手工选取。**这条是"运营拿不到已有文件 URL"的根因修复**,与 `FileUploader` 的库选择互补(一个给字段用,一个给贴到别处用)。
- **顺带合规**:`Files.vue:94` 的原生 `confirm('确定要彻底删除该文件吗？')` 换成全局 `useConfirm`(CLAUDE.md 明令"确认框用全局 `ConfirmDialog`,不要用原生 `confirm()`")。既然已经在改这个文件,一并修。

**② `Editor.vue` 缩略图(field 模式)**
- 删:`thumbnailInput` ref(`:181`)、`onThumbnailSelected`(`:182-202`)、模板 `:291-296` 的整块内联 dropzone + file input。
- 加(在 `Editor.vue` 的侧栏,或随 §5A.7 一起整体移交 `EditorPanel`):
  ```html
  <FileUploader v-model="form.thumbnail" accept="image/*" size="lg" />
  ```
- 净效果:Editor 不再持有任何 file input 引用。

**③ `EditorPanel.vue` 的 attachment 字段 + 缩略图(事件链塌缩)**
- 前提:先做 §5A.7 让这个组件真的被用起来。
- 缩略图分支(`:50-71`)→ `<FileUploader v-model="form.thumbnail" accept="image/*" size="lg" />`。
- attachment 分支(`:105-120`)→ `<FileUploader v-model="form.data[field.key]" size="sm" />`(不限 `accept`,附件可以是任意文件)。
- **事件链怎么简化**:今天是 `EditorPanel` 里的隐藏 input → `emit('upload-thumbnail' | 'upload-attachment', …)` → 父组件 `Editor.vue` 里的 handler 拼 FormData、调 API、写回 `form`;父组件还得把 `thumbnailInput`(一个 DOM ref!)**当 prop 传下去**(`EditorPanel.vue:12`)。
  接入后:**`defineEmits` 整块删除**,`defineProps` 里的 `thumbnailInput` 删除,父组件不再需要任何 upload handler —— 因为 `FileUploader` 自己完成"选文件 → 上传 → 写回 `v-model`",而 `form` 本身是引用传递的 prop(`props.form`),写入直接生效。**一条 prop + 两个 emit + 两个父级 handler 全部消失。**

**④ `Settings.vue` 的 `image` 分支(field 模式)**
- 改 `:331-337` 的字段渲染,给 `image` 单独一支(放在 `textarea` 之后、`InputText` 兜底之前):
  ```html
  <FileUploader v-if="f.type === 'image'" v-model="themeConfig[f.key]" accept="image/*" size="md" />
  ```
- 删 `:335` 那个只读 `<img>` 预览(`FileUploader` 自带预览)。`text`/`number`/`textarea` 三支不动。
- `themeConfig` 是 `ref<Record<string,string>>`,`v-model="themeConfig[f.key]"` 的索引写入在 Vue 3 下正常响应;保存路径不变(`:181` 起把 `themeConfig` 并进 `saveConfig` 载荷)。
- **这一处直接兑现 §4 的收益**:`theme_neo_avatar` / `theme_neo_social_wechat_qr` 两条 hint 从"去 /admin/files 上传再回来粘 URL"简化为正常说明。

### 5A.6A 设计判断:接线 `EditorPanel` **不是原样接,而是接线同时清掉一个反模式**

`EditorPanel.vue:8-13` 的 `defineProps` 里有一项:

```ts
thumbnailInput: HTMLInputElement | null;   // ← 父组件要把一个 DOM ref 当 prop 传下来
```

**这是一个从未被现实校验过的接口设计。** 该组件全仓无人 import(§2.1 红框),所以这条 prop 从来没有真正的调用方 —— 它只是作者当初"想象中的父子分工"留下的化石。它的问题是结构性的:

1. **方向倒置**:DOM ref 天然属于**声明该 DOM 的组件**。这里 `<input>` 写在 `EditorPanel` 自己的模板里(`:56`),ref 却要求父组件持有并回传 —— 把子组件的实现细节漏成了父子契约。
2. **强耦合三件套**:一条 prop(`thumbnailInput`)+ 两个 emit(`upload-thumbnail` / `upload-attachment`)+ 父组件两个 handler,只为完成"选文件 → 上传 → 写回 `form`"这一件事,而这件事**完全可以在一个组件内闭合**。
3. **类型上是个陷阱**:`HTMLInputElement | null` 让父组件不得不声明一个与自己模板无关的 ref,`vue-tsc` 也无法帮你发现它其实没被用对。

**处置(已批准,不是可选项)**:接线时**顺势删掉这条 prop**,缩略图与 attachment 两处改由 §5A 的 `FileUploader` 自管(见 §5A.6 接入点 ② 与 ③)—— `FileUploader` 内部持有自己的 file input,对外只暴露 `v-model`。净效果:

| 接线前(设想的契约) | 接线后 |
|---|---|
| `thumbnailInput` prop(DOM ref) | **删除** |
| `emit('upload-thumbnail')` | **删除** |
| `emit('upload-attachment')` | **删除** |
| 父组件 2 个 upload handler | **删除**(`Editor.vue` 不再持有任何 file input 引用) |
| `EditorPanel` 的 `defineEmits` 整块 | **删除** |

保留的 props 只剩三项真正的数据契约:`form` / `categoryOptions` / `articleDataFields`(`EditorPanel.vue:9-11`)。
⚠ **施工时不要"忠实还原"这个组件的原有接口** —— 它没有存量调用方,不存在向后兼容义务;照原样接反而是把一个未经检验的反模式固化下来。

### 5A.7 前置阻塞:让 `Editor.vue` 真正渲染自定义字段(**用户已批准的既定范围,必做**)

见 §2.1 红框。用户已在第二轮拍板:**修,且做法是接线现成的 `EditorPanel.vue`**(而非在 `Editor.vue` 里另写一份自定义字段渲染器)—— 理由是 `EditorPanel` 的 UI 已经写好,缺的只是接线;重写等于第二份实现。`FileUploader` 接进 `EditorPanel.vue` 的 attachment 分支**只有在这个组件被真的用起来之后才有意义**。

> #### 📌 历史来源:这块接线**曾经存在过**,有可直接参照的实现
>
> 用户指出"之前明明接进去了",已查实无误:
> - `dd1707a`(2026-07-16 `feat: 很多新内容`)的 `Editor.vue` **确实 `import` 并使用了 `EditorPanel`** —— 是全部历史提交中唯一的命中。
> - 接线在 **`2d5b5c3`**(同日 `merge: integrate upstream (storage/themes/settings/pack/pinia) onto RBAC+lifecycle base`)**丢失**。不是主动重构删的,而是那次合并里 upstream 侧的 `Editor.vue` 没有这块,整块被上游版本覆盖 —— 而同一次合并带来的正是生命周期重构。
>
> **施工时用 `git show dd1707a:frontend/src/views/admin/Editor.vue` 作参照实现**(它已含 `form.data`、`articleDataFields` computed、加载时的 `data` 归一、以及在侧栏 + 移动抽屉**两处**渲染 `EditorPanel`),比从零写风险低得多。
>
> **但必须是选择性移植,不是 revert** —— 三处偏差:
> 1. 那版仍在用已废弃的 **`visible`** 字段(早于生命周期重构)。现在是 `status`/`publish_at` 三态,**不要把 `visible` 一起带回来**。
> 2. 那版取分类用 `crudAPI.getList('categories')`;**现在必须沿用 `lifecycleAPI.manageableCategories`**(见 §5A.7A 已查实它同样返回 `article_data_fields`)。跟着历史版本退回 `crudAPI` 会让受限用户看到自己无权管辖的分类 —— 属权限回退。
> 3. 那版的 `data` 归一含死代码:`item.data && typeof item.data === 'object' ? (typeof item.data === 'string' ? JSON.parse(...) : item.data) : {}` —— 外层已要求 `typeof === 'object'`,里层 string 分支永不可达。行为结果正确(对象则用、其余归 `{}`),照下面第 2 步写干净的即可。
>
> 另:那版的 `articleDataFields` computed 对 string/object/null 三态的处理与 §5A.7A 独立得出的写法基本一致 —— 算是对该设计的反向印证。

改法:

1. `Editor.vue:30-32` 的 `form` 加一项:`data: {} as Record<string, any>`。
2. `loadArticle` 里回填并归一三态(§3 已论证 `data` 可能是对象 / `null` / `''`):
   ```ts
   form.value.data = (item.data && typeof item.data === 'object') ? item.data : {};
   ```
3. 保存载荷带上 `data`(`createArticle` / `updateArticle` 都走同一个 `form` 快照)。
4. 派生字段定义:从当前选中分类的 `article_data_fields` 转成 `{ key, title, type }[]`(即 `EditorPanel.vue:11` 的 `articleDataFields` prop 形状;转换逻辑可参考反向操作 `CategoryEditor.vue:131-155`)。**取数途径已定,见 §5A.7A —— 复用 `Editor.vue:51` 现有那次请求,零额外请求、零后端改动。**
5. `import EditorPanel from './EditorPanel.vue'`,在侧栏渲染它,替掉 Editor 自己内联的分类/模板/缩略图那几块(EditorPanel 已经覆盖了这些)。**注意是"替掉"而非"并列"**,否则同一字段出现两次(见 §5A.9 F5)。

   > ##### ⚠️ 顺带修掉一个当前存在的真实故障:窄屏下**无法保存新文章**
   >
   > 同一次 `2d5b5c3` 合并还丢掉了移动端属性抽屉。现状:
   > - `Editor.vue:244` 的属性侧栏是 `hidden lg:block`,**无任何移动端替代入口**;
   > - `form.category_id` 在整个模板里**只出现于该侧栏内**(`:248`);
   > - 而 `:85` 把 `Number(form.category_id) === 0` 当作校验错误拦下保存。
   >
   > → **窗口宽度 < `lg`(1024px) 时,分类无法设置,新文章根本存不出去**;缩略图 / `content_template` / 置顶同样够不着。
   >
   > `dd1707a` 版有完整的移动抽屉(`Teleport` + `Transition` + `showMobilePanel`/`isMobile`,第二处 `EditorPanel` 挂在里面,带 `article.properties` 标题与关闭按钮),可直接参照移植。
   >
   > 这正是把字段渲染收进 `EditorPanel` 的结构性收益:**一个组件、两个挂载点**,不必维护两份表单。接线时一并做,增量只是一个开关按钮 + 抽屉容器。
   > **范围提示**:此项超出"渲染自定义字段"的字面需求,属顺带修复,已在报告中向用户显著标注。
6. 切分类时字段定义要跟着变 —— **不需要 `watch`,也不需要重新拉接口**:§5A.7A 的 `articleDataFields` 是随 `form.category_id` 重算的 `computed`,天然满足,且**天然不会清空 `form.value.data` 里已有的键**(切错分类再切回来不丢数据;多余的键留在 `data` 里无害,前台按键名取用)。

**验收**:给 team 分类配好 §2.1 的 9 个字段 → 新建/编辑一篇 team 文章 → 侧栏出现 9 个输入,其中"微信二维码图片"是 `FileUploader`;保存后重新打开值仍在;`/a/team/<slug>` 前台能读到。

### 5A.7A `article_data_fields` 取数途径(原 F3 未知项 —— **本轮已查实,不留给施工**)

**结论:直接复用 `Editor.vue:51` 已有的那次 `lifecycleAPI.manageableCategories` 请求,它本来就返回完整的 category 行,含 `article_data_fields`。** 不新增请求、不换接口、不动后端。

**证据链(读后端源码即可定论,无需发 HTTP 请求)**

| # | 事实 | 证据 |
|---|---|---|
| 1 | 该列在模型里声明为 `DataType.Object` | `backend/app/models/CategoryModel.ts:24` — `F.Object("article_data_fields")` |
| 2 | 端点取数用的是**裸 `read()`**,且**没有传 `fields` / `hideFields` / `select` / `pops`** → 返回**整行全字段** | `backend/app/controllers/ContentLifecycleController.ts:92` — `const all = await this._app.I(CategoryModel).read({ limit: 100000, orderBy: "weight" });` |
| 3 | **不存在字段级裁剪**:`Model.read()` 只在调用方显式传 `param.hideFields` 时才删字段;它是 CLAUDE.md 所说的"裸方法",不经 RBAC / 字段级权限 | `dyapi/core/model.js:155-162`(`if (param.hideFields)`);字段级权限属 `HTTP*` 路径,此处未走 |
| 4 | 响应体原样透出,控制器不做二次投影 | `ContentLifecycleController.ts:93-94` — `all.filter(...)` 后直接 `return { code: 200, data: { scope, categories } }` |
| 5 | `read()` 会把 Object 型的字符串列 **`JSON.parse`** 后再返回(try/catch 吞错) | `dyapi/core/model.js:146-152` |

> 附注:`manageableCategories` 只按 `policy.manageableArticleCategories` 的结果**过滤行**(`:93`),从不裁字段。所以 `super_admin`(`scope==='any'`)与受限用户拿到的**字段集合完全一致**,只是行数不同。

**字段形态(到前端手上长什么样)—— 三态,必须兜住**

实测 `backend/data/test.db` 的 `categories` 表(`typeof(article_data_fields)` 全为 `text`):

| 分类 | DB 原始值 | 经 `read()` 后到前端 |
|---|---|---|
| id=1 作品 | `{"ggg":{"title":"bbb","type":"text"}}` | **对象** `{ ggg: { title, type } }` |
| id=2..5 服务/团队/动态/关于 | 字面文本 `'null'` | `JSON.parse('null')` → **`null`** |
| (未来可能) 空串 | `''` | `JSON.parse('')` 抛错被 catch 吞掉 → **原样 `''`** |

即与 §3 记录的 `article.data` 三态**完全同构**(同一个 `read()` 归一逻辑)。⚠ 所以 `null` **不是** "字段没返回",而是"返回了且值就是 null" —— 不要据此误判成接口不带该字段。

**兜底写法(施工照抄)**

```ts
// Editor.vue —— 从已加载的 categories 里派生当前分类的自定义字段定义。
// article_data_fields 经 DYAPI 归一后可能是 对象 / null / ''(见 §5A.7A),一律先收敛成对象。
const articleDataFields = computed(() => {
  const cat = categories.value.find((c: any) => Number(c.id) === Number(form.value.category_id));
  const raw = cat?.article_data_fields;
  const obj = (raw && typeof raw === 'object') ? raw as Record<string, any> : {};
  return Object.entries(obj).map(([key, def]: [string, any]) => ({
    key,
    title: def?.title || key,
    type: def?.type || 'text',
  }));   // → EditorPanel 的 articleDataFields prop 形状(EditorPanel.vue:11)
});
```
- `?? []` 的语义由 `computed` 末尾的 `Object.entries({})` 天然给到:**空/`null`/`''` 一律得到 `[]`**,`EditorPanel` 的 `v-for` 自然什么都不渲染。
- 不需要 `watch(category_id)` 再拉一次接口 —— `categories` 已含全部行,`computed` 随 `form.category_id` 自动重算(这也顺带满足 §5A.7 步 6"切分类刷新字段定义"的要求,且天然不会清空 `form.data`)。
- ⚠ `categories` 是 `onMounted` 异步填充的(`Editor.vue:48-54`),首帧为 `[]` → 字段区先空一帧再出现,属正常;不必加 loading 态。

### 5A.8 i18n(新文案全部进 `frontend/src/i18n.ts` 的 en + zh)

复用已有 `action.upload`(en `Upload` / zh `上传文件`)与 `action.remove`;新增一个 `fileUploader` 命名空间:

| key | en | zh |
|---|---|---|
| `fileUploader.chooseFromLibrary` | Choose from library | 从文件库选择 |
| `fileUploader.pickTitle` | Select a file | 选择文件 |
| `fileUploader.search` | Search filename... | 搜索文件名... |
| `fileUploader.empty` | No files yet | 文件库还没有文件 |
| `fileUploader.uploading` | Uploading... | 上传中... |
| `fileUploader.uploadFailed` | Upload failed | 上传失败 |
| `fileUploader.dropHint` | Click to upload | 点击上传 |
| `fileUploader.replace` | Replace | 替换 |
| `fileUploader.removeConfirm` | Remove this file from the field? (The file itself stays in the library.) | 从该字段移除此文件?(文件本身仍保留在文件库中。) |
| `fileUploader.copyLink` | Copy link | 复制链接 |
| `fileUploader.copied` | Link copied | 链接已复制 |
| `fileUploader.copyFailed` | Copy failed — select the URL manually | 复制失败,请手动选择地址 |
| `fileUploader.selectedN` | {n} selected | 已选 {n} 个 |

**不硬编码中文。** 组件内一律 `$t()` / `useI18n()`。

### 5A.9 风险与回滚

| # | 风险 | 缓解 | 回滚点 |
|---|---|---|---|
| F1 | **改动面是核心应用**(4 个 admin 页 + `api.ts` + `i18n.ts` + 2 个新组件),波及所有内容录入 | 每处接入**单独一个 commit**;每步后跑类型检查 + 手工验一次上传 | 逐 commit `git revert`;新组件是纯增量,删掉即回到今天 |
| F2 | `vue-tsc` 必须干净 | `cd frontend && npx vue-tsc --noEmit -p tsconfig.app.json --noCheck false`(注意 `npm run build` 的 `vue-tsc` 带 `noCheck`,**过了不代表没错**) | — |
| ~~F3~~ | ~~`article_data_fields` 取数途径未定~~ | **✅ 本轮已解决,不再是风险。** 查实 `manageableCategories` 走裸 `read()` 无字段裁剪,本来就带该列 → 复用 `Editor.vue:51` 现有请求即可。完整证据链与兜底写法见 **§5A.7A** | — |
| F4 | `navigator.clipboard` 在非安全上下文不可用 | `catch` 降级为只读输入框供手选 | 去掉复制按钮 |
| F5 | 接入 `EditorPanel` 后侧栏字段重复(Editor 内联块与 EditorPanel 都渲染分类/模板/缩略图) | §5A.7 步 5 明确"替掉"而非"并列" | 回退 import |
| F6 | 多文件追加语义(`multiple`)当前无人使用(`Files.vue` 走 button 模式) | 保留但**不为它写额外 UI**;首个真实用例出现时再打磨 | — |

---

## 6. 视觉系统

### 6.1 设计令牌(CSS 变量)
```
--bg-page:      #F4F1EA   纸底
--surface:      #FFFFFF   卡面
--ink:          #1C1C1C   墨黑(描边/正文)
--accent:       #D64933   朱红
--border-light: #D1CCC5   浅分隔
--shadow-hard:  8px 8px 0 #1C1C1C
--shadow-soft:  4px 4px 0 #1C1C1C
```
**新增令牌文件 `frontend_themes/neo/tokens.css`**(见 §7.1 / §9):把上表 + 基础排版(`font-family: 'Manrope'` / `color` / `background`)定义在 `.neo-scope` 类选择器下。`Layout.vue` 与 `MemberLayout.vue` 各自 `import './tokens.css'`(Vite 去重,只出一份 CSS)并在根元素加 `class="neo-scope"`。
- 单一出处、两个外壳共用,不复制粘贴;
- 类选择器作用域 → **不会泄漏到 `/admin`**(这正是本次要修的问题 2 之一);
- CSS 自定义属性按 **DOM 继承**生效,与 `<style scoped>` 的 hash 属性选择器无关 —— 所以子组件(`AHeader`/`AFooter`/各模板)的 scoped 样式里 `var(--ink)` 照旧能吃到。

### 6.2 字体(主题批次里唯一涉及 `frontend/` 的改动 —— §5A 另有一批)
| 字体 | 用途 |
|---|---|
| Bricolage Grotesque(400/600/700/800,opsz 12..96) | 大标题、卡片标题 |
| Space Mono(400/700) | 面包屑、元信息、标签、按钮 |
| Manrope(400/500/600/700) | 正文 |

- `theme.config.ts:11-21` 的 `init()`:把 `fonts.googleapis.com` **换成 `fonts.googleapis.cn`**(Google Fonts 官方中国镜像)。已实测:三款字体齐全,返回 CSS 与 `.com` 版**逐字节等价**,其中 woff2 URL 自动改写为 `fonts.gstatic.cn`,实测 200 / `font/woff2`。查询串保持不变。
- `frontend/index.html:6` 的 preconnect 同步换成 `https://fonts.googleapis.cn` / `https://fonts.gstatic.cn`。
- **不自托管 woff2、不入仓字体文件。**
- 可选降级方案(**本次不实施**,仅留档):`@fontsource/bricolage-grotesque` / `@fontsource/space-mono` / `@fontsource/manrope` npm 自托管(已实测 `registry.npmmirror.com` 可达),在 `init()` 里改为 `import`。适用于纯内网/无外网出口的部署。

### 6.3 组件基调(粗野主义语言,复用现有写法)
- 卡片:`border: 3px solid var(--ink)` + `background: var(--surface)` + `box-shadow: var(--shadow-hard)`;hover `transform: translate(-3px,-3px)` + 阴影加深到 `12px 12px 0`。
- 按钮/图标格:`border: 2px solid var(--ink)`,横向连排用 `margin-left: -2px` 共享描边;hover 反色(`background: var(--ink); color: var(--surface)`)。
- 标签:`Space Mono` + `2px` 描边 + `2px 7px` 内距,不圆角。
- 标题:`Bricolage Grotesque` + `text-transform: uppercase` + `line-height: .95`,`clamp()` 做流式字号。
- 链接下划线:`underline wavy var(--accent) 1px`。
- **零圆角、零渐变、零投影模糊**(阴影一律 0 blur)。

---

## 7. 改动清单(逐文件)

### 7.1 新增

| 文件 | 说明 |
|---|---|
| `frontend_themes/neo/MemberPage.vue` | 成员个人主页模板(详见 §8) |
| `frontend_themes/neo/MemberLayout.vue` | 裸页外壳(详见 §9) |
| `frontend_themes/neo/tokens.css` | `.neo-scope` 令牌 + 基础排版(§6.1) |
| **`frontend/src/components/FileUploader.vue`** | **核心应用**:通用文件上传/选择字段控件(§5A.4) |
| **`frontend/src/components/FilePicker.vue`** | **核心应用**:文件库选择弹层(§5A.5) |

### 7.2 修改(主题目录)

| 文件 | 位置 | 改成什么 |
|---|---|---|
| `theme.config.ts` | `init()` `:11-21` | 域名 → `fonts.googleapis.cn` |
| | `configSchema` `:27-44` | 按 §4 表重写(**删 5 增 5**,共 16 项;两条 image hint 简化) |
| | `pages` `:51-76` | 新增 `MemberPage` 条目**与 `MemberLayout: {}` 空条目**(§7.4;显式登记的理由见 §1) |
| `DefaultHome.vue` | `:81` | `theme_neo_tagline \|\| config?.subtitle` → **直接读 `config?.subtitle`**(§4 删键配套) |
| `AboutPage.vue` | `:40` | `theme_neo_tagline \|\| cfg.subtitle` → **直接读 `cfg.value.subtitle`**(同上) |
| `Layout.vue` | `:18` `<style>` | 改 `<style scoped>`;变量块移入 `tokens.css`;根元素 `class="neo-layout neo-scope"`;`import './tokens.css'` |
| `components/Socials.vue` | 全文 | `kind:'link'\|'popover'` 改造 + `source`/`size` props(§10)+ 图标集换血(§11) |
| `components/AHeader.vue` | `:36` | `const { config, menus } = props.context \|\| {}` → 两个 `computed`;`navItems`/`ctaText`/`ctaLink` 内改 `.value`;模板不用改(computed 在模板里自动解包) |
| `components/AFooter.vue` | `:29` | 同上(`footerItems`/`note` 内改 `.value`) |
| `lib.ts` | `useArticleList` `:14-38` | 分页进 URL(§13.1);新增 `useMemberWorks`? **不新增**,反查逻辑就 3 行,直接写在 `MemberPage.vue` 内 |
| `TeamGrid.vue` | `:14-31`,`:49` | 整卡可点(§8.4);去掉硬编码 `GH`/`X`/`✉` 三个字母链接;`skillsOf` 保留 |
| `neo-demo-data.json` | — | 见 §17(第 6 步) |
| `frontend/index.html` | `:6` | preconnect → `fonts.googleapis.cn` / `fonts.gstatic.cn` |

### 7.2A 修改(核心应用,§5A 批次 —— 先于主题施工)

| 文件 | 位置 | 改成什么 |
|---|---|---|
| `frontend/src/api.ts` | `uploadAPI` `:146-153` | 新增 `uploadFiles(files)` 语义封装(§5A.3);`upload(formData)` 保留 |
| `frontend/src/i18n.ts` | `en` + `zh` | 新增 `fileUploader.*` 13 条(§5A.8) |
| `frontend/src/views/admin/Files.vue` | `:15,:17,:69-91,:105-107,:128-131` | 换 `FileUploader`(button 模式);删自拼 FormData 与 `uploading`/`fileInput` |
| | `:94` | 原生 `confirm()` → 全局 `useConfirm`(CLAUDE.md 合规) |
| | `:149-156` | hover 浮层加「复制链接」按钮(clipboard + 降级) |
| `frontend/src/views/admin/Editor.vue` | `:30-32`,`loadArticle`,保存载荷 | `form` 加 `data`;回填/归一/提交(§5A.7) |
| | `:48-54` | **不改这次请求** —— 已查实 `manageableCategories` 返回的行本就带 `article_data_fields`(§5A.7A);只需新增一个 `articleDataFields` computed 从 `categories` 派生 |
| | `:168-179` | `onUploadImg` 内改用 `uploadAPI.uploadFiles(files)` |
| | `:181-202`,`:291-296` | 删 `thumbnailInput` + `onThumbnailSelected` + 内联 dropzone;改由 `EditorPanel` 承载 |
| | 新增 import | `import EditorPanel from './EditorPanel.vue'` 并在侧栏渲染(替掉内联块) |
| `frontend/src/views/admin/EditorPanel.vue` | `:8-18` | 删 `thumbnailInput` prop 与两个 `emit`(事件链塌缩,§5A.6 ③) |
| | `:50-71`,`:105-120` | 缩略图与 attachment 分支各换成一行 `FileUploader` |
| `frontend/src/views/admin/Settings.vue` | `:331-337` | `image` 类型单独一支走 `FileUploader`;删 `:335` 只读 `<img>` |

### 7.3 明确不动

`DefaultArticle.vue` · `DefaultCategory.vue`(除 `lib.ts` 带来的分页行为变化) · `WorkGrid.vue` · `ServiceList.vue` · `ProjectArticle.vue` · `ContactPage.vue` · `THEME_DEV.md` · 所有 `backend/**`。
`frontend/src/**` 中除 §7.2A 列出的文件与 `index.html` 一行外**不动** —— 特别是 `router/index.ts` · `DynamicView.vue` · `theme-runtime.ts` · **`views/setup/SetupWizard.vue`**(§5A.1 已论证排除)。
(`DefaultHome.vue` / `AboutPage.vue` 各改一行 tagline computed,见 §7.2。)

### 7.4 `theme.config.ts` 关键契约(可直接抄)

```ts
export const pages: ThemePages = {
  // …现有条目不变…
  TeamGrid:  { layout: 'Layout', title: '$data.category.name - $data.config.site_name', prefetch: listPrefetch },

  // 成员个人主页:裸页外壳 + 反查该成员参与的作品
  MemberPage: {
    layout: 'MemberLayout',
    title: '$data.article.title - $data.config.site_name',
    prefetch: [
      { key: 'memberWorks', api: 'contentAPI.listArticles',
        args: [{ filter: { data: { $contains: '$data.article.slug' } },
                 orderBy: 'published_at', orderDesc: true, page: 0, limit: 24 }] },
    ],
  },
  // 显式登记以便后来人一眼看懂布局链;条目为空是刻意的 ——
  // MemberLayout 不需要 prefetch(返回链接从 context.article.category 派生,不取菜单)
  // 也不需要 title(标题由 MemberPage 提供,子级优先)。
  // ⚠ 唯一硬约束:绝不能写 layout: 'Layout',否则通用外壳(AHeader/AFooter)会被套回来。
  MemberLayout: {},

  Layout: { title: '$data.config.site_name',
            prefetch: [{ key: 'menus', api: 'crudAPI.getList', args: ['menus'] }] },
};
```

---

## 8. `MemberPage.vue` 设计

### 8.1 数据入口
```ts
const props = defineProps<{ context: any }>();
const article = computed(() => props.context?.article || null);
const d = computed<any>(() => { const x = article.value?.data; return x && typeof x === 'object' ? x : {}; });
const bio = computed(() => (article.value?.content ? marked.parse(article.value.content) as string : ''));
const skills = computed(() => String(d.value.skills || '').split(',').map(s => s.trim()).filter(Boolean));
const socialSource = computed(() => ({
  github: d.value.social_github, bilibili: d.value.social_bilibili, douyin: d.value.social_douyin,
  xiaohongshu: d.value.social_xiaohongshu, zhihu: d.value.social_zhihu,
  email: d.value.social_email, wechat_qr: d.value.social_wechat_qr,
}));
const works = computed(() => /* §3.1 的两道过滤 */);
```

### 8.2 区块结构(4 组,自上而下)

**① 身份卡 `.m-hero`** —— 不对称双栏(左像右名)
- 左:方形头像 `aspect-ratio:1`,`3px` 描边 + `--shadow-hard`,`object-fit:cover`。**空态**:沿用 `TeamGrid` 的 45° 米色斜条纹 + 首字母(`opacity:.2`,`3.5rem`),不显示灰色占位图。
- 右:姓名 `Bricolage Grotesque` `clamp(2.6rem, 7vw, 4.5rem)` uppercase,`line-height:.95`;左侧 `16px solid var(--accent)` 竖条(呼应 `DefaultArticle` 的 h1)。
- 职位:`Space Mono` `.9rem` 朱红,姓名下方;无 `role` 则整行隐藏。
- 右上角装饰:`Space Mono` 极小号的 `MEMBER / <slug>` 标记(纯排版,无数据依赖)。

**② 简介 + 技能 `.m-about`**
- 正文:`marked.parse(article.content)` → `.prose` `max-width: 680px`(左对齐,不居中,延续"偏左不对称");`h2` 用 Bricolage,`blockquote` 用 12px 朱红左边 + 硬阴影(抄 `DefaultArticle` 的 prose 规则)。
- 技能标签:正文下方 flex-wrap 标签墙(`2px` 描边,`Space Mono` `.7rem`)。
- **空态**:`content` 为空 → 整个正文块隐藏;`skills` 为空 → 标签墙隐藏;两者都空 → `.m-about` 不渲染(不出现空框)。

**③ 社交矩阵 `.m-social`**
- 一条 `3px solid var(--ink)` 上分隔线 + `Space Mono` 小标题 `FIND ME`。
- `<Socials :context="context" :source="socialSource" size="lg" />` —— 复用组件,格子放大到 `48×48`,横向连排共享描边;换行时用 `flex-wrap` + `margin: -2px 0 0 -2px` 保持描边不重叠。
- 微信项是 `popover`:点击弹出二维码卡片(§10.3)。
- **空态**:`source` 全空 → `Socials` 自身 `v-if="items.length"` 不渲染 → 整个 `.m-social` 段隐藏。

**④ 参与作品 + 返回 `.m-works`**

> **数据来源(先说清,这是本方案唯一的持续性运营成本)**:本区块**不是**从 `author_id` 自动推导的。它读 **works 分类的 `article_data_fields` 字段 `members`** —— 一个逗号分隔的成员 slug 串(如 `member-1,member-3`),**由运营在每篇作品的编辑页手工填写**。没人填 → **整段不渲染**。
> 为什么不能自动:文章 `author_id` 指向**登录用户**,而团队成员是 team 分类下的**文章**,两者不是同一实体;成员的头像/职位/技能都在文章 `data` 里,用户表拿不到。要自动关联须让"成员 = 真实用户",属后端改造,**第 2 步已否决**。完整论证见 §3.1 开头。✅ 该区块**已确认保留**,运营承担这项录入(§14 #7)。
> 前置:运营要能填它,必须先完成 §5A.7(编辑器渲染自定义字段)。

- 标题 `WORKS · <n>`(n = 精确复筛后的条数)。
- 列表形态用**横向条目**而非网格(与 `WorkGrid` 的卡片网格区分,避免成员页变成第二个作品页):每条 `border-bottom: 2px solid var(--border-light)`,左侧 64×64 缩略图(空则斜条纹+首字),中间标题 + `client · year`,右侧 `↗`;整条 `<a :href="articleUrl(w)">` 包裹,hover 整条底色转 `--ink` 文字反白。
- **空态**:`works.length === 0` → **整段不渲染**(不显示"暂无作品"—— 成员没参与作品是常态,不是异常)。
- 末尾轻量返回链接:`← 返回{{ article.category.name }}`(`Space Mono`,波浪下划线),href 取 `/a/${article.category.slug}`。与 `MemberLayout` 顶部的返回入口构成"首尾各一个",都从 `article.category` 派生,**不硬编码 `/a/team`**。

### 8.3 桌面 / 移动塌陷

| 断点 | 布局 |
|---|---|
| ≥ 1024px | `.m-hero` grid `320px 1fr`,gap `3rem`;主容器 `max-width: 1000px`,`padding: 4rem 2rem 6rem` |
| 768–1023px | `.m-hero` grid `240px 1fr`;姓名字号由 `clamp` 自动收缩 |
| < 768px | `.m-hero` 单列:头像先行,`max-width: 200px`(不铺满,避免整屏一张脸);姓名竖条改为 `8px`;`padding: 2.5rem 1.25rem 4rem` |
| < 560px | 社交格 `44×44`(触控可达),作品条目缩略图降到 `48×48`,右侧 `↗` 隐藏 |

`.m-hero` 头像空态在移动端仍保持 `aspect-ratio:1`,首字母字号降到 `2.5rem`。

### 8.4 `TeamGrid.vue` 入口改造

- 整卡可点。**不用 `<a>` 包整卡**(卡内若有链接会产生非法嵌套),改用 **stretched-link 覆盖层**:
  ```html
  <article class="member">
    <a class="card-link" :href="articleUrl(a)" :aria-label="`${a.title} 的个人主页`"></a>
    …头像 / 姓名 / 职位 / 简介 / 技能…
    <span class="card-more">查看主页 →</span>
  </article>
  ```
  ```css
  .member { position: relative; }
  .card-link { position: absolute; inset: 0; z-index: 1; }
  ```
- **移除卡内 `GH`/`X`/`✉` 三个硬编码字母链接**(`TeamGrid.vue:25-29`)。理由:① 它们本就不是图标,是字母;② 社交矩阵已在个人主页有完整 7 项呈现;③ 移除后卡内无可交互元素,stretched-link 不必做 z-index 分层,最简也最稳。**✅ 已确认(§14 #1)。**
- 卡片新增 `.card-more`(`Space Mono` 小号朱红,hover 时下划线),给"可点"一个视觉承诺。
- `articleUrl(a)` 直接用 —— `listArticles` 返回的是**富化文章**,自带 `category.slug`,生成 `/a/team/member-1`。

---

## 9. `MemberLayout.vue` 职责边界

```html
<template>
  <div class="member-layout neo-scope">
    <a class="back" :href="backHref">← {{ backLabel }}</a>
    <slot></slot>
  </div>
</template>
```

**提供**
1. `class="neo-scope"` + `import './tokens.css'` → 配色令牌、基础排版、纸底背景(与 `Layout.vue` **同一份** CSS,见 §6.1)。
2. 页面骨架:`min-height: 100vh`;`display: flex; flex-direction: column`。
3. 极简返回入口:左上角固定/贴顶的一个文字链接,`Space Mono` `.85rem`,`2px` 描边小方块 + hover 反色。`backHref = '/a/' + (context?.article?.category?.slug || '')`,`backLabel = '返回' + (context?.article?.category?.name || '列表')`;**category 缺失时退化为 `/`+`返回首页`**(唯一一处兜底,因为"返回"必须永远可用)。
4. 一条底部极简署名行:`© <year> <config.site_name>`(`.7rem`,`--border-light` 色)。**仅此一行**,不是页脚 —— 让裸页仍有归属感,不引入导航。

**不提供**
- ❌ `AHeader` / `AFooter`(这是本页存在的全部意义)
- ❌ 主导航、社交矩阵、CTA 按钮、ICP 备案、菜单预取
- ❌ 任何业务逻辑 / 数据获取(不 prefetch,不调 `context.api`)
- ❌ 自己的字体加载(字体由 `theme.config.ts` 的 `init()` 全局注入,与页面无关)

**与 `Layout.vue` 的关系**:平级兄弟,共享 `tokens.css`,互不 import。`Layout.vue` 保留 `.neo-layout` 类承载它自己的 flex/`min-height` 规则(改为 `scoped`),令牌部分从中删除。

---

## 10. `Socials.vue` 改造契约

### 10.1 Props(向后兼容)
```ts
const props = defineProps<{
  context: any;                          // 保持必填,不变
  source?: Record<string, string>;       // 新增:覆盖数据源(成员页用)
  size?: 'sm' | 'md' | 'lg';             // 新增:默认 'md' = 现有 40px;sm 34px;lg 48px
}>();
```
- **不传 `source`** → 行为与今天完全一致(从 `config.theme_neo_social_*` + `theme_neo_contact_email` 读)。`AHeader`/`AFooter` 的调用处**一字不改**。
- **传 `source`** → 只认 `source`,忽略 config(成员页不应混入站点级链接)。

### 10.2 数据模型
```ts
type SocialItem = {
  key: string; label: string; svg: string;
  kind: 'link' | 'popover';
  url?: string;        // kind==='link'
  mailto?: boolean;    // 影响 target/rel
  img?: string;        // kind==='popover' 的弹层图片
};
const ORDER = ['github','bilibili','douyin','xiaohongshu','zhihu','email','wechat_qr'] as const;
```
- `email` → `kind:'link'`,`url = 'mailto:' + v`,`mailto: true`。
- `wechat_qr` → `kind:'popover'`,`img = v`,**无 `url`**。
- 其余 → `kind:'link'`,`url = v`,`target="_blank" rel="noopener"`。
- 值为空 → 不入列表(空则隐藏)。
- **`svg: ICONS[key] || ICONS.fallback`** —— 补一个 fallback 圆点图标。今天 `ICONS[key]` 无兜底,key 拼错会渲染**空方框且无任何报错**;顺手治掉。

### 10.3 渲染
```html
<div class="socials" v-if="items.length" :class="`size-${size||'md'}`">
  <template v-for="s in items" :key="s.key">
    <a v-if="s.kind === 'link'" :href="s.url" :target="s.mailto ? undefined : '_blank'"
       :rel="s.mailto ? undefined : 'noopener'" :title="s.label" :aria-label="s.label" class="social">
      <span v-html="s.svg"></span>
    </a>
    <span v-else class="social-wrap">
      <button type="button" class="social" :title="s.label" :aria-label="s.label"
              :aria-expanded="openKey === s.key" @click.stop="toggle(s.key)">
        <span v-html="s.svg"></span>
      </button>
      <span class="qr-pop" v-if="openKey === s.key">
        <img :src="s.img" :alt="s.label">
        <span class="qr-cap">{{ s.label }}</span>
      </span>
    </span>
  </template>
</div>
```
Popover 行为契约:
- 点击切换;同时只开一个(`openKey: ref<string>('')`)。
- 关闭途径:再次点击 · 点击页面其他位置(`document` 上 `click` 监听,`onMounted` 加 / `onBeforeUnmount` 摘)· `Esc`。按钮上用 `@click.stop` 避免自己被 document 监听立刻关掉。
- 定位:`.social-wrap { position: relative }`,`.qr-pop { position: absolute; top: calc(100% + 8px); right: 0; z-index: 70 }` —— **必须 > 70**,因为 `.site-header` 是 `z-index: 50` 的 sticky。
- 视觉:`--surface` 底 + `3px solid var(--ink)` + `--shadow-hard`,内含 `160×160` 图 + `Space Mono` 小字说明。
- `title`/`aria-label` = `微信`;`img alt` 同。
- 移动端(< 940px)页眉的 `.header-socials` 本就 `display:none`,所以站点级弹层只出现在页脚/关于页;成员页的社交矩阵在移动端把 `.qr-pop` 定位改为 `left: 0; right: auto`,避免右侧溢出。

### 10.4 复用点
`AHeader`(不变)· `AFooter`(不变)· `MemberPage`(新增,传 `source` + `size="lg"`)。`AboutPage`/`ContactPage` 现状如何调用即保持。

---

## 11. 国内平台图标策略(自绘,零 CDN)

统一规格:`viewBox="0 0 24 24"` · `fill="currentColor"` · 单路径优先 · 视觉重量与现有 GitHub 图标对齐(实心、无描边)。`width`/`height` 由 CSS 控制(不再写死 18,以支持 `size` 三档)。

| key | 画法 | 辨识特征 |
|---|---|---|
| `github` | **沿用现有 octocat path**(`Socials.vue:17`) | 已有 |
| `bilibili` | 圆角矩形"电视机"外壳 + 左右两根斜天线 + 两个圆点眼睛(挖空) | 天线 + 电视轮廓是 B 站最强识别符,几何简单、18px 下不糊 |
| `douyin` | 音符:竖干 + 顶部右弯旗 + 左下实心圆头(经典单色抖音音符) | 音符形状即品牌,单色版本官方也在用 |
| `xiaohongshu` | 实心圆角方"徽章" + 挖空的 `<text>` 单字 **书** | 汉字笔画无法用简单几何还原;用 `<text>` 交给系统 CJK 字体渲染,任意尺寸清晰、零外部依赖 |
| `zhihu` | 实心圆角方"徽章" + 挖空的 `<text>` 单字 **知** | 同上;知乎品牌本身就是"知"字形 |
| `email` | **沿用现有信封 path** | 已有 |
| `wechat_qr` | 微信双气泡:两个交叠圆角气泡 + 各 2 个挖空圆点(小气泡在右上) | 双气泡是微信最强识别符,几何可精确还原 |

`<text>` 方案要点:`<text x="12" y="17.5" text-anchor="middle" font-size="15" font-weight="700" font-family="'PingFang SC','Microsoft YaHei',sans-serif" fill="var(--surface)">知</text>`,外层 `<rect rx="4" fill="currentColor">`。在 40px 格子里字号约 15/24 × 20 ≈ 12.5px,清晰可读。
**✅ 汉字徽章已确认(§14 #2)。** 仅留档备选:若将来不满意,可手工临摹 simple-icons 的官方路径数据替换(体积 +约 1KB/个)。图标全部集中在 `ICONS` 一个 map 里,**替换成本极低,任何时候都能换**。

---

## 12. 顺手三修

### 12.1 分页进 URL(`lib.ts` 的 `useArticleList`)

**现状**:`lib.ts:35` 的 `goPage` 只 `load(p)` + `window.scrollTo`,不碰 router → 翻页后 URL 不变、无法分享/收藏、浏览器后退直接离开列表页。影响 `DefaultCategory` / `WorkGrid` / `ServiceList` / `TeamGrid`(4 处调用点,改 `lib.ts` 一处即可)。

**方案**
- query key:**`page`,1-based**(`?page=2` = 第二页);**第 1 页省略参数**,保证列表页规范 URL 干净、不产生 `?page=1` 与无参两个等价 URL。
- 读:`const initial = Math.max(0, (Number(route.query.page) || 1) - 1)`。
- **首屏播种规则**:`initial === 0` 时用 prefetch 的 `context.articles` 播种(零额外请求,同今天);`initial > 0` 时**不播种**(`items` 起始为 `[]`、`loading=true`),`onMounted` 里 `load(initial)`。这样直接打开 `?page=3` 不会先闪一屏第 1 页的内容再跳 —— 只有一个"加载中…"过渡。`totalPages` 仍可立即算对,因为 `total` 取自 page-0 prefetch 的 `context.$meta.articles.total`。
- 写:`goPage(p)` 改为
  ```ts
  const q: any = { ...route.query };
  if (p <= 0) delete q.page; else q.page = String(p + 1);
  router.push({ query: q });        // 不写 path,保持当前路径
  ```
- **不需要 watcher**:`router.beforeResolve`(`router/index.ts:354`)对**每次导航**(含仅 query 变化)都会重跑 `to.meta.fetch`,刷新 `route.meta.fetchedData`;`DynamicView.vue:160` 的 watch 触发 `resolveTemplate`,末尾 `renderKey++` 使模板 `:key` 变化 → **模板重挂**,`useArticleList` 以新 URL 重新初始化。前进/后退同理走 popstate → 导航 → 重挂,页码从 URL 复原,天然正确。
- **删掉 `goPage` 里的 `window.scrollTo`**:`scrollBehavior`(`router/index.ts:290-294`)对新导航已返回 `{ top: 0 }`,对 back/forward 返回 `savedPosition`(延迟 300ms)。保留手工 scroll 会与之打架(强制把后退也顶到顶部)。
- 需要 `useRoute`/`useRouter`:`useArticleList` 只在模板 `setup` 内调用,composable 里直接 `import { useRoute, useRouter } from 'vue-router'` 合法。

**代价(如实记录)**:每次翻页从 1 个请求变成 3 个(`getCategory` + prefetch `listArticles(page0)` + 客户端 `listArticles(pageN)`),因为整条导航被重跑。对作品集体量(几十条)无感;**根治**需要给框架的 prefetch 参数注入加 `$query.x` 支持,那是 `router/index.ts` 改动,**本次不做**(见 §15)。

**SSG / 爬虫**:后端 `StaticGenService` 只为**文章**生成静态 HTML(`StaticGenService.ts:24`),列表页本来就是客户端渲染,`?page=` 不影响 SSG。分页 URL 的价值在于可分享/可收藏/可后退,而非 SEO。**不加 `rel=prev/next`**(无 SSR 承载,收益为零)。

### 12.2 响应式 + 样式泄露

**(a) 非响应式 destructure** —— `AHeader.vue:36` / `AFooter.vue:29`:
```ts
const { config, menus } = props.context || {};   // ← 一次性快照
```
`Layout`(含其中的 header/footer)**只在 `layoutKey` 变化时才重建**(`DynamicView.vue:140-149`),同布局的页间导航**不会重挂** —— 于是这两个值在 Layout 的整个生命周期里被冻结在首次挂载的快照上。今天大多数情况看不出问题(menus/config 全站相同),但引入 `MemberLayout` 后布局链会真正切换、后台改配置/菜单后 SPA 内也不会更新,属于必须消除的隐患。
**最小改法**(模板零改动,因为 computed 在模板里自动解包):
```ts
const config = computed<any>(() => props.context?.config || {});
const menus  = computed<any[]>(() => props.context?.menus || []);
// 脚本内其余引用加 .value:navItems / ctaText / ctaLink / footerItems / note
```

**(b) 样式泄露** —— `Layout.vue:18` 的 `<style>` **未 scoped**:`.neo-layout { --bg-page … }` 是全局规则,`/admin` 也吃到这份 CSS(虽然选择器是类,不会立刻表现为视觉 bug,但主题 CSS 进入管理端 bundle 属于边界破损)。
**改法**:`<style scoped>` + 令牌移入 `tokens.css`(§6.1)。
**为什么 scoped 后子组件仍能吃到变量**:`scoped` 只是给选择器加 `[data-v-hash]` 属性约束**选择器匹配范围**;CSS 自定义属性一旦在某元素上生效,就沿 **DOM 树继承**给所有后代,与后代自己的 scope hash 无关。`AHeader`/`AFooter`/各模板都在 `.neo-scope` 元素内部,`var(--ink)` 照常解析。(这也是今天 `Socials.vue` 等 scoped 组件能用 `var(--ink)` 的原因,机制不变。)

### 12.3 补齐 `article_data_fields`

**现状(本轮直查 `backend/data/test.db`)**:`categories.article_data_fields` 只有 id=1(作品)有一个手工试填的残留值 `{"ggg":{"title":"bbb","type":"text"}}`,**id=2..5 全是字面文本 `'null'`**(经 DYAPI `read()` 解析后为 `null`)。加上编辑器根本不渲染自定义字段(§2.1 红框),运营**无法录入** `role`/`skills`/`social_*`/`members`。
**改法**:① 前置修复编辑器渲染(§5A.7,已批准);② 按 §2.1 在 demo 数据的 `categories` 里补齐 works/services/team 三个分类的声明(journal/about 明确保持 `null`),**顺带清掉 id=1 那条 `ggg` 测试残留**。已装机的用户可在"后台 → 分类 → 编辑 → 自定义字段"手工补,或重导 demo 数据。
**验收**:后台新建一篇 team 文章,编辑器应出现 9 个字段,其中"微信二维码图片"是 `FileUploader`;选 journal 分类(值为 `null`)则字段区为空且不报错(§5A.7A 的兜底)。

---

## 13. 风险与回滚点

| # | 风险 | 触发条件 | 缓解 | 回滚 |
|---|---|---|---|---|
| R1 | `filter: { data: { $contains } }` 在某些 DYAPI 版本上行为不一致 | 框架升级 | prefetch 失败被 catch 成"空区" → 表现为作品区不显示,不白屏 | 删掉 `MemberPage` 的 prefetch,该区自然消失 |
| R2 | 作品区误命中(`member-1` vs `member-10`) | slug 有前缀包含关系 | 客户端精确复筛(§3.1 ①) | — |
| R3 | 某行 `data=''` 触发 `json_extract` 全查询失败 | 若有人把 filter 改成 `data.members` 点号路径 | **文档写死"禁止点号路径"** + 代码注释 | 改回整列 LIKE |
| R4 | `fonts.googleapis.cn` 未来失效/被墙 | 外部不可控 | 字体缺失只导致回落系统字体,不影响功能 | `init()` 改回 `.com`,或启用 §6.2 的 `@fontsource` 自托管方案 |
| R5 | 翻页 3 请求 / 翻页时整页重挂闪一下 | 每次翻页 | 首屏播种规则避免"先闪错内容";只有 loading 过渡 | `goPage` 改回纯 `load(p)`(退回今天的行为) |
| R6 *(极低)* | 误给 `MemberLayout` 的 `pages` 条目**填上** `layout: 'Layout'` | 后续维护者看到空对象想"补全配置" | **显式登记 `MemberLayout: {}` 后此项已基本消解**:条目存在且带注释写明"空是刻意的 + 绝不能写 `layout`",不再有"看起来像漏写"的诱因,也不再依赖"查表落空"的隐式终止路径(§1)。即便真被填上,表现也只是通用外壳回归(header/footer 出现),不白屏、不报错 | 删掉该 `layout` 字段 |
| R7 | 汉字徽章图标(知乎/小红书)被认为不够品牌化 | 主观 | 集中在 `ICONS` map,单点替换 | 换 simple-icons 路径 |
| R8 | 去掉 TeamGrid 卡内社交链接被认为是功能退化 | 主观 | 社交在个人主页完整呈现,且卡片整体可点 | 恢复为 `<Socials :source size="sm">` + z-index 分层 |
| R9 | `tokens.css` 若被 admin bundle 引入 | Vite chunk 划分 | 选择器为 `.neo-scope`,不匹配任何 admin 元素 → 无视觉影响 | — |
| **R10** | **§5A 是核心应用改动**,波及全部内容录入路径(文章、文件库、站点配置) | 本批次每一步 | 排在主题之前**独立施工、逐处 commit**;详细风险表见 §5A.9(F1-F6) | 逐 commit `git revert`;两个新组件是纯增量 |
| ~~R11~~ | ~~§5A.7 依赖"分类接口是否返回 `article_data_fields`"这一未验证事实~~ | **✅ 已消解**(本轮查实,见 §5A.7A):`ContentLifecycleController.ts:92` 用裸 `read()` 且不传 `fields`/`hideFields` → 整行全字段返回;形态为 对象/`null`/`''` 三态,兜底写法已给定 | — |

**类型检查门禁**:`cd frontend && npx vue-tsc --noEmit -p tsconfig.app.json --noCheck false` 必须干净(基线已干净)。注意 `v-for` 索引在 `any` 数组上是 `string|number`,做算术要 `Number(i)`。

---

## 14. 取舍确认状态 —— **全部已定,无悬空项**

> 第二轮修订后,本节**不再有待用户确认的取舍**。以下全部为已拍板结论,第 5 步照此施工。

### 已确认(施工按此执行)

1. ✅ **TeamGrid 卡片移除社交图标** —— 整卡可点,社交在个人主页完整呈现。(原待拍板 #1)
2. ✅ **知乎 / 小红书用汉字徽章图标** —— `rect` + `text` 渲染「知」「书」,零依赖、任意尺寸清晰。(原待拍板 #2)
3. ✅ **成员头像沿用 `article.thumbnail`,不新增 `avatar` 字段** —— 避免双真源。(原待拍板 #3)
4. ✅ **抽象通用 `FileUploader`,并入本流水线且排在主题改造之前**(§5A / §16)。
5. ✅ **删除 `theme_neo_tagline`,统一读通用键 `subtitle`**(§4)。
6. ✅ **公安网安备号本次不做**,页脚只保留 `icp_record`(§15)。

### 第二轮新增确认(原 N1 / 编辑器修法)

7. ✅ **N1 已定:"参与作品"区块保留。**(原 §14 待确认 N1)
   - 用户接受它带来的持续性运营录入成本:每篇作品需在编辑页手工维护 `data.members`(成员 slug 串),无法自动推导(完整论证见 §3.1 / §8.2 ④)。
   - 理由:它是"团队 → 成员 → 作品"这条动线的收口,也是个人主页区别于一张名片的地方。
   - 施工照 §3.1 的 prefetch + 两道客户端复筛写;空态是**整段不渲染**。demo 数据按 §17.4 覆盖(含一位 0 作品的成员用于检验空态)。
8. ✅ **后台文章编辑器的自定义字段渲染:修,做法 = 接线现成的 `EditorPanel.vue`。**
   - 不在 `Editor.vue` 里重写第二份实现;接线**同时**清掉 `thumbnailInput` prop 这个反模式(§5A.6A)。
   - 取数途径已查实(§5A.7A):复用 `Editor.vue:51` 已有的 `manageableCategories` 请求,零额外请求、零后端改动。
   - 这是必做的前置修复,与 N1 的取舍无关:即便不做"参与作品",`role`/`skills`/`social_*` 也同样需要它才能录入。

---

## 15. 本次不修(用户已明确排除)

| 项 | 现状 | 为何不修 |
|---|---|---|
| **`v-html` 未消毒(存储型 XSS)** | `DefaultArticle` / `ProjectArticle` / `MemberPage`(新增,同样)对 `marked.parse(content)` 直接 `v-html`;SSG 侧仅基础 strip | 用户明确延后。**新代码沿用同一模式,不单独加固**(避免主题内出现两套标准)。上线前应统一接 DOMPurify 或后端 `content.pre_save` hook |
| **`article.data` 链接 scheme 未校验** | `social_*` 直出 `href`,`javascript:` 可注入 | 同上,一并延后 |
| **公安网安备号** | 页脚只有 `icp_record`(`AFooter.vue:18`,链到 `beian.miit.gov.cn`) | **用户明确排除。** 本次不加任何网安备相关字段或页脚元素。<br>若将来要做:应加**通用键 `police_record`**(与 `icp_record` 同层,进 `backend/app/models/SystemConfigModel.ts` 的 `VALID_CONFIG_KEYS` + 后台"站点配置"表单),**不是**主题键 `theme_neo_*` —— 备案号是站点法律属性,与主题无关,换主题不该丢。同理不应由单个主题的 `configSchema` 声明。 |
| 硬编码站内路径 | `theme_neo_hero_cta_link` 默认 `/a/works`、`nav_cta_link` 默认 `/contact` | 已是可配项,默认值硬编码可接受 |
| 运营指令文案暴露给访客 | `AboutPage` / `ContactPage` 未配置时显示"请到后台填写…" | 用户明确不修 |
| **首页焦点区"无置顶回退取最新"** | `DefaultHome.vue:102` `if (top && !data.length)` | 与 patterns.md 的"约定优于兜底"相冲(反面教材),但用户已限定只修 3 项 → **记录待办,不动** |
| 框架 prefetch 缺 `$query.x` 注入 | 导致 §12.1 的 3 请求代价 | 属 `frontend/src/router/index.ts` 框架改动,超出主题范围 |
| 字体自托管 / 入仓 woff2 | 走 `fonts.googleapis.cn` 镜像 | 用户拍板;`@fontsource` 方案仅留档 |
| 后端任何改动 | — | 零后端改动是本次硬约束 |
| 暗色模式 | 无 | 风格定案:不做 |
| 站内搜索页 | 无 | 不在页面清单内 |
| `ProjectArticle` 反向展示"参与成员" | works 有了 `members` 但详情页不展示 | 需按 slug 列表批量取成员,prefetch 表达不了(要 `$in`),客户端又需 team 分类 id;收益小于复杂度 → **不做** |

---

## 16. 施工顺序(第 5 步照此执行)

> 每步后跑 `npx vue-tsc --noEmit -p tsconfig.app.json --noCheck false`(`npm run build` 的 `vue-tsc` 带 `noCheck`,过了不算数)。
> 主题部分改的是 `frontend_themes/neo/` **真源**(槽位是软链,已激活)。
> **每一步一个 commit** —— 尤其批次 A,它动的是核心应用。

### 批次 A · 通用 `FileUploader`(核心应用,**先做**)

用户明确要求"先做组件再做主题":主题的图片类配置与成员二维码字段都依赖它才真正可用,反过来做等于先交付一批填不进数据的字段。

1. **`api.ts` 加 `uploadAPI.uploadFiles()` + `i18n.ts` 加 `fileUploader.*` 13 条**(§5A.3 / §5A.8)。
   *验收*:`vue-tsc` 干净;中英切换下新 key 都有值(无 `[intlify]` 缺失告警)。
2. **新建 `FileUploader.vue` + `FilePicker.vue`**,先只接 **`Files.vue`**(button 模式)+ 补「复制链接」+ 原生 `confirm()` 换 `useConfirm`(§5A.6 ①)。
   *验收*:`/admin/files` 单选/多选上传成功并刷新列表;删除走全局确认框;「复制链接」拿到 `/static/uploads/xxx.ext`(非安全上下文下降级提示可用)。
3. **`Editor.vue` 接线自定义字段(§5A.7)** —— 取数途径已定(§5A.7A,复用 `:51` 现有请求,**不必再跑接口验证**):加 `articleDataFields` computed、`form` 加 `data`、回填/归一/提交,`import EditorPanel` 并替掉侧栏内联块。**接线的同时删掉 `thumbnailInput` prop 这个反模式**(§5A.6A)。
   *验收*:给 team 分类配好 9 个字段 → 新建/编辑 team 文章侧栏出现 9 个输入 → 保存后重开值仍在;`article.data` 在 `/api/content/article?slug=` 里可见;把分类切走再切回来,已填的值不丢;选一个 `article_data_fields` 为 `null` 的分类(如 journal)→ 字段区为空且不报错。
4. **`EditorPanel.vue` 两个分支换 `FileUploader`**,删两个 emit 与 `thumbnailInput` prop;`Editor.vue` 删 `onThumbnailSelected` 与内联 dropzone,`onUploadImg` 改用 `uploadFiles`(§5A.6 ②③)。
   *验收*:缩略图上传/从文件库选择/移除三条路径都通;attachment 字段(微信二维码)同样;md 编辑器里拖图上传仍工作。
5. **`Settings.vue` 的 `image` 分支接 `FileUploader`**(§5A.6 ④)。
   *验收*:"设置 → 主题设置"里 `theme_neo_avatar` 出现真上传器 + 库选择,保存后刷新值仍在、预览正常。
6. **批次 A 回归**:`npm run build` + 手过 `/admin/files`、文章新建/编辑、`/admin/settings` 三条录入路径。

### 批次 B · 主题改造

7. **`tokens.css`** 新建 → `Layout.vue` 改 scoped + 加 `neo-scope` + import。
   *验收*:现有页面视觉零变化(截图对比首页/作品页)。
8. **`AHeader.vue` / `AFooter.vue`** destructure → computed。
   *验收*:导航、CTA、页脚链接、社交图标均正常;SPA 内多次跳转后仍正常。
9. **`Socials.vue`** 换血:删 4 平台、加 4 平台 + 微信 popover、`source`/`size` props、`ICONS` fallback。
   *验收*:页眉页脚调用处未改动仍工作;配了 `theme_neo_social_wechat_qr` 后点击弹出、点外部/Esc 关闭;弹层不被 sticky header 遮挡。
10. **`theme.config.ts`**:`init()` 换域名 + `configSchema` 重写(16 项)+ `pages.MemberPage` 新增;**同步改 `DefaultHome.vue:81` 与 `AboutPage.vue:40` 的 `tagline` computed 为直接读 `config.subtitle`**(§4 删 `theme_neo_tagline` 的配套)。
    *验收*:DevTools Network 里字体走 `fonts.gstatic.cn` 且 200;后台"主题设置"出现 **16 项**、分组正确、无 `theme_neo_tagline`;把"站点配置 → 副标题"改掉,首页副标语与关于页同步变化。
11. **`MemberLayout.vue`** 新建(最小骨架 + `<slot/>`),并在 `theme.config.ts` 的 `pages` 里**显式登记空条目 `MemberLayout: {}`**(§7.4 的注释一并抄上)。⚠ 条目必须保持为空对象,绝不写 `layout: 'Layout'`。
    *验收*:`pages` 里 `MemberPage` 与 `MemberLayout` 两个条目都在;打开成员页 DevTools Network **没有** `menus` 请求(证明未继承 `Layout`)。
12. **`MemberPage.vue`** 新建(4 个区块 + 空态 + 响应式)。
    *验收*:把 team 分类 `content_template` 改成 `MemberPage`,打开 `/a/team/member-1` → 无 header/footer、返回链接可用、作品区按 `members` 正确出现;`?page=` 不适用此页。
13. **`lib.ts`** 分页进 URL。
    *验收*:4 个列表页翻页 URL 变化、直开 `?page=2` 正确、后退回到上一页且滚动位置恢复、第 1 页无 `?page` 参数。
14. **`TeamGrid.vue`** 整卡可点 + 去字母社交 + `.card-more`。
    *验收*:卡片任意空白处可点进个人主页;⌘/中键新标签打开正常(靠真 `<a href>`)。
15. **`frontend/index.html:6`** preconnect 换域名。
16. **全量回归**:`npm run build` + 手点 10 个页面(首页 / 4 个列表 / 3 类详情 / about / contact / 成员页)+ 移动端 375px 宽走一遍;再回 `/admin` 确认主题 CSS 没泄漏进管理端。

---

## 17. 第 6 步:demo 数据需要准备什么(`neo-demo-data.json`)

现状:`_meta` + `system_config`(21,键名是 `configkey`/`configvalue`)+ `categories`(5)+ `menus`(2)+ `articles`(22)+ RBAC 表 + `users`(2)。

**必改**
1. `categories`:
   - id=3(team)`content_template`: `DefaultArticle` → **`MemberPage`**
   - id=1/2/3 补 `article_data_fields`(§2.1 的三个对象,**原样对象,不要 JSON 字符串化**)。id=1 现有的 `{"ggg":{"title":"bbb","type":"text"}}` 是手工试填残留,**直接被覆盖掉**(§12.3)
   - id=4/5 `article_data_fields` 保持 `null`
2. `system_config`:删 `theme_neo_social_x` / `_dribbble` / `_linkedin` / `_instagram`;新增 `theme_neo_social_bilibili` / `_douyin` / `_xiaohongshu` / `_zhihu`。
   - **删 `theme_neo_tagline`(现 `:40`)** —— 副标语统一走通用键 `subtitle`(现 `:20`,**保留并写好值**)。两个键都写值是第一版的重复真源,已按 §4 收敛;导入后"站点配置 → 副标题"就是唯一编辑入口。
   - `theme_neo_social_wechat_qr` **留空或不写**(没有真图可指;空则微信图标不渲染,正是设计的降级)。
   - 站点级社交只给 `github` + `bilibili` + `zhihu` + `contact_email` **4 项有值**,`douyin`/`xiaohongshu` 留空 —— 顺带演示"空则隐藏"。
3. `articles` — team 4 篇(id 13-16,`member-1..4`):
   - `data.social_x` **删除**;按人**差异化**配置社交(演示空态):
     | slug | github | bilibili | douyin | xiaohongshu | zhihu | email | wechat_qr |
     |---|---|---|---|---|---|---|---|
     | member-1 | ✓ | ✓ | — | ✓ | ✓ | ✓ | — |
     | member-2 | ✓ | ✓ | — | — | ✓ | ✓ | — |
     | member-3 | — | ✓ | ✓ | ✓ | — | ✓ | — |
     | member-4 | ✓ | — | ✓ | — | — | — | — |
   - `content` 从"空/占位"改为**每人 3-5 段真 Markdown 个人简介**(带 1 个 `##` 小标题 + 1 段 `>` 引用,以便检验 prose 样式);`description` 保留一句话简介(TeamGrid 卡片用)。
   - `skills` 保留现有逗号串。
4. `articles` — works(id 1-N)每篇加 `data.members`,覆盖到全部 4 位成员,且**至少一位成员参与 ≥2 个作品**(检验列表)、**至少一位成员 0 作品**(检验"整段不渲染"的空态)。
   > 与 §17.3 的社交表对齐建议:member-4 作为"0 作品"样本。
5. **外链占位图全部清除**:`works.thumbnail` / `works.data.gallery` / `team.thumbnail` 现在都指向 `https://mockimg.dev/...`(国内慢/易挂)。
   - **默认方案(推荐)**:全部**留空**。所有消费点都已有 on-brand 空态 —— `WorkGrid.vue:16-17`、`DefaultHome.vue:22-23`、`TeamGrid.vue:15-16` 的 45° 米色斜条纹 + 首字母;`ProjectArticle` 的 cover/gallery 直接不渲染。零外部依赖、零仓库体积,且交付说明里写明"上传真实图片"。
   - 备选(若审阅要求 demo 有图):生成 4-6 个 2-4KB 的纯色/条纹 SVG 放 `backend/static/uploads/`,并补 `attachments` 行,thumbnail 指向 `/static/uploads/*.svg`。**注意** `TeamGrid`/`WorkGrid` 用 `backgroundImage: url(${thumbnail})` 拼接,**data: URI 会因逗号/井号破坏 CSS**,所以只能用真实文件路径,不能用内联 data URI。
6. `theme_neo_avatar` 同样从 mockimg 外链改为**留空**(关于页头像区自动隐藏)。

**导入注意(patterns.md §E)**:`publish_at` 用真 `null`;`category_id` 数字;`data`/`items`/`article_data_fields` 是**对象**不是 JSON 字符串;id 从 1 连续、`articles` 最后导入。测导入用一次性库:`cp data/test.db{,.bak}` → 导入 → 冒烟 → 还原;重启后端前 `pkill -9 -f "index.ts"; lsof -ti tcp:3000 | xargs kill -9`。

**冒烟清单(第 6 步收尾)**
- `/a/team` 4 张卡整卡可点,卡内无字母社交
- `/a/team/member-1` 无 header/footer、7 项社交里只出现有值的 5 项、作品区列出 ≥2 条
- `/a/team/member-4` 作品区**整段不出现**
- `/a/works?page=2`(若作品 >12)直开正确
- 首页副标语与关于页 tagline 都来自"站点配置 → 副标题"(改一处两处都变);全站无 `theme_neo_tagline` 残留
- 后台 team 文章编辑器出现 9 个自定义字段,微信二维码字段是 `FileUploader`(可上传、可从文件库选)
- 后台"主题设置"里 `theme_neo_avatar` / `theme_neo_social_wechat_qr` 是 `FileUploader`,hint 不再包含"去 /admin/files 手动粘 URL"的操作说明
- `/admin/files` 每个文件卡可「复制链接」,删除走全局确认框

---

## 16. 后续修订(上线后)

### 16.1 正文样式收到 `prose.css`(唯一一份)

**症状**:文章正文里标题、引用、表格、列表"和纯文本没什么区别"。

**根因两条**:

1. **`<style scoped>` 管不到 `v-html`**。`marked.parse()` 出来的节点没有 `data-v-xxx`,所以
   `.prose code { … }` 这类写法**一条都不生效**,只有 `:deep()` 包住的才行。四个模板里真正生效的
   规则加起来只有 `h2 / p / blockquote / a` —— `h3`、列表、表格、代码块、`hr`、`img` 全是浏览器
   默认样式。
2. **四份复制已经漂移**:同一个链接在 MemberPage 是墨黑 + 朱红波浪线,在 AboutPage / ProjectArticle
   是朱红实色;`blockquote` 的 padding 三个值。

**做法**:新增 `prose.css`,选择器一律 `.neo-scope .neo-prose ...`(同 tokens.css 的理由:类选择器
在 /admin 匹配不到,不会漏样式),由两个 shell `import`。覆盖 Markdown 能产出的全部元素:三级标题
三种"材质"(h2 朱红竖条 / h3 方块+细底线 / h4-h6 等宽小标签)、自绘列表标记(朱红方块 / Space Mono
编号)、GFM 任务列表复选框、引用、行内码与反相代码块、三线表 + 墨底表头、`hr`(左朱红右墨黑)、
图片描边硬阴影、`figcaption`、`kbd`、`iframe`,以及窄屏下的字号与表格横滑。

调用点只用变量调**尺度**,不再复制外观:

```css
.content { --prose-measure: 680px; --prose-size: 1.2rem; }
```

另:正文字体栈补了 CJK 兜底(`'Manrope', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei'`)——
Manrope 没有汉字字形,不写就掉进浏览器默认字体;行距按中文调到 1.85。

### 16.2 移动端抽屉:`fixed` → `absolute`

**症状**:汉堡按钮行为异常、菜单被遮挡、未展开时还在右侧占地方把页面横向撑宽。

**根因是一个**:`.site-header` 有 `backdrop-filter`,而 backdrop-filter 会让自身成为后代
**fixed 元素的包含块**。于是 `.nav-menu` 的 `top:76px; bottom:0` 相对的是 76px 高的表头 ——
算出来高度 ≈ 0(看着像被遮挡),而 `translateX(100%)` 把它停在表头右侧之外,收起态照样贡献
布局溢出,页面被撑宽。

**做法**:改 `position: absolute` + `top:100%` + `left/right:0`(表头是 sticky,已定位;它的
padding box 本身就是整屏宽,所以 0 就铺满),收起态用 `opacity/visibility/pointer-events` +
**纵向** `translateY(-8px)`(和本文件里 `.sub-nav` 同一套写法),不再有任何横向位移。
`max-height: calc(100dvh - 76px)` + `overflow-y:auto`;`z-index: 70`。顺带给汉堡加
`aria-expanded` / `aria-controls`。

**教训**:`filter` / `backdrop-filter` / `transform` 都会悄悄改写"谁是包含块"。表头这类会加
这些属性的容器里,别用 `position: fixed` 排布子元素。

### 16.3 进文章不回到顶部

框架的 `router.scrollBehavior` 已对新导航返回 `{ top: 0 }`,但实测本主题点进文章仍停在原位置。
补 `lib.ts` 的 `scrollToTopOnEnter()`,在 DefaultArticle / ProjectArticle / MemberPage /
DefaultCategory 调用。它靠 `history.state.scroll` 区分"全新 push"与"后退/前进":后者带着
vue-router 写下的滚动记录,直接跳过,不和框架的 300ms 延迟恢复打架。

只能放在**每次导航都会重挂的模板**里 —— 布局由 DynamicView 按 `layouts.join('>')` 做 key,
在导航之间是复用的,写在 Layout 里只会首次进站生效一次。

### 16.4 作品页被横向撑开:`1fr` 轨道的 `min-width: auto`

**症状**:进作品页,整页被横向撑宽。

**两个来源,一个是我新引入的、一个是一直都在的**:

1. **我引入的**:`prose.css` 给行内 `code` 写了 `white-space: nowrap`。一段长命令 / 长路径因此
   不能断行,成了一个"最小宽度很大"的盒子。改成 `white-space: pre-wrap` + `overflow-wrap: anywhere`
   (保留码内空格,但允许在任意位置断)。表格同样:`max-width` 拦不住表格(它按内容最小宽度算),
   所以让它自己变成滚动容器 —— `display: block; width: fit-content; max-width: 100%; overflow-x: auto`,
   窄表格贴着内容、宽表格内部横滑,窄屏那套单独规则也就不需要了。

2. **一直都在的**:`min-width` 对**弹性/网格项**的初始值是 `auto`,意思是"不得窄于内容的最小
   尺寸"。本主题有 25 处 `1fr` 轨道、原先**一处 `min-width` 都没有** —— 于是任何一个宽子元素
   (大图、宽表格、`pre`、不可断长串)都能把轨道顶开,把整页撑宽。作品页 `.proj-body` 是
   `260px 1fr`,正是这个形状;它的 `.cover img` / `.gallery img` 与 markdown 内容都在那条 `1fr` 里。

**地基规则**(tokens.css,`:where()` 写法所以特异性为 0,页面里的显式规则照旧覆盖):

```css
.neo-scope :where(*) { min-width: 0; }
.neo-scope :where(img, svg, video, iframe, canvas) { max-width: 100%; }
```

`min-width: 0` 对普通块盒本来就是初始值,所以第一条**只影响弹性/网格项** —— 正是要治的那批。
代价是弹性项从此可以被压扁:表头的标志与右侧图标组因此显式加了 `flex: none`(被压扁只会重叠)。

**排查手法**(下次再遇到,一行定位元凶):

```js
[...document.querySelectorAll('*')]
  .filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
  .map(e => e.tagName + '.' + e.className)
```
