import * as crypto from "crypto";
import { ControllerRoute, Route, Inject } from "dyapi/utils/decorators.js";
import { Controller } from "dyapi/core/controller.js";
import UserModel from "../models/UserModel.js";
import SystemConfigModel, { globalConfigCache, VALID_CONFIG_KEYS, isThemeConfigKey } from "../models/SystemConfigModel.js";
import CategoryModel from "../models/CategoryModel.js";
import ArticleModel from "../models/ArticleModel.js";
import MenuModel from "../models/MenuModel.js";
import RoleModel from "../models/RoleModel.js";
import ResourceGrantModel from "../models/ResourceGrantModel.js";
import { ARTICLES_CATEGORY } from "../services/PolicyService.js";
import { seedDefaultRbac } from "../services/RbacSeedService.js";


@ControllerRoute("system")
export default class SystemController extends Controller {
    @Inject(UserModel) declare userModel: UserModel;
    @Inject(SystemConfigModel) declare configModel: SystemConfigModel;
    @Inject(CategoryModel) declare categoryModel: CategoryModel;
    @Inject(ArticleModel) declare articleModel: ArticleModel;
    @Inject(MenuModel) declare menuModel: MenuModel;

    /**
     * salt 指纹(KCV):用于判断一份导出数据里的密码哈希在本机**是否还能用**。
     *
     * 存的密码是 `HMAC-SHA256(env PASSWORD_SALT, 明文)`。所以一旦 salt 变了(换机器、轮换密钥、
     * 从别的站点搬数据),那些哈希就永久失效 —— 现象是"导入成功、数据齐全、**没有一个人能登录**",
     * 而且没有任何东西提示你为什么。这正是需要确定性判断、而不是靠猜的地方。
     *
     * 指纹就是"用本机的 salt 去哈希一个固定串"。它证明 salt 身份,却不泄露 salt 本身。
     *
     * 已知代价(明确接受):导出文件因此带上了一个 **salt 预言机** —— 攻击者拿到文件可以离线爆破
     * salt(而只有哈希时,他还得先知道某个用户的明文密码才能做同样的事)。前提是 salt 足够强;
     * `.env.example` 要求的是随机长值。
     */
    private static readonly SALT_FINGERPRINT_INPUT = "nfcms-salt-fingerprint-v1";

    private saltFingerprint(): string {
        return this._app.settings.passwordHash(SystemController.SALT_FINGERPRINT_INPUT);
    }

