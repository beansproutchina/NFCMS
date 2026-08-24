import axios from 'axios';
import i18n from './i18n';
import {
    configureApi, crud,
    schematoolsGetAllSchemas,
    contentGetHome, contentGetCategory, contentGetArticle, contentListArticles, contentListCategories,
    lifecycleTransition, lifecycleListRevisions, lifecycleRollback, lifecycleManageableCategories,
    aclList, aclCreate, aclRemove,
    systemStatus, systemGetConfig, systemUpdateConfig, systemRestart, systemSetup, systemExportData,
    listAttachment, uploadUploadFile, uploadDeleteFile, uploadGetProviders, uploadTestStorage,
    userLogin, userLoginInfo, userLogout,
    type ReadQuery, type LifecycleTransitionBody, type AclCreateBody, type SystemSetupBody,
} from './api.gen';

// baseURL is intentionally EMPTY: api.gen.ts emits absolute paths that already carry the
// dyapi urlPrefix (e.g. "/api/articles"). Setting baseURL to "/api" here would produce
// "/api/api/articles". Vite proxies /api and /static to :3000 in dev; nginx does it in prod.
export const api = axios.create({
    baseURL: '',
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
        const message: string = body?.message || error.message || `${i18n.global.t('system.requestFailed')}${status ? ' (' + status + ')' : ''}`;
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

// Hand the generated client our instance. `unwrap: false` is REQUIRED: the interceptor above
// already returns response.data, so the generated request() must not unwrap a second time
// (that would drop `total`/`pages` off list responses).
configureApi({ instance: api, unwrap: false });

// Typed model CRUD (listArticle/createUser/...), the crud(route) escape hatch for runtime
// models, and every controller function are re-exported so views import from a single place.
export * from './api.gen';

// ---------------------------------------------------------------------------
// Semantic wrappers. These keep call-site-friendly signatures (positional slug/id
// instead of a query object) over the generated functions. Return types are inferred.
// ---------------------------------------------------------------------------

export const schemaAPI = {
    getAll: () => schematoolsGetAllSchemas(),
};

/**
 * Backward-compat shim for THEMES. The whole api module is injected into every theme template
 * as `context.api` (see THEME_DEV.md), and existing/external themes call
 * `api.crudAPI.getList('articles', ...)`. The admin app has moved to the typed named functions
 * + `crud()`, but this preserves the public theme-facing contract with zero theme edits.
 * Prefer `crud(route)` / the named functions in new app code.
 */
/**
 * 受众轴:`categories` 的公开读改走 `/api/content/categories`(按受众过滤)。
 *
 * 后端已把 `CategoryModel.PUBLIC` 降为 `""` —— 匿名再打 `/api/categories` 会 403,因为那条路
 * 会把全部栏目(含受限栏目的名字/slug/层级)泄漏出去。重定向放在这层 shim 里,于是 4 个主题
 * (`cosmos_love`/`school`/`pear` 都在用 `crudAPI.getList('categories')`)**一行都不用改**。
 *
 * 注意:授权用的分类选择器不该用这条路 —— 该用 `lifecycleAPI.manageableCategories`(它返回当前
 * 用户真正可管辖的分类)。用 crudAPI 取分类做**编辑器**选择器本就是权限回退,neo 主题的设计文档
 * 里已经记过这一条。管理后台走的是具名的 `listCategory()`,不经这里,不受影响。
 */
const CONTENT_REDIRECT: Record<string, (params?: any) => Promise<any>> = {
    categories: () => contentListCategories(),
};

export const crudAPI = {
    getList: (route: string, params: any = {}) =>
        CONTENT_REDIRECT[route] ? CONTENT_REDIRECT[route](params) : crud(route).list(params),
    getOne: (route: string, id: string | number, params: any = {}) => crud(route).get(id, params),
    create: (route: string, data: any) => crud(route).create(data),
    update: (route: string, id: string | number, data: any) => crud(route).update(id, data),
    remove: (route: string, id: string | number) => crud(route).remove(id),
};

/**
 * Stringify a loose query object into the shape /api/content/* expects.
 * dyapi's app-level middleware runs `JSON.parse(ctx.query.filter)` on every request
 * (core/dyapiApp.js), so object values must be sent as JSON, not bracket-expanded
 * the way axios would serialize them by default.
 */
function serializeContentQuery(params: Record<string, any>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null) continue;
        out[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
    return out;
}

// 文章详情/分类详情按 slug 查询;公开站只能走 /api/content/*(见 CLAUDE.md 坑 5)。
export const contentAPI = {
    getHome: () => contentGetHome(),
    getCategory: (slug: string) => contentGetCategory({ slug }),
    getArticle: (slug: string) => contentGetArticle({ slug }),
    // 受众轴过滤后的公开分类树(取代匿名直读 /api/categories)。
    listCategories: () => contentListCategories(),
    // Public article list — same query shape as the admin list; server forces status=visible.
    // Referenced by theme.config.ts prefetch via the string "contentAPI.listArticles".
    listArticles: (params: Record<string, any> = {}) => contentListArticles(serializeContentQuery(params)),
};

// Content lifecycle: status transitions and version history/rollback.
export const lifecycleAPI = {
    transition: (type: string, id: string | number, body: LifecycleTransitionBody) =>
        lifecycleTransition(type, id, body),
    revisions: (type: string, id: string | number) => lifecycleListRevisions(type, id),
    // NOTE: the backend only reads `version_no` (ContentLifecycleController.rollback destructures
    // just that key), so no `note` param here — the old signature accepted one and silently dropped it.
    rollback: (type: string, id: string | number, version_no: number) =>
        lifecycleRollback(type, id, { version_no }),
    // Categories the current user may create/manage articles in. Pass action="C" for the
    // new-article picker (only categories the user can create in); omit for the manage union.
    manageableCategories: (action?: string) => lifecycleManageableCategories(action ? { action } : undefined),
};

// Generic resource ACL. `model` is a content tablename (e.g. "articles") for row sharing,
// or a synthetic model with resourceId=<category id> for category-scoped grants.
/** 管辖轴:可在该分类子树下**管理**文章。 */
export const ARTICLES_CATEGORY = "articles_category";
/** 受众轴:可在公开站**查看**该分类子树下的受限文章(动作 `V`)。见 docs/public-access.md。 */
export const ARTICLES_AUDIENCE = "articles_audience";
/** 受众轴的动作字母。也可用于行级授权:aclAPI.grant('articles', <id>, { access: 'V' })。 */
export const VIEW_ACTION = "V";
export const aclAPI = {
    list: (model: string, resourceId: string | number) => aclList(model, resourceId),
    grant: (model: string, resourceId: string | number, body: AclCreateBody) =>
        aclCreate(model, resourceId, body),
    revoke: (model: string, resourceId: string | number, grantId: number) =>
        aclRemove(model, resourceId, grantId),
};

export const systemAPI = {
    getStatus: () => systemStatus(),
    getConfig: () => systemGetConfig(),
    saveConfig: (data: any) => systemUpdateConfig(data),
    restart: () => systemRestart(),
    setup: (data: SystemSetupBody) => systemSetup(data),
    exportData: () => systemExportData(),
};

export const uploadAPI = {
    getList: (params: ReadQuery = {}) => listAttachment(params),
    // axios sets the multipart boundary itself when the payload is a FormData.
    upload: (formData: FormData) => uploadUploadFile(formData),
    /**
     * Build the multipart body for you — the single place that knows the backend's
     * 'file' field name. Resolves to { code, data: attachmentRow[] }.
     */
    uploadFiles: (files: File[] | FileList) => {
        const fd = new FormData();
        Array.from(files).forEach((f) => fd.append('file', f));
        return uploadUploadFile(fd);
    },
    remove: (id: number) => uploadDeleteFile(id),
    getProviders: () => uploadGetProviders(),
    testStorage: (provider?: string) => uploadTestStorage({ provider }),
};

export const authAPI = {
    login: (data: { username: string; password: string }) => userLogin(data),
    loginInfo: () => userLoginInfo(),
    logout: () => userLogout(),
};
