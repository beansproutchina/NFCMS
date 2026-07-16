import type { DYApp } from "dyapi/core/dyapiApp.js";
import RoleModel from "../models/RoleModel.js";
import RolePermissionModel from "../models/RolePermissionModel.js";
import UserRoleModel from "../models/UserRoleModel.js";
import ResourceGrantModel from "../models/ResourceGrantModel.js";
import CategoryModel from "../models/CategoryModel.js";
import { hooks } from "./HookManager.js";

/**
 * Synthetic ResourceGrant.model for category-scoped article permissions.
 * A grant (model=ARTICLES_CATEGORY, resource_id=<category_id>, access="C,R,U,...") means:
 * "the grantee may perform those actions on ARTICLES in that category — and, because grants
 * cascade, in every descendant category too."
 */
export const ARTICLES_CATEGORY = "articles_category";

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

    /** Resource ids the user can `action` via ACL grants (own-user or their roles). Cached on state. */
    private async aclIds(state: any, model: any, action: string): Promise<any[]> {
        const cacheKey = `${model.tablename}:${action}`;
        if (state._acl?.has(cacheKey)) return state._acl.get(cacheKey);
        const uid = state.user?.id;
        const roleIds: any[] = state._roleIds || [];
        const grants = await this.app.I(ResourceGrantModel).read({ filter: { model: model.tablename } });
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
     * categories (grants cascade). Merges user + role grants. Cached on state per action.
     */
    private async categoryGrantIds(state: any, action: string): Promise<Set<number>> {
        state._catGrant ??= new Map<string, Set<number>>();
        if (state._catGrant.has(action)) return state._catGrant.get(action);
        const uid = state.user?.id;
        const roleIds: any[] = state._roleIds || [];
        const grants = await this.app.I(ResourceGrantModel).read({ filter: { model: ARTICLES_CATEGORY } });
        const direct = grants
            .filter(
                (g: any) =>
                    ((g.grantee_type === "user" && g.grantee_id == uid) ||
                        (g.grantee_type === "role" && roleIds.some((r) => r == g.grantee_id))) &&
                    String(g.access).includes(action)
            )
            .map((g: any) => Number(g.resource_id));
        const expanded = await this.expandCategories(state, direct);
        state._catGrant.set(action, expanded);
        return expanded;
    }

    /** Expand category ids to include their whole subtree (cascade). */
    private async expandCategories(state: any, ids: number[]): Promise<Set<number>> {
        if (!ids.length) return new Set();
        if (!state._catChildren) {
            const cats = await this.app.I(CategoryModel).read({ limit: 100000 });
            const childrenOf = new Map<number, number[]>();
            for (const c of cats) {
                const p = Number(c.parent_id) || 0;
                (childrenOf.get(p) ?? childrenOf.set(p, []).get(p)!).push(Number(c.id));
            }
            state._catChildren = childrenOf;
        }
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
}

export const policy = new PolicyService();

// Placeholder for future cache invalidation when roles/permissions change.
hooks.addAction("rbac_changed", () => { /* no-op: resolve() is uncached for now */ });
