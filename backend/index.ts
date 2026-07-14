import path from "path";
import process from "process";
import { DYApp } from "dyapi/core/dyapiApp.js";
import { scanFiles } from "dyapi/utils/scanFiles.js";
import { hooks } from "./app/services/HookManager.js";
import { ContentSchemaModel, injectDynamicModel } from "./app/services/ModelInjector.js";
import UserModel from "./app/models/UserModel.js";
import crypto from "crypto";
import { authMiddlewareFactory } from "./app/middlewares/authmiddleware.js";
import { policy } from "./app/services/PolicyService.js";
import { scheduler } from "./app/services/SchedulerService.js";
import { staticgen } from "./app/services/StaticGenService.js";
import RoleModel from "./app/models/RoleModel.js";
import RolePermissionModel from "./app/models/RolePermissionModel.js";

/**
 * Seed default RBAC roles + permissions once (idempotent: skips if roles already exist).
 * super_admin has no rows here — it is hard-allowed by PolicyService.
 */
const seedRbac = async (app) => {
    const roleModel = app.I(RoleModel);
    const rpModel = app.I(RolePermissionModel);
    if ((await roleModel.read({})).length > 0) return;

    const roleDefs = [
        { name: "super_admin", label: "Super Admin", is_system: 1, weight: 100 },
        { name: "admin", label: "Admin", is_system: 1, weight: 80 },
        { name: "editor", label: "Editor", is_system: 1, weight: 50 },
        { name: "author", label: "Author", is_system: 1, weight: 30 },
    ];
    const idByName = {};
    for (const r of roleDefs) idByName[r.name] = await roleModel.create(r);

    // [role, model, action, scope]
    const perms = [
        ["admin", "articles", "C", "any"], ["admin", "articles", "R", "any"],
        ["admin", "articles", "U", "any"], ["admin", "articles", "D", "any"],
        ["admin", "articles", "publish", "any"],
        ["editor", "articles", "C", "own"], ["editor", "articles", "R", "own"],
        ["editor", "articles", "U", "own"], ["editor", "articles", "publish", "own"],
        ["author", "articles", "C", "own"], ["author", "articles", "R", "own"],
        ["author", "articles", "U", "own"],
    ];
    for (const [role, model, action, scope] of perms) {
        await rpModel.create({ role_id: idByName[role], model, action, scope });
    }
    console.log("[RBAC] seeded default roles and permissions");
};

const start = async () => {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret === "nihao") {
        throw new Error("Missing JWT_SECRET env. Set a strong random value in backend/.env (see .env.example).");
    }
    const passwordSalt = process.env.PASSWORD_SALT;
    if (!passwordSalt) {
        throw new Error("Missing PASSWORD_SALT env. Set a strong random value in backend/.env (see .env.example).");
    }

    const app = new DYApp({
        jwtSecret,
        enableFileUpload: true,
        // Deterministic keyed hash (secret salt from env) — fits DYAPI's equality-match login
        // while removing the old unsalted MD5 + hardcoded public salt.
        passwordHash: (password) => {
            return crypto.createHmac("sha256", passwordSalt).update(String(password)).digest("hex");
        },
    });

    // 1. Core plugins and hook system initialization
    await hooks.doAction("app_init");

    // 2. Scan core files (UserController, ArticleModel, etc)
    await scanFiles(app, path.join(import.meta.dirname, "app"));

    // 3. RBAC: bind the policy authority and seed default roles/permissions
    //    (must precede dynamic-model injection, which seeds admin perms per model).
    policy.bind(app);
    await seedRbac(app);

    // 4. Register the schema store, load existing dynamic content types, and inject new ones live.
    await app.use(ContentSchemaModel);
    try {
        const schemas = await app.I(ContentSchemaModel).read({});
        for (const record of schemas) await injectDynamicModel(app, record);
    } catch (e) {
        console.log(`[ModelInjector] schema load skipped:`, (e as any).message);
    }
    hooks.addAction("schema_inserted", async (record) => {
        try { await injectDynamicModel(app, record); }
        catch (e) { console.log("[ModelInjector] live inject failed:", (e as any).message); }
    });

    // 5. Bootstrap App (registers decorators, routers, etc)
    app.koa.use(authMiddlewareFactory(app));
    app.bootstrap();
    // 5. Post Bootstrap hook
    await hooks.doAction("app_ready");

    // 6. Start the scheduled-publish cron (flips due `scheduled` content to `visible`).
    scheduler.start(app);

    // 7. Public-site SSG: regenerate static pages on content changes, and do an initial build.
    staticgen.bind(app);
    hooks.addAction("content.saved.articles", async (id) => {
        await staticgen.regenerateArticle(id);
        await staticgen.generateSitemap();
    });
    hooks.addAction("content.published.articles", async (id) => {
        await staticgen.regenerateArticle(id);
        await staticgen.regenerateHome();
        await staticgen.generateSitemap();
    });
    await staticgen.regenerateAll();
}
start();