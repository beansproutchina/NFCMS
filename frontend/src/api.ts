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

        window.dispatchEvent(new CustomEvent('app-error', { detail: message }));

        // Session expired / invalid token -> force re-login (but not on the login request itself).
        const url: string = error.config?.url || '';
        const isAuthError = status === 401 || /invalid token/i.test(body?.message || '');
        if (isAuthError && !url.includes('/user/login')) {
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

export const contentAPI = {
    getHome: () => api.get('/content/home'),
    getCategory: (slug: string) => api.get(`/content/category?slug=${slug}`),
    getArticle: (slug: string) => api.get(`/content/article?slug=${slug}`),
    previewToken: (id: string | number) => api.post('/content/preview-token', { id }),
    preview: (id: string | number, pt: string) => api.get(`/content/preview?id=${id}&pt=${encodeURIComponent(pt)}`)
};

// Content lifecycle: status transitions, version history/rollback, and resource sharing (ACL).
export const lifecycleAPI = {
    transition: (type: string, id: string | number, body: { to: string; publish_at?: string; note?: string }) =>
        api.post(`/lifecycle/${type}/${id}/transition`, body),
    revisions: (type: string, id: string | number) => api.get(`/lifecycle/${type}/${id}/revisions`),
    rollback: (type: string, id: string | number, version_no: number, note?: string) =>
        api.post(`/lifecycle/${type}/${id}/rollback`, { version_no, note }),
    grants: (type: string, id: string | number) => api.get(`/lifecycle/${type}/${id}/grants`),
    share: (type: string, id: string | number, body: { grantee_type: string; grantee_id: number; access: string }) =>
        api.post(`/lifecycle/${type}/${id}/share`, body),
    revoke: (type: string, id: string | number, grantId: number) =>
        api.delete(`/lifecycle/${type}/${id}/share/${grantId}`)
};

export const systemAPI = {
    getStatus: () => api.get('/system/status'),
    getConfig: () => api.get('/system/config'),
    saveConfig: (data: any) => api.post('/system/config', data),
    restart: () => api.post('/system/restart'),
    setup: (data: any) => api.post('/system/setup', data),
    getConfigItem: (key: string) => api.get(`/systemconfig?filter={"key":"${key}"}`),
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
    remove: (id: number) => api.delete(`/upload/${id}`)
};

export const authAPI = {
    login: (data: any) => api.post('/user/login', data)
};
