import type { DYApp } from "dyapi/core/dyapiApp.js";
import RoleModel from "../models/RoleModel.js";
import RolePermissionModel from "../models/RolePermissionModel.js";
import UserRoleModel from "../models/UserRoleModel.js";
import ResourceGrantModel from "../models/ResourceGrantModel.js";
import CategoryModel from "../models/CategoryModel.js";
import { hooks } from "./HookManager.js";
import {
    resolveVisibility,
    accessEffFromChain,
    normalizeTeaser,
    ACCESS_EFF_ANON,
    ACCESS_EFF_AUTHED,
    type ViewContext,
    type Visibility,
    type AccessEff,
    type AudienceLevel,
} from "../lib/audience.js";

/**
 * Synthetic ResourceGrant.model for category-scoped article permissions.
 * A grant (model=ARTICLES_CATEGORY, resource_id=<category_id>, access="C,R,U,...") means:
 * "the grantee may perform those actions on ARTICLES in that category — and, because grants
 * cascade, in every descendant category too."
 */
export const ARTICLES_CATEGORY = "articles_category";

/**
 * Synthetic ResourceGrant.model for the AUDIENCE axis (public-site gating, see
 * docs/public-access.md). A grant (model=ARTICLES_AUDIENCE, resource_id=<category_id>,
 * access="V") means: "the grantee may VIEW restricted articles in that category — and, because
 * grants cascade, in every descendant category too."
 *
 * Why a separate action letter `V` instead of reusing `R`: ARTICLES_CATEGORY's `R` already means
 * "can read every article in that category from the ADMIN side, drafts included". Reusing it would
 * silently upgrade "a member may read published content" into "a member may read drafts".
 */
export const ARTICLES_AUDIENCE = "articles_audience";

/** The audience-axis action letter. Also usable row-level: ResourceGrant(model="articles", access="V"). */
export const VIEW_ACTION = "V";

/**
 * PolicyService — the single authority for access control.
 *
 * Effective roles = primary role from the JWT (state.user.role) ∪ roles in user_roles.
 * A (model, action) is allowed only if some effective role has a role_permissions row
 * for it. `scope` decides row visibility: "any" = all rows; "own" = rows the user owns
 * (model.ownerField === user.id) or has an ACL grant for.
 *
 * No caching in this version: resolve() runs a few small indexed reads per authed request,
 * which keeps the logic simple and avoids stale-permission windows. Add caching later if needed.
 */
class PolicyService {
    private app!: DYApp;

    bind(app: DYApp) {
        this.app = app;
    }

    /** Expand state.user into state.roles / state.perms. Call once per request (in auth middleware). */
    async resolve(state: any): Promise<void> {
        state.roles = [];
        state.perms = new Map<string, string>(); // `${model}:${action}` -> scope
        state._roleIds = [];
        state._acl = new Map<string, any[]>();

        const uid = state.user?.id;
        if (uid == null) return; // anonymous / PUBLIC

        const roleNames = new Set<string>();
        if (state.user?.role) roleNames.add(state.user.role);

        const urs = await this.app.I(UserRoleModel).read({ filter: { user_id: uid } });
        if (urs.length) {
            const extra = await this.app.I(RoleModel).read({ filter: { id: { $in: urs.map((u: any) => u.role_id) } } });
            for (const r of extra) roleNames.add(r.name);
        }
        state.roles = [...roleNames];
        if (roleNames.size === 0) return;

        const roles = await this.app.I(RoleModel).read({ filter: { name: { $in: [...roleNames] } } });
        state._roleIds = roles.map((r: any) => r.id);
        if (state._roleIds.length === 0) return;

        const perms = await this.app.I(RolePermissionModel).read({ filter: { role_id: { $in: state._roleIds } } });
        for (const p of perms) {
            const key = `${p.model}:${p.action}`;
            if (state.perms.get(key) === "any") continue;
            state.perms.set(key, p.scope === "any" ? "any" : "own");
        }
    }

    isSuper(state: any): boolean {
        return Array.isArray(state.roles) && state.roles.includes("super_admin");
    }

