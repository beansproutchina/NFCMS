import axios from 'axios';

export const api = axios.create({
    baseURL: '/api',
    withCredentials: true
});

api.interceptors.response.use(
    // HTTP 2xx: return the unwrapped body ({ code, data, ... }).
    (response) => response.data,
    // dyapi 3.1.0 (S6) returns real HTTP status codes for errors. Extract the backend
    // `message` here and reject with a real Error so every caller can read err.message.
    (error) => {
        const body: any = error.response?.data;
        const status: number | undefined = error.response?.status;
        const message: string = body?.message || error.message || `请求失败${status ? ' (' + status + ')' : ''}`;
        const code = body?.code ?? status;

        // Auth-probe endpoints (login attempt, initial loginInfo check) handle their own errors —
        // a 401 there is normal (not logged in / wrong password), so no global toast or redirect.
        const url: string = error.config?.url || '';
        const isAuthProbe = url.includes('/user/login') || url.includes('/user/loginInfo');
        if (!isAuthProbe) {
            window.dispatchEvent(new CustomEvent('app-error', { detail: message }));
        }

        // Session expired mid-use -> clear auth and force re-login.
        const isAuthError = status === 401 || /invalid token/i.test(body?.message || '');
        if (isAuthError && !isAuthProbe) {
            import('./stores/auth').then(({ useAuthStore }) => useAuthStore().clearUser()).catch(() => {});
            localStorage.removeItem('user');
            window.location.pathname = '/login';
        }
        return Promise.reject(Object.assign(new Error(message), { code, data: body }));
    }
);

// Unified Frontend API calls definition
export const schemaAPI = {
    getAll: () => api.get('/schematools/all'),
};

export const crudAPI = {
    getList: (modelRoute: string, params: any = {}) => {
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
             if (value !== undefined && value !== null) {
                 const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                 searchParams.append(key, strValue);
             }
        }
        const qs = searchParams.toString();
        return api.get(`/${modelRoute}${qs ? '?' + qs : ''}`);
    },
    getOne: (modelRoute: string, id: string | number) => api.get(`/${modelRoute}/${id}`),
    create: (modelRoute: string, data: any) => api.post(`/${modelRoute}`, data),
    update: (modelRoute: string, id: string | number, data: any) => api.put(`/${modelRoute}/${id}`, data), 
    remove: (modelRoute: string, id: string | number) => api.delete(`/${modelRoute}/${id}`),
};

// contentAPI 使用 crudAPI.getOne，slug 使用 {slug} 格式
// 文章详情: /api/articles/{slug}
// 分类详情: /api/categories/{slug}
export const contentAPI = {
    getHome: () => api.get('/content/home'),
    getCategory: (slug: string) => api.get(`/content/category?slug=${slug}`),
    getArticle: (slug: string) => api.get(`/content/article?slug=${slug}`),
    // Public article list — same query shape as crudAPI.getList; server forces status=visible.
    listArticles: (params: any = {}) => {
        const sp = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null) sp.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
        }
        const qs = sp.toString();
        return api.get(`/content/articles${qs ? '?' + qs : ''}`);
    },
    previewToken: (id: string | number) => api.post('/content/preview-token', { id }),
    preview: (id: string | number, pt: string) => api.get(`/content/preview?id=${id}&pt=${encodeURIComponent(pt)}`)
};

// Content lifecycle: status transitions and version history/rollback.
export const lifecycleAPI = {
    transition: (type: string, id: string | number, body: { to: string; publish_at?: string; note?: string }) =>
        api.post(`/lifecycle/${type}/${id}/transition`, body),
    revisions: (type: string, id: string | number) => api.get(`/lifecycle/${type}/${id}/revisions`),
    rollback: (type: string, id: string | number, version_no: number, note?: string) =>
        api.post(`/lifecycle/${type}/${id}/rollback`, { version_no, note }),
    // Categories the current user may create/manage articles in. Pass action="C" for the
    // new-article picker (only categories the user can create in); omit for the manage union.
    manageableCategories: (action?: string) =>
        api.get(`/lifecycle/manageable-categories${action ? `?action=${action}` : ''}`),
};

// Generic resource ACL. `model` is a content tablename (e.g. "articles") for row sharing,
// or "articles_category" with resourceId=<category id> for category-scoped article grants.
export const ARTICLES_CATEGORY = "articles_category";
export const aclAPI = {
    list: (model: string, resourceId: string | number) => api.get(`/acl/${model}/${resourceId}`),
    grant: (model: string, resourceId: string | number, body: { grantee_type: string; grantee_id: number; access: string }) =>
        api.post(`/acl/${model}/${resourceId}`, body),
    revoke: (model: string, resourceId: string | number, grantId: number) =>
        api.delete(`/acl/${model}/${resourceId}/${grantId}`),
};

export const systemAPI = {
    getStatus: () => api.get('/system/status'),
    getConfig: () => api.get('/system/config'),
    saveConfig: (data: any) => api.post('/system/config', data),
    restart: () => api.post('/system/restart'),
    setup: (data: any) => api.post('/system/setup', data),
    exportData: () => api.get('/system/export'),
};

export const uploadAPI = {
    getList: (params: any = {}) => {
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                searchParams.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
            }
        }
        const qs = searchParams.toString();
        return api.get(`/attachments${qs ? '?' + qs : ''}`);
    },
    upload: (formData: FormData) => api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    remove: (id: number) => api.delete(`/upload/${id}`),
    getProviders: () => api.get('/upload/providers'),
    testStorage: (provider?: string) => api.post('/upload/test', { provider }),
};

export const authAPI = {
    login: (data: any) => api.post('/user/login', data),
    loginInfo: () => api.get('/user/loginInfo'),
    logout: () => api.post('/user/logout')
};
