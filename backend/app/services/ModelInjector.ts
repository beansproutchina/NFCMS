import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { CMSModel } from "../lib/CMSModel.js";
import { CRUD, PopTarget, Inject } from "dyapi/utils/decorators.js";
import { assert, ForbiddenError } from "dyapi/utils/error.js";
import testContainer from "../containers/testContainer.js";
import { decorateClass, decorateProperty } from "dyapi/utils/dynamic.js";
import { hooks } from "./HookManager.js";
import type { DYApp } from "dyapi/core/dyapiApp.js";
import RolePermissionModel from "../models/RolePermissionModel.js";
import { policy } from "./PolicyService.js";

/**
 * Stores user-defined content-type schemas. Each row is turned into a live, CRUD-exposed
 * CMSModel at boot (and on creation, via the schema_inserted hook) by injectDynamicModel.
 */
@CRUD("schemas")
@PopTarget("uid")
export class ContentSchemaModel extends Model {
    @Inject(testContainer) declare container;
    tablename = "schemas";
    datafields = [
        F.String("modelName").notNull().unique(),
        F.String("tableName").notNull().unique(),
        F.String("routePath").notNull().unique(),
        F.Object("schemaDefinition").notNull(),   // [{ name, type }]
        F.Date("createdAt"),
    ];
    /** 静态 map 只管写(与 super_admin);读走下面的 RBAC 闸门,不再硬编码角色名。 */
    permission = {
        "PUBLIC": "",
        "DEFAULT": "",
        "super_admin": "C,R,U,D"
    };

    /** 读由 `role_permissions(schemas, R, any)` 决定。理由同 RevisionModel 的注释。 */
    async HTTPReadMany(state, query) {
        assert(policy.hasAnyScope(state, "R", this), ForbiddenError, "没有权限");
        const param: any = this.processReadQuery(state, query);
        const rows = await this.read(param);
        return { code: 200, data: rows, total: param.total, pages: param.pages };
    }

    async HTTPReadOne(state, query) {
        assert(policy.hasAnyScope(state, "R", this), ForbiddenError, "没有权限");
        const param: any = this.processReadQuery(state, query);
        param.limit = 1;
        param.offset = 0;
        param.page = 0;
        return { code: 200, data: (await this.read(param))[0] };
    }

    async create(item) {
        const result = await super.create(item);
        await hooks.doAction("schema_inserted", item);
        return result;
    }

    async update(param, item) {
        const result = await super.update(param, item);
        await hooks.doAction("schema_updated", item);
        return result;
    }
}

function parseFieldType(typeStr: string, name: string) {
    switch (String(typeStr).toLowerCase()) {
        case "int": return F.Number(name);
        case "float": return F.Float(name);
        case "boolean": return F.Number(name);
        case "date": return F.Date(name);
        case "json": return F.Object(name);
        case "text":
        case "string":
        default: return F.String(name);
    }
}

/**
 * Materialize a schema record into a live CMSModel subclass with CRUD routes.
 * Idempotent: a model with the same tablename is only registered once.
 */
export async function injectDynamicModel(app: DYApp, schemaDef: any) {
    const { modelName, tableName, routePath, schemaDefinition } = schemaDef;
    if (!modelName || !tableName || !routePath || !schemaDefinition) return;

    const already = Object.values((app as any).instanceDict).some((m: any) => m && m.tablename === tableName);
    if (already) return;

    const fields = typeof schemaDefinition === "string" ? JSON.parse(schemaDefinition) : schemaDefinition;
    const datafields = fields.map((f: any) => parseFieldType(f.type, f.name));

    // Every content type gets the lifecycle fields so status/versioning/scheduling apply uniformly.
    const names = new Set(datafields.map((d: any) => d.name));
    if (!names.has("status")) datafields.push(F.String("status").default("hidden"));
    if (!names.has("publish_at")) datafields.push(F.Date("publish_at"));
    if (!names.has("rev_version")) datafields.push(F.Number("rev_version").default(0));

    // Set tablename/datafields in a CONSTRUCTOR (not on the prototype): Model declares
    // `tablename;` / `datafields = []` as class fields, whose per-instance initializers would
    // otherwise shadow prototype values back to undefined/[].
    const DynamicClass = class extends (CMSModel as any) {
        constructor(app: any) {
            super(app);
            this.tablename = tableName;
            this.datafields = datafields;
            this.ownerField = null;
        }
    };
    Object.defineProperty(DynamicClass, "name", { value: modelName, writable: false });
    decorateProperty(DynamicClass, "container", Inject(testContainer));
    const DecoratedClass = decorateClass(DynamicClass, CRUD(routePath), PopTarget("uid"));

    await app.use(DecoratedClass); // runs init() -> auto-migrate table + bindCRUD routes

    await seedDynamicPerms(app, tableName);
    console.log(`[ModelInjector] injected dynamic model '${modelName}' -> /${routePath}`);
}

/**
 * 给新建的动态内容类型播种权限:**凡是能全站创建文章的角色**(`articles:C any`),都获得该新模型
 * 的同等全权。super_admin 无需播种(硬放行)。
 *
 * 以前这里是 `read({ filter: { name: "admin" } })` —— 按角色**名字**找。那意味着站点一旦把
 * `admin` 改名或删掉,新建的内容类型就只有 super_admin 能用,而且没有任何提示。改成按**能力**
 * 推断:"能管全站文章的人,也该能管新内容类型"是可解释的规则,且完全不认名字。
 */
async function seedDynamicPerms(app: DYApp, tableName: string) {
    const rpModel = app.I(RolePermissionModel);
    if ((await rpModel.read({ filter: { model: tableName } })).length > 0) return;
    const siteWideAuthors = await rpModel.read({
        filter: { $and: { model: "articles", action: "C", scope: "any" } },
    });
    const roleIds = [...new Set(siteWideAuthors.map((p: any) => p.role_id))];
    if (!roleIds.length) return; // 没有这样的角色 → 交给 super_admin 手动配
    for (const roleId of roleIds) {
        for (const action of ["C", "R", "U", "D", "publish"]) {
            await rpModel.create({ role_id: roleId, model: tableName, action, scope: "any" });
        }
    }
}
