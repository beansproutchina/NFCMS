import path from "path";
import process from "process";
import Koa from "koa";
import { DYApp } from "dyapi/core/dyapiApp.js";
import { scanFiles } from "dyapi/utils/scanFiles.js";
import { hooks } from "./app/services/HookManager.js";
import { ContentSchemaModel, injectDynamicModel } from "./app/services/ModelInjector.js";
import testContainer from "./app/containers/testContainer.js";
import UserModel from "./app/models/UserModel.js";
import crypto from "crypto";
import { authMiddlewareFactory } from "./app/middlewares/authmiddleware.js";
import { policy } from "./app/services/PolicyService.js";
import { audience } from "./app/services/AudienceService.js";
import { scheduler } from "./app/services/SchedulerService.js";

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
        jwtExpire: 1000 * 60 * 60 * 24 * 7,
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

    // 3. RBAC: bind the policy authority. Default roles/permissions are NOT seeded here —
    //    `/system/setup` owns that (see seedDefaultRbac), so an imported site keeps its own
    //    role ids instead of colliding with boot-seeded ones.
    policy.bind(app);
    audience.bind(app);

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

    // 5. HTTP 装配。dyapi 3.2 起 DYApp 不再拥有 Koa 实例:它只是一个模块作用域,
    //    HTTP 服务器由调用方创建并交给 `bindKoa`。自己的中间件必须放在 `bindKoa` **之前**
    //    —— bindKoa 会把 static/body 反插到队首、把 logger/错误兜底/路由接在后面,
    //    于是相对顺序仍是 static/body → 我们的鉴权 → 框架中间件 → 路由。
    const koa = new Koa();
    koa.use(authMiddlewareFactory(app));
    app.bindKoa(koa);
    // `bootstrap()` 现在只挂 SIGINT/SIGTERM/beforeExit 的优雅停机,不再建中间件也不再 listen。
    app.bootstrap();
    // 6. Post Bootstrap hook
    await hooks.doAction("app_ready");

    // 7. Start the scheduled-publish cron (flips due `scheduled` content to `visible`).
    scheduler.start(app);

    // 7b. 受众轴:回填 `articles.access_eff`。老库(本次改动之前建的)那一列是 DDL 默认值,
    //     没经过派生 —— 不回填的话已有栏目的受众设置会静默不生效。只写真正变化的行,
    //     所以正常启动是 0 改动、一次全表读的成本。
    try {
        await audience.recomputeAll();
    } catch (e) {
        console.log("[audience] backfill skipped:", (e as any).message);
    }

    // 8. Public-site SSG: DISABLED for now — the generated pages are far below the quality of the
    //    themed SPA render, so the public site is served entirely by the SPA. `StaticGenService`
    //    and its `docker/nginx.single.conf` locations are left in place but unwired; re-enable by
    //    restoring the block below (and the SSG `location`s in the nginx conf).
    //
    // staticgen.bind(app);
    // hooks.addAction("content.saved.articles", async (id) => {
    //     await staticgen.regenerateArticle(id);
    //     await staticgen.generateSitemap();
    // });
    // hooks.addAction("content.published.articles", async (id) => {
    //     await staticgen.regenerateArticle(id);
    //     await staticgen.regenerateHome();
    //     await staticgen.generateSitemap();
    // });
    // await staticgen.regenerateAll();

    // 9. Keepalive: keep the SQLite connection warm (from upstream).
    setInterval(() => {
        try {
            const container = app.I(testContainer) as any;
            container.rawSQLQuery?.("SELECT 1;");
        } catch { /* ignore */ }
    }, 60 * 60 * 1000);

    // 10. 起服务。listen 也归调用方了(见第 5 步)。
    const port = Number(process.env.PORT) || app.settings.port;
    koa.listen(port, () => console.log(`[nfcms] listening on http://localhost:${port}`));
};
start();
