import 'vue-router';
declare module 'vue-router' {
  interface RouteMeta {
    fetchedData?: any;
    viewType?: 'home' | 'category' | 'article' | 'custom';
    templateName?: string;
  }
}

import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import { systemAPI, contentAPI, crud, listMenu } from '../api';
import { pages, info as themeInfo } from '../views/front/templates/theme.config';
import { resolveTemplateChain, accessGateName } from '../views/front/templateLoader';
import { useAuthStore } from '../stores/auth';

NProgress.configure({ showSpinner: false, speed: 400 });

/**
 * Prefetch dispatch table for themes. `theme.config.ts` names APIs by string
 * (e.g. `api: 'crudAPI.getList'`), which no compiler can verify — so the set of
 * callable APIs lives here explicitly. Adding a theme-callable API means adding a
 * row here; the legacy `crudAPI.*` / `contentAPI.*` names are the public contract
 * for existing themes and must keep working.
 */
const PREFETCH_APIS: Record<string, (...args: any[]) => Promise<any>> = {
    'crudAPI.getList': (route: string, params?: any) => crud(route).list(params),
    'crudAPI.getOne': (route: string, id: any, params?: any) => crud(route).get(id, params),
    'contentAPI.getHome': () => contentAPI.getHome(),
    'contentAPI.listArticles': (params?: any) => contentAPI.listArticles(params),
    'contentAPI.getCategory': (slug: string) => contentAPI.getCategory(slug),
    'contentAPI.getArticle': (slug: string) => contentAPI.getArticle(slug),
    'systemAPI.getConfig': () => systemAPI.getConfig(),
    'systemAPI.getStatus': () => systemAPI.getStatus(),
};

/** Themes may abbreviate the namespace: `crud.getList` == `crudAPI.getList`. */
const PREFETCH_ALIASES: Record<string, string> = { crud: 'crudAPI', content: 'contentAPI', system: 'systemAPI' };

/**
 * How long a prefetch may wait for a `${data.x}` value that another prefetch still has to publish.
 * Only ever spent when a dependency is genuinely in flight: a waiter bails out early once every
 * remaining prefetch is also waiting, so a mistyped key costs no wall-clock time at all.
 */
const PREFETCH_WAIT_MS = 3000;
const PREFETCH_POLL_MS = 5;

/** 等页面长够以恢复滚动位置的上限。目标位置可能永远达不到,不能无限等。 */
const SCROLL_RESTORE_MAX_MS = 1500;
/** 高度连着这么多帧没变,就认定内容已稳定(约 130ms),不必再等满上面那个时限。 */
const SCROLL_SETTLE_FRAMES = 8;

function resolvePrefetchApi(name: string): ((...args: any[]) => Promise<any>) | undefined {
    const [ns, method] = String(name).split('.');
    return PREFETCH_APIS[`${PREFETCH_ALIASES[ns] ?? ns}.${method}`];
}

/** Walk a dotted path (["article","title"]) into an object; undefined if any hop is missing. */
function getByPath(root: any, path: string[]): any {
    let val = root;
    for (const k of path) {
        if (val && typeof val === 'object' && k in val) val = val[k];
        else return undefined;
    }
    return val;
}

/**
 * One `${data.a.b}` / `${params.x}` injection token.
 *
 * The braces are what make a token composable: `'en-${params.category_slug}'` has an unambiguous
 * end, so a token can sit next to ordinary characters. The older brace-less `$data.a.b` form ended
 * wherever the path regex stopped being greedy, which made anything written after it a guess —
 * that form is gone, not deprecated: it no longer resolves at all.
 */
const TOKEN_RE = /\$\{(data|params)((?:\.[A-Za-z0-9_]+)+)\}/g;

/** The string is *exactly* one token — the caller may hand back the raw value, unstringified. */
const WHOLE_TOKEN_RE = /^\$\{(data|params)((?:\.[A-Za-z0-9_]+)+)\}$/;

/**
 * Resolve `${data.<path>}` / `${params.<name>}` tokens embedded anywhere in a template string
 * (same injection syntax as prefetch args, but usable mid-string for composed titles).
 * `data` is the merged page data (config + entity + prefetched keys); `params` is the route params.
 * Unresolved or nullish tokens collapse to "".
 */
function resolveTemplateString(tpl: string, scope: { data: any; params: any }): string {
    return tpl.replace(TOKEN_RE, (_m, kind, pathStr) => {
        const path = pathStr.split('.').filter(Boolean);
        const val = getByPath(kind === 'params' ? scope.params : scope.data, path);
        return val == null ? '' : String(val);
    });
}

