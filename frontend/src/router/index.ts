import 'vue-router';
declare module 'vue-router' {
  interface RouteMeta {
    fetchedData?: any;
    viewType?: 'home' | 'category' | 'article' | 'custom';
    templateName?: string;
  }
}

import { createRouter, createWebHistory } from 'vue-router';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import { systemAPI, contentAPI, crudAPI } from '../api';
import { pages } from '../views/front/templates/theme.config';
import { useAuthStore } from '../stores/auth';

NProgress.configure({ showSpinner: false, speed: 400 });

// 统一的数据获取函数
const fetchContentData = async (to: any) => {
    const viewType = to.meta.viewType as string;
    const [configRes, menuRes] = await Promise.all([
        systemAPI.getConfig().catch(() => ({ data: {} })),
        crudAPI.getList('menus').catch(() => ({ data: [] }))
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
    
    while (currentTemplate && pages[currentTemplate]) {
        const pConf = pages[currentTemplate];
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
            const [namespace, method] = fetchInfo.api.split('.');
            let apiModule: any;
            if (namespace === 'crudAPI' || namespace === 'crud') apiModule = crudAPI;
            else if (namespace === 'contentAPI' || namespace === 'content') apiModule = contentAPI;
            else if (namespace === 'systemAPI' || namespace === 'system') apiModule = systemAPI;

            if (apiModule && typeof apiModule[method] === 'function') {
                
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
                const res = await apiModule[method](...args);

                return { key: fetchInfo.key, data: res.data };
            }
        } catch (e) {
            console.error('Prefetch error for', fetchInfo.key, e);
        }
        return { key: fetchInfo.key, data: null };
    });

    const results = await Promise.all(promises);
    // Apply in reverse order (parents first, then children) so children override parents
    for (let i = results.length - 1; i >= 0; i--) {
        const r = results[i];
        if (r.data !== null) extraData[r.key] = r.data;
    }

to.meta.fetchedData = {
        ...baseData,
        data: {
            ...entityData,
            ...extraData
        },
        templateName,
        layouts
    };
};

const customRoutes = Object.entries(pages)
  .filter(([_, config]) => config.routes && config.routes.length > 0)
  .flatMap(([templateName, config]) => 
    config.routes!.map(route => ({
      path: route,
      component: () => import('../views/front/DynamicView.vue'),
      meta: { fetch: fetchContentData, viewType: 'custom', templateName }
    }))
  );

const routes = [
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
  routes
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
      const statusRes: any = await systemAPI.getStatus();
      isInitialized = statusRes.data?.is_initialized || statusRes.is_initialized;
      
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