    /** Serialize the resolved auth for the frontend (drives nav visibility + feature gating). */
    serialize(state: any) {
        const perms = state.perms instanceof Map ? [...state.perms] : [];
        return {
            roles: state.roles || [],
            isSuperAdmin: this.isSuper(state),
            permissions: perms.map(([k, scope]: [string, string]) => {
                const i = k.indexOf(":");
                return { model: k.slice(0, i), action: k.slice(i + 1), scope };
            }),
        };
    }

    /**
     * Does the user have `action` on `model`? Pass `row` for a single-item check.
     *
     * Priority: super_admin → role scope "any" → then the independent grant paths.
     *
     * CREATE is special: whatever you create is yours, so "own" is meaningless for it.
     * Create is therefore gated only by "any" scope or a category grant (with C) on the
     * target category — never by "own". For R/U/D/publish, the grant paths are
     * own-owner · row-level ACL · category grant, and any of them (even without a base
     * role_permission) suffices.
     */
    async can(state: any, action: string, model: any, row?: any): Promise<boolean> {
        if (this.isSuper(state)) return true;
        const scope = state.perms?.get(`${model.tablename}:${action}`);
        if (scope === "any") return true;
        const uid = state.user?.id;

        if (action === "C") {
            // No "own" create. Only a category grant (incl. C) unlocks creating in a category.
            if (!model.categoryField) return false;
            const cats = await this.categoryGrantIds(state, "C");
            if (!row) return cats.size > 0; // create gate (no target category yet)
            return row[model.categoryField] != null && cats.has(Number(row[model.categoryField]));
        }

        if (row) {
            if (scope === "own" && model.ownerField && row[model.ownerField] == uid) return true;
            const aclIds = await this.aclIds(state, model, action);
            if (aclIds.some((id) => id == row.id)) return true;
            if (model.categoryField && row[model.categoryField] != null) {
                const cats = await this.categoryGrantIds(state, action);
                if (cats.has(Number(row[model.categoryField]))) return true;
            }
            return false;
        }

        // No row (list gate): allowed if any path could grant this action.
        if (scope === "own") return true;
        if (model.categoryField && (await this.categoryGrantIds(state, action)).size > 0) return true;
        if ((await this.aclIds(state, model, action)).length > 0) return true;
        return false;
    }

    /** True if the user has unrestricted (`any`) scope for (model, action) — or is super_admin. */
    hasAnyScope(state: any, action: string, model: any): boolean {
        if (this.isSuper(state)) return true;
        return state.perms?.get(`${model.tablename}:${action}`) === "any";
    }

    /**
     * Filter to AND into a LIST query so only visible rows return. {} = unrestricted.
     * Builds an OR over every path that grants read access: owner rows, row-level ACL,
     * and (for article-like models) any article in a granted category subtree.
     */
    async scopeFilter(state: any, model: any, action: string): Promise<any> {
        if (this.isSuper(state)) return {};
        const scope = state.perms?.get(`${model.tablename}:${action}`);
        if (scope === "any") return {};
        const uid = state.user?.id;

        const or: any = {};
        if (scope === "own" && model.ownerField) or[model.ownerField] = uid;
        const aclIds = await this.aclIds(state, model, action);
        or.id = { $in: aclIds }; // empty => 0=1, contributes nothing to the OR
        if (model.categoryField) {
            const cats = [...(await this.categoryGrantIds(state, action))];
            or[model.categoryField] = { $in: cats };
        }
        return { $or: or };
    }

    /** Resource ids the user can `action` via ACL grants (own-user or their roles). Cached on state.
     *  `model` may be a model instance or a bare tablename (the audience axis passes "articles"
     *  without holding the model, to avoid an import cycle). */
    private async aclIds(state: any, model: any, action: string): Promise<any[]> {
        const table = typeof model === "string" ? model : model.tablename;
        const cacheKey = `${table}:${action}`;
        if (state._acl?.has(cacheKey)) return state._acl.get(cacheKey);
        const uid = state.user?.id;
        const roleIds: any[] = state._roleIds || [];
        const grants = await this.app.I(ResourceGrantModel).read({ filter: { model: table } });
        const ids = grants
            .filter(
                (g: any) =>
                    ((g.grantee_type === "user" && g.grantee_id == uid) ||
                        (g.grantee_type === "role" && roleIds.some((r) => r == g.grantee_id))) &&
                    String(g.access).includes(action)
            )
            .map((g: any) => g.resource_id);
        state._acl?.set(cacheKey, ids);
        return ids;
    }

