import { ControllerRoute, Route } from "dyapi/utils/decorators.js";
import { Controller } from "dyapi/core/controller.js";
import { CMSModel } from "../lib/CMSModel.js";
import { policy } from "../services/PolicyService.js";
import { revisions } from "../services/RevisionService.js";
import { hooks } from "../services/HookManager.js";
import ResourceGrantModel from "../models/ResourceGrantModel.js";

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
        if (to === "visible" && hasField("published_at") && !row.published_at) update.published_at = new Date();

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

    // --- Resource ACL / sharing (owner-initiated) ---
    // Anyone who can update a row may share it. Grants are consumed by PolicyService.scopeFilter/can.

    @Route("post", "/:type/:id/share")
    async share(ctx: any) {
        const { type, id } = ctx.params;
        const { grantee_type, grantee_id, access } = ctx.request.body || {};
        const model = this.resolveModel(type);
        if (!model) return { code: 404, message: "Unknown content type" };
        const row = (await model.read({ id }))[0];
        if (!row) return { code: 404, message: "Not found" };
        if (!(await policy.can(ctx.state, "U", model, row))) return { code: 403, message: "没有权限" };
        if (!["user", "role"].includes(grantee_type)) return { code: 400, message: "grantee_type must be user|role" };
        if (!access) return { code: 400, message: "access is required (e.g. \"R\" or \"R,U\")" };
        const gid = await this._app.I(ResourceGrantModel).create({
            model: type,
            resource_id: Number(id),
            grantee_type,
            grantee_id: Number(grantee_id),
            access,
            granted_by: ctx.state.user?.id,
            created_at: new Date(),
        });
        return { code: 200, data: { id: gid } };
    }

    @Route("get", "/:type/:id/grants")
    async grants(ctx: any) {
        const { type, id } = ctx.params;
        const model = this.resolveModel(type);
        if (!model) return { code: 404, message: "Unknown content type" };
        const row = (await model.read({ id }))[0];
        if (!row) return { code: 404, message: "Not found" };
        if (!(await policy.can(ctx.state, "U", model, row))) return { code: 403, message: "没有权限" };
        const data = await this._app.I(ResourceGrantModel).read({
            filter: { $and: { model: type, resource_id: Number(id) } },
        });
        return { code: 200, data };
    }

    @Route("delete", "/:type/:id/share/:grantId")
    async revoke(ctx: any) {
        const { type, id, grantId } = ctx.params;
        const model = this.resolveModel(type);
        if (!model) return { code: 404, message: "Unknown content type" };
        const row = (await model.read({ id }))[0];
        if (!row) return { code: 404, message: "Not found" };
        if (!(await policy.can(ctx.state, "U", model, row))) return { code: 403, message: "没有权限" };
        await this._app.I(ResourceGrantModel).remove({ id: Number(grantId) });
        return { code: 200 };
    }
}
