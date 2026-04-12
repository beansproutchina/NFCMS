## Plan: NFCMS 动态无头 CMS 与前端基准架构

NFCMS 是一个基于 DYAPI 构建的高可定制、低代码、插件化的无头 (Headless) CMS，同时包含一个彻底解耦的参考测试/管理前端。

**Core Principles**:
- **解耦架构 (Decoupled)**：后端遵循 API-first，同时提供一个独立的管理后台前端供调试与展示，用户随时可以替换自己实现的前端。
- **真正的运行时低代码 (Dynamic Models)**：通过读取数据库 schema 配置，使用 `utils/dynamic` 提供的 `deriveClass` / `decorateClass`，在内存中动态赋予真正的 `@CRUD` 装饰器生成 API 类。
- **Markdown First**：核心内容模块（Article）原生拥抱 Markdown 语法，纯文本存取，将渲染全权交给前端。
- **插件化架构 (Hooks/Events)**：实现强大的 Event/Hook 系统拦截和拓展底层应用逻辑。

**Steps**
1. **核心钩子与事件引擎 (Hook/Event System)**
   * 实现一个全局 `HookManager`，支持挂载 Actions 和 Filters 至请求生命周期。
2. **核心动态模型注入器 (ModelInjector.ts)** *depends on 1*
   * 建立读取自定义模型配置的机制。利用 `deriveClass(Model, modelName)` 动态继承基类。
   * 利用 `decorateClass(DerivedModel, CRUD(route), PopTarget(uid))` 动态注册路由，并挂载到系统应用中。
3. **内置 CMS 核心模块 (Article & Auth)** *parallel with 2*
   * 搭建基础静态模型：基于 JWT 认证的 `UserModel`、全局选项 `OptionModel`。
   * 构建核心内容模型 `ArticleModel`，只管理 MD 原文文本字段与元信息。
4. **插件加载系统** *depends on 1*
   * `plugins/` 目录扫描，执行入口并使其注册进 `HookManager`，也可提供特有 Controller。
5. **Headless Schema 分发 API** *depends on 2*
   * 暴露如 `GET /api/schemas` 的端点，供前端自动构建动态表单和列表。
6. **解耦的管理后台前端 ( UI)** *depends on 3, 5*
   * 在根目录隔离 `frontend/`，初始化现代前端框架（如 React/Vue + Vite）。
   * 实现统一登录。
   * 结合 `/api/schemas` 实现**动态表格 (Data Table)** 与 **动态表单生成器 (Form Builder)**。
   * 为 `ArticleModel` 接入纯净的 Markdown 编辑器（如 `react-markdown` 或类似库）。

**Relevant files**
- `backend/index.ts` — 更新后端应用启动逻辑，引入插件器与模型动态注入器。
- `backend/app/services/ModelInjector.ts` — DYAPI 动态元编程核心代码。
- `backend/app/models/ArticleModel.ts` — 原生 Markdown 文章模型。
- `frontend/package.json` — 独立测试用管理端入口。

**Verification**
1. 验证 `ModelInjector` 能否成功动态注册并透出 `@CRUD` 路由接口。
2. 验证 Markdown 全文在 `ArticleModel` API 交互时不被转义破坏。
3. 验证管理端应用（Frontend）能够成功拦截 JWT 并读取 `/api/schemas` 生成至少一个可用动态数据表单。

**Development**
DYAPI框架的使用需要严格遵循其代码实现。位于：`backend\node_modules\dyapi`