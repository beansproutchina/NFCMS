# Frontend

代码在 `frontend/`,Vue 3 `<script setup>` + Vite 8 + PrimeVue(unstyled + Tailwind 4 PassThrough)+ vue-router 5 + vue-i18n `^11`。

## 结构
- 入口 `src/main.ts`(createApp + router + i18n + PrimeVue Aura + ToastService);`src/App.vue`(Toast + RouterView + 全局 `app-error` 事件→toast)。
- 路由 `src/router/index.ts`:
  - 展示站:`/`、`/a/:cat/:article`、`/a/:cat`、`/preview`。
  - `/setup`、`/login`;`/admin/*`(Layout + 子路由:articles/categories/menus/users/**roles**/files/settings/crud/:model)。
  - 守卫做初始化检查 + `localStorage.user` 存在性 + 非 super 的路径白名单(**装饰性**,真鉴权在后端)。
  - `meta.fetch`(fetchHome/fetchCategory/fetchArticle)在 `beforeResolve` 预取数据塞 `to.meta.fetchedData`。
- API 客户端 `src/api.ts`(手写接线层)+ `src/api.gen.ts`(**代码生成,勿手改**)。
- i18n `src/i18n.ts`(en/zh)。

## API 层:生成 + 接线(重要)

**两个文件,职责分开:**

| 文件 | 谁维护 | 内容 |
|---|---|---|
| `src/api.gen.ts` | `dyapi-cli` 生成,**禁止手改** | 11 个模型的实体类型 + CRUD 函数、27 个 controller 函数、`crud(route)` 逃生舱 |
| `src/api.ts` | 手写 | axios 实例 + 拦截器 + `configureApi` 接线 + 语义封装分组 |

**重新生成**:改了后端 model/controller 后跑 `npm run gen:api`,并把 `api.gen.ts` 一起提交。
> `dyapi-cli` 从 npm 装(`~0.3.0`)。生成器换版本可能让产物有细微差异(类型推断的宽窄),所以**重新生成后要看一眼 diff**,别把无关变化混进提交。

**接线的两个硬约束**(改错了会静默出错,不报编译错):
1. `api` 实例的 `baseURL` 必须是**空串**。`api.gen.ts` 产出的是含前缀的绝对路径(`/api/articles`),再叠加 `baseURL:'/api'` 会变成 `/api/api/articles`。
2. `configureApi({ instance: api, unwrap: false })` 的 `unwrap: false` **不能省**。拦截器已经把响应解包成 body,生成层若再解一次,列表响应的 `total`/`pages` 会静默消失。

- **响应拦截器**:2xx 返回 `response.data`(即 body `{code,data,...}`);出错时提取后端 `message`,`reject(new Error(message))` 并挂 `.code`/`.data`,同时派发全局 `app-error`。→ 调用方 `catch(e => e.message)` 一定拿得到后端消息。401(非登录请求)会清 localStorage 并跳 `/login`。
- **静态模型直接用具名函数**:`listArticle/getArticle/createArticle/updateArticle/removeArticle`、`listUser`、`listRole`… 参数是 `ReadQuery`(`filter` 传对象,生成层会 `JSON.stringify` —— dyapi 框架层对每个请求都 `JSON.parse(ctx.query.filter)`)。
- **运行时/动态模型用 `crud(route)`**:静态分析看不见的模型(`ModelInjector` 注入的、用户自建的)走这个逃生舱,如 `DynamicCrud.vue`。
- 语义封装分组保留:`authAPI`、`systemAPI`、`contentAPI`、`uploadAPI`、`schemaAPI`、`aclAPI`、`lifecycleAPI`。它们只是把生成函数包成更顺手的签名(位置参数代替 query 对象),返回类型自动推断。
- **公开站只用 `contentAPI`(`/content/*`)**;`listArticle()` 等是后台 RBAC 管控端点,匿名会 403。

## 主题的两个「字符串/动态」扩展面(编译器管不到)
1. **prefetch 派发**:`theme.config.ts` 里 `prefetch: [{ api: 'crudAPI.getList', args: [...] }]` 按**字符串**索引。可调用的 API 白名单是 `router/index.ts` 的 `PREFETCH_APIS` 表 —— 加新的主题可用 API 要往这张表里加行,`crudAPI.*` / `contentAPI.*` 这些名字是对存量主题的公开契约,不能改名。
2. **注入的 api 对象**:`DynamicView.vue` 把整个 `* as api` 塞进模板渲染上下文,主题可以 `api.xxx` 直接调。改 `api.ts` 的导出等于改主题 API。

