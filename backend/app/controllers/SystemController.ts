import { ControllerRoute, Route, Inject } from "dyapi/utils/decorators.js";
import { Controller } from "dyapi/core/controller.js";
import UserModel from "../models/UserModel.js";
import SystemConfigModel, { globalConfigCache, VALID_CONFIG_KEYS, isThemeConfigKey } from "../models/SystemConfigModel.js";
import CategoryModel from "../models/CategoryModel.js";
import ArticleModel from "../models/ArticleModel.js";
import MenuModel from "../models/MenuModel.js";
import RoleModel from "../models/RoleModel.js";
import ResourceGrantModel from "../models/ResourceGrantModel.js";
import * as crypto from "crypto";
import { staticgen } from "../services/StaticGenService.js";
import { ARTICLES_CATEGORY } from "../services/PolicyService.js";


@ControllerRoute("system")
export default class SystemController extends Controller {
    @Inject(UserModel) declare userModel: UserModel;
    @Inject(SystemConfigModel) declare configModel: SystemConfigModel;
    @Inject(CategoryModel) declare categoryModel: CategoryModel;
    @Inject(ArticleModel) declare articleModel: ArticleModel;
    @Inject(MenuModel) declare menuModel: MenuModel;

    // AES-256-CBC symmetric encryption key & IV (fixed for export/import portability)
    private readonly CRYPTO_KEY = crypto.createHash("sha256").update("NFCMS-EXPORT-KEY-2024").digest();
    private readonly CRYPTO_IV = Buffer.alloc(16, 0); // Fixed IV for deterministic encryption

    private encrypt(text: string): string {
        const cipher = crypto.createCipheriv("aes-256-cbc", this.CRYPTO_KEY, this.CRYPTO_IV);
        return cipher.update(text, "utf8", "hex") + cipher.final("hex");
    }

    private decrypt(encrypted: string): string {
        const decipher = crypto.createDecipheriv("aes-256-cbc", this.CRYPTO_KEY, this.CRYPTO_IV);
        return decipher.update(encrypted, "hex", "utf8") + decipher.final("utf8");
    }

    /**
     * Dynamically get all registered Model instances (static + dynamic)
     */
    private getAllModels(): any[] {
        const app = this._app as any;
        const staticModels = app.models ? Object.values(app.models) : [];
        const dynamicModels = app.components ?? [];
        // Deduplicate by tablename
        const seen = new Set<string>();
        const all: any[] = [];
        for (const m of [...staticModels, ...dynamicModels]) {
            if (m?.tablename && !seen.has(m.tablename)) {
                seen.add(m.tablename);
                all.push(m);
            }
        }
        return all;
    }

    @Route("get", "/config")
    async getConfig(ctx) {
        return { code: 200, data: await this.configModel.GetConfig() };
    }

    @Route("post", "/config")
    async updateConfig(ctx) {
        if (ctx.state.user?.role !== "super_admin") {
            return { code: 403, message: "Permission Denied. super_admin required." };
        }
        
        const payload = ctx.request.body || {};

        for (const key in VALID_CONFIG_KEYS) {
            if (key === "is_initialized") continue;
            if (payload[key] !== undefined) {
                await this.configModel.SetConfig(key, payload[key]);
            }
        }
        // Theme-owned keys (theme_<name>_<field>) are dynamic — persist any present in the payload.
        for (const key of Object.keys(payload)) {
            if (isThemeConfigKey(key)) {
                await this.configModel.SetConfig(key, payload[key]);
            }
        }

        return { code: 200, message: "Configuration updated successfully." };
    }

    @Route("get", "/status")
    async status() {
        const config = await this.configModel.GetConfig();
        const isInitialized = config!["is_initialized"] === "true";
        return { code: 200, data: { is_initialized: isInitialized } };
    }
    @Route("post", "/restart")
    async restart(ctx) {
        if (ctx.state.user?.role !== "super_admin") {
            return { code: 403, message: "Permission Denied. super_admin required." };
        }
        
        console.log("Server restart triggered by super_admin");
        setTimeout(() => { process.exit(0); }, 1000);
        return { code: 200, message: "Server is restarting..." };
    }

