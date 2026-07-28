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
  /** Positional args for the API. Strings may use `$params.x` / `$data.a.b` injection. */
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
   * in the string: `$data.<path>` reads merged page data (config / entity / prefetched keys),
   * `$params.<name>` reads a route param. Unresolved tokens collapse to "". The most specific
   * template in the layout chain wins; empty result falls back to config.site_name.
   * e.g. '$data.article.title - $data.config.site_name'
   */
  title?: string;
  /** Data to fetch before the page renders; results land on `context[key]`. */
  prefetch?: PrefetchItem[];
}

/** Theme metadata block (`export const info`). */
export interface ThemeInfo {
  name: string;
  version: string;
  author: string;
  description: string;
}

/** The `pages` map a theme exports: template name -> its config. */
export type ThemePages = Record<string, PageConfig>;

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
  /** Prefetched keys + the current entity (article/category/children/breadcrumbs) spread in. */
  [key: string]: any;
}
