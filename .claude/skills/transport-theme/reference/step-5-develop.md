# 第 5 步 · 开发(Develop) — 子 agent 执行说明

## 前置门禁
**必须已拿到用户明确的"开始开发"。** 没有就停,交回编排器。

## 输入(编排器传入)
已批准的完整设计文档 + 所有定案。主题名 `name`,dev 槽位已 `npm run theme:use <name>`(改的就是 `frontend_themes/<name>/` 真源)。

## 必读参考
- `reference/theme-api.md` —— `theme.config.ts` 契约、`context` 字段、数据模型、模板选择、prefetch API 白名单与 `$` 注入。
- `reference/patterns.md` —— **可直接抄的模式 + 坑位分类(务必先过一遍 A–E 五类心法)**。

## 实现顺序(每完成一块就 `npx vue-tsc --noEmit -p tsconfig.app.json --noCheck false` 把关)
1. **基建**:`theme.config.ts`(`info` / `init` 加载字体 / `pages` 的 title·prefetch·routes / `configSchema`)+ 共享件(`components/Socials.vue`、`lib.ts` 分页 composable)。
2. **布局与页眉页脚**:`Layout.vue`(CSS 变量,呼应设计的配色/字体)、`AHeader`/`AFooter`(按约定 location 读 `menus`、真 `<a href>`、移动端、社交、CTA)。
3. **内容模板**:列表/详情 + 该主题特有模板(作品/服务/团队/搜索…);用 `lib.ts` 的分页;Markdown 走 `marked`;链接用真 `<a>`。
4. **首页 Landing**:分区拼装,按分类 `list_template` **自动发现**,无数据**隐藏**(不兜底塞内容)。
5. **自定义路由页**:About/Contact/Search 等(`pages[].routes` + 模板内 `context.api` 客户端取数;配置派生数据无法进 prefetch args)。
6. **收尾验证**:`npx vue-tsc --noEmit -p tsconfig.app.json --noCheck false` 零错 + `npm run build` 通过。

## 硬约束(违反必翻车,详见 patterns.md)
- 改真源不改槽位;类型检查用 `--noCheck false`(build 的 vue-tsc 不查主题)。
- `content` 是 Markdown → `marked.parse` 再 `v-html`;内部链接真 `<a href>` 走全局 SPA 委托。
- 配置/字段空则隐藏,绝不假数据、绝不"拿 A 冒充 B"。
- `v-for` over any 的 index 用 `Number(i)`。

## 产出与门禁
主题代码完成且 vue-tsc + build 均过 → 交回编排器。**演示数据是第 6 步的事,不在这里做。** 若用户对产物不满 → 编排器回到第 2/3 步修设计,别在本步硬改。