## 管理台惯例
- 列表页用 `components/SmartTable.vue`(动态列 + PassThrough 样式);弹窗用 `components/AdminModal.vue`。
- 文章:`views/admin/Articles.vue`(状态徽章 + 行内发布/隐藏)、`Editor.vue`(保存草稿/发布/隐藏/定时/预览、版本历史回滚、共享 ACL)。
- 用户:`Users.vue` + `UserEditor.vue`(主角色下拉从 `roles` 表动态取 + 附加角色多选 → 保存时 `syncUserRoles` 同步 `user_roles`)。
- 角色:`Roles.vue`(角色 CRUD + 权限矩阵:模型×动作×范围)。
- 状态三态用 `$t('contentStatus.' + status)`;`hidden/scheduled/visible`。

## 设计系统(管理台 UI 一律照此写)

三层,各有唯一出处。**外观走令牌与 preset;布局(flex/grid/gap/padding/width/position)按需内联。**

### 1. 令牌 — `src/style.css` 的 `@theme`

选令牌看**角色**,不看数值。

| 族 | 令牌 | 用途 |
|---|---|---|
| 文字 | `label` `label-2` `label-3` `label-4` | 主 / 次 / 提示 / 禁用 |
| 分隔线 | `separator` `separator-weak` | 看得见的边界 / 卡片内发丝线 |
| 填充 | `fill` `fill-strong` | hover 底 / 选中底 |
| 遮罩 | `scrim` `chrome` | 弹窗背后 / 深色半透明应用栏 |
| 面 | `white` `canvas` `surface` `surface-hover` `divider` | 卡片 / 页面底 / 卡片内次级面 / 其 hover / 实色分隔 |
| 品牌与语义 | `accent` `accent-hover` `link` `danger` `danger-hover` `warn` `warn-fill` `info` `info-fill` `indigo` `indigo-fill` | 主色 / 链接 / 破坏性 / 警示 / 信息 / 角色徽章 |
| 字号 | `text-small` `text-body` `text-title-item` `text-title-section` `text-title-page` | 12 / 14 / 17 / 20 / 40 |
| 圆角 | `rounded-chip` `rounded-control` `rounded-card` `rounded-full` | 4 / 8 / 12 / 药丸 |
| 阴影 | `shadow-card` | 卡片 |

**新增令牌前先确认现有阶数不够用。** 加令牌时守四条:

1. 同族 ≤5 阶,相邻两阶肉眼可辨。
2. 一个值只对应一个令牌。
3. 按角色命名(`label-3`),不按数值命名。
4. 用自定义名(`--text-body`),不覆盖 Tailwind 内置名(`--text-sm`)——后者会静默失效。

**用 `text-black` / `text-gray-500` / `text-xs` / `rounded-lg` 会被门槛拦下。** 例外只有一处:图标与徽章底色的**分类装饰色**(标识「哪个指标」「哪个角色」),把它们集中在视图顶部的数据声明里(参照 `Dashboard.vue` 的 `stats` 数组)。

### 2. preset — `src/ui/presets.ts`

**按用途查表取用,不要手写等价的类串。**

| 需要 | 用 |
|---|---|
| 单行输入 | `INPUT_CLASS` / 紧凑 `INPUT_CLASS_SM` / 密集树形行 `INPUT_CLASS_XS` |
| 多行输入 | `TEXTAREA_CLASS` / 代码 `TEXTAREA_CLASS_MONO`(**永不给 textarea 固定 `h-*`**) |
| 引导页字段 | `INPUT_CLASS_LG` / 密码 `PASSWORD_LG` |
| 下拉 / 日期 / 复选 | `SELECT_PT` / `DATEPICKER_PT` / `CHECKBOX_PT` |
| 按钮 | `BTN.primary\|secondary\|danger`;行内密集用 `BTN_SM.*`;独立表单卡片(登录 / 初始化向导)的提交键用 `BTN_LG.*` |
| 圆形图标按钮 | `BTN_ICON.plain\|danger\|subtle\|nav` |
| 深色顶栏图标按钮 | `TOPBAR_ICON` |
| 二选一分段控件 | `SEGMENT.wrap` + `SEGMENT.item` + `SEGMENT.active\|idle` |
| 移除一项 | `BTN_REMOVE` |
| 权限位开关 | `TOGGLE.base` + `TOGGLE.on\|off` |
| 侧边导航项 / 可选中列表行 | `NAV_ITEM.base` + `NAV_ITEM.active\|idle`;`ROW` 是它的别名(逐类相同,两个名字只为语义) |
| 文字链接 | `LINK.action\|danger\|small` |
| 页面骨架 | `PAGE.container\|header\|title\|subtitle` |
| 卡片 / 区块标题 | `CARD` / `SECTION_TITLE` |
| 表单标签 / 字段组 | `LABEL`(带下边距) / `LABEL_BARE` / `FIELD_GROUP` / `REQUIRED_MARK` |
| 状态与角色徽章 | `CHIP.neutral\|info\|warn\|accent` |
| 命名文字角色 | `TEXT.caption\|meta\|hint\|muted` |
| 空态 / 搜索 / 遮罩 / 磁贴 | `EMPTY` / `SEARCH.icon` + `SEARCH.input` / `SCRIM` / `TILE` |
| 弹窗 | `AdminModal.vue`;头部 ✕ 用 `DIALOG_CLOSE`;全局确认框已接 `CONFIRM_PT` |

