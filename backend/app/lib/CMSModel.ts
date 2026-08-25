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

    /**
     * 这个模型上**真的会被 RBAC 判定**的动作 —— 权限矩阵只该列出这些。
     *
     * 存在的理由:后台的权限面板过去把所有注册模型、所有动作、两种 scope 都列出来,而引擎只认
     * CMSModel;给 `users`、`menus` 配一行权限写了等于没写,给没有 `ownerField` 的模型配 `own`
     * 也是静默无效。判据必须由模型自己给出(它才知道自己有没有生命周期字段、有没有属主列),
     * 不能靠面板去猜、更不能靠读源码才知道的规则。
     *
     * `publish` 只在有生命周期字段的模型上有意义(附件没有 status,发布无从谈起)。
     */
    get rbacActions(): string[] {
        const base = ["C", "R", "U", "D"];
        const hasLifecycle = this.datafields?.some?.((f: any) => f.name === "status");
        return hasLifecycle ? [...base, "publish"] : base;
    }

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
            /**
             * 属主列**一律**落到创建者身上:受限创建者是强制(不许伪造他人),全站创建者是
             * 缺省(没显式给就是自己)。
             *
             * 以前只有 `forceOwner` 那一支写属主,于是站点级创建者建的行属主为空 —— 谁的
             * `own` 都匹配不上。"own 只对一部分行生效"比"own 不生效"更难查。
             */
            if (this.ownerField && (forceOwner || item[this.ownerField] === undefined)) {
                item[this.ownerField as string] = state.user?.id;
            }
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
        /**
         * 删除也要发 hook。`HTTPCreate`/`HTTPUpdate` 都发 `content.saved.*`,唯独删除不发 ——
         * 于是删掉一篇已生成静态页的文章,那张页面会永远留在磁盘上继续被 nginx 命中。
         * 僵尸页比 404 坏得多:它看起来是好的。
         *
         * 用独立事件名而不是复用 `content.saved`:订阅方要区分「这行还在,重算它」和
         * 「这行没了,清掉它的产物」—— 后者读不到行,复用同一个名字会让每个订阅者自己去猜。
         */
        await hooks.doAction(`content.removed.${this.tablename}`, id, existing);
        return { code: 200 };
    }
}
