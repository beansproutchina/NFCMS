# NFCMS 主题 API 参考(架构 / 数据 / 契约 / context)

## 1. 目录与槽位

- **主题真源**:仓库根 `frontend_themes/<name>/`。这是唯一改动位置。
- **加载槽位**:`frontend/src/views/front/templates/`。生产由 Docker `COPY frontend_themes/${THEME}/` 填充;开发用 `npm run theme:use <name>` 建**软链**指向真源。`vite`/`tsconfig` 已配 `preserveSymlinks` + `@`→`src`,软链下"改槽位"就是"改真源"。**不要手动往槽位写文件。**
- 一个主题的组成:`theme.config.ts` + 若干模板 `.vue`(放主题根)+ `components/`(页眉页脚等)+ 可选 `lib.ts`(共享逻辑)。
- 模板发现:`import.meta.glob('./templates/*.vue')` 编译期扫描;新增 `<TemplateName>.vue` 即可被 `list_template`/`content_template`/自定义路由按名引用。

## 2. 数据模型(你能拿到的全部)

### 分类 category
`id`(number) · `name` · `slug` · `parent_id`(0=根) · `weight`(小在前) · `list_template`(列表页模板名) · `content_template`(该类文章详情模板名) · `article_data_fields`(对象:`{ key: { title, type } }`,声明文章自定义字段) · `data`(JSON,分类级自定义,如 `data.description`)。
公开 `GET /api/content/category?slug=` 额外带:`children[]`(直接子分类) · `breadcrumbs[]`(`{id,name,slug,disabled}`)。

### 文章 article
数据库字段:`id` · `title` · `slug` · `description` · `thumbnail` · `content`(**Markdown 源码**) · `content_template` · `status`(hidden/scheduled/visible) · `publish_at` · `is_top`(0/1) · `category_id`(number) · `published_at` · `created_at` · `updated_at` · `data`(JSON 自定义字段)。
公开接口**已富化**再追加:`category`(对象,含 slug/name) · `breadcrumbs[]` · `author`(对象:`nickname`/`username`,已抹密码;**是对象不是字符串**) · `template`(解析后的详情模板名)。
**没有** views / source / department 等——需要就放进 `article.data`,并在分类 `article_data_fields` 声明(后台编辑器据此出字段)。

### 菜单 menu
`{ name, location, items: [{ label, url, type, refId, children: [...] }] }`。`location` 约定:`header` 主导航 / `top` 顶栏次级 / `quicklinks` 快速通道 / `footer` 页脚。主题自行决定消费哪些;`url` 站内(`/a/slug`、`/about`)或外链(`http...`)。

### 配置 config
`site_name` · `subtitle` · `icp_record` · `mourning_mode` · `home_template` · `storage_config` + **任意 `theme_<name>_*` 自定义键**。后端 `isThemeConfigKey` 放行 `^theme_[a-z0-9]+_[a-z0-9_]+$`;`GetConfig` 只返回白名单 ∪ `theme_*`。

## 3. 公开内容端点(模板经 `context.api` 调用)

- `contentAPI.getHome()` → `{code, data:{ articles, categories }}`(articles 仅基础字段)。
- `contentAPI.listArticles(params)` → `{code, data:[富化文章], total, pages}`;`params`:`{ filter, orderBy, orderDesc, page, limit, fields }`;`filter` 传对象(框架会 `JSON.stringify`),支持 `{category_id}`、`{is_top:1}`、`{$or:{title:{$contains:q}}}`;强制 `status=visible`。
- `contentAPI.getCategory(slug)` → `{code, data:{...category, children, breadcrumbs}}`。
- `contentAPI.getArticle(slug)` → `{code, data:富化文章}`(404 时 `code!=200`)。
- `crud(route)` → 运行时模型逃生舱:`.list/.get/.create/...`。
- 拦截器已解包:`res` 即 body;列表的 `total/pages` 在 `res` 上。**公开站只走 `/api/content/*`**,别打 `/api/articles`(RBAC 匿名 403)。

