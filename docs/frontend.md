# Frontend

代码在 `frontend/`,Vue 3 `<script setup>` + Vite 8 + PrimeVue(unstyled + Tailwind 4 PassThrough)+ vue-router 5 + vue-i18n `^11`。

## 结构
- 入口 `src/main.ts`(createApp + router + i18n + PrimeVue Aura + ToastService);`src/App.vue`(Toast + RouterView + 全局 `app-error` 事件→toast)。
- 路由 `src/router/index.ts`:
  - 展示站:`/`、`/a/:cat/:article`、`/a/:cat`、`/preview`。
  - `/setup`、`/login`;`/admin/*`(Layout + 子路由:articles/categories/menus/users/**roles**/files/settings/crud/:model)。
  - 守卫做初始化检查 + `localStorage.user` 存在性 + 非 super 的路径白名单(**装饰性**,真鉴权在后端)。
  - `meta.fetch`(fetchHome/fetchCategory/fetchArticle)在 `beforeResolve` 预取数据塞 `to.meta.fetchedData`。
- API 客户端 `src/api.ts`。
- i18n `src/i18n.ts`(en/zh)。

## api.ts 约定(重要)
- 单 axios 实例,`baseURL:/api`,`withCredentials:true`(JWT 在 httpOnly cookie)。
- **响应拦截器**:2xx 返回 `response.data`(即 body `{code,data,...}`);出错时提取后端 `message`,`reject(new Error(message))` 并挂 `.code`/`.data`,同时派发全局 `app-error`。→ 调用方 `catch(e => e.message)` 一定拿得到后端消息。401(非登录请求)会清 localStorage 并跳 `/login`。
- 分组:`authAPI`、`systemAPI`、`contentAPI`(含 `getHome/getCategory/getArticle/previewToken/preview`)、`crudAPI`(通用 REST:getList/getOne/create/update/remove)、`uploadAPI`、`schemaAPI`、**`lifecycleAPI`**(transition/revisions/rollback/share/grants/revoke)。
- **公开站只用 `contentAPI`(`/content/*`)**;`crudAPI('articles')` 等是后台 RBAC 管控端点,匿名会 403。

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
- 模板在 `src/views/front/templates/*.vue`;`templates_example/` 是参考。每个模板收到统一 `context` prop(`config/menus/user/api` + 页面数据)。文档见 `src/views/front/THEME_DEV.md`。
- 换主题:把 `frontend_themes/<name>/` 在**构建期**拷进 `templates/`(Docker `THEME` build arg)。`import.meta.glob` 是编译期解析——换主题需重新构建,不是运行时。
- 首页/分类/文章模板可由配置/记录字段在**已编译进包的模板中**选择(`home_template`/`list_template`/`content_template`)。
- **XSS 注意**:模板对 `article.content` 用 `v-html` 且未消毒——上线前接 DOMPurify 或后端消毒。

## 构建
```bash
npm run dev      # vite(代理 /api、/static 到 :3000)
npm run build    # vue-tsc -b && vite build → dist/(SSG 会以 dist/index.html 为壳)
```
- `vue-i18n` 固定 `^11`(12-alpha 需要 Vue 3.6,会导致 rolldown "Missing export useInstanceOption" 构建失败)。
- 若改主题模板导致 `vue-tsc` 报 `string|number` 比较错(`v-for` index over `any`),用 `Number(index)`。
