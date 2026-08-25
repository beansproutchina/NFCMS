import { ControllerRoute, Route, Inject, Auth } from "dyapi/utils/decorators.js";
import { Controller } from "dyapi/core/controller.js";
import { registeredModels } from "../lib/registry.js";

@ControllerRoute("schematools")
export default class SchemaDevController extends Controller {

    @Route("get", "/all")
    @Auth("super_admin")
    async getAllSchemas() {
        const models = registeredModels(this._app).filter((c: any) => c?.tablename && c.datafields);
        const schemas = models.map((m: any) => {
            return {
                modelName: m.constructor.name,
                tableName: m.tablename,
                routePath: m.tablename, // In dyapi CRUD path usually mimics tablename
                /**
                 * 权限面板需要的两个判据,由**模型自己**给出(见 CMSModel.rbacActions):
                 *   rbacActions —— 这张表上真的会被 RBAC 判定的动作;空数组 = 这张表不认
                 *                  role_permissions(users / categories / menus / RBAC 三张表…),
                 *                  面板必须把它藏起来,否则配了等于没配。
                 *   ownerField  —— 没有属主列就没有 `own`,面板只该给 `any`。
                 */
                rbacActions: Array.isArray((m as any).rbacActions) ? (m as any).rbacActions : [],
                ownerField: (m as any).ownerField ?? null,
                fields: m.datafields.map(f => ({
                    name: f.name,
                    type: f.type,
                    defaultValue: f.defaultvalue
                }))
            };
        });
        return { code: 200, data: schemas };
    }
}
