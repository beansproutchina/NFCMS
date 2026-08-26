import * as crypto from "crypto";
import { ControllerRoute, Route, Inject } from "dyapi/utils/decorators.js";
import { Controller } from "dyapi/core/controller.js";
import UserModel from "../models/UserModel.js";
import SystemConfigModel, { globalConfigCache, VALID_CONFIG_KEYS, SENSITIVE_CONFIG_KEYS, isThemeConfigKey } from "../models/SystemConfigModel.js";
import CategoryModel from "../models/CategoryModel.js";
import ArticleModel from "../models/ArticleModel.js";
import MenuModel from "../models/MenuModel.js";
import RoleModel from "../models/RoleModel.js";
import ResourceGrantModel from "../models/ResourceGrantModel.js";
import { ARTICLES_CATEGORY, policy } from "../services/PolicyService.js";
import { seedDefaultRbac } from "../services/RbacSeedService.js";
import { prerender } from "../services/PrerenderService.js";
import { registeredModels } from "../lib/registry.js";


/** 模型当前声明的列名(含主键 id)。 */
function declaredColumns(model: any): string[] {
    const names = (model?.datafields ?? []).map((f: any) => f.name).filter((n: any) => typeof n === "string");
    return names.includes("id") ? names : ["id", ...names];
}

/**
 * 按模型当前声明的字段过滤一行导入数据,把被丢弃的列名记进 `dropped`。
 *
 * `id` 永远保留 —— `restore()` 靠它保住原编号,而所有交叉引用(category_id / author_id /
 * parent_id / role_id / grantee_id / resource_id / content_id / menus.items[].refId)都指着它。
 */