    /**
     * 生成一个可打字的随机密码。用于 salt 不一致时重置账号 —— 那些哈希已经废了,留着只会让人
     * 以为"密码还在"。96 位熵,base64url 无填充。
     */
    private randomPassword(): string {
        return crypto.randomBytes(12).toString("base64url");
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

            // Determine import order. RBAC tables come last of the pinned ones and in dependency
            // order (roles → rows referencing role ids): `schemas` must precede `roles` so the
            // dynamic-model injection it triggers finds no `admin` role and skips seeding perms —
            // the dump's own role_permissions are authoritative.
            const priorityOrder = ["system_config", "categories", "users", "menus", "attachments", "schemas",
                                   "roles", "role_permissions", "user_roles", "resource_grants"];
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

            /**
             * 这份数据的密码哈希在本机还能不能用?
             *
             * - 指纹一致 → 能用,原样搬运。
             * - 指纹不同 → **一个都不能用**(salt 变了)。此时给每个账号生成随机密码,并把明文
             *   一次性返回给正在初始化的人 —— 否则导入模式下不创建新管理员,重置完就**没人能登录**了。
             * - 指纹缺失(本次改动之前导出的旧文件)→ 无法证明,也不敢销毁数据:**原样保留 + 警告**。
             *   "没有证据"不等于"证据表明不行",而重置密码是不可逆的。
             */
            const localFp = this.saltFingerprint();
            const exportedFp = importData._meta?.saltFingerprint;
            const saltState: "match" | "mismatch" | "unknown" =
                !exportedFp ? "unknown" : (exportedFp === localFp ? "match" : "mismatch");
            /** salt 不一致时重置出来的凭据,仅在本次响应里返回一次,不落库、不写日志。 */
            const resetCredentials: { username: string; password: string }[] = [];

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
                        /**
                         * **保留原 id**(`model.restore` 而不是 `model.create`)。
                         *
                         * 从前这里是 `const { id, ...data } = item` —— 剥掉 id 让它重新自增。那只在
                         * "源库 id 连续 + 目标库为空"时碰巧对:源库删过任何一条就有空洞,重新编号后
                         * **所有按 id 的交叉引用同时错位** —— articles.category_id / author_id、
                         * categories.parent_id、role_permissions.role_id、user_roles.*、
                         * resource_grants.grantee_id 与 resource_id、revisions.content_id,
                         * 还有藏在 JSON 里的 menus.items[].refId。而且一声不响。
                         *
                         * 保 id 是唯一**不需要穷举引用关系图**就正确的做法:每条记录还在原来的编号上,
                         * 所有指针自动有效。(本次会话开头那个"角色重复"就是这个病的一个症状。)
                         */
                        const data = { ...item };
                        /**
                         * 历史脏数据兜底:dyapi 的写入路径曾把真正的 `null` 当对象 JSON.stringify,
                         * 于是可空的 Date / Object 列里存的是**4 个字符的文本 `"null"`**(根因已在
                         * 容器里修掉)。这类值读出来是字符串,`process()` 会把它变成 Invalid Date,
                         * 插入时炸成一句莫名的 "Invalid Date" —— 老库因此整表导不进来。
                         * 恢复要能吃下已经存在的坏数据,所以在这里归一成真 null。
                         */
                        for (const k of Object.keys(data)) {
                            if (data[k] === "null") data[k] = null;
                        }
                        /**
                         * 密码**原样搬运**,不做任何加解密。
                         *
                         * 导出里存的已经是 `HMAC-SHA256(env PASSWORD_SALT, 明文)` 的哈希,而这里走的是
                         * **裸 `create()`**(不是 `HTTPCreate`)—— 裸路径不碰 password,所以哈希直接落库,
                         * 不会被二次哈希。"绕过加哈希的前置步骤直接插哈希"本来就成立,不需要额外手段。
                         *
                         * ⚠️ 别把这里改成 `HTTPCreate`:那条路会对 password 再哈希一次
                         * (UserModel.HTTPCreate),导入后全站登录失效,现象是"密码就是不对"。
                         *
                         * 也**不做**"这值像不像哈希"的形状校验:导入数据只可能来自本系统的导出,
                         * 明文密码不可能出现在这里。形状检查除了给人"校验过了"的错觉,什么也查不到 ——
                         * 真正会出事的是 salt 变了,那由上面的指纹判定负责。
                         */
                        if (key === "users" && saltState === "mismatch") {
                            const plain = this.randomPassword();
                            data.password = this._app.settings.passwordHash(plain);
                            resetCredentials.push({ username: String(data.username ?? item.id), password: plain });
                        }
                        await model.restore(data);
                        imported++;
                    } catch (e: any) {
                        console.warn(`Import failed [${key}] id=${item.id}:`, e.message);
                        failed++;
                    }
                }

                results[key] = { imported, failed };
            }

            // Safety net for dumps that carry no `roles` rows (partial/legacy export): without
            // this the site would have zero roles and only super_admin (hard-allowed in
            // PolicyService) could do anything. No-op when the import brought its own roles.
            await seedDefaultRbac(this._app);

            // Mark system as initialized. NOTE: system_config columns are configkey/configvalue
            // (not key/value); go through SetConfig so the write + cache stay consistent even when
            // the imported data already contained an is_initialized row.
            this.configModel.ClearCache();
            await this.configModel.SetConfig("is_initialized", "true");

            // 日志只写**发生了什么**和**多少个**,绝不写明文密码 —— 日志会被转存、留存、翻阅。
            if (saltState === "mismatch") {
                console.warn(`[setup] PASSWORD_SALT differs from the export's; reset ${resetCredentials.length} ` +
                    `account password(s). The one-time credentials are in the HTTP response only.`);
            } else if (saltState === "unknown") {
                console.warn("[setup] export has no salt fingerprint (pre-fingerprint dump); password hashes were " +
                    "kept as-is. If nobody can sign in, PASSWORD_SALT differs from the source site.");
            }
            return {
                code: 200,
                data: results,
                saltState,
                /** 仅此一次:重置出来的明文凭据。前端必须显示,否则导入模式下没人能登录。 */
                resetCredentials,
                message: "Setup completed with imported data.",
            };
        }

        // ── Default cold-start seed: demonstrate every feature with usable examples ──
        const hash = this._app.settings.passwordHash;

        // RBAC first: the demo users below reference role names, and the demo category grant
        // below needs the `editor` role's id.
        await seedDefaultRbac(this._app);

        // Users: the super admin (from the wizard) + a demo editor to show RBAC "own" scope.
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

        // SSG is currently unwired (see index.ts step 8) — nothing to build here. When it comes
        // back, this seed content is created via raw model calls (no content hooks), so setup has
        // to kick off the initial build itself: `await staticgen.regenerateAll();`

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
                /**
                 * 全表原样导出,**密码也原样** —— 存的本来就是 `HMAC-SHA256(env PASSWORD_SALT)` 的
                 * 哈希,不是明文。
                 *
                 * 从前这里把哈希再用 AES-256-CBC 加密一层,密钥是源码里的字面量、IV 全零。那不是保护,
                 * 是伪装:任何拿到源码的人都能解开,而它却让人以为"密码被加密了"。真正的保护在于
                 * salt 只在 `.env` 里、**不在导出文件里** —— 拿到文件也无法离线爆破。
                 *
                 * 结论:导出哈希是正常做法(`mysqldump` 也如此),那层 AES 是纯粹的复杂度。
                 * 但导出文件仍应按敏感文件对待:它 + `.env` 一起泄漏 = 可离线爆破。
                 */
                exportData[key] = await model.read({});
            } catch (e: any) {
                console.warn(`Export read failed for [${key}]:`, e.message);
                exportData[key] = [];
            }
        }));

        return {
            code: 200,
            data: {
                _meta: {
                    version: "1.1",   // 1.1 起带 saltFingerprint
                    exportedAt: new Date().toISOString(),
                    generator: "NFCMS",
                    /** 见 saltFingerprint():证明这些密码哈希是用哪个 salt 算的,不泄露 salt。 */
                    saltFingerprint: this.saltFingerprint(),
                },
                ...exportData,
            }
        };
    }

}
