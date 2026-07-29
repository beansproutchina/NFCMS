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
import { pages } from '../views/front/templates/theme.config';
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
 * Resolve `$data.<path>` / `$params.<name>` tokens embedded anywhere in a template string
 * (same injection syntax as prefetch args, but usable mid-string for composed titles).
 * `data` is the merged page data (config + entity + prefetched keys); `params` is the route params.
 * Unresolved or nullish tokens collapse to "".
 */
function resolveTemplateString(tpl: string, scope: { data: any; params: any }): string {
    return tpl.replace(/\$(data|params)((?:\.[A-Za-z0-9_]+)+)/g, (_m, kind, pathStr) => {
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
            templateName = baseData.config.home_template || 'DefaultHome';
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
    
    // Execute all prefetches in parallel. Since queue goes from child to parent,
    // later items (parent) shouldn't override earlier items (child) if they share a key.
    const promises = fetchQueue.map(async (fetchInfo: any) => {
        try {
            const apiFn = resolvePrefetchApi(fetchInfo.api);
            if (!apiFn) console.warn(`[prefetch] unknown api "${fetchInfo.api}" — see PREFETCH_APIS in router/index.ts`);

            if (apiFn) {

                // Helper to resolve dynamically, polls for missing variables across extraData
                const resolveArgAsync = async (arg: any): Promise<any> => {
                    if (typeof arg === 'string') {
                        if (arg.startsWith('$params.')) return to.params[arg.split('.')[1]];
                        if (arg.startsWith('$data.')) {
                            const path = arg.split('.').slice(1);
                            
                            // Polling for the data resolution 
                            let maxWait = 5000; // 5x1000ms max
                            let waited = 0;
                            while (waited < maxWait) {
                                let val: any = { ...entityData, ...extraData };
                                let valid = true;
                                for (const k of path) {
                                    if (val && typeof val === 'object' && k in val) {
                                        val = val[k];
                                    } else {
                                        valid = false;
                                        break;
                                    }
                                }
                                if (valid && val !== undefined) return val;
                                await new Promise(r => setTimeout(r, 1));
                                waited += 1;
                            }
                            // Default fallback if timeout
                            let fallback: any = { ...entityData, ...extraData };
                            for (const k of path) fallback = fallback ? fallback[k] : undefined;
                            return fallback;
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
                return { key: fetchInfo.key, data: res.data, meta };
            }
        } catch (e) {
            console.error('Prefetch error for', fetchInfo.key, e);
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
    // now that entity + prefetched data is ready. `config` is exposed under $data.config.*.
    // Fall back to site_name when no template sets a title or it resolves empty.
    const titleScope = { data: { config: baseData.config, ...pageData }, params: to.params };
    let pageTitle = titleTemplate ? resolveTemplateString(titleTemplate, titleScope).trim() : '';
    if (!pageTitle) pageTitle = baseData.config?.site_name || '';
    if (pageTitle) document.title = pageTitle;

    to.meta.fetchedData = {
        ...baseData,
        data: pageData,
        meta,
        title: pageTitle,
        templateName,
        layouts
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
  { path: '/preview', component: () => import('../views/front/Preview.vue') },
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
      { path: 'settings', component: () => import('../views/admin/Settings.vue') }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  // Without this, Vue Router keeps the previous page's scroll position on every navigation.
  // New navigations start at the top; back/forward restore the saved position (delayed a little
  // so the async-rendered content has height before we scroll to it); #hash jumps to the anchor.
  scrollBehavior(to, _from, savedPosition) {
    if (to.hash) return { el: to.hash, behavior: 'smooth' };
    if (savedPosition) return new Promise((resolve) => setTimeout(() => resolve(savedPosition), 300));
    return { top: 0 };
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
    const adminAllowedPaths = ['/admin', '/admin/articles', '/admin/articles/new', '/admin/files'];
    
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
