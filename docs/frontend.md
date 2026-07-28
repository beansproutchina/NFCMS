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
> `dyapi-cli` 是 `file:../../dyapi3/dyapi-cli` 依赖 —— 和后端 pin `dyapi` 同款坑:改了 CLI 源码要在 `frontend/` 重新 `npm install` 才生效(file: 是拷贝不是软链)。

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

## i18n(务必遵守)
- 新文案**一律加到 `src/i18n.ts` 的 en 和 zh**,组件里用 `$t('...')`/`t('...')`,**别硬编码中文**。
- 现有分组:`system/action/contentStatus/roles/preview/form/dashboard/auth/front/article/user`。
- 脚本里(computed/toast)需要翻译时 `import { useI18n }`,用 `t()`;纯 toast 短消息沿用现状即可。

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
