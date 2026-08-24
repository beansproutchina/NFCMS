# NFCMS 前台主题开发指南

NFCMS 的前台支持自定义无缝的 Vue.js 模板。无论您正在构建首页、列表页还是文章详情页，系统都会将相关的数据包装为一个统一的 `context`（上下文）对象直接注入至模板中。

## 主题在哪 · 本地开发工作流

- **主题源码住在仓库根的 `frontend_themes/<主题名>/`**（`pear`/`neo`/`school`/`cosmos_love`），这是**唯一真源**。每个主题含 `Default{Home,Category,Article}.vue`、`Layout.vue`、`components/`、`theme.config.ts`。
- 应用通过一个「活动主题槽位」`frontend/src/views/front/templates/` 加载主题：**生产**由 Docker `COPY frontend_themes/${THEME}/` 填充；**本地开发**把它做成指向真源的**符号链接**。槽位永不入库（`.gitignore`）。

**切换/激活当前开发的主题**（一条命令，改哪个主题就填哪个）：

```bash
cd frontend
npm run theme:use pear      # 默认 pear;可换 neo / school / cosmos_love
npm run dev
```

`theme:use` 把槽位重指到 `frontend_themes/<名>`。**之后你直接编辑 `src/views/front/templates/...`（其实就是符号链接后的真源），改动落到 `frontend_themes/<名>/`**——单一真源、无副本漂移，且因为槽位在 `src/` 内，**自动补全、类型检查、`@` 别名、`vue-router` 等裸包全部正常**（靠 `preserveSymlinks` 穿透符号链接，已在 vite + tsconfig 配好）。

> 首次 clone 后槽位不存在，先跑一次 `npm run theme:use <名>` 再 `npm run dev`。
> 部署不变：`Dockerfile.single` 仍按 `--build-arg THEME=<名>` 把对应主题 COPY 进槽位。

**深度类型检查单个主题**（可选，能揪出主题里被日常 `noCheck` 构建放过的类型问题）：

```bash
npx vue-tsc --noEmit -p tsconfig.app.json --noCheck false
```

## 获取与使用 Context

每个位于 `templates/` 下的模板组件都只需接收一个通用的 `context` Prop：

```vue
<script setup lang="ts">
const props = defineProps<{ context: any }>();

// 解构获取对应的字段供模板使用
const { config, menus, user, api } = props.context || {};
</script>
```

## `context` 包含的完整字段全览

由于各个页面的场景不同，不是所有页面都会填充所有字段，下面是完整的 `context` 属性清单以及它们出现的页面类型：

| 属性名 (Property) | 数据类型 | 在哪些页面可用 | 描述 |
| :--- | :--- | :--- | :--- |
| `config` | `Object` | 所有页面 | 站点的基本全局配置资源（如 `site_name`, `subtitle`, `home_template`, `icp_record`, `mourning_mode` 等等由系统设置中配置的值）。 |
| `menus` | `Array<Object>` | 所有页面 | 全局定义的前台菜单列表。每个菜单包含以下属性：{ name: "Header Menu", location: "header", items:[{ label: '首页', url: '/', type: 'custom', refId: 1, children: [] },{ label: '分类', url: '/a/default', type: 'custom', refId: 1, children: [] },]} 一般而言，你可以用location来确定应该显示哪个菜单。|
| `user` | `Object \| null` | 所有页面 | 当前已登录用户的信息（如包含 `role`、`username` 等字段）。如果游客访问则为 `null`。 |
| `api` | `Object` | 所有页面 | 前端直接导出的 `api.ts` 工具包。允许您在模板深处自定义任何前端异步请求逻辑。 |
| `categories` | `Array<Object>` | 首页 (`Home`) | 返回当前所有的根分类列表，常用于首页分栏拉取各个区块。 |
| `articles` | `Array<Object>` | 首页, 分类列表页 | 首页会推入所有公开可见的文章合集（最新一定条数）；在分类列表页则仅推入隶属于该层级的对应文章分页/列表。 |
| `category` | `Object` | 分类列表页, 文章详情页 | 该页面隶属的当前核心分类信息（`id`, `name`, `slug` 等），供文章或列表调用自身的元数据。 |
| `children` | `Array<Object>` | 分类列表页 | 该层级下设拥有的全部子分类信息。常用于 Sidebar 中的二级导航呈现。 |
| `article` | `Object` | 文章详情页 | 当前独立文章的全部详细信息，包括 `title`、`content` (Markdown)、`thumbnail` 和 `published_at`。 |
| `breadcrumbs`| `Array<Object>` | 分类列表页, 文章详情页 | 由根分类至本页层级的完整路径面包屑数组 `{ id, name, slug, disabled }`。可直接用于顶部路径溯源渲染。 |

## 实战示例：统一风格的 Header 渲染

结合拿到的 `config` 和 `menus` 资源，任何模板都可以轻松呈现一个与后台对接的完全动态导航栏：

```vue
<template>
  <nav class="navbar">
    <!-- 系统全局名 -->
    <div class="logo">{{ config.site_name }}</div>
    
    <!-- 动态全局菜单 -->
    <div class="menu-items">
      <button 
         v-for="menu in menus" 
         :key="menu.id" 
         @click="navigateTo(menu.url)"
      >
        {{ menu.name }}
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
const props = defineProps<{ context: any }>();
const { config, menus } = props.context || {};
// ...
</script>
```

## 页面标题（浏览器标签页）

在主题的 `theme.config.ts` 里，每个页面配置支持 `title` 字段来设置浏览器标签页标题。它与 `prefetch` 的 `args` 用**同一套 `$` 变量注入**语法，但可以嵌在字符串任意位置，便于拼接：

```ts
export const pages: Record<string, PageConfig> = {
  DefaultArticle: {
    layout: 'Layout',
    title: '$data.article.title - $data.config.site_name',   // 「文章标题 - 站点名」
    prefetch: []
  },
  DefaultCategory: {
    layout: 'Layout',
    title: '$data.category.name - $data.config.site_name',
    // ...
  },
  Layout: {
    title: '$data.config.site_name',   // 兜底:未单独设标题的页面用它
    // ...
  }
};
```

注入规则：

- `$data.<路径>` —— 读取当前页面数据。作用域是「`config`(站点设置) + 该页的实体(`article`/`category`/…) + 所有 prefetch 拉到的 key」的合集,例如 `$data.article.title`、`$data.config.site_name`、`$data.category.name`。
- `$params.<名>` —— 读取路由参数,如 `$params.category_slug`。
- 解析在**实体与 prefetch 数据都就绪之后**执行,所以能安全引用它们。未命中的 token 会被替换成空串。
- 布局链里**最具体的模板**(页面本身)的 `title` 优先;它没设或解析后为空,则回退到上层布局的 `title`,最终回退到 `config.site_name`。

解析后的标题会写入 `document.title`,同时以 `context.title` 暴露给模板(如需在页内再次使用)。

> 注:这套标题只作用于**前台动态渲染**。后端 SSG 静态生成走的是另一条渲染路径,不读取此配置。

现在您可以专注于为各个页面实现完美的 Vue UI 啦。如需回退或修改，请查阅 `templates_example` 文件夹。