    @Route("post", "/setup")
    async setup(ctx) {
        const { siteName, adminUsername, adminPassword, importData } = ctx.request.body;
        const config = await this.configModel.GetConfig();

        if (config!["is_initialized"] === "true") {
            return { code: 403, message: "System is already initialized." };
        }

        // If importData is provided, restore from export file instead of default setup
        if (importData && importData._meta && importData._meta.generator === "NFCMS") {
            const allModels = this.getAllModels();
            const modelMap = new Map<string, any>();
            for (const model of allModels) {
                modelMap.set(model.tablename, model);
            }

            // Determine import order
            const priorityOrder = ["system_config", "categories", "users", "menus", "attachments", "schemas"];
            const orderedKeys: string[] = [];
            for (const key of priorityOrder) {
                if (importData[key] !== undefined) orderedKeys.push(key);
            }
            for (const key of Object.keys(importData)) {
                if (key === "_meta" || orderedKeys.includes(key)) continue;
                orderedKeys.push(key);
            }
            // Ensure articles are last
            const articlesIdx = orderedKeys.indexOf("articles");
            if (articlesIdx !== -1 && articlesIdx !== orderedKeys.length - 1) {
                orderedKeys.splice(articlesIdx, 1);
                orderedKeys.push("articles");
            }

            const results: Record<string, { imported: number, failed: number }> = {};

            for (const key of orderedKeys) {
                const items = importData[key];
                if (!Array.isArray(items)) {
                    results[key] = { imported: 0, failed: 0 };
                    continue;
                }

                const model = modelMap.get(key);
                if (!model) {
                    console.warn(`Import skip table [${key}]: no matching model found`);
                    results[key] = { imported: 0, failed: items.length };
                    continue;
                }

                let imported = 0;
                let failed = 0;

                for (const item of items) {
                    try {
                        const { id, ...data } = item;
                        // Decrypt user passwords
                        if (key === "users" && data.password) {
                            try {
                                data.password = this.decrypt(data.password);
                            } catch {
                                // If decryption fails, keep as-is
                            }
                        }
                        await model.create(data);
                        imported++;
                    } catch (e: any) {
                        console.warn(`Import failed [${key}] id=${item.id}:`, e.message);
                        failed++;
                    }
                }

                results[key] = { imported, failed };
            }

            // Mark system as initialized. NOTE: system_config columns are configkey/configvalue
            // (not key/value); go through SetConfig so the write + cache stay consistent even when
            // the imported data already contained an is_initialized row.
            this.configModel.ClearCache();
            await this.configModel.SetConfig("is_initialized", "true");

            return { code: 200, data: results, message: "Setup completed with imported data." };
        }

        // ── Default cold-start seed: demonstrate every feature with usable examples ──
        const hash = this._app.settings.passwordHash;

        // Users: the super admin (from the wizard) + a demo editor to show RBAC "own" scope.
        // Roles themselves (super_admin/admin/editor/author) are seeded at boot by seedRbac().
        await this.userModel.create({ nickname: adminUsername, username: adminUsername, password: hash(adminPassword), role: "super_admin" }); // id 1
        await this.userModel.create({ nickname: "Demo Editor", username: "editor", password: hash("editor123"), role: "editor" });          // id 2

        await this.configModel.SetConfig("is_initialized", "true");
        await this.configModel.SetConfig("site_name", siteName);
        await this.configModel.SetConfig("subtitle", "Powered by NFCMS");

        // Categories (both list-viewable).
        const blogId = await this.categoryModel.create({ name: "Blog", slug: "blog", list_template: "DefaultCategory", content_template: "DefaultArticle", parent_id: 0, weight: 50 }); // id 1
        await this.categoryModel.create({ name: "News", slug: "news", list_template: "DefaultCategory", content_template: "DefaultArticle", parent_id: 0, weight: 40 }); // id 2

        // Demo category-scoped grant: the `editor` role may create & manage ALL articles in the
        // Blog category (and its subtree) — but nothing in News. Shows category-limited access
        // in the Roles page. (Without this, the demo editor can only manage its OWN articles.)
        const editorRole = (await this._app.I(RoleModel).read({ filter: { name: "editor" } }))[0];
        if (editorRole) {
            await this._app.I(ResourceGrantModel).create({
                model: ARTICLES_CATEGORY, resource_id: blogId,
                grantee_type: "role", grantee_id: editorRole.id,
                access: "C,R,U,publish", granted_by: 1, created_at: new Date(),
            });
        }

        const now = new Date();
        // Articles across all three lifecycle states + two authors (RBAC ownership example).
        await this.articleModel.create({
            title: "Welcome to NFCMS", slug: "welcome-to-nfcms",
            description: "A quick tour of what this CMS can do.",
            content: "# Welcome to NFCMS\n\nThis is a **published** article. It renders Markdown and is served both as a static SSG page (SEO-friendly) and via the SPA.\n\n- Role-based access control\n- Draft / scheduled / visible lifecycle with version history\n- Pluggable file storage\n\nEdit or delete me anytime in the admin panel.",
            category_id: 1, author_id: 1, status: "visible", published_at: now
        }); // id 1
        await this.articleModel.create({
            title: "Getting Started", slug: "getting-started",
            description: "How to create and publish content.",
            content: "## Getting Started\n\n1. Log in to `/admin`.\n2. Create an article — it starts as a **draft** (hidden).\n3. Use **Publish** to make it visible, or **Schedule** it for later.\n4. Check the **version history** panel to roll back edits.",
            category_id: 1, author_id: 1, status: "visible", published_at: now
        }); // id 2
        await this.articleModel.create({
            title: "An Editor's Draft", slug: "editors-draft",
            description: "Hidden draft owned by the demo editor.",
            content: "This draft is **hidden** from the public site and is owned by the `editor` user — demonstrating RBAC 'own' scope (the editor only sees/edits their own content).",
            category_id: 1, author_id: 2, status: "hidden"
        }); // id 3
        await this.articleModel.create({
            title: "Scheduled Announcement", slug: "scheduled-announcement",
            description: "Goes live automatically in ~2 minutes.",
            content: "This article is **scheduled** — the cron scheduler will flip it to visible at its publish time and regenerate the static site.",
            category_id: 2, author_id: 1, status: "scheduled", publish_at: new Date(now.getTime() + 2 * 60 * 1000)
        }); // id 4

        await this.menuModel.create({
            name: "Header Menu",
            location: "header",
            items: [
                { label: "首页", url: "/", type: "custom", refId: 0, children: [] },
                { label: "Blog", url: "/a/blog", type: "custom", refId: 1, children: [] },
                { label: "News", url: "/a/news", type: "custom", refId: 2, children: [] },
            ]
        });

        // Seed content was created via raw model calls (no content hooks) — build the static site now.
        await staticgen.regenerateAll();

        return { code: 200, message: "Setup completed successfully." };
    }

    @Route("get", "/export")
    async exportData(ctx) {
        if (ctx.state.user?.role !== "super_admin") {
            return { code: 403, message: "Permission Denied. super_admin required." };
        }

        const allModels = this.getAllModels();
        const exportData: Record<string, any[]> = {};

        // Read all data from each model in parallel
        await Promise.all(allModels.map(async (model) => {
            const key = model.tablename;
            try {
                const records = await model.read({});
                // Special handling: encrypt user passwords
                if (key === "users") {
                    exportData[key] = records.map(u => ({
                        ...u,
                        password: u.password ? this.encrypt(u.password) : "",
                    }));
                } else {
                    exportData[key] = records;
                }
            } catch (e: any) {
                console.warn(`Export read failed for [${key}]:`, e.message);
                exportData[key] = [];
            }
        }));

        return {
            code: 200,
            data: {
                _meta: {
                    version: "1.0",
                    exportedAt: new Date().toISOString(),
                    generator: "NFCMS",
                },
                ...exportData,
            }
        };
    }

}
