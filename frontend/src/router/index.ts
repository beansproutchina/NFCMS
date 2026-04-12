import 'vue-router';
declare module 'vue-router' {
  interface RouteMeta {
    fetchedData?: any;
  }
}

import { createRouter, createWebHistory } from 'vue-router';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import { systemAPI, contentAPI, crudAPI } from '../api';

NProgress.configure({ showSpinner: false, speed: 400 });

const fetchHome = async (to: any) => {
    const [configRes, catRes, artRes, menuRes] = await Promise.all([
        systemAPI.getConfig().catch(()=>({data:{}})),
        crudAPI.getList('categories').catch(()=>({data:[]})),
        crudAPI.getList('articles', { filter: { visible: 1 }, orderBy: 'published_at', orderDesc: true }).catch(()=>({data:[]})),
        crudAPI.getList('menus').catch(()=>({data:[]}))
    ]);
    to.meta.fetchedData = {
        config: configRes.data || {},
        categories: catRes.data || [],
        articles: artRes.data || [],
        menus: menuRes.data || []
    };
};

const fetchCategory = async (to: any) => {
    const slug = to.params.category_slug as string;
    const [configRes, res, menuRes] = await Promise.all([
        systemAPI.getConfig().catch(()=>({data:{}})),
        contentAPI.getCategory(slug).catch((e: any) => ({ error: e.response?.data?.message || 'Server error' })),
        crudAPI.getList('menus').catch(()=>({data:[]}))
    ]);
    const data: any = res;
    to.meta.fetchedData = data.code === 200 ? { success: true, data: data.data, config: configRes.data || {}, menus: menuRes.data || [] } : { success: false, error: data.error || data.message || 'Error loading category', config: configRes.data || {}, menus: menuRes.data || [] };
};

const fetchArticle = async (to: any) => {
    const slug = to.params.article_slug as string;
    const [configRes, res, menuRes] = await Promise.all([
        systemAPI.getConfig().catch(()=>({data:{}})),
        contentAPI.getArticle(slug).catch((e: any) => ({ error: e.response?.data?.message || 'Server error' })),
        crudAPI.getList('menus').catch(()=>({data:[]}))
    ]);
    const data: any = res;
    to.meta.fetchedData = data.code === 200 ? { success: true, data: data.data, config: configRes.data || {}, menus: menuRes.data || [] } : { success: false, error: data.error || data.message || 'Error loading article', config: configRes.data || {}, menus: menuRes.data || [] };
};

const routes = [
  // Visitor Facing Routes
  { path: '/', component: () => import('../views/front/Home.vue'), meta: { fetch: fetchHome } },
  { path: '/a/:category_slug/:article_slug', component: () => import('../views/front/ArticleDetail.vue'), meta: { fetch: fetchArticle } },
  { path: '/a/:category_slug', component: () => import('../views/front/CategoryView.vue'), meta: { fetch: fetchCategory } },
  
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

  const isAuthenticated = !!localStorage.getItem('user');
  if (to.meta.requiresAuth && !isAuthenticated && to.path !== '/setup' && to.path !== '/login') {
    next('/login');
  } else if (to.meta.requiresAuth && isAuthenticated) {
    const userRaw = localStorage.getItem('user');
    const user = userRaw ? JSON.parse(userRaw) : { role: 'admin' };
    const isSuper = user.role === 'super_admin' || user.role === 'superadmin';
    const adminAllowedPaths = ['/admin', '/admin/articles', '/admin/articles/new', '/admin/files'];
    
    const isEditingArticle = to.path.startsWith('/admin/articles/edit/');
    const isAllowedForAdmin = adminAllowedPaths.includes(to.path) || isEditingArticle;

    if (!isSuper && to.path.startsWith('/admin') && !isAllowedForAdmin) {
      next('/admin'); 
    } else {
      next();
    }
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
