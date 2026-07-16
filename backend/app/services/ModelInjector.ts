import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { CRUD, PopTarget, Inject } from "dyapi/utils/decorators.js";
import testContainer from "../containers/testContainer.js";
import { deriveClass, decorateClass, decorateProperty } from "dyapi/utils/dynamic.js";
import { hooks } from "./HookManager.js";
import { DYApp } from "dyapi/core/dyapiApp.js";

/**
 * Built-in Core Model for Custom Content Schemas.
 */
@CRUD("schemas")
export class ContentSchemaModel extends Model {
    @Inject(testContainer) 
    container;
    
    tablename = "schemas";
    
    datafields = [
        F.String("modelName").notNull().unique(),
        F.String("tableName").notNull().unique(),
        F.String("routePath").notNull().unique(),
        F.Object("schemaDefinition").notNull(),
        F.String("permission").default('{"PUBLIC":"R", "admin":"CRU"}'),
        F.Date("createdAt").default(() => new Date()),
    ];

    permission = {
        "PUBLIC": "R",
        "admin": "C,R,U,D"
    };

    /**
     * @param {any} item
     * @returns {Promise<any>}
     */
    async insert(item) {
        const result = await super.insert(item);
        await hooks.doAction("schema_inserted", item);
        return result;
    }

    /**
     * @param {any} param
     * @param {any} item
     * @returns {Promise<any>}
     */
    async update(param, item) {
        const result = await super.update(param, item);
        await hooks.doAction("schema_updated", item);
        return result;
    }
}

/**
 * @param {string} typeStr
 * @param {string} name
 * @returns {any}
 */
function parseFieldType(typeStr, name) {
    switch (typeStr.toLowerCase()) {
        case "string": return F.String(name);
        case "int": return F.Int(name);
        case "float": return F.Float(name);
        case "boolean": return F.Boolean(name);
        case "date": return F.Date(name);
        case "json": return F.Object(name);
        case "text": return F.String(name); 
        default: return F.String(name);
    }
}

/**
 * @param {DYApp} app
 * @param {any} schemaDef
 */
export async function injectDynamicModel(app, schemaDef) {
    const { modelName, tableName, routePath, schemaDefinition, permission } = schemaDef;

    const DynamicClass = deriveClass(Model, modelName);

    const datafields = [];
    const fields = typeof schemaDefinition === "string" ? JSON.parse(schemaDefinition) : schemaDefinition;
    
    for (const f of fields) {
        datafields.push(parseFieldType(f.type, f.name));
    }
    
    const parsedPerms = typeof permission === "string" ? JSON.parse(permission) : permission;

    Object.assign(DynamicClass.prototype, {
        tablename: tableName,
        datafields: datafields,
        permission: Object.assign({"admin": "C,R,U,D"}, parsedPerms), 
        
        async insert(item) {
            item = await hooks.applyFilters(`pre_insert_${modelName}`, item);
            let res = await Model.prototype.insert.call(this, item);
            await hooks.doAction(`post_insert_${modelName}`, res);
            return res;
        },
        
        async update(param, item) {
            item = await hooks.applyFilters(`pre_update_${modelName}`, item);
            let res = await Model.prototype.update.call(this, param, item);
            await hooks.doAction(`post_update_${modelName}`, param, item, res);
            return res;
        }
    });

    decorateProperty(DynamicClass, "container", Inject(testContainer));

    const DecoratedClass = decorateClass(
        DynamicClass,
        CRUD(routePath),
    );

    if (!app.components) app.components = [];
    
    const inst = new DecoratedClass();
    inst._app = app;
    app.components.push(inst); 
}