## 4. 模板选择规则

- 列表页 = `category.list_template`(如 `WorkGrid`;空/未知回退 `DefaultCategory`)。
- 详情页 = `article.content_template || category.content_template || 'DefaultArticle'`。
- 首页 = `config.home_template || 'DefaultHome'`。
- 自定义路由页 = `theme.config.ts` 的 `pages[key].routes: ['/about']`,`viewType='custom'`,模板名=页面 key。
- `list_template` 为空的分类,在面包屑里 `disabled`(不可点)。

## 5. theme.config.ts 契约

类型从 `@/views/front/theme-runtime` 导入。

```ts
export const info: ThemeInfo = { name, version, author, description };

export function init(_app: App) { /* 加载展示字体:判重后动态插 <link>,否则字体不生效 */ }

export const pages: ThemePages = {
  // PageConfig: { layout?, routes?: string[], title?: string, prefetch?: PrefetchItem[] }
  DefaultHome:     { layout:'Layout', title:'$data.config.site_name', prefetch:[ /* ... */ ] },
  DefaultCategory: { layout:'Layout', title:'$data.category.name - $data.config.site_name', prefetch:[
    { key:'articles', api:'contentAPI.listArticles',
      args:[{ filter:{ category_id:'$data.category.id' }, orderBy:'published_at', orderDesc:true, page:0, limit:12 }] },
  ] },
  AboutPage:       { layout:'Layout', routes:['/about'], title:'关于 - $data.config.site_name', prefetch:[] },
  Layout:          { title:'$data.config.site_name', prefetch:[{ key:'menus', api:'crudAPI.getList', args:['menus'] }] },
};

export const configSchema: ThemeConfigSchema = [
  // ThemeConfigField: { key, label, type?, hint?, placeholder?, group? }
  // key 必须是 theme_<name>_<field>(小写/数字/下划线);type: 'text'|'textarea'|'number'|'image'
  { key:'theme_<name>_logo', label:'Logo', type:'image', group:'品牌', hint:'留空显示站名文字。' },
];
```

**prefetch `api` 白名单**(`frontend/src/router/index.ts` 的 `PREFETCH_APIS`):`crudAPI.getList` · `crudAPI.getOne` · `contentAPI.getHome` · `contentAPI.listArticles` · `contentAPI.getCategory` · `contentAPI.getArticle` · `systemAPI.getConfig` · `systemAPI.getStatus`(别名 `crud`/`content`/`system`)。要加新 API 得往该表登记。结果存入 `context[key]`,分页元信息进 `context.$meta[key]`。

**`$` 注入**(title 与 prefetch args 通用):`$params.x` = 路由参数;`$data.a.b` = 作用域内路径。prefetch 的 `$data` 作用域 = 已取实体 + 已完成的其他 prefetch;title 的 `$data` 作用域 = `config` + 实体 + 各 prefetch key,且可**内嵌**在字符串任意位置,未命中→空串。**配置派生的数据无法进 prefetch args**(自定义路由页要在模板里用 `context.api` 自取)。

## 6. context(模板唯一入参)

`defineProps<{ context: any }>()`。字段:
- `config` — 所有配置(含 `theme_<name>_*`)。
- `menus` — 全部菜单。
- `user` — 当前登录用户或 null。
- `api` — 整个 api.ts:`api.contentAPI.*` / `api.crud(route)` / 具名函数。
- `title` — 已解析标题(= `document.title`)。
- `$meta` — `{ [prefetchKey]: { total, pages } }`。
- 各 **prefetch key** + 当前**实体**:文章页 `article`/`breadcrumbs`;分类页 `category`/`children`/`breadcrumbs`/`articles`(若 prefetch)。
完整字段表另见 `frontend/src/views/front/THEME_DEV.md`。

## 7. theme-runtime.ts 导出类型
`PrefetchItem` · `PageConfig` · `ThemeInfo` · `ThemePages` · `ThemeContext` · `ThemeConfigField` · `ThemeConfigSchema`。新增 context 字段或配置类型时改这个文件。
