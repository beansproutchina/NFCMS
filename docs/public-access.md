# 公开站页面权限(受众轴)设计

> 状态:**一期已实现**。后端 36/36 端到端矩阵(含 6 项越权尝试)+ 29 个纯函数单测通过;前端 lint / `vue-tsc` / `vite build` 通过。实现中修正了两处设计细节与发现一个 bug,见 §11。

现状是:公开站唯一的门是生命周期 `status='visible'`,没有任何"需登录 / 需授权"的能力。[ContentController](../backend/app/controllers/ContentController.ts) 的公开读全部走裸 `read()` 绕过 RBAC,`/static/uploads` 是裸 koa-static。本文设计**受众轴**——在不动现有 RBAC 管辖轴的前提下,给公开站加页面级门禁。

---

## 1. 心智模型:两根正交的轴

| 轴 | 回答的问题 | 判定者 | 谁在用 |
|---|---|---|---|
| **管辖轴**(现有) | 登录用户**能改**哪些内容 | `policy.can` / `scopeFilter` | 后台 `HTTP*` 路径;主题的 `crudAPI.*` 调用 |
| **受众轴**(新增) | 访客**能看**哪些内容 | `policy.canView` / `viewFilter` | 公开站 `/api/content/*` |

两轴共享 `ResourceGrant` 表和分类树展开,但**判定互不调用**。

### 两个必须避开的错误答案

