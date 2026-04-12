import { createRouter, createWebHistory } from 'vue-router';
import axios from 'axios';

const routes = [
  // Visitor Facing Routes
  { path: '/', component: () => import('../views/front/Home.vue') },
  { path: '/article/:slug', component: () => import('../views/front/ArticleDetail.vue') },
  
  // Setup & Auth
  { path: '/setup', component: () => import('../views/setup/SetupWizard.vue') },
  { path: '/login', component: () => import('../views/auth/Login.vue') },
  
  // Admin Routes
  {
    path: '/admin',
    component: () => import('../components/Layout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', component: () => import('../views/admin/Dashboard.vue') },
      { path: 'articles', component: () => import('../views/admin/Articles.vue') },
      { path: 'articles/new', component: () => import('../views/admin/Editor.vue') },
      { path: 'articles/edit/:id', component: () => import('../views/admin/Editor.vue') },
      { path: 'schemas', component: () => import('../views/admin/Schemas.vue') },
      { path: 'settings', component: () => import('../views/admin/Settings.vue') }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to, from, next) => {
  try {
    const statusRes = await axios.get('/api/system/status');
    const isInitialized = statusRes.data?.data?.is_initialized;

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
  } else {
    next();
  }
});

export default router;
