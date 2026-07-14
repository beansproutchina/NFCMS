import axios from 'axios';

export const api = axios.create({
    baseURL: '/api',
    withCredentials: true
});

api.interceptors.response.use(
    (response) => {
        // Global error handling: if response contains a code and it is not a success code like 200/201, show a generic error toast
        if (response.data && response.data.code && (response.data.code < 200 || response.data.code >= 300)) {
             window.dispatchEvent(new CustomEvent('app-error', { detail: response.data.message || `Request failed with code ${response.data.code}` }));
             return Promise.reject(response.data);
        }
        return response.data; // Crucial: standardize response
    }, 
    (error) => {
        // Backend (dyapi 3.1.0, S6) now returns real HTTP status codes, so business
        // errors (400/401/403/404/5xx) land here rather than in the success branch.
        const url: string = error.config?.url || '';
        const isLoginRequest = url.includes('/user/login');
        const message = error.response?.data?.message || error.message || 'API Request Failed';
        window.dispatchEvent(new CustomEvent('app-error', { detail: message }));

        // Session expired / invalid token -> force re-login. Skip when the failing call
        // IS the login attempt (wrong password), so the login page can show the error in place.
        const isAuthError = error.response?.status === 401 || error.response?.data?.message?.includes("Invalid token");
        if (isAuthError && !isLoginRequest) {
            localStorage.removeItem('user');
            window.location.pathname = '/login';
        }
        // Reject with the unwrapped body when available, matching the success-branch convention.
        return Promise.reject(error.response?.data || error);
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
    getCategory: (slug: string) => api.get(`/content/category?slug=${slug}`),
    getArticle: (slug: string) => api.get(`/content/article?slug=${slug}`)
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
