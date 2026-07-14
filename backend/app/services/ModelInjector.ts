import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { CMSModel } from "../lib/CMSModel.js";
import { CRUD, PopTarget, Inject } from "dyapi/utils/decorators.js";
import testContainer from "../containers/testContainer.js";
import { decorateClass, decorateProperty } from "dyapi/utils/dynamic.js";
import { hooks } from "./HookManager.js";
import type { DYApp } from "dyapi/core/dyapiApp.js";
import RoleModel from "../models/RoleModel.js";
import RolePermissionModel from "../models/RolePermissionModel.js";

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
    permission = {
        "PUBLIC": "",
        "DEFAULT": "",
        "admin": "R",
        "super_admin": "C,R,U,D"
    };

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

/** Give the built-in `admin` role full access to a new dynamic model (super_admin already bypasses). */
async function seedDynamicPerms(app: DYApp, tableName: string) {
    const rpModel = app.I(RolePermissionModel);
    if ((await rpModel.read({ filter: { model: tableName } })).length > 0) return;
    const adminRole = (await app.I(RoleModel).read({ filter: { name: "admin" } }))[0];
    if (!adminRole) return;
    for (const action of ["C", "R", "U", "D", "publish"]) {
        await rpModel.create({ role_id: adminRole.id, model: tableName, action, scope: "any" });
    }
}