function stripUnknownColumns(model: any, item: any, dropped: Set<string>): Record<string, any> {
    const allowed = new Set(declaredColumns(model));
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(item)) {
        // `a.b` 形式是 JSON 子字段寻址,按主字段判定(restore 也是这么做的)。
        const base = k.includes(".") ? k.split(".")[0] : k;
        if (allowed.has(base)) out[k] = v;
        else dropped.add(k);
    }
    return out;
}

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
        // 动态内容类型也在 app.models 里(injectDynamicModel 走的就是 app.use),不需要第二个来源。
        const seen = new Set<string>();
        const all: any[] = [];
        for (const m of registeredModels(this._app)) {
            if (m?.tablename && !seen.has(m.tablename)) {
                seen.add(m.tablename);
                all.push(m);
            }
        }
        return all;
    }

    @Route("get", "/config")
    async getConfig(ctx) {
        // 公开读:前台匿名访客要拿 site_name/subtitle/icp_record/theme_* 等展示项。
        // 但敏感键(storage_config,含对象存储明文密钥)只对 super_admin 下发 ——
        // 浅拷贝后按调用方身份剔除,不污染 GetConfig 的进程级缓存。
        const cfg: Record<string, string> = { ...(await this.configModel.GetConfig()) };
        if (!policy.isSuper(ctx.state)) {
            for (const k of SENSITIVE_CONFIG_KEYS) delete cfg[k];
        }
        return { code: 200, data: cfg };
    }

    @Route("post", "/config")
    async updateConfig(ctx) {
        if (!policy.isSuper(ctx.state)) {
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
        if (!policy.isSuper(ctx.state)) {
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

            const results: Record<string, { imported: number, failed: number, droppedColumns?: string[] }> = {};

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
                /** 本表被丢弃的幽灵列(见下方 stripUnknownColumns 的说明),按表汇总上报一次。 */
                const droppedCols = new Set<string>();

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
                        /**
                         * **剔除模型不再声明的列。**
                         *
                         * DYAPI 迁移只增不减(见 CLAUDE.md):从 Model 里删掉一个字段,库表里那一列
                         * 还在。于是导出(裸读全表)会带上这个幽灵列,而 `restore()` 对未声明的键是
                         * `assert(f, ...)` —— **整行拒绝**。净效果:任何一张表只要历史上删过字段,
                         * 它的导入就会全表失败。
                         *
                         * 真实案例:`87f838b` 删掉 `roles.weight` 之后,导出文件里每条角色都带
                         * `weight: 100`,导入时四条角色全部 `字段weight不存在`,然后被下面的
                         * `seedDefaultRbac` 兜底重种 —— 一次彻底失败被伪装成成功,而重种出来的
                         * 角色 id 与源站对不上时,`role_permissions` / `user_roles` /
                         * `resource_grants` 会静默指到错误的角色上。
                         *
                         * 为什么修在导入侧而不只是导出侧:**已经生成的旧导出文件救不回来**。导出侧
                         * 也收口(见 exportData),但那只保证新文件干净。
                         */
                        const data = stripUnknownColumns(model, item, droppedCols);
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
                if (droppedCols.size) {
                    // 汇总一条,不是每行一条 —— 幽灵列是**表级**事实,刷 N 行日志只会淹掉别的信息。
                    results[key].droppedColumns = [...droppedCols].sort();
                    console.warn(`[import] 表 ${key}: 丢弃了模型不再声明的列 ${results[key].droppedColumns!.join(", ")} ` +
                        `(${items.length} 行)。多半是这些字段曾从 Model 里删除,而 DYAPI 迁移只增不减,库里列还在。`);
                }
            }

            /**
             * 兜底之前先拦一种情况:**dump 里明明有 roles,却一条都没导进来。**
             *
             * 这时候重新种默认角色是最坏的选择 —— 它会造出一批 id 与源站无关的角色,而
             * `role_permissions` / `user_roles` / `resource_grants` 里的 role_id 是按源站编号导入的,
             * 于是权限被静默挂到错误的角色上。「导入成功但权限错乱」比「导入失败」难查得多。
             *
             * 宁可硬失败:此时站点仍是未初始化状态,重置数据库重来即可。
             */
            const rolesInDump = Array.isArray(importData.roles) ? importData.roles.length : 0;
            if (rolesInDump > 0 && results.roles?.imported === 0) {
                console.error(`[import] dump 带了 ${rolesInDump} 个角色但一个都没导入,中止 —— 继续下去会让权限挂到错误的角色上。`);
                /**
                 * 把 `is_initialized` 摘掉再退出。
                 *
                 * `system_config` 是**第一个**导入的表,dump 里自带 `is_initialized=true`,所以此刻
                 * 站点已经"看起来初始化过了" —— 不清掉的话 `/setup` 会 403,人被卡在一个 0 角色的
                 * 半残站点上,既进不去后台也回不到向导。清掉之后至少状态是诚实的:**没装好**。
                 * (重试仍需重置数据库 —— 表里已经有行,保 id 的 restore 会撞主键。)
                 */
                this.configModel.ClearCache();
                await this.configModel.SetConfig("is_initialized", "false");
                return {
                    code: 500,
                    data: results,
                    message: `导入中止:dump 里有 ${rolesInDump} 个角色,但一个都没能导入(见 results.roles)。` +
                        `继续下去会重新种默认角色,而权限数据仍指向源站的角色 id —— 权限会错配。` +
                        `请重置数据库后重试。`,
                };
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

        /**
         * 上面的种子内容是用**裸** model 调用建的(不走 HTTP*),因此一条 content hook 都没发过
         * —— 预渲染那边什么都不知道。这里主动踢一次全量,否则新站点要等到第一次编辑才有静态页。
         * 不 await:全量可能几分钟,不该挡住 setup 的响应。
         */
        void prerender.regenerateAll().catch((e: any) => console.error("[ssg] setup 后全量失败:", e?.message));

        return { code: 200, message: "Setup completed successfully." };
    }

    /**
     * 手动全量重生成公开站静态页。**super_admin only,且刻意没有后台 UI。**
     *
     * 为什么存在:开发环境的 `npm run ssg:preview` 需要一个触发点 —— 生成必须由后端做(要读库),
     * 而预览服务器在前端起。备选是写一个独立 CLI 进程,但那会二次打开同一个 SQLite,正是
     * CLAUDE.md 坑 #2 点名的 `disk I/O error` 陷阱。
     *
     * `baseUrl`:让生成器对着调用方指定的站点渲染(dev 指向预览服务器;生产不传,用容器内 nginx)。
     */
    @Route("post", "/ssg/regenerate")
    async ssgRegenerate(ctx: any) {
        if (!policy.isSuper(ctx.state)) {
            return { code: 403, message: "Permission Denied. super_admin required." };
        }
        const baseUrl = ctx.request.body?.baseUrl;
        try {
            const pages = await prerender.regenerateAll({ baseUrl });
            return { code: 200, data: { pages }, message: `generated ${pages} pages` };
        } catch (e: any) {
            console.error("[ssg] 手动全量失败:", e?.message);
            return { code: 500, message: `预渲染失败:${e?.message ?? e}` };
        }
    }

    @Route("get", "/export")
    async exportData(ctx) {
        if (!policy.isSuper(ctx.state)) {
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
                // 只导模型**当前声明**的列。库表里可能还留着历史上删过的字段(DYAPI 迁移只增不减),
                // 裸读会把它们一起带出来,导入侧再遇到就是 `字段X不存在`。导入侧也做了容错,
                // 但新文件不该一开始就是脏的。
                exportData[key] = await model.read({ fields: declaredColumns(model) });
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
