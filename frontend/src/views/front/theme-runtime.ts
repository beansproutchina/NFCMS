/**
 * Theme contract — the single source of truth for the shapes a theme's `theme.config.ts`
 * declares. Themes live in `frontend_themes/<name>/` and are wired into the app through the
 * build slot `src/views/front/templates/` (Docker COPY in prod, a dev symlink locally).
 *
 * Every theme imports these types via the `@` alias so the router and all themes agree on one
 * shape — add a field here once and it propagates everywhere, with no per-theme drift.
 */

/** A single prefetch entry. `api` names a function in PREFETCH_APIS (see router/index.ts). */
export interface PrefetchItem {
  /** Key the resolved response.data is stored under, exposed on the template `context`. */
  key: string;
  /** Dotted API name, e.g. "crudAPI.getList" / "contentAPI.listArticles". */
  api: string;
  /** Positional args for the API. Strings may use `${params.x}` / `${data.a.b}` injection. */
  args: any[];
}

/** Per-page (per-template) configuration declared by a theme. */
export interface PageConfig {
  /** Layout template to wrap this page in (walked as a chain up to the root layout). */
  layout?: string;
  /** Extra URL paths to mount this template at (see customRoutes in router/index.ts). */
  routes?: string[];
  /**
   * Browser tab title. Supports the same `$` injection as prefetch args, embedded anywhere
   * in the string: `${data.<path>}` reads merged page data (config / entity / prefetched keys),
   * `${params.<name>}` reads a route param. Unresolved tokens collapse to "". The most specific
   * template in the layout chain wins; empty result falls back to config.site_name.
   * e.g. '${data.article.title} - ${data.config.site_name}'
   */
  title?: string;
  /** Data to fetch before the page renders; results land on `context[key]`. */
  prefetch?: PrefetchItem[];
}

/**
 * Theme metadata block (`export const info`) —— 也是**模板入口**的声明处。
 *
 * 为什么入口在这里而不是站点配置(`system_config`):站点配置跨主题存活(`subtitle` 就是刻意如此),
 * 而模板名是主题的内部资产。放在站点级 = 一个引用活得比它指向的东西更久,换主题后就悬空。
 * 详见 docs/public-access.md §6。
 */
export interface ThemeInfo {
  name: string;
  version: string;
  author: string;
  description: string;
  /** 首页模板名。缺省 `DefaultHome`。 */
  home?: string;
  /** 受限内容的 gate 页模板名(受众轴)。缺省 `AccessGate`;主题不提供该组件时回落到框架内置兜底。 */
  accessGate?: string;
}

/** The `pages` map a theme exports: template name -> its config. */
export type ThemePages = Record<string, PageConfig>;

/**
 * A theme-owned config field, declared by a theme's `export const configSchema`.
 * The admin Settings panel reads the active theme's schema and renders an editor for each,
 * so a theme can expose its own settings (logo URL, footer contact, …) with zero backend work.
 *
 * `key` MUST follow the `theme_<themename>_<field>` convention (lowercase/digits/underscore) —
 * that prefix is what the backend accepts as a theme-owned key. Values are stored as strings;
 * empty means "unset", and the theme should hide the corresponding UI rather than show a default.
 */
export interface ThemeConfigField {
  /** Full config key, e.g. "theme_school_logo". Must start with `theme_<name>_`. */
  key: string;
  /** Human label shown in the admin Settings form. */
  label: string;
  /** Editor control. Defaults to "text". */
  type?: 'text' | 'textarea' | 'number' | 'image';
  /** Optional helper text under the field. */
  hint?: string;
  /** Placeholder for the input. */
  placeholder?: string;
  /** Optional grouping heading in the form (e.g. "页脚", "品牌"). */
  group?: string;
}

/** A theme's `export const configSchema: ThemeConfigSchema`. */
export type ThemeConfigSchema = ThemeConfigField[];

/**
 * The object injected into every template as the `context` prop. Themes may type their
 * `defineProps<{ context: ThemeContext }>()` against this for autocomplete (all optional
 * since which keys are present depends on the page — see THEME_DEV.md).
 */
export interface ThemeContext {
  config?: Record<string, any>;
  menus?: any[];
  user?: any | null;
  /** The re-exported api.ts toolkit, for ad-hoc requests deep in a template. */
  api?: any;
  /** Resolved page title (same value written to document.title). */
  title?: string;
  /** Per-prefetch-key pagination meta from list responses, e.g. `$meta.articles.total`. */
  $meta?: Record<string, { total?: number; pages?: number }>;
  /** Prefetched keys + the current entity (article/category/children/breadcrumbs) spread in. */
  [key: string]: any;
}