写法:
```vue
<InputText unstyled :class="INPUT_CLASS" />
<Select unstyled :pt="SELECT_PT" class="flex-1 min-w-0" />
<Button unstyled :class="BTN.primary" />
<!-- 需要额外类时:静态 class 与动态并存,Vue 会合并 -->
<div class="mb-4" :class="CARD">…</div>
```
per-instance 的宽度/flex 写在组件自己的 `class`(会并入 root);**尺寸与内边距由 preset 决定,调用点不要重写**。

#### 页面骨架(新建后台页照抄 `Settings.vue`)

preset 只保证"零件长得一样",页面怎么摆是另一回事 —— 这几条只存在于现有页面里,新页面必须跟上,
否则一眼就能看出是外挂的(「我的资料」页初版就踩了全部三条):

| 位置 | 约定 |
|---|---|
| 容器 | 表单类页面用 `max-w-4xl mx-auto py-10 w-full px-6`(`PAGE.container` 是 `max-w-7xl`,给列表页用) |
| 页头 | `PAGE.header` + 左侧 `PAGE.title`;**动作键一律在右上**(`<div class="flex gap-4 items-center">` 里放 `BTN.primary` / `BTN.secondary`,带 Lucide 图标),不要把保存放在卡片底部 |
| 副标题 | **不用**。`PAGE.subtitle` 存在但没有任何页面在用,后台页只有标题 |
| 卡片 | `<div class="p-8 mb-6" :class="CARD">` —— `CARD` 只有底色/圆角/描边/阴影,**内边距由调用点给**,漏了就是一个 padding 为 0 的框 |
| 字段 | 卡片内 `flex flex-col gap-6`,每个字段 `<div class="max-w-lg" :class="FIELD_GROUP">` + `LABEL_BARE`(`FIELD_GROUP` 自带间距,别再用带下边距的 `LABEL`) |

写新页面前先打开 `Settings.vue` 对一遍 —— CLAUDE.md 的「复用现有模式而非另起一套」说的就是这件事。

**同一串外观类出现第二次就提成 preset**,并把它放进上表。`npm run lint` 会提示重复组合。

### 3. 组件与交互

- 表单控件用 **unstyled PrimeVue + preset**。原生 `<button>` 可以保留 —— 列表行、tab、导航磁贴语义上就是 button/link —— 但**必须穿 preset**。隐藏的 `<input type="file">` 与 `<button type="submit" class="hidden">` 例外。
- 确认框用 `useConfirm()`;提示用 `useToast()`。二者样式已统一,直接调用即可。
- 模板里每个 PascalCase 组件都要有来源(import / 局部声明 / 自引用)。漏了不会报错,只会渲染成 0×0 的未知元素。
- hover / focus 变体必须与基态取不同令牌。

## 提交门槛(pre-commit,自动执行)

`npm install` 时通过 `prepare` 装好;也可手动 `npm run hooks:install`。提交前自动跑:设计系统规则 → `vue-tsc` → `vite build`,约 5 秒。

```bash
npm run lint          # 只跑规则
npm run lint:list     # 含已接受项的完整清单
npm run lint:accept   # 把当前状态收进 baseline
```

拦下时报出 `file:line` 与改法。**修掉是正途**;确实合理的例外往 `frontend/scripts/lint-baseline.json` 加一条(该文件进 review),不要用 `--no-verify`。

