import path from "path";
import process from "process";
import { DYApp } from "dyapi/core/dyapiApp.js";
import { scanFiles } from "dyapi/utils/scanFiles.js";
import { hooks } from "./app/services/HookManager.js";
import { ContentSchemaModel, injectDynamicModel } from "./app/services/ModelInjector.js";
import testContainer from "./app/containers/testContainer.js";
import UserModel from "./app/models/UserModel.js";
import crypto from "crypto";
import { authMiddlewareFactory } from "./app/middlewares/authmiddleware.js";

const start = async () => {
    const app = new DYApp({
        jwtExpire: 1000*60*60*24*7,
        passwordHash: (password) => {
            return crypto.createHash("md5").update(password + "cn0917").digest("hex");
        },
    });

    // 1. Core plugins and hook system initialization
    await hooks.doAction("app_init");

    // 2. Scan core files (UserController, ArticleModel, etc)
    await scanFiles(app, path.join(import.meta.dirname, "app"));

    // 3. Register ContentSchemaModel and Load Dynamic Models
    // Manually instantiate ContentSchemaModel to read existing schemas
    /*
    app.components?.push(new ContentSchemaModel(app));

    try {
        const dummyInstance = new ContentSchemaModel(app);
        // manually inject container and context just for a temporary read
        dummyInstance._app = app;
        dummyInstance["container"] = new testContainer(app);

        const schemas = await dummyInstance.container.read({});

        // Apply dynamically generated models
        for (const record of schemas) {
            // Find records matching schema tablename (in reality testContainer stores all under "tablename")
            if (record.modelName && record.schemaDefinition) {
                console.log(`[ModelInjector] Injecting dynamic model: ${record.modelName}`);
                await injectDynamicModel(app, record);
            }
        }
    } catch (e) {
        console.log(`[ModelInjector] No dynamic schemas loaded yet.`, e.message);
    }
*/
    // 4. Boostrap App (registers decorators, routers, etc)
    
    
    app.koa.use(authMiddlewareFactory(app));
    app.bootstrap();
    // 5. Post Bootstrap hook
    await hooks.doAction("app_ready");

    setInterval(() => {
        // Database Alive
        const container = app.I(testContainer) as testContainer;
        container.rawSQLQuery("SELECT 1;")
    }, 60*60*1000);
}
start();