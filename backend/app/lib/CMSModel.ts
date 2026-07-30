import { Model } from "dyapi/core/model.js";
import { assert, ForbiddenError, BadRequestError } from "dyapi/utils/error.js";
import { policy } from "../services/PolicyService.js";
import { revisions } from "../services/RevisionService.js";
import { hooks } from "../services/HookManager.js";
import { mergeFilter } from "../utils/filters.js";

/**
 * Base class for CMS content models. RBAC (PolicyService) is the SOLE authority here:
 * the HTTP* methods are fully reimplemented and do NOT call DYAPI's built-in
 * permission check, so subclasses declare NO static `permission` map.
 *
 * Row-level scoping:
 *  - LIST reads AND a scopeFilter into the query.
 *  - Single-item read/update/delete fetch the row and check policy.can(..., row),
 *    which sidesteps the `/:id` short-circuit in the SQL layer (id ignores filter).
 *
 * Subclasses set `ownerField` (e.g. "author_id") to enable ownership-based "own" scope.
 */
export class CMSModel extends Model {
    /** @type {string|null} column holding the owning user id, or null for no ownership */
    ownerField: string | null = null;

    /** @type {string|null} column holding the category id, to enable category-scoped grants
     *  (PolicyService cascades a category grant to that category's article subtree). */
    categoryField: string | null = null;

    /** Lifecycle-managed fields: never writable via generic CRUD; only the lifecycle
     *  controller / scheduler may change them (via raw update).
     *
     *  `access_eff` is the受众轴 derived value (see docs/public-access.md): it is computed from
     *  the row's own `audience`/`teaser` plus its category chain, so accepting it from a request
     *  body would let a client hand itself visibility. Author intent (`audience`/`teaser`) stays
     *  writable — only the derivation is protected. Listing a field a subclass doesn't declare is
     *  harmless (writableKeys filters over `datafields`). */
    lifecycleFields: string[] = ["status", "publish_at", "rev_version", "access_eff"];

    private writableKeys(): string[] {
        return this.datafields
            .map((f: any) => f.name)
            .filter((n: string) => n !== "id" && !this.lifecycleFields.includes(n));
    }

    async HTTPReadMany(state: any, query: any) {
        assert(await policy.can(state, "R", this), ForbiddenError, "没有权限");
        const param: any = this.processReadQuery(state, query);
        param.filter = mergeFilter(param.filter, await policy.scopeFilter(state, this, "R"));
        const rows = await this.read(param);
        return { code: 200, data: rows, total: param.total, pages: param.pages };
    }

    async HTTPReadOne(state: any, query: any) {
        assert(await policy.can(state, "R", this), ForbiddenError, "没有权限");
        const param: any = this.processReadQuery(state, query);
        param.limit = 1;
        param.offset = 0;
        param.page = 0;
        const row = (await this.read(param))[0];
        if (row) assert(await policy.can(state, "R", this, row), ForbiddenError, "没有权限");
        return { code: 200, data: row };
    }

    async HTTPCreate(state: any, _query: any, body: any) {
        assert(await policy.can(state, "C", this), ForbiddenError, "没有权限");
        const items = Array.isArray(body) ? body : [body];
        const forceOwner = this.ownerField && !policy.hasAnyScope(state, "C", this);
        const ids: any[] = [];
        for (const raw of items) {
            const item: any = {};
            for (const k of this.writableKeys()) if (raw[k] !== undefined) item[k] = raw[k];
            if (forceOwner) item[this.ownerField as string] = state.user?.id;
            // Re-check with the concrete item so category-scoped users can only create in a
            // category they're granted (no-op for "any"/"own"-owner creators).
            assert(await policy.can(state, "C", this, item), ForbiddenError, "没有该分类的权限");
            const id = await this.create(item);
            await revisions.snapshot(this, id, state.user?.id, "create");
            await hooks.doAction(`content.saved.${this.tablename}`, id);
            ids.push(id);
        }
        return { code: 200, id: Array.isArray(body) ? ids : ids[0] };
    }

    async HTTPUpdate(state: any, query: any, body: any) {
        assert(await policy.can(state, "U", this), ForbiddenError, "没有权限");
        const id = query.id;
        assert(id != null, BadRequestError, "缺少 id");
        const existing = (await this.read({ id }))[0];
        if (existing) assert(await policy.can(state, "U", this, existing), ForbiddenError, "没有权限");
        const item: any = {};
        for (const k of this.writableKeys()) if (body[k] !== undefined) item[k] = body[k];
        const length = await this.update({ id }, item);
        await revisions.snapshot(this, id, state.user?.id, "update");
        await hooks.doAction(`content.saved.${this.tablename}`, id);
        return { code: 200, length };
    }

    async HTTPDelete(state: any, query: any) {
        assert(await policy.can(state, "D", this), ForbiddenError, "没有权限");
        const id = query.id;
        assert(id != null, BadRequestError, "缺少 id");
        const existing = (await this.read({ id }))[0];
        if (existing) assert(await policy.can(state, "D", this, existing), ForbiddenError, "没有权限");
        await this.remove({ id });
        return { code: 200 };
    }
}