    /**
     * Category ids the user may `action` articles in, expanded to include all descendant
     * categories (grants cascade). Merges user + role grants. Cached on state per (grantModel, action).
     *
     * `grantModel` selects the axis: ARTICLES_CATEGORY = 管辖轴 (admin reach), ARTICLES_AUDIENCE =
     * 受众轴 (public-site view). Same shape, deliberately separate grant rows.
     */
    private async categoryGrantIds(
        state: any,
        action: string,
        grantModel: string = ARTICLES_CATEGORY,
    ): Promise<Set<number>> {
        state._catGrant ??= new Map<string, Set<number>>();
        const cacheKey = `${grantModel}:${action}`;
        if (state._catGrant.has(cacheKey)) return state._catGrant.get(cacheKey);
        const uid = state.user?.id;
        const roleIds: any[] = state._roleIds || [];
        const grants = await this.app.I(ResourceGrantModel).read({ filter: { model: grantModel } });
        const direct = grants
            .filter(
                (g: any) =>
                    ((g.grantee_type === "user" && g.grantee_id == uid) ||
                        (g.grantee_type === "role" && roleIds.some((r) => r == g.grantee_id))) &&
                    String(g.access).includes(action)
            )
            .map((g: any) => Number(g.resource_id));
        const expanded = await this.expandCategories(state, direct);
        state._catGrant.set(cacheKey, expanded);
        return expanded;
    }

    /**
     * The whole category table, read at most ONCE per request and cached on `state` along with the
     * parent→children map and an id→row index. Both axes need it (subtree cascade for grants, parent
     * chain for audience inheritance), so sharing the read keeps the per-request cost at one query.
     */
    private async categoryIndex(state: any): Promise<{ rows: any[]; childrenOf: Map<number, number[]>; byId: Map<number, any> }> {
        if (!state._catIndex) {
            const rows = await this.app.I(CategoryModel).read({ limit: 100000 });
            const childrenOf = new Map<number, number[]>();
            const byId = new Map<number, any>();
            for (const c of rows) {
                const p = Number(c.parent_id) || 0;
                (childrenOf.get(p) ?? childrenOf.set(p, []).get(p)!).push(Number(c.id));
                byId.set(Number(c.id), c);
            }
            state._catIndex = { rows, childrenOf, byId };
            state._catChildren = childrenOf; // 兼容:早先的字段名
        }
        return state._catIndex;
    }

    /** Expand category ids to include their whole subtree (cascade). */
    private async expandCategories(state: any, ids: number[]): Promise<Set<number>> {
        if (!ids.length) return new Set();
        await this.categoryIndex(state);
        const out = new Set<number>();
        const stack = [...ids];
        while (stack.length) {
            const id = stack.pop()!;
            if (out.has(id)) continue;
            out.add(id);
            for (const ch of state._catChildren.get(id) ?? []) stack.push(ch);
        }
        return out;
    }

    /**
     * Which categories may the user act on articles in? Returns "any" (unrestricted —
     * super_admin or an articles role-permission with scope "any" for one of the actions)
     * or the explicit set of cascaded category-grant ids. Drives the admin category dropdown.
     * `actions` defaults to create+manage; pass ["C"] for the new-article category picker.
     */
    async manageableArticleCategories(state: any, actions: string[] = ["C", "U", "publish"]): Promise<"any" | number[]> {
        if (this.isSuper(state)) return "any";
        for (const a of actions) {
            if (state.perms?.get(`articles:${a}`) === "any") return "any";
        }
        const set = new Set<number>();
        for (const a of actions) {
            for (const id of await this.categoryGrantIds(state, a)) set.add(id);
        }
        return [...set];
    }

    // ════════════════════════════════════════════════════════════════════════════════════
    // 受众轴(公开站门禁)。与上面的管辖轴**正交**:管辖轴回答"登录用户能改什么",受众轴回答
    // "访客能看什么"。两轴共享 ResourceGrant 表与分类树索引,但判定互不调用。
    // 判定规则本身是 app/lib/audience.ts 的纯函数;这里只负责把 state 组装成它需要的上下文
    // —— 读 grants 的地方仍然只有 PolicyService 一处。设计见 docs/public-access.md。
    // ════════════════════════════════════════════════════════════════════════════════════