// 统一的数据获取函数
const fetchContentData = async (to: any) => {
    const viewType = to.meta.viewType as string;
    const [configRes, menuRes] = await Promise.all([
        systemAPI.getConfig().catch(() => ({ data: {} })),
        listMenu().catch(() => ({ data: [] }))
    ]);

    const baseData = {
        config: configRes.data || {},
        success: true,
    };

    let templateName = 'DefaultHome';
    let entityData: any = {};

    // 1. 根据viewType获取基础内容并确定需要的模板
    try {
        if (viewType === 'home') {
            // 模板入口由**主题**声明(theme.config 的 `info.home`),不再读站点配置 `home_template`:
            // 站点配置跨主题存活,而模板名是主题的内部资产 —— 换主题后旧值就悬空了。
            // 见 docs/public-access.md §6「模板入口声明归主题」。
            templateName = themeInfo.home || 'DefaultHome';
        } else if (viewType === 'category') {
            templateName = 'DefaultCategory';
            const slug = to.params.category_slug as string;
            const res: any = await contentAPI.getCategory(slug);
            if (res.code === 200) {
                entityData = { category: res.data, children: res.data.children, breadcrumbs: res.data.breadcrumbs };
                if (res.data.list_template) {
                    templateName = res.data.list_template;
                }
            } else {
                to.meta.fetchedData = { ...baseData, success: false, error: res.message || 'Error loading category' };
                return;
            }
        } else if (viewType === 'article') {
            templateName = 'DefaultArticle';
            const slug = to.params.article_slug as string;
            const res: any = await contentAPI.getArticle(slug);
            if (res.code === 200) {
                entityData = { article: res.data, category: res.data.category, breadcrumbs: res.data.breadcrumbs };
                if (res.data.template) {
                    templateName = res.data.template;
                }
                // 受众轴:后端判定为 `locked` 的内容会带着摘要 + `locked:true` 返回 200(不是 403 ——
                // 那样会触发全局错误 toast,而这里要的是页面内的登录引导)。整条渲染通路不变,
                // 只把模板换成 gate 页,于是它照常套主题的 layout 链与标题解析。
                // 见 docs/public-access.md §6。
                if (res.data.locked) templateName = accessGateName();
            } else {
                to.meta.fetchedData = { ...baseData, success: false, error: res.message || 'Error loading article' };
                return;
            }
        } else if (viewType === 'custom') {
            templateName = to.meta.templateName as string;
        }
    } catch (e: any) {
        to.meta.fetchedData = { ...baseData, success: false, error: e.response?.data?.message || e.message || 'Server error' };
        return;
    }

    
    // 2. Gather prefetch configs by traversing layout chain
    const extraData: any = {};
    let currentTemplate = templateName;
    const layouts: string[] = [];
    const fetchQueue: any[] = [];
    let titleTemplate: string | undefined;   // most-specific template's title wins (child before parent)

    while (currentTemplate && pages[currentTemplate]) {
        const pConf = pages[currentTemplate];
        if (titleTemplate === undefined && pConf.title) titleTemplate = pConf.title;
        if (pConf.prefetch) fetchQueue.push(...pConf.prefetch);
        if (pConf.layout) {
            layouts.push(pConf.layout);
            currentTemplate = pConf.layout;
        } else {
            currentTemplate = '';
        }
    }
    
    /**
     * Live view of prefetch results, published the moment each one lands.
     *
     * This is what makes a prefetch able to depend on an earlier prefetch's output — e.g. fetch a
     * category by slug, then list articles with `filter: { category_id: '${data.thatKey.id}' }`.
     * `extraData` cannot serve that purpose: it is only filled after `Promise.all` below, so a
     * waiter reading it would block on a result that, in turn, waits for the waiter.
     *
     * `PREFETCH_DEPTH_LIMIT` bounds how long a dependent may wait. `blocked` / `pending` let a
     * waiter give up the instant no runnable prefetch is left, so a bad key costs nothing instead
     * of burning the whole budget.
     */
    const live: Record<string, any> = {};
    const liveOwner: Record<string, number> = {};   // fetchQueue index that published each key
    const blocked = new Map<number, number>();      // fetchQueue index → how many of its args wait
    let pending = fetchQueue.length;

    const publish = (key: string, data: any, idx: number) => {
        if (data === undefined || data === null) return;
        // fetchQueue runs child → parent, so the lower index (child) wins — the same precedence the
        // final merge into `extraData` applies. Without this, whichever request happened to finish
        // last would win, making a duplicated key resolve differently run to run.
        if (!(key in live) || idx < liveOwner[key]) { live[key] = data; liveOwner[key] = idx; }
    };

    // Execute all prefetches in parallel. Since queue goes from child to parent,
    // later items (parent) shouldn't override earlier items (child) if they share a key.
    const promises = fetchQueue.map(async (fetchInfo: any, fetchIndex: number) => {
        try {
            const apiFn = resolvePrefetchApi(fetchInfo.api);
            if (!apiFn) console.warn(`[prefetch] unknown api "${fetchInfo.api}" — see PREFETCH_APIS in router/index.ts`);

            if (apiFn) {

                /**
                 * Resolve one `${data.…}` / `${params.…}` token to its **raw** value.
                 *
                 * `params` is available synchronously; a `data` path may still be in flight as
                 * another prefetch's output, so it polls `live` until that dependency lands.
                 */
                const resolveToken = async (kind: string, path: string[], label: string): Promise<any> => {
                    if (kind === 'params') return to.params[path[0]];
                    // `live` last: an already-published prefetch key beats a stale entity key.
                    const scope = () => ({ ...entityData, ...extraData, ...live });

                    let val = getByPath(scope(), path);
                    if (val !== undefined) return val;

                    // Not there yet — it may be another prefetch's output still in flight.
                    const deadline = Date.now() + PREFETCH_WAIT_MS;
                    blocked.set(fetchIndex, (blocked.get(fetchIndex) || 0) + 1);
                    try {
                        while (Date.now() < deadline) {
                            // Every prefetch still running is itself waiting → nobody can
                            // publish anything more. Give up now rather than at the deadline.
                            if (blocked.size >= pending) break;
                            await new Promise(r => setTimeout(r, PREFETCH_POLL_MS));
                            val = getByPath(scope(), path);
                            if (val !== undefined) return val;
                        }
                    } finally {
                        const n = (blocked.get(fetchIndex) || 1) - 1;
                        if (n > 0) blocked.set(fetchIndex, n); else blocked.delete(fetchIndex);
                    }
                    // Deliberately loud: silently returning undefined drops the key from the
                    // request (JSON.stringify omits it), which for a filter means "no filter"
                    // — i.e. a page quietly showing everything instead of one category.
                    console.warn(`[prefetch] "${label}" never resolved for key "${fetchInfo.key}" — check the key name and that whatever provides it is prefetched too`);
                    return undefined;
                };

                // Helper to resolve dynamically, polls for missing variables across extraData
                const resolveArgAsync = async (arg: any): Promise<any> => {
                    if (typeof arg === 'string') {
                        /**
                         * Whole string == one token → hand back the **raw** value. Going through
                         * the interpolation path instead would stringify it, turning
                         * `${data.cat.id}` into "3" and quietly breaking numeric filters.
                         */
                        const whole = WHOLE_TOKEN_RE.exec(arg);
                        if (whole) return resolveToken(whole[1], whole[2].split('.').filter(Boolean), arg);

                        // Token(s) embedded in surrounding text → interpolate, e.g.
                        // 'en-${params.category_slug}' → 'en-posts'. A fresh RegExp per call:
                        // `TOKEN_RE` is module-level and /g, and these resolutions interleave.
                        const scan = new RegExp(TOKEN_RE.source, 'g');
                        const found: RegExpExecArray[] = [];
                        for (let m = scan.exec(arg); m !== null; m = scan.exec(arg)) found.push(m);
                        if (found.length) {
                            const vals = await Promise.all(found.map(
                                m => resolveToken(m[1], m[2].split('.').filter(Boolean), m[0])));
                            let i = 0;
                            return arg.replace(TOKEN_RE, () => {
                                const v = vals[i++];
                                return v == null ? '' : String(v);
                            });
                        }
                    } else if (Array.isArray(arg)) {
                        return Promise.all(arg.map(resolveArgAsync));
                    } else if (typeof arg === 'object' && arg !== null) {
                        const newObj: any = {};
                        for (const [k, v] of Object.entries(arg)) newObj[k] = await resolveArgAsync(v);
                        return newObj;
                    }
                    return arg;
                };

                const args = await Promise.all((fetchInfo.args || []).map(resolveArgAsync));
                const res = await apiFn(...args);

                // Keep list pagination info from the envelope — `context[key]` stays the
                // data (array), while total/pages are surfaced separately via `context.$meta[key]`
                // so themes can paginate off a prefetched first page without a second request.
                const meta = (res && (res.total !== undefined || res.pages !== undefined))
                    ? { total: res.total, pages: res.pages }
                    : undefined;
                publish(fetchInfo.key, res.data, fetchIndex);   // let dependents proceed immediately
                return { key: fetchInfo.key, data: res.data, meta };
            }
        } catch (e) {
            console.error('Prefetch error for', fetchInfo.key, e);
        } finally {
            // Whether it succeeded, failed or was skipped, this one can no longer publish anything —
            // which is how a waiter learns that nothing runnable is left.
            pending -= 1;
        }
        return { key: fetchInfo.key, data: null, meta: undefined };
    });

    const results = await Promise.all(promises);
    const meta: Record<string, any> = {};
    // Apply in reverse order (parents first, then children) so children override parents
    for (let i = results.length - 1; i >= 0; i--) {
        const r = results[i];
        if (r.data !== null) {
            extraData[r.key] = r.data;
            if (r.meta) meta[r.key] = r.meta;
        }
    }

    const pageData = { ...entityData, ...extraData };

    // 3. Resolve the page title from the theme config (same $-injection as prefetch), applied
    // now that entity + prefetched data is ready. `config` is exposed under ${data.config.*}.
    // Fall back to site_name when no template sets a title or it resolves empty.
    const titleScope = { data: { config: baseData.config, ...pageData }, params: to.params };
    let pageTitle = titleTemplate ? resolveTemplateString(titleTemplate, titleScope).trim() : '';
    if (!pageTitle) pageTitle = baseData.config?.site_name || '';
    if (pageTitle) document.title = pageTitle;

    /**
     * 连组件一起解析好再让导航完成。
     *
     * 不这么做的话 DynamicView 挂载后的第一次同步渲染没有组件可渲染(它原先在 watch 里
     * 异步 import),DOM 是空的 —— 而预渲染页恰恰要在这一帧上水合,空 DOM 对不上整页静态
     * 内容,Vue 判 mismatch 后整棵重渲染,表现为整页闪白。见 templateLoader.ts。
     */
    const components = await resolveTemplateChain(templateName, layouts, viewType);

    to.meta.fetchedData = {
        ...baseData,
        data: pageData,
        meta,
        title: pageTitle,
        templateName,
        layouts,
        components,
    };
};

