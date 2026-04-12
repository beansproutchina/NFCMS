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
        // Handle unhandled catastrophic errors (e.g. 500 Network error)
        window.dispatchEvent(new CustomEvent('app-error', { detail: error.response?.data?.message || error.message || 'API Request Failed' }));

        if (error.response?.status === 401 || error.response?.data?.message?.includes("Invalid token")) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            window.location.pathname = '/login';
        }
        return Promise.reject(error);
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
