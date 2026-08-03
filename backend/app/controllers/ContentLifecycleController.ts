import { ControllerRoute, Route } from "dyapi/utils/decorators.js";
import { Controller } from "dyapi/core/controller.js";
import { CMSModel } from "../lib/CMSModel.js";
import { policy } from "../services/PolicyService.js";
import { revisions } from "../services/RevisionService.js";
import { hooks } from "../services/HookManager.js";
import CategoryModel from "../models/CategoryModel.js";
import { audience } from "../services/AudienceService.js";
import { isBlankDate } from "../utils/dates.js";

const STATES = ["hidden", "scheduled", "visible"];

/**
 * Content lifecycle: status transitions (hidden/scheduled/visible) and revision history.
 * Status is a lifecycle-managed field (not writable via plain PUT), so all transitions
 * funnel through here where they are permission-checked and snapshotted.
 */
@ControllerRoute("lifecycle")
export default class ContentLifecycleController extends Controller {
    /** Resolve a CMSModel instance by its tablename (the ":type" route param). */
    private resolveModel(type: string): any {
        const dict = (this._app as any).instanceDict;
        const models = dict instanceof Map ? [...dict.values()] : Object.values(dict);
        return models.find((m: any) => m && m.tablename === type && m instanceof CMSModel);
    }

    @Route("post", "/:type/:id/transition")
    async transition(ctx: any) {
        const { type, id } = ctx.params;
        const { to, publish_at, note } = ctx.request.body || {};
        const model = this.resolveModel(type);
        if (!model) return { code: 404, message: "Unknown content type" };
        if (!STATES.includes(to)) return { code: 400, message: "Invalid target status" };

        const row = (await model.read({ id }))[0];
        if (!row) return { code: 404, message: "Not found" };

        // Publishing/scheduling needs 'publish'; hiding is an update ('U').
        const cap = to === "hidden" ? "U" : "publish";
        if (!(await policy.can(ctx.state, cap, model, row))) return { code: 403, message: "没有权限" };

        const update: any = { status: to };
        if (to === "scheduled") {
            if (!publish_at) return { code: 400, message: "publish_at is required for scheduled status" };
            update.publish_at = new Date(publish_at);
        } else {
            update.publish_at = null;
        }
        const hasField = (n: string) => model.datafields.some((f: any) => f.name === n);
        // 首次公开才盖 published_at:已有值(含作者手工补录的日期)一律保留。
        // 空判必须走 isBlankDate —— 库里可能是文本 "null",而它是 truthy。
        if (to === "visible" && hasField("published_at") && isBlankDate(row.published_at)) {
            update.published_at = new Date();
        }

        await model.update({ id }, update);
        await revisions.snapshot(model, id, ctx.state.user?.id, `status -> ${to}${note ? ": " + note : ""}`);
        await hooks.doAction(`content.saved.${model.tablename}`, id);
        if (to === "visible" && row.status !== "visible") {
            await hooks.doAction(`content.published.${model.tablename}`, id, row);
        }
        return { code: 200, message: `Transitioned to ${to}` };
    }

    @Route("get", "/:type/:id/revisions")
    async listRevisions(ctx: any) {
        const { type, id } = ctx.params;
        const model = this.resolveModel(type);
        if (!model) return { code: 404, message: "Unknown content type" };
        const row = (await model.read({ id }))[0];
        if (!row) return { code: 404, message: "Not found" };
        if (!(await policy.can(ctx.state, "R", model, row))) return { code: 403, message: "没有权限" };
        return { code: 200, data: await revisions.list(model, id) };
    }

    @Route("post", "/:type/:id/rollback")
    async rollback(ctx: any) {
        const { type, id } = ctx.params;
        const { version_no } = ctx.request.body || {};
        const model = this.resolveModel(type);
        if (!model) return { code: 404, message: "Unknown content type" };
        const row = (await model.read({ id }))[0];
        if (!row) return { code: 404, message: "Not found" };
        if (!(await policy.can(ctx.state, "U", model, row))) return { code: 403, message: "没有权限" };
        const ok = await revisions.rollback(model, id, version_no, ctx.state.user?.id);
        return ok ? { code: 200, message: `Rolled back to v${version_no}` } : { code: 404, message: "Revision not found" };
    }

    // Resource ACL / sharing moved to AclController (/acl) so it can be reused generically
    // (content-row sharing + category-scoped article grants).

    /** Categories the caller may create/manage articles in — drives the editor's category dropdown.
     *  Pass ?action=C for the new-article picker (only categories the user can create in). */
    @Route("get", "/manageable-categories")
    async manageableCategories(ctx: any) {
        const action = ctx.query?.action;
        const scope = await policy.manageableArticleCategories(ctx.state, action ? [String(action)] : undefined);
        const all = await this._app.I(CategoryModel).read({ limit: 100000, orderBy: "weight" });
        const categories = scope === "any" ? all : all.filter((c: any) => scope.includes(Number(c.id)));
        // 带上受众轴的继承结果:文章编辑器要据此显示"本文继承到的有效受众"。
        await audience.annotateCategories(categories);
        return { code: 200, data: { scope: scope === "any" ? "any" : "scoped", categories } };
    }
}