规则覆盖:字面值 / 内置调色板与阶 / 死类 / 空操作状态 / 原生元素未走 preset / 原生 `confirm`·`alert` / 硬编码文案 / preset 自身旁路 / 未导入组件 / **`<Button>` 外观未走 preset(R13)** / **两个 preset 类集合重复(R14)**。另有「重复外观组合」仅提示。

R13 与 R14 补的是同一个洞的两头:前者拦「调用点自己拼一套按钮外观」——`BTN_LG` 就是因为没有大号尺寸,登录页和初始化向导各自手搓了一串逐字节相同的类;后者拦「preset 自己重复」——加 R13 那轮我就当场又写了个 `NAV_ROW`,而 `NAV_ITEM` 早已存在且内容相同。两条都比**归一化后的类集合**,词序不同一样算重复。

## i18n(务必遵守)
- 新文案**一律加到 `src/i18n.ts` 的 en 和 zh**,组件里用 `$t('...')`/`t('...')`,**别硬编码中文**。
- 现有分组:`system/action/contentStatus/confirm/common/userPicker/fileUploader/acl/roles/preview/form/dashboard/auth/front/article/menu/user/role/toast/validate/setup`。
- 操作反馈进 `toast.*`,表单校验进 `validate.*`,确认框文案进 `confirm.*`。
- 脚本里(computed/toast)需要翻译时 `import { useI18n }`,用 `t()`;`src/api.ts` 这类非组件模块用 `i18n.global.t()`。

## 展示站模板/主题
- **主题真源在仓库根 `frontend_themes/<name>/`**(`pear`/`neo`/`school`/`cosmos_love`)。每个含 `Default{Home,Category,Article}.vue`、`Layout.vue`、`components/`、`theme.config.ts`。每个模板收到统一 `context` prop(`config/menus/user/api` + 页面数据)。作者文档见 `src/views/front/THEME_DEV.md`。
- **活动主题槽位** `src/views/front/templates/`(gitignore,不入库):
  - **本地开发**:`npm run theme:use <name>` 把槽位做成指向 `frontend_themes/<name>` 的**符号链接**。直接编辑 `templates/...` 即改真源,单一出处、无副本漂移;补全/类型检查靠 `resolve.preserveSymlinks`(vite)+ `preserveSymlinks`(tsconfig)穿透符号链接。
  - **生产**:`Dockerfile.single` 按 `--build-arg THEME=<name>` 把 `frontend_themes/<name>/` **COPY** 进槽位(`.dockerignore` 排除了本地符号链接,避免悬挂)。
  - `import.meta.glob('./templates/*.vue')` 是编译期解析——换主题需重新构建,不是运行时。
- **主题契约单一出处** `src/views/front/theme-runtime.ts`:导出 `PageConfig`/`ThemePages`/`ThemeContext` 等类型,四个主题的 `theme.config.ts` 都 `import type { ... } from '@/views/front/theme-runtime'`。往这一个接口加字段(如 `title`)→ router 与所有主题同时看到,结构上杜绝「router 比主题源新」的漂移。
- **`@` → `src` 别名**:vite `resolve.alias` + tsconfig `paths` 双写,`@/...` 在编辑器/vue-tsc/构建三处一致解析。
- **页面标题**:`theme.config.ts` 每页可配 `title`,支持 `$data.*`/`$params.*` 注入(同 prefetch),router 在数据就绪后写 `document.title`。见 `THEME_DEV.md`。
- **主题面向的 `api.crudAPI`**:`context.api` 注入整个 api 模块;为兼容存量/外部主题,`api.ts` 保留 `crudAPI` shim(转发到 `crud()`)。admin 内部已改用具名函数,新代码优先 `crud(route)`/具名函数。
- 首页/分类/文章模板可由配置/记录字段在**当前主题已编译进包的模板中**选择(`home_template`/`list_template`/`content_template`)。
- 深度类型检查单个主题(揪出被 `noCheck` 构建放过的主题类型债):`npx vue-tsc --noEmit -p tsconfig.app.json --noCheck false`。
- **XSS 注意**:模板对 `article.content` 用 `v-html` 且未消毒——上线前接 DOMPurify 或后端消毒。

## 构建
```bash
npm run dev      # vite(代理 /api、/static 到 :3000)
npm run build    # vue-tsc -b && vite build → dist/(SSG 会以 dist/index.html 为壳)
```
- `vue-i18n` 固定 `^11`(12-alpha 需要 Vue 3.6,会导致 rolldown "Missing export useInstanceOption" 构建失败)。
- 若改主题模板导致 `vue-tsc` 报 `string|number` 比较错(`v-for` index over `any`),用 `Number(index)`。
