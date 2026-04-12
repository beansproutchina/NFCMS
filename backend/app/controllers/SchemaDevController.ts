import { ControllerRoute, Route, Inject, Auth } from "dyapi/utils/decorators.js";
import { Controller } from "dyapi/core/controller.js";

@ControllerRoute("schematools")
export default class SchemaDevController extends Controller {

    @Route("get", "/all")
    @Auth("super_admin")
    async getAllSchemas() {
        const instanceDict = (this._app as any).instanceDict;
        const components = instanceDict ? (instanceDict instanceof Map ? Array.from(instanceDict.values()) : Object.values(instanceDict)) : [];
        const models = components.filter((c: any) => c && c.tablename && c.datafields);
        const schemas = models.map((m: any) => {
            return {
                modelName: m.constructor.name,
                tableName: m.tablename,
                routePath: m.tablename, // In dyapi CRUD path usually mimics tablename
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
