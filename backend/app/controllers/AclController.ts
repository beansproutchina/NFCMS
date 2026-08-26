import { ControllerRoute, Route } from "dyapi/utils/decorators.js";
import { Controller } from "dyapi/core/controller.js";
import { CMSModel } from "../lib/CMSModel.js";
import { policy, ARTICLES_CATEGORY, ARTICLES_AUDIENCE } from "../services/PolicyService.js";
import ResourceGrantModel from "../models/ResourceGrantModel.js";
import { findModelByTable } from "../lib/registry.js";

/**
 * Generic resource-ACL management: list / grant / revoke access on a (model, resource) pair.
 * Consumed by the reusable frontend <AclEditor>. Three kinds of target:
 *   - a content row, e.g. model="articles", resourceId=<article id>  (owner-initiated sharing).
 *     `access` may include the audience-axis letter `V` — that is a row-level "this visitor may
 *     VIEW this one article" grant (see docs/public-access.md), so a single article can be shared
 *     without carving out a category for it.
 *   - a category-scoped article grant, model="articles_category", resourceId=<category id>
 *     (RBAC-level / 管辖轴; super_admin only) — see PolicyService.
 *   - a category-scoped AUDIENCE grant, model="articles_audience", access="V" (受众轴;
 *     super_admin only) — who may view restricted articles in that category subtree.
 *
 * Permission to manage grants:
 *   - super_admin: always.
 *   - articles_category / articles_audience grants: super_admin only.
 *   - a content row: whoever can update that row (policy.can 'U'). Granting `V` on a row you can
 *     already edit adds no reach — you could just as well set that article's audience to public.
 */
@ControllerRoute("acl")
export default class AclController extends Controller {
    private resolveModel(type: string): any {
        const found = findModelByTable(this._app, type);
        return found instanceof CMSModel ? found : undefined;
    }

    /** Whether the caller may view/modify grants for (model, resourceId). */
    private async canManage(state: any, model: string, resourceId: string): Promise<boolean> {
        if (policy.isSuper(state)) return true;
        // 两个合成 model 都是站点级授权,只有 super_admin 能改。显式写出来而不是依赖
        // resolveModel 找不到就返回 false —— 后者是巧合,不是意图。
        if (model === ARTICLES_CATEGORY || model === ARTICLES_AUDIENCE) return false;
        const m = this.resolveModel(model);
        if (!m) return false;
        const row = (await m.read({ id: resourceId }))[0];
        if (!row) return false;
        return await policy.can(state, "U", m, row);
    }

    @Route("get", "/:model/:resourceId")
    async list(ctx: any) {
        const { model, resourceId } = ctx.params;
        // id 一律字符串原样(雪花安全:19 位十进制 id 过 Number() 会丢精度)。
        if (!(await this.canManage(ctx.state, model, resourceId))) return { code: 403, message: "没有权限" };
        const data = await this._app.I(ResourceGrantModel).read({
            filter: { $and: { model, resource_id: resourceId } },
        });
        return { code: 200, data };
    }

    @Route("post", "/:model/:resourceId")
    async create(ctx: any) {
        const { model, resourceId } = ctx.params;
        const { grantee_type, grantee_id, access } = ctx.request.body || {};
        if (!(await this.canManage(ctx.state, model, resourceId))) return { code: 403, message: "没有权限" };
        if (!["user", "role"].includes(grantee_type)) return { code: 400, message: "grantee_type 必须是 user|role" };
        if (grantee_id == null) return { code: 400, message: "缺少 grantee_id" };
        if (!access) return { code: 400, message: "缺少 access (如 \"R\" 或 \"C,R,U,D\")" };
        // Avoid duplicate (model, resource, grantee) rows — update access if one exists.
        const existing = (await this._app.I(ResourceGrantModel).read({
            filter: { $and: { model, resource_id: resourceId, grantee_type, grantee_id: String(grantee_id) } },
        }))[0];
        if (existing) {
            await this._app.I(ResourceGrantModel).update({ id: existing.id }, { access });
            return { code: 200, data: { id: existing.id, updated: true } };
        }
        const id = await this._app.I(ResourceGrantModel).create({
            model,
            resource_id: resourceId,
            grantee_type,
            grantee_id: String(grantee_id),
            access,
            granted_by: ctx.state.user?.id,
            created_at: new Date(),
        });
        return { code: 200, data: { id } };
    }

    @Route("delete", "/:model/:resourceId/:grantId")
    async remove(ctx: any) {
        const { model, resourceId, grantId } = ctx.params;
        if (!(await this.canManage(ctx.state, model, resourceId))) return { code: 403, message: "没有权限" };
        // IDOR 修复:grantId 必须真属于本次已授权的 (model, resourceId),否则可借它删除全站任意授权行
        // (含 super 配的分类/受众管辖授权)。id 用字符串比较,雪花安全。
        const grant = (await this._app.I(ResourceGrantModel).read({ id: grantId }))[0];
        if (!grant || grant.model !== model || String(grant.resource_id) !== String(resourceId)) {
            return { code: 404, message: "授权不存在" };
        }
        await this._app.I(ResourceGrantModel).remove({ id: grantId });
        return { code: 200 };
    }
}