    /**
     * 组装受众判定上下文。匿名路径**一次库都不读**(匿名不可能持有 grant),这是公开流量的绝大多数。
     * 缓存在 state 上,一个请求内多次调用免费。
     */
    async viewContext(state: any): Promise<ViewContext> {
        if (state._viewCtx) return state._viewCtx;
        const isAuthed = state.user?.id != null;
        const unrestricted = this.isSuper(state) || state.perms?.get("articles:R") === "any";

        let grantedCats = new Set<number>();
        let grantedIds = new Set<string>();
        if (isAuthed && !unrestricted) {
            grantedCats = await this.categoryGrantIds(state, VIEW_ACTION, ARTICLES_AUDIENCE);
            const raw = await this.aclIds(state, "articles", VIEW_ACTION);
            grantedIds = new Set(raw.map((id: any) => String(id)));
        }
        state._viewCtx = { isAuthed, unrestricted, grantedCats, grantedIds };
        return state._viewCtx;
    }

    /** 单条内容的可见性。返回三态而不是布尔 —— `locked` 不是拒绝,它走 200 + 剥正文。 */
    async canView(state: any, row: any): Promise<Visibility> {
        return resolveVisibility(row, await this.viewContext(state));
    }

    /**
     * AND 进公开列表查询的 filter。`{}` = 无约束。
     * 空集合的 `{$in: []}` 对 OR 无贡献(与 scopeFilter 同行为),所以无授权用户不会因此多看到东西。
     */
    async viewFilter(state: any): Promise<any> {
        const ctx = await this.viewContext(state);
        if (ctx.unrestricted) return {};
        if (!ctx.isAuthed) return { access_eff: { $in: ACCESS_EFF_ANON } };
        const rawIds = await this.aclIds(state, "articles", VIEW_ACTION);
        return {
            $or: {
                access_eff: { $in: ACCESS_EFF_AUTHED },
                category_id: { $in: [...ctx.grantedCats] },
                id: { $in: rawIds },
            },
        };
    }

    /**
     * 栏目自身的有效 access_eff —— 沿父链继承(取最严)。栏目上不物化派生值(栏目数量小、
     * 每请求已经全表读进 state),所以这里现算。
     */
    private async categoryAccessEff(state: any, categoryId: any): Promise<AccessEff> {
        const { byId } = await this.categoryIndex(state);
        const chain: AudienceLevel[] = [];
        const seen = new Set<number>();
        let id = Number(categoryId);
        while (Number.isFinite(id) && id > 0 && !seen.has(id)) {
            seen.add(id);
            const cat = byId.get(id);
            if (!cat) break;
            chain.unshift({ audience: cat.audience || null, teaser: normalizeTeaser(cat.teaser) });
            id = Number(cat.parent_id) || 0;
        }
        return accessEffFromChain(chain);
    }

    /** 栏目对当前访客的可见性(栏目详情页 / 分类列表过滤共用)。 */
    async canViewCategory(state: any, categoryId: any): Promise<Visibility> {
        const ctx = await this.viewContext(state);
        const access_eff = await this.categoryAccessEff(state, categoryId);
        // `id: null` 是刻意的:行级 V 授权是给**文章**发的,不能让同号的栏目蹭到。
        return resolveVisibility({ access_eff, category_id: Number(categoryId), id: null }, ctx);
    }

    /**
     * 访客可见的栏目 id 集合(非 hidden —— teaser 栏目**要**出现在列表里,那正是它的用途)。
     * 供 /content/categories 与分类树过滤使用。
     */
    async viewableCategoryIds(state: any): Promise<Set<number>> {
        if (state._viewableCats) return state._viewableCats;
        const { rows } = await this.categoryIndex(state);
        const out = new Set<number>();
        for (const c of rows) {
            if ((await this.canViewCategory(state, c.id)) !== "hidden") out.add(Number(c.id));
        }
        state._viewableCats = out;
        return out;
    }
}

export const policy = new PolicyService();

// Placeholder for future cache invalidation when roles/permissions change.
hooks.addAction("rbac_changed", () => { /* no-op: resolve() is uncached for now */ });
