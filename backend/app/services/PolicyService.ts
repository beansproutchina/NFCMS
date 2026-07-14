import type { DYApp } from "dyapi/core/dyapiApp.js";
import RoleModel from "../models/RoleModel.js";
import RolePermissionModel from "../models/RolePermissionModel.js";
import UserRoleModel from "../models/UserRoleModel.js";
import ResourceGrantModel from "../models/ResourceGrantModel.js";
import { hooks } from "./HookManager.js";

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

    /** Does the user have `action` on `model`? Pass `row` for a single-item check (own/ACL). */
    async can(state: any, action: string, model: any, row?: any): Promise<boolean> {
        if (this.isSuper(state)) return true;
        const scope = state.perms?.get(`${model.tablename}:${action}`);
        if (!scope) return false;
        if (scope === "any") return true;
        // scope === "own"
        if (!row) return true; // create / list — row filtering handled by scopeFilter
        const uid = state.user?.id;
        if (model.ownerField && row[model.ownerField] == uid) return true;
        const aclIds = await this.aclIds(state, model, action);
        return aclIds.some((id) => id == row.id);
    }

    /** True if the user has unrestricted (`any`) scope for (model, action) — or is super_admin. */
    hasAnyScope(state: any, action: string, model: any): boolean {
        if (this.isSuper(state)) return true;
        return state.perms?.get(`${model.tablename}:${action}`) === "any";
    }

    /** Filter to AND into a LIST query so only visible rows return. {} = unrestricted. */
    async scopeFilter(state: any, model: any, action: string): Promise<any> {
        if (this.isSuper(state)) return {};
        const scope = state.perms?.get(`${model.tablename}:${action}`);
        if (scope === "any") return {};
        if (scope !== "own") return { id: { $in: [] } }; // no permission -> match nothing
        const uid = state.user?.id;
        const aclIds = await this.aclIds(state, model, action);
        if (model.ownerField) {
            // owner OR explicitly granted. Distinct keys in one $or => (owner=? OR id IN (...)).
            return { $or: { [model.ownerField]: uid, id: { $in: aclIds } } };
        }
        return { id: { $in: aclIds } };
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
}

export const policy = new PolicyService();

// Placeholder for future cache invalidation when roles/permissions change.
hooks.addAction("rbac_changed", () => { /* no-op: resolve() is uncached for now */ });