const customRoutes: RouteRecordRaw[] = Object.entries(pages)
  .filter(([_, config]) => config.routes && config.routes.length > 0)
  .flatMap(([templateName, config]) =>
    config.routes!.map(route => ({
      path: route,
      component: () => import('../views/front/DynamicView.vue'),
      meta: { fetch: fetchContentData, viewType: 'custom' as const, templateName }
    }))
  );

const routes: RouteRecordRaw[] = [
  // Visitor Facing Routes - 统一使用 DynamicView
  { path: '/', component: () => import('../views/front/DynamicView.vue'), meta: { fetch: fetchContentData, viewType: 'home' } },
  { path: '/a/:category_slug/:article_slug', component: () => import('../views/front/DynamicView.vue'), meta: { fetch: fetchContentData, viewType: 'article' } },
  { path: '/a/:category_slug', component: () => import('../views/front/DynamicView.vue'), meta: { fetch: fetchContentData, viewType: 'category' } },
  ...customRoutes,
  
  // Setup & Auth
  { path: '/setup', component: () => import('../views/setup/SetupWizard.vue') },
  { path: '/login', component: () => import('../views/auth/Login.vue') },
  
  // Admin Routes
  {
    path: '/admin',
    component: () => import('../views/admin/Layout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', component: () => import('../views/admin/Dashboard.vue') },
      { path: 'articles', component: () => import('../views/admin/Articles.vue') },
      { path: 'categories', component: () => import('../views/admin/Categories.vue') },
      { path: 'menus', component: () => import('../views/admin/Menus.vue') },
      { path: 'articles/new', component: () => import('../views/admin/Editor.vue') },
      { path: 'articles/edit/:id', component: () => import('../views/admin/Editor.vue') },
      { path: 'users', component: () => import('../views/admin/Users.vue') },
      { path: 'roles', component: () => import('../views/admin/Roles.vue') },
      { path: 'schemas', component: () => import('../views/admin/Schemas.vue') },
      { path: 'crud/:modelName', component: () => import('../views/admin/DynamicCrud.vue') },
      { path: 'files', component: () => import('../views/admin/Files.vue') },
      { path: 'settings', component: () => import('../views/admin/Settings.vue') },
      // 我的资料:任何登录用户都能进(后端把读写锁在本人),不需要任何后台能力
      { path: 'profile', component: () => import('../views/admin/Profile.vue') }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  // Without this, Vue Router keeps the previous page's scroll position on every navigation.
  // New navigations start at the top; back/forward restore the saved position (delayed a little
  // so the async-rendered content has height before we scroll to it); #hash jumps to the anchor.
  /**
   * 后退时恢复滚动位置。
   *
   * 难点在于**页面内容是异步的**:导航完成的那一帧文档还只有视口那么高,浏览器根本滚不到
   * 上次的位置。原来的做法是固定等 300ms 再滚,而 300 这个数字对谁都不准 —— 内容早就绪就
   * 白等(用户先看见顶部,再被甩回原处),内容慢(图片撑高、列表分页)又不够,滚到一半就停。
   *
   * 改成**等文档真的长到那个位置就立刻滚**:按帧检查高度,够了就 resolve。内容快就快,内容
   * 慢就等,不再赌一个固定时长。`SCROLL_RESTORE_MAX_MS` 是兜底 —— 目标位置可能永远达不到
   * (那一页的内容变少了),不能无限等下去。
   */
  scrollBehavior(to, _from, savedPosition) {
    if (to.hash) return { el: to.hash, behavior: 'smooth' };
    if (!savedPosition) return { top: 0 };

    const target = savedPosition.top ?? 0;
    if (target <= 0) return savedPosition;

    return new Promise((resolve) => {
      const deadline = performance.now() + SCROLL_RESTORE_MAX_MS;
      const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;
      let lastHeight = -1;
      let stableFrames = 0;

      const tick = () => {
        const reach = maxScroll();
        // 够得着了 —— 立刻滚,不多等一帧
        if (reach >= target) return resolve(savedPosition);

        /**
         * 够不着,但高度已经连着若干帧没变了:那一页的内容比上次少(删了文章、换了筛选),
         * 目标位置**永远**到不了。此时继续等只是白等满兜底时限,不如就此放手 ——
         * 浏览器会把位置自动收敛到能滚到的最底部,这已经是最接近的结果。
         */
        if (reach === lastHeight) {
          if (++stableFrames >= SCROLL_SETTLE_FRAMES) return resolve(savedPosition);
        } else {
          lastHeight = reach;
          stableFrames = 0;
        }

        if (performance.now() >= deadline) return resolve(savedPosition);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  },
});

router.beforeEach(async (to, from, next) => {
  if (to.path !== from.path) NProgress.start();

  const authStore = useAuthStore();

  // 首次导航时，通过 API 获取真实登录状态
  if (!authStore.initialized) {
    await authStore.fetchLoginInfo();
  }

  let isInitialized = localStorage.getItem('is_initialized') === '1';
  

  try {
    if (!isInitialized) {
      const statusRes = await systemAPI.getStatus();
      isInitialized = statusRes.data.is_initialized;   // { code, data: { is_initialized } }
      
      if (isInitialized) {
        localStorage.setItem('is_initialized', '1');
      }
    }

    if (!isInitialized && to.path !== '/setup') {
      return next('/setup');
    }
    if (isInitialized && to.path === '/setup') {
      return next('/');
    }
  } catch (err) {
    if (to.path !== '/setup') {
      return next('/setup');
    }
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated && to.path !== '/setup' && to.path !== '/login') {
    next('/login?redirect=' + encodeURIComponent(to.path));
  } else if (to.meta.requiresAuth && authStore.isAuthenticated) {
    const isSuper = authStore.isSuperAdmin;
    // '/admin/profile' 必须在列:它是给**非超管**用的(改自己的用户名/昵称/密码),
    // 漏了就会被下面这条重定向打回 /admin —— 需要它的人恰好一个都进不去。
    const adminAllowedPaths = ['/admin', '/admin/articles', '/admin/articles/new', '/admin/files', '/admin/profile'];
    
    const isEditingArticle = to.path.startsWith('/admin/articles/edit/');
    const isAllowedForAdmin = adminAllowedPaths.includes(to.path) || isEditingArticle;

    if (!isSuper && to.path.startsWith('/admin') && !isAllowedForAdmin) {
      next('/admin'); 
    } else {
      next();
    }
  } else if (to.path === '/login' && authStore.isAuthenticated) {
    // 已登录用户访问登录页，重定向到后台
    next('/admin');
  } else {
    next();
  }
});

router.beforeResolve(async (to, _from, next) => {
    if (to.meta.fetch) {
        try {
            await (to.meta.fetch as Function)(to);
        } catch(e) {
            console.error('Fetch error before navigation:', e);
        }
    }
    next();
});

router.afterEach(() => {
  NProgress.done();
});

export default router;