**❌ 给 `status` 加第四态(如 `members_only`)。** `status` 是单值状态机(`hidden → scheduled → visible`),受众是正交维度。混进去,"定时发布 + 仅会员"就无法表达,且全站几十处 `status='visible'` 的语义会静默改变([ContentController](../backend/app/controllers/ContentController.ts#L100)、[StaticGenService](../backend/app/services/StaticGenService.ts#L91)、SchedulerService、sitemap)。

**❌ 复用 `role_permissions` 的 `articles:R` 表达"会员能看"。** 给 member 角色 `articles:R any` 等于给了它**后台读全站草稿**的权限。管辖权和访问权必须是两套。

**❌ 用 DYAPI 的字段级 PUBLIC 权限让 `content` 对匿名不可读。** 那是**模型级静态声明**([SystemConfigModel](../backend/app/models/SystemConfigModel.ts#L18) 的 `"PUBLIC": "RO"` 就是),无法按行区分"这篇是摘要墙、那篇全公开"。做不到,不要试。

### 过滤边界:自动生成的过滤,人工策划的不过滤

| 数据 | 来源 | 过滤 | 理由 |
|---|---|---|---|
| 文章列表 / 详情 | 自动查询 | ✅ | 受众轴的核心 |
| 分类列表 / 网格 | 主题自动渲染全部栏目 | ✅ | 作者无逐项控制权,泄漏是**无作者动作**发生的 |
| **菜单** | 作者逐项手工添加 | ❌ **不做** | 作者已有控制权——不想让人看见就别加进菜单 |

菜单不过滤是刻意的范围决策,它砍掉了整个设计里唯一需要第二套授权词汇(菜单项显示规则)和前端二段过滤的部分。**结果是门禁只存在于内容端点一处,导航纯表现层。** 已知代价见 §8。

---

## 2. 数据模型

### 作者侧:两个正交字段,栏目为主、文章可覆盖

```
categories.audience   String  default 'public'   -- public | authenticated | restricted
categories.teaser     Number  default 0          -- 受限时,摘要是否仍进公开列表
articles.audience     String  default ''         -- 空 = 继承栏目
articles.teaser       Number  default -1         -- -1 = 继承栏目
```

`audience` 三级的区别在**凭什么放你进来**:

| 级别 | 判据 | 场景 |
|---|---|---|
| `public` | 无 | 今天的行为 |
| `authenticated` | **只要登录**,是谁都行(登录墙) | 校园站的"内部通知":全校师生可见 |
| `restricted` | **被明确授权**(名单墙) | 工作室的"客户交付/客户A":客户 B 也是登录用户,但不该看 |

`teaser` 决定受限内容**是否仍以摘要形态出现在公开列表**:

- `teaser=0` → 列表不出现,详情 404(完全隐身)
- `teaser=1` → 列表出现卡片(标题/摘要/缩略图,**正文被剥离**),详情返回 200 + 登录引导

没有 `teaser` 的话,作者被迫二选一:完全隐身(丧失引流和 SEO)或完全公开。

### `restricted` 的授权:复刻分类授权的形状

```
ResourceGrant {
  model: "articles_audience",       // 合成 model,与 "articles_category" 同构
  resource_id: <分类 id>,           // 级联整棵子树
  access: "V",                      // view —— public-facing 查看
  grantee_type: "user" | "role",
  grantee_id
}
```

- 级联子树直接复用 [`PolicyService.expandCategories`](../backend/app/services/PolicyService.ts#L199)。
- grantee 可以是 user 或 role → **[AclEditor.vue](../frontend/src/components/AclEditor.vue) + [UserPicker.vue](../frontend/src/components/UserPicker.vue) 零改造复用**。

**为什么新造动作 `V` 而不复用 `R`**:`articles_category` 的 `R` 已经意味着"后台能读该栏目下所有文章,含草稿"。混用会把"会员能看已发布"静默升级成"会员能看草稿"。`V` 与管辖轴的动作集完全隔离。

### 单篇授权:行级 `V`(必须有)

只能授权到栏目的话,"这一篇给客户 A 看"就得为它单开一个栏目——很笨。所以受众轴同时支持**行级** view 授权,与现有行级分享同构:

```
ResourceGrant { model: "articles", resource_id: <文章 id>, access: "...,V", grantee_type, grantee_id }
```

接法几乎零成本,全是现成件:

- [`PolicyService.aclIds(state, model, action)`](../backend/app/services/PolicyService.ts#L157) 本来就按 action 过滤 `access` 字符串 → 传 `'V'` 即可。它的缓存 key 是 `${tablename}:${action}`,`V` 天然与 `R` 分开缓存,不会串。
- `viewFilter` 加第三个 OR 项 `id: {$in: aclIds(state, model, 'V')}`。三键 `$or` 已有先例——[`scopeFilter`](../backend/app/services/PolicyService.ts#L145) 现在就是 `ownerField` / `id` / `categoryField` 三键。
- `resolveVisibility` 的 ctx 多一个 `grantedIds: Set`;命中即 `full`(与栏目授权同级,任一路径命中即放行——沿用管辖轴的"独立授权路径"心智)。
- UI:文章编辑器已有的分享入口(`AclEditor`,`model=articles`)加一个 `V` 复选框。

**授权门槛**沿用现有行级分享的规则(需要该行 `U` 权限):能改这篇的人,本来就能把它改成 `public`,所以给他"让某人能看这篇"的权力不扩大攻击面。栏目级 `V` 授权仍仅 `super_admin`。

### `member` 角色:零权限行,天生进不了后台

PolicyService 明确写了「分类授权 / 行级 ACL **不需要**基础角色权限也能生效」。所以一个**零 `role_permissions` 的角色**只能出现在 `V` 授权里,后台每个接口都会 403。不需要"前台用户 vs 后台用户"的二分,现有 RBAC 已能表达。

**受众轴不认任何角色名。** `V` 授权按 role id 落在 `resource_grants` 上,所以站点可以把这个角色叫「客户」「师生」「订阅者」,或者按客户拆成好几个 —— 判定逻辑完全一样。代码里除 `super_admin` 外没有任何角色名被依赖(实测:`member` 这个字符串在整个代码库只出现在 seed 列表那一行)。

[`seedDefaultRbac`](../backend/app/services/RbacSeedService.ts) 在 setup 时播种一个 `member` 作为**开箱起点**,`is_system: 0` —— 可改名可删除。**没有** boot 时"按 name 补齐"的逻辑:那会变成框架和站点所有者抢同一张表(删掉的角色复活、新版本静默改写已有站点数据)。已有站点升级后自己在「角色与权限」页建一个即可,不缺任何功能。

### member 登录后进 /admin 会看到什么

**不动 [router 守卫](../frontend/src/router/index.ts#L374)。** 守卫保持"是否登录"这一个判据——在守卫里维护一份"哪些权限算后台权限"的清单,会和 [Layout.vue](../frontend/src/views/admin/Layout.vue#L23) 的 nav 清单漂移,产生第二份出处。

后台导航**已经**是能力驱动的:[Layout.vue:48](../frontend/src/views/admin/Layout.vue#L48) 的 `menuGroups` 按 `authStore.can(model, action)` / `isSuperAdmin` 过滤每一项,并剔除空分组;[Dashboard.vue:39](../frontend/src/views/admin/Dashboard.vue#L39) 也已按 `can()` 收敛请求 + `Promise.allSettled`。member 因此看不到任何内容/系统菜单项。

剩两个小缺口,补法都**不新增权限清单**:

| 缺口 | 补法 |
|---|---|
| 仪表盘项是 `show: () => true` 硬编码,member 会看到"只有仪表盘" | 条件化;并在 `menuGroups.length === 0` 时由 Layout 渲染「无后台权限」提示 + 回首页链接。判据**复用 `menuGroups`**,零额外维护 |
| Dashboard 里 `schemaAPI.getAllSchemas()` 无条件调用,member 吃 403 → 触发全局 error toast(`allSettled` 不崩但会弹提示) | 加 `isSuper` 条件,与同文件其它请求一致 |

---

## 3. 物化:派生成单个枚举

作者侧是两个正交字段,派生侧合成**一个**字段:

```
articles.access_eff  String default 'public'
  ∈ { public | auth | auth_teaser | restricted | restricted_teaser }
```

**为什么物化**:不物化的话公开列表查询要表达"`audience='public'` OR (`audience` 为空 AND `category_id IN publicCats`)",而 DYAPI 的 filter 语法对 `IS NULL` 支持不明、`$or` 嵌套脆。物化后退化成单字段 `$in`。

**为什么合成一个枚举而不是两个派生字段**:物化的目的就是让查询简单,单字段 `$in` 比两字段组合更贴合这个目的。

**`access_eff` 必须加进 [`CMSModel.lifecycleFields`](../backend/app/lib/CMSModel.ts#L29)** —— 项目已有"派生 / 受控字段一律不走普通 CRUD"这个容器,正好装它,不用新造机制。

### 继承规则:沿父链取最严

`audience` 严格性 `public < authenticated < restricted`,沿链取最严——子栏目**不能比父栏目更宽松**。

`teaser` 的钳制有一个**必须的例外**(实现时发现,否则设计不成立):**只有 `audience != public` 的层级对 teaser 有发言权。**

因为 `categories.teaser` 默认 0,如果一律"取最小",那么任何 public 父栏目都会把子栏目显式声明的 `teaser=1` 清掉——而 public 父栏目根本没有保护任何东西,钳制毫无意义。带默认值的字段参与"取最严"时,必须先问"这一层真的施加了限制吗"。

| 链(root → leaf) | `access_eff` | 说明 |
|---|---|---|
| `public,0` + `restricted,1` | `restricted_teaser` | public 父不钳制子的 teaser ✅ |
| `authenticated,0` + `restricted,1` | `restricted` | 父已隐身,子无法放宽 |
| `authenticated,1` + `restricted,-1` | `restricted` | 子未声明 → 按默认 0,钳制成隐身 |

后果(如实记录):非 public 父栏目声明 `teaser=0` 时,子栏目声明 `teaser=1` 无效。需要例外的作者应调整栏目结构,而不是加"允许放宽"的开关。

**不可表达的组合**:"登录用户看得到卡片、匿名看不到"。`teaser` 是二值的"摘要是否公开",刻意不做第三种模式,避免组合爆炸。

### 重算时机

`app/services/AudienceService.ts`(单例 `audience`),负责有状态的批处理:

| 触发 | 动作 | 挂在哪 |
|---|---|---|
| 文章保存 | `stampArticle(item, existing)` —— 写入前算好 `access_eff` | `ArticleModel.create/update` |
| 栏目 `audience`/`teaser` 变更 | `recomputeSubtree(catId)` —— 批量重算该子树下所有文章 | `CategoryModel.update` 之后 |
| 栏目 `parent_id` 变更 | 同上(继承走父链) | 同上 |
| 文章换栏目 | 由"文章保存"覆盖 | — |

纯函数(`computeAccessEff` / `inherit`)放 `app/lib/audience.ts`,零依赖可单测;批处理放 service。

---

## 4. 判定:一个纯函数,三处调用

```ts
// app/lib/audience.ts —— 纯函数,零依赖
type Visibility = 'full' | 'locked' | 'hidden';

resolveVisibility(
  row: { access_eff: string; category_id: number | null; id: any },
  ctx: {
    isAuthed: boolean;
    unrestricted: boolean;      // super_admin 或 articles:R any
    grantedCats: Set<number>;   // 栏目级 V 授权(已级联展开)
    grantedIds: Set<any>;       // 行级 V 授权
  },
): Visibility
```

| `access_eff` | 匿名 | 登录(无 `V`) | 有 `V`² | `unrestricted`¹ |
|---|---|---|---|---|
| `public` | full | full | full | full |
| `auth` | **hidden** | full | full | full |
| `auth_teaser` | **locked** | full | full | full |
| `restricted` | **hidden** | **hidden** | full | full |
| `restricted_teaser` | **locked** | **locked** | full | full |

¹ `unrestricted` = `super_admin` 或持有 `articles:R any` —— 让后台用户预览受限内容天然可行。
² 栏目级(`grantedCats.has(category_id)`)**或**行级(`grantedIds.has(id)`),任一命中即放行。

**列表、详情、以及未来 SSG 判定必须调用同一个函数**,否则一定漂移。这是整个设计的收口点,也是最该被单测覆盖的地方。

---

## 5. 后端落点

### PolicyService:加受众轴,不新开服务

CLAUDE.md 立了「PolicyService 是鉴权唯一权威」的规矩,新开 `AccessService` 会立刻产生第二个权威。加在 PolicyService 里,用分节注释隔开两轴:

```ts
// ══ 管辖轴(后台) ══  can / scopeFilter / hasAnyScope / manageableArticleCategories
// ══ 受众轴(公开站) ══
canView(state, row, category?): Promise<Visibility>   // 单页;返回三态,不是布尔
viewFilter(state): Promise<any>                       // 列表;AND 进公开查询
viewableCategoryIds(state): Promise<Set<number>>      // 分类列表过滤复用
```

`viewFilter` 的形状:

| state | filter |
|---|---|
| `unrestricted` | `{}` |
| 匿名 | `{ access_eff: {$in: ['public','auth_teaser','restricted_teaser']} }` |
| 登录 | `{ $or: { access_eff: {$in: ['public','auth','auth_teaser','restricted_teaser']}, category_id: {$in: [...grantedCats]}, id: {$in: [...grantedIds]} } }` |

空集合时 `{$in: []}` 对 OR 无贡献——与 [`scopeFilter`](../backend/app/services/PolicyService.ts#L148) 现有注释的行为一致;三键 `$or` 也与它同形。

**无缓存**,与 PolicyService 现有的显式选择保持一致(避免陈旧权限窗口)。匿名路径连 `resource_grants` 都不用读(匿名不可能持有 grant),分类树复用 `state._catChildren`。

### 公开读收口到一处

现在 5 个公开读方法各自裸读,分散就一定漏。收口:

```ts
// app/utils/contentHelpers.ts
readPublic(model, state, param)
//  = 强制 status:'visible'
//  + AND policy.viewFilter(state)
//  + 出口逐行 resolveVisibility:'locked' → 剥掉 content 等正文字段 + 标记 locked:true
//                                'hidden' → 防御性丢弃
```

[ContentController](../backend/app/controllers/ContentController.ts) 的 `getHome` / `getArticle` / `listArticles` / `getCategory` / `preview` 全改调它。`getArticle`/`getCategory` 额外走 `canView` 单点复核。

收口后可以立 lint 规则:**ContentController 里禁止出现 `articleModel.read(`** —— 把不变式变成可自动检查的(同 [`frontend/scripts`](../frontend/scripts) 里那批规则的思路)。

顺带修:`getCategory` 目前完全不校验栏目可见性,`enrichCategoryData` 里那个 `ForbiddenError` 在这条路径上根本没被用到。

`mergeFilter` 现在是 [CMSModel](../backend/app/lib/CMSModel.ts#L102) 的文件私有函数,受众轴也要用 → 提到 `app/utils/filters.ts`,不要复制第二份。

### HTTP 语义:200-locked / 404-hidden,不要 403

| 情况 | 返回 | 为什么 |
|---|---|---|
| `locked`(teaser) | **200** + 剥正文 + `locked: true` | 403 会触发 [api.ts](../frontend/src/api.ts#L38) 的全局错误 toast 和 401 硬跳转;这里要的是**页面内引导**(标题/摘要照常渲染 + 登录 CTA) |
| `hidden` | **404** | 403 等于告诉你"这里有东西";404 不泄露存在性,且与"真不存在"统一,前端一条路径处理 |

`locked: true` **必须是响应里的显式标记**。不能让主题去猜"content 为空"——那和"真的没写正文"混淆。

**推论:公开站永远不返回 401/403,所以 [api.ts](../frontend/src/api.ts#L43) 的 401 全局硬跳转不用改。** 匿名请求 `/api/content/*` 不带 token;token 过期时 [authmiddleware](../backend/app/middlewares/authmiddleware.ts) 只是不设 `state.user` → 按匿名处理 → 依然 200/404。这是本设计的自证收益,不是待办项。

### 端点与公开面收口

调研结论:文章读取**已经**全部收敛到 `contentAPI.*`(4 个主题无例外),但分类没有——`cosmos_love`(6 处)/`school`/`pear` 都在用 `crudAPI.getList('categories')` 打 `/api/categories`,靠 [`CategoryModel`](../backend/app/models/CategoryModel.ts#L28) 的 `PUBLIC: "R"` 裸奔,全表泄漏(名字、slug、树结构)。

处理:

1. 新增 `GET /api/content/categories` —— 按 `viewableCategoryIds` 过滤。
2. `CategoryModel.permission.PUBLIC` 从 `"R"` 降成 `""`。
3. **在 [api.ts:78](../frontend/src/api.ts#L78) 的 `crudAPI` shim 里重定向**,主题一行不用改:

```ts
const CONTENT_REDIRECT = { categories: contentListCategories };
getList: (route, params = {}) => (CONTENT_REDIRECT[route] ?? crud(route).list)(params),
```

`crudAPI` 那层 shim 的注释本来就写明它存在的意义是"preserve the public theme-facing contract with zero theme edits" —— 正是为此。`menus` 不动(菜单不过滤)。

### 主题有两条数据路径

必须写清,否则以后一定有人问"为什么 `cosmos_love` 那几个页面不受 audience 管":

| 路径 | 走哪 | 受哪根轴管 |
|---|---|---|
| 公开路径 | `contentAPI.*` → `/api/content/*` | **受众轴** |
| 登录路径 | `crudAPI.*` → `/api/articles` 等 | **管辖轴**(匿名 403) |

`cosmos_love` 的 `DiaryEditor` / `MusicUploader` / `DiaryCategory` / `DiaryArticle` / `MeetupArticle` 直接打 `/api/articles`,靠 `articles:C/U own` 鉴权——**项目里已经存在"需要登录的前台"**。它不该被受众轴影响,是一期的天然回归样本。

---

## 6. 前端落点

### `AccessGate` 是一个普通模板,走统一 pages

**不给它开特殊渲染通路。** locked 时,`fetchContentData` 只把 `templateName` 换成 `'AccessGate'`,其余一切不变——`layouts` 链、`title` 解析、prefetch 注入全部复用。[DynamicView](../frontend/src/views/front/DynamicView.vue#L121) 一行不加分支。

这么做的收益是白送的:主题在 `pages` 里声明

```ts
AccessGate: { layout: 'Layout', title: '需要登录 - $data.config.site_name' }
```

就让 gate 页**自动套上主题的页眉页脚**,并参与标题解析。特殊通路是拿不到这些的。

**主题不提供时的兜底**:[Dockerfile.single:13](../Dockerfile.single#L13) 会把 `frontend_themes/<THEME>/` 整个 COPY 覆盖 `views/front/templates/`,所以兜底组件**不能放在 `templates/` 里**。放框架侧 `views/front/AccessGate.vue`,作为 [`loadComponent(name, fallback)`](../frontend/src/views/front/DynamicView.vue#L96) 的显式 fallback 传入——和现有 `defaultTemplates` 完全同一个机制。于是:主题提供 `templates/AccessGate.vue` → 用主题的;没提供 → 用框架内置的。**4 个现有主题零改动零破坏。**

主题没在 `pages` 里声明 `AccessGate` 时,`layouts` 为空 → 兜底组件自带最简样式(不套主题页眉页脚)。这是可接受的降级:能看、能登录,只是不好看;主题想要好看就自己提供一份。

### 模板入口声明归主题,不进 system_config

**gate 页用哪个模板,由主题在 `theme.config.ts` 的 `info` 里声明**,不新增 `system_config` 键:

```ts
export const info: ThemeInfo = {
  name: "Neo Studio", version: "2.0.0", author: "NFCMS", description: "...",
  home: "DefaultHome",        // 可选,默认 'DefaultHome'
  accessGate: "AccessGate",   // 可选,默认 'AccessGate'
};
```

理由不是"更整齐",而是**一类真实的 bug**:`system_config` 是**跨主题存活**的(CLAUDE.md 明确写了 `subtitle` 故意放通用键"so it survives a theme change"),而模板名是**主题内部资产**。把它存在站点级 = 一个引用活得比它指向的东西更久 —— 换主题后值就悬空了。这与我们刚修掉的「角色 id 在导入后悬空」是同一类错误。

现状正是这个病:[`home_template`](../backend/app/models/SystemConfigModel.ts#L84) 是 `VALID_CONFIG_KEYS` 里的键,[Settings.vue:321](../frontend/src/views/admin/Settings.vue#L321) 把它做成**手打自由文本框**(placeholder `DefaultHome`)——既跨主题悬空,又打错就静默回落。

于是归属规则定死:

| 数据 | 归属 | 该不该跨主题存活 |
|---|---|---|
| 站点数据(`site_name`、`subtitle`、`icp_record`) | `system_config` 通用键 | ✅ 应该 |
| 主题外观项(logo、CTA 文案) | `configSchema` → `theme_<name>_*` | 主题命名空间,天然隔离 |
| **模板入口(哪个模板是首页 / gate)** | **`theme.config.ts` 的 `info`** | ❌ 不该,随主题走 |
| 单行模板覆盖(`category.list_template`、`article.content_template`) | DB 行字段 | 必须留在 DB——是**逐行**选择,不是站点单选;陈旧值由 fallback 链兜住 |

**顺带把 `home_template` 一起迁移**(3 处小改,非破坏性):

- `router`:`config.home_template || 'DefaultHome'` → `info.home ?? 'DefaultHome'`(router 已经 import 同一个文件的 `pages`)。
- 从 `VALID_CONFIG_KEYS` 删键、删 [Settings.vue](../frontend/src/views/admin/Settings.vue#L320) 的输入框与 i18n 文案。
- **已有库里的 `home_template` 行自动失效**:`GetConfig` 只缓存白名单内或 `theme_*` 的键,删了白名单项后那行被忽略,`SetConfig` 也会拒写。不需要迁移脚本(DYAPI 迁移只增不减,正好)。
- 4 个现有主题的首页模板都叫 `DefaultHome`,而 `info.home` 可选、缺省即 `'DefaultHome'` → **一个主题都不用改**。

**"那管理员想在两套首页间切换怎么办?"** 能力没丢,只是换了归属:主题自己声明一个 `configSchema` 键(如 `theme_neo_home`),router 按 `theme_<name>_home` → `info.home` → `'DefaultHome'` 取值。这样这个选择项**随主题生死**,不会在换主题后变成脏数据。只在主题确实需要时声明,不是所有人都得知道的机制。

### 其余

1. **列表卡片的 locked 呈现。** 主题按 `article.locked` 渲染锁标记 / "登录后阅读"。内置模板给参考实现,[THEME_DEV.md](THEME_DEV.md) 补一节。
2. **访客登录复用 `/login` + `?redirect=`**,不新建页面。`redirect` 由 `AccessGate` 里的登录按钮带上(不是拦截器的事——公开站不产生 401,见 §5)。
3. **后台导航/仪表盘的两个小缺口**(见 §2),`router` 守卫不动。

---

## 7. 明确不做(及理由)

| 不做 | 理由 | 何时再看 |
|---|---|---|
| **菜单过滤** | 菜单是人工策划,作者已有控制权(不加进菜单即可) | 若出现真实抱怨 |
| **受限内容的附件/图片** | `/static/uploads` 是裸 koa-static(DYAPI 在 `dyapiApp.js` 挂的),受限文章正文里的图片可被直链拿到 | 二期:`/api/content/asset/:id` 代理 + 私有目录 |
| **自助注册** | 涉及公开写入口,风险面完全不同 | 二期 |
| **分享链接** | [preview-token](../backend/app/controllers/ContentController.ts#L117) 已是"签名换取受限内容"的现成先例,可同法实现 | 二期 |
| **`PageConfig.audience`** | 菜单不过滤后它只剩装饰;后端返回的 `locked` 已能触发 `AccessGate`,一条路径够了 | 不做 |
| **SSG** | 当前整体停用(见 [architecture.md](architecture.md)) | 恢复时按 §9 规则实现 |

---

## 8. 已知代价

1. **菜单里有、分类网格里没有的不一致。** 例:school 主题 header 有"内部通知",首页分类网格里没有。作者心智是"我手动放的就显示",自洽,可接受——**不是 bug**。
2. **受限文章的图片仍可被直链猜到**(见 §7)。
3. **菜单指向草稿文章 / 无 `list_template` 栏目仍是死链**(既有问题,非本次引入)。在**编辑器侧**修更便宜更对症:文章下拉只列 `visible`、栏目下拉标注"无列表模板"。列为可选小改,不进一期。
4. **菜单每次导航被取两次**:[router/index.ts:82](../frontend/src/router/index.ts#L82) 的 `listMenu()`(框架级,每页都调)+ 每个主题 Layout 的 `crudAPI.getList('menus')` prefetch。既有浪费,与本设计无关,可顺手去重。

---

## 9. 一期任务清单

**后端**

- [x] `app/lib/audience.ts` —— 纯函数:`computeAccessEff` / `inherit`(取最严)/ `resolveVisibility`。**先写单测**。
- [x] `app/services/AudienceService.ts` —— `stampArticle` / `recomputeSubtree`,挂 `ArticleModel.create/update` + `CategoryModel.update`。
- [x] 字段迁移:`categories.audience/teaser`、`articles.audience/teaser/access_eff`;`access_eff` 进 `lifecycleFields`。
- [x] `PolicyService`:`canView` / `viewFilter` / `viewableCategoryIds` + 分节注释;`ARTICLES_AUDIENCE` 常量;行级 `V` 走现成的 `aclIds(state, model, 'V')`。
- [x] `mergeFilter` 提到 `app/utils/filters.ts`。
- [x] `app/utils/contentHelpers.ts`:`readPublic`;ContentController 5 个方法全部改调,补 `getCategory` 的可见性校验。
- [x] `GET /api/content/categories`;`CategoryModel.PUBLIC` 降为 `""`。
- [x] `AclController` 放行 `articles_audience`(栏目级 `V`,仅 super_admin)+ `articles` 的 `V`(行级,门槛=该行 `U`)。
- [x] `seedDefaultRbac` 增 `member` 角色(零权限行,`is_system: 0`,仅 setup 播种 —— 不做 boot 补齐,见 §11)。
- [x] 修 [setup seed](../backend/app/controllers/SystemController.ts#L256) 的菜单项 `type:'custom'` → `'category'`(现在标错了)。

**前端**

- [x] `api.ts`:`crudAPI.getList` 对 `categories` 重定向(**401 拦截器不动**,见 §5)。
- [x] `CategoryEditor`:audience 下拉 + teaser 开关 + 「访问授权」页签(复用 `AclEditor`,`model=articles_audience`)。
- [x] `Roles.vue`:「可访问栏目」区块(复用现有分类授权 UI 的形状)。
- [x] `Editor.vue`:文章级 audience/teaser 覆盖(默认"继承栏目");分享面板加 `V` 复选(行级授权)。
- [x] `Articles.vue` 列表:受限 / 摘要墙的状态标记。
- [x] `views/front/AccessGate.vue`(框架兜底)+ `fetchContentData` 在 locked 时把 `templateName` 切成 `info.accessGate ?? 'AccessGate'`;内置主题给 `pages.AccessGate` 声明与卡片 locked 呈现。
- [x] `ThemeInfo` 加可选 `home` / `accessGate`;**顺带迁移 `home_template`**:router 改读 `info.home`、从 `VALID_CONFIG_KEYS` 删键、删 Settings 输入框与 i18n(见 §6;非破坏,主题零改动)。
- [x] `Layout.vue`:仪表盘项条件化 + `menuGroups` 为空时渲染「无后台权限」;`Dashboard.vue` 的 schema 请求加 `isSuper` 条件。**router 守卫不动。**
- [x] i18n:en + zh 全部新文案。

**文档**

- [x] CLAUDE.md 核心约定加"受众轴"一行;[THEME_DEV.md](THEME_DEV.md) 补 `locked` 与两条数据路径。
- [x] 本文状态改为"已实现"。

**回归重点**

- [x] `cosmos_love` 主题(管辖轴前台)不受影响。
- [x] 4 个主题的分类列表在重定向后行为不变;4 个主题**都没有** `AccessGate.vue`,必须都能落到框架兜底。
- [x] 匿名 / member / editor / super_admin 四种身份 × 五种 `access_eff` 的矩阵,栏目级与行级 `V` 各覆盖一遍。
- [x] member 登录后 `/admin`:导航为空 → 见「无后台权限」提示,且**不弹任何 403 toast**。

---

## 10. 二期

受限附件代理、分享 token、自助注册、访问审计,以及 SSG 恢复时的规则:**只生成 `access_eff ∈ {public, auth_teaser, restricted_teaser}` 的页面**(后两者只含摘要),sitemap 同步过滤,且内容变成非公开时要**删除**已生成文件(现在 [`regenerateArticle`](../backend/app/services/StaticGenService.ts#L91) 只在 `status` 变化时删)。teaser 页进静态正好——原本"SSG 与门禁互斥"的死结由 teaser 解开。

---

## 11. 实现记录(与设计的差异)

实现过程中修正了两处设计细节、发现一个 bug、补了一条设计里没有的升级路径。都已落到代码与本文正文里。

### 修正 1:teaser 的钳制必须跳过 public 层级

原设计只说"沿父链取最严"。但 `categories.teaser` 有默认值 0,一律取最小会让**任何 public 父栏目**清掉子栏目显式声明的 `teaser=1` —— 而 public 父栏目没有保护任何东西。规则改为「只有 `audience != public` 的层级对 teaser 有发言权」,见 §3。

一般化的教训:**带默认值的字段参与"取最严"时,必须先判断这一层是否真的施加了限制**,否则默认值会冒充作者意图。

### 修正 2:`ARTICLES_AUDIENCE` 需要独立的 grant 缓存键

`PolicyService.categoryGrantIds` 原来把 `ARTICLES_CATEGORY` 硬编码在函数体里,缓存键只有 `action`。受众轴复用它时,`V` 与管辖轴的动作虽然不同名不会撞,但只要将来两轴出现同名动作就会串味。已改成显式的 `grantModel` 参数 + 缓存键 `${grantModel}:${action}`。

### Bug:派生值重算会篡改 `updated_at`

`recomputeSubtree` 走 `ArticleModel.update` 写 `access_eff`,而那个方法**无条件**刷新 `updated_at`。后果:改一次栏目受众设置,整棵子树文章的"最后修改时间"全被污染 —— 连带影响最近更新排序、sitemap 的 lastmod、作者对自己改动的认知。

修法:`ArticleModel.update` 判断"本次写入是否只有 `access_eff`",纯派生写入不刷 `updated_at`(**派生值变化不是一次内容编辑**)。这个 bug 是靠"改完数据逐行 diff 回原始备份"发现的,不是靠测试 —— 值得记下来。

### 走错又退回来的一步:不要按 name 补齐系统角色

实现时我一度加了 `ensureSystemRoles(app)`,在 boot 时按 name 把缺失的 `DEFAULT_ROLES` 补回去,理由是"已初始化的站点升级后拿不到 `member`"。**这是错的,已撤销。**

两个问题:

1. **框架和站点所有者抢同一张表。** 所有者删掉或改名的角色会在下次启动复活;而每个新版本往 `DEFAULT_ROLES` 里加一行,都会静默改写所有已有站点的数据 —— 那是伪装成幂等的迁移。
2. **它解决的问题根本不存在。** 一查就清楚:`member` 这个字符串在整个代码库**只出现在 seed 列表那一行**,零代码依赖。受众轴按 role id 授权,不认名字。所以"老库没有 member"不是缺功能,所有者在角色页建一个、名字随自己站点语义取(「客户」「师生」),完全等效 —— 而且更合适。

播种的正确定位是**开箱起点**,不是持续强制的契约。因此 `member` 也改成 `is_system: 0`(可改名可删除)——只有 `super_admin` 才真的是基础设施(`policy.isSuper` 硬编码检查它,20 处引用)。

这条一般化:**一次性的便利播种 ≠ 持续生效的规范。** 判据是"代码是否真的依赖这个名字"——不依赖,就别在 boot 时维护它。

### 一个实现约束(不是设计问题)

`frontend/src/views/front/templates` 是指向 `frontend_themes/neo` 的**符号链接**(dev 时;Docker 构建改为 COPY 覆盖)。所以"改内置模板"和"改 neo 主题"是同一个文件 —— 这也再次确认了框架兜底组件必须放在 `templates/` 之外。

### 验证方式

- **29 个纯函数单测**(`backend/test/audience.test.ts`,`bun test`):5×4 判定矩阵、继承规则(含上面那条修正的关键用例)、`ACCESS_EFF_*` 常量与矩阵自洽、整形不改原对象。
- **36 项端到端矩阵**(匿名 / member / 有授权 member / super_admin × 五种 `access_eff`,栏目级与行级 `V` 各一遍),含 **6 项越权尝试**:伪造 `access_eff`、伪造 `status=hidden`、用 `$or` 试图放宽、直接点名隐身栏目、隐身文章详情、显式 `fields=content` 索取正文。全部按预期拒绝。
- 前端:`npm run lint`(设计系统规则)/ `vue-tsc` / `vite build` 全过。**未做浏览器视觉确认** —— gate 页与卡片锁标记的渲染是靠代码路径推导 + 构建通过,不是靠肉眼看过。
