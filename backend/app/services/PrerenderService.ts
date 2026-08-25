import fs from "fs";
import path from "path";
import crypto from "crypto";
import ArticleModel from "../models/ArticleModel.js";
import CategoryModel from "../models/CategoryModel.js";
import { findModelByTable } from "../lib/registry.js";
import { BrowserPool } from "./BrowserPool.js";
import { PrerenderQueue } from "./PrerenderQueue.js";
import {
    articleRelPath, categoryRelPath, customRelPath, relPathToUrl,
    shouldPrerenderArticle, shouldPrerenderCategory,
} from "../lib/ssgPaths.js";
import { emptyManifest, planArticleWrites, type SsgManifest } from "../lib/ssgManifest.js";
import { sanitizeSnapshot } from "../lib/ssgSanitize.js";

const SSG_DIR = process.env.SSG_DIR || path.join(process.cwd(), "static", "ssg");
const SITE_URL = (process.env.SITE_URL || "http://localhost").replace(/\/$/, "");
/** 生成器访问哪个站点。容器里是同容器的 nginx;本地是 `npm run ssg:preview` 起的预览服务器。 */
const BASE_URL = process.env.SSG_BASE_URL || "http://127.0.0.1";
/** 构建产物目录。只用来读 `ssg-routes.json` 与算指纹 —— 壳由浏览器从 nginx 拿,不在这里读。 */
const SPA_DIST = process.env.SSG_SPA_DIST || path.join(process.cwd(), "..", "frontend", "dist");
const MANIFEST_FILE = ".manifest.json";

/**
 * 公开站预渲染。
 *
 * 用 headless chromium 打开**真实 SPA URL**,等页面自报渲染完成,把 DOM 落成静态 HTML。
 * 保真度 100%(生成的就是访客看到的那一页),主题零改造 —— 代价是镜像里要有 chromium。
 * 路线取舍见 docs/spec/001-ssg-prerender.md §2。
 *
 * 三条铁律:
 * 1. **只生成 `access_eff === 'public'`**。判定收口在 `shouldPrerenderArticle`。
 * 2. **只写允许的文件**。nginx 因此不需要任何排除列表:没写过 `admin.html`,`/admin` 就必然
 *    落到 SPA。
 * 3. **manifest 是 stale 文件的唯一真相**。撤下/转受限/删除/改 slug/栏目改名,全靠它清残留。
 */
class PrerenderService {
    private app: any;
    private pool: BrowserPool | null = null;
    private queue: PrerenderQueue | null = null;
    private manifest: SsgManifest = emptyManifest();
    /** 正在进行的全量。第二个调用者等它,而不是并肩再跑一轮 —— 两轮抢同一个浏览器会互相拖超时。 */
    private fullRun: Promise<number> | null = null;

    bind(app: any) {
        this.app = app;
        this.manifest = this.loadManifest();
        this.pool = new BrowserPool({
            baseUrl: BASE_URL,
            executablePath: process.env.SSG_CHROMIUM_PATH,
        });
        this.queue = new PrerenderQueue({
            run: (rel) => this.renderOne(rel),
            debounceMs: Number(process.env.SSG_DEBOUNCE_MS) || 400,
            onError: (rel, err) => console.error(`[ssg] ${rel} 生成失败:`, (err as any)?.message ?? err),
        });
    }

    // ── manifest ────────────────────────────────────────────────────────────
    private manifestPath() { return path.join(SSG_DIR, MANIFEST_FILE); }

    private loadManifest(): SsgManifest {
        try {
            const raw = fs.readFileSync(this.manifestPath(), "utf8");
            const m = JSON.parse(raw);
            if (m && typeof m === "object" && m.articles) return { ...emptyManifest(), ...m };
        } catch { /* 缺失或损坏都按空处理 —— 后果只是下次全量重生成 */ }
        return emptyManifest();
    }

    private saveManifest() {
        fs.mkdirSync(SSG_DIR, { recursive: true });
        fs.writeFileSync(this.manifestPath(), JSON.stringify(this.manifest, null, 2));
    }

    /** dist/index.html 的 hash。换主题 / 重新构建前端必变 → 旧快照全部作废。 */
    private fingerprint(): string {
        try {
            return crypto.createHash("sha1").update(fs.readFileSync(path.join(SPA_DIST, "index.html"))).digest("hex");
        } catch { return "no-dist"; }
    }

    // ── 文件 ────────────────────────────────────────────────────────────────
    private write(rel: string, content: string) {
        const full = path.join(SSG_DIR, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content);
    }

    private remove(rel: string) {
        try { fs.rmSync(path.join(SSG_DIR, rel), { force: true }); } catch { /* ignore */ }
    }

    // ── 单页 ────────────────────────────────────────────────────────────────
    /** 渲染一个生成文件。页面自报 error 或超时 → **不写文件**(该 URL 回落 SPA)。 */
    private async renderOne(rel: string): Promise<void> {
        if (process.env.SSG_TRACE) console.log(`[ssg:trace] renderOne ${rel}`);
        if (rel === "sitemap.xml") return this.writeSitemap();
        const res = await this.pool!.snapshot(relPathToUrl(rel));
        if (!res.html) {
            /**
             * 区分两种失败,处置完全不同:
             *
             * - `error-signal` —— 页面**权威地**说"这一页渲染不出来"(内容 404、栏目对匿名
             *   访客不可见)。此时陈旧文件必须**删掉**:一个刚被收紧为 restricted 的栏目,它
             *   那张列着全部文章标题的旧列表页还留在磁盘上,就是实打实的越权泄漏。
             * - `timeout` / `launch-failed` —— 基础设施抖动,不代表这一页不该存在。删掉等于
             *   一次 chromium 打嗝就让线上少一页,所以保留旧文件,只记日志。
             */
            if (res.reason === "error-signal") {
                this.remove(rel);
                console.warn(`[ssg] ${rel} 页面自报渲染失败 —— 已删除陈旧文件,该 URL 回落 SPA`);
            } else {
                console.warn(`[ssg] 跳过 ${rel}(${res.reason}) —— 保留既有文件,不做改动`);
            }
            return;
        }
        this.write(rel, sanitizeSnapshot(res.html));
    }

    // ── 数据 → 期望产物 ─────────────────────────────────────────────────────
    private get articles() { return this.app.I(ArticleModel); }
    private get categories() { return this.app.I(CategoryModel); }

    private async categorySlugs(): Promise<Map<number, string>> {
        const map = new Map<number, string>();
        for (const c of await this.categories.read({ limit: 100000 })) map.set(Number(c.id), c.slug);
        return map;
    }

    /** 一篇文章**应当**生成到哪个文件;不该生成则 null。 */
    private async wantForArticle(row: any, slugs?: Map<number, string>): Promise<string | null> {
        if (!row || !shouldPrerenderArticle(row)) return null;
        const map = slugs ?? (await this.categorySlugs());
        return articleRelPath(map.get(Number(row.category_id)), row.slug);
    }

    /** 主题在构建期落下的自定义路由(`/about` 等)。文件缺失就是没有,不报错。 */
    private customRoutes(): string[] {
        try {
            const raw = fs.readFileSync(path.join(SPA_DIST, "ssg-routes.json"), "utf8");
            const list = JSON.parse(raw);
            return Array.isArray(list) ? list.filter((r) => typeof r === "string") : [];
        } catch { return []; }
    }

    // ── 对外:增量 ───────────────────────────────────────────────────────────
    /**
     * 一批文章的增量重算。`ids` 之外的条目不受影响。
     *
     * 一个入口覆盖 S7(撤下)/ S11(转受限)/ S16(删除)/ S18(栏目改名)/ E10(改 slug):
     * 差别只在 `wantForArticle` 算出来是什么。删除的行读不到 → want = null → 删文件。
     */
    async reconcileArticles(ids: any[]): Promise<void> {
        if (!ids.length) return;
        const slugs = await this.categorySlugs();
        const wants: Array<{ id: any; rel: string | null }> = [];
        for (const id of ids) {
            const row = (await this.articles.read({ id }))[0];
            wants.push({ id, rel: await this.wantForArticle(row, slugs) });
        }
        const { write, remove, next } = planArticleWrites(this.manifest, wants);
        for (const rel of remove) this.remove(rel);
        this.manifest = next;
        this.saveManifest();
        for (const rel of write) this.queue!.enqueue(rel);
    }

    /** 一篇文章变了,连带首页、它所在栏目页(及祖先)、sitemap 都可能过期。 */
    async onArticleChanged(id: any): Promise<void> {
        await this.reconcileArticles([id]);
        const row = (await this.articles.read({ id }))[0];
        this.queue!.enqueue("index.html");
        this.queue!.enqueue("sitemap.xml");
        if (row?.category_id != null) await this.enqueueCategoryChain(Number(row.category_id));
    }

    /** 该栏目及其所有祖先的列表页 —— 父栏目的列表通常含子孙内容。 */
    private async enqueueCategoryChain(categoryId: number): Promise<void> {
        const all = await this.categories.read({ limit: 100000 });
        const byId = new Map<number, any>(all.map((c: any) => [Number(c.id), c]));
        let cur: any = byId.get(categoryId);
        const seen = new Set<number>();
        while (cur && !seen.has(Number(cur.id))) {
            seen.add(Number(cur.id));
            if (shouldPrerenderCategory(cur)) {
                const rel = categoryRelPath(cur.slug);
                this.manifest.categories[String(cur.id)] = rel;
                this.queue!.enqueue(rel);
            }
            cur = byId.get(Number(cur.parent_id));
        }
        this.saveManifest();
    }

    /** 栏目本身变了(slug / list_template / 受众)→ 该栏目页 + 其下每篇文章都要重算路径。 */
    async onCategoryChanged(categoryId: any): Promise<void> {
        const cat = (await this.categories.read({ id: categoryId }))[0];
        const prevRel = this.manifest.categories[String(categoryId)];
        const wantRel = cat && shouldPrerenderCategory(cat) ? categoryRelPath(cat.slug) : null;
        if (prevRel && prevRel !== wantRel) this.remove(prevRel);
        if (wantRel) { this.manifest.categories[String(categoryId)] = wantRel; this.queue!.enqueue(wantRel); }
        else delete this.manifest.categories[String(categoryId)];
        this.saveManifest();

        const rows = await this.articles.read({ filter: { category_id: categoryId }, fields: ["id"], limit: 100000 });
        await this.reconcileArticles(rows.map((r: any) => r.id));
        this.queue!.enqueue("index.html");
        this.queue!.enqueue("sitemap.xml");
    }

    // ── 对外:全量 ───────────────────────────────────────────────────────────
    /**
     * 全量重生成。清空产物目录再按当前数据重建 —— 增量的残留、换主题后的陈旧壳,一并归零。
     */
    /**
     * 全量重生成。并发调用会**合流**到同一次运行 —— 冷启动的指纹全量与手动触发很容易撞上,
     * 两轮同时跑会抢同一个浏览器,表现为一批页面莫名超时。
     */
    async regenerateAll(opts?: { baseUrl?: string }): Promise<number> {
        // dev 的预览服务器与生产的容器内 nginx 不是同一个地址,允许调用方指定。
        // 只改 baseUrl,不换 pool 实例:换掉会让在途的 page 变成孤儿。
        if (opts?.baseUrl) this.pool!.setBaseUrl(opts.baseUrl);
        if (this.fullRun) return this.fullRun;
        this.fullRun = this.doRegenerateAll().finally(() => { this.fullRun = null; });
        return this.fullRun;
    }

    private async doRegenerateAll(): Promise<number> {
        const slugs = await this.categorySlugs();
        const next = emptyManifest();
        /**
         * **指纹留到最后再盖。**
         *
         * 一开始写在这里,结果是:全量跑到一半进程被杀(部署重启、OOM、Ctrl+C),磁盘上留下一份
         * 「指纹已是最新」但页面一张都没有的 manifest —— 下次启动 `regenerateIfStale` 看指纹
         * 相符,直接返回,**站点永远是空的且没有任何报错**。先立碑再干活。
         * 现在只有 `doRegenerateAll` 跑完才盖章,中断就等于没做过,下次启动重来。
         */

        const targets: string[] = ["index.html"];
        for (const c of await this.categories.read({ limit: 100000 })) {
            if (!shouldPrerenderCategory(c)) continue;
            const rel = categoryRelPath(c.slug);
            next.categories[String(c.id)] = rel;
            targets.push(rel);
        }
        const rows = await this.articles.read({
            fields: ["id", "slug", "status", "access_eff", "category_id"], limit: 100000,
        });
        for (const r of rows) {
            const rel = await this.wantForArticle(r, slugs);
            if (!rel) continue;
            next.articles[String(r.id)] = rel;
            targets.push(rel);
        }
        for (const route of this.customRoutes()) {
            const rel = customRelPath(route);
            next.custom.push(rel);
            targets.push(rel);
        }

        // 先清空:上一轮的残留(换主题后的旧壳、已删内容的僵尸页)没有别的地方能清掉。
        try { fs.rmSync(SSG_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
        this.manifest = next;
        this.saveManifest();

        for (const rel of targets) this.queue!.enqueue(rel);
        await this.queue!.idle();
        // sitemap 依赖磁盘现状,必须等所有页面都尘埃落定后再写。
        this.queue!.enqueue("sitemap.xml");
        await this.queue!.idle();
        // 跑完了才盖指纹(见上)。
        this.manifest.fingerprint = this.fingerprint();
        this.saveManifest();
        const built = fs.existsSync(SSG_DIR) ? this.countFiles(SSG_DIR) : 0;
        console.log(`[ssg] full regenerate complete, ${built} pages -> ${SSG_DIR}`);
        return built;
    }

    /** 产物目录里所有 .html 的相对路径(排序后,让 sitemap 稳定)。 */
    private listGeneratedPages(dir = SSG_DIR, prefix = ""): string[] {
        let out: string[] = [];
        let entries: fs.Dirent[];
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
        for (const e of entries) {
            const rel = prefix ? `${prefix}/${e.name}` : e.name;
            if (e.isDirectory()) out = out.concat(this.listGeneratedPages(path.join(dir, e.name), rel));
            else if (e.name.endsWith(".html")) out.push(rel);
        }
        return out.sort();
    }

    private countFiles(dir: string): number {
        let n = 0;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (e.name === MANIFEST_FILE) continue;
            n += e.isDirectory() ? this.countFiles(path.join(dir, e.name)) : 1;
        }
        return n;
    }

    /** 指纹变了(换主题/重新构建前端)或 manifest 缺失才全量,否则普通重启不白跑。 */
    async regenerateIfStale(): Promise<void> {
        const fp = this.fingerprint();
        if (this.manifest.fingerprint === fp && fs.existsSync(this.manifestPath())) return;
        console.log(`[ssg] 构建指纹变化(${this.manifest.fingerprint ?? "无"} → ${fp}),后台全量重生成`);
        this.regenerateAll().catch((e) => console.error("[ssg] 全量重生成失败:", e?.message));
    }

    /**
     * 周期性盯着构建指纹。
     *
     * **为什么不能只在启动时查一次:** 预渲染页里写死了带哈希的 bundle 名
     * (`/assets/index-D14wq3_j.js`)。前端一重新构建,哈希就变,旧文件被删 —— 于是每一张
     * 已生成的静态页都指向一个**不存在的脚本**。
     *
     * 那个失效模式极毒:页面看起来完美(静态 HTML 照常渲染),但一行 JS 都跑不起来 ——
     * 没有 SPA 接管、点站内链接是整页跳转、登录态永远不会被纠正。服务端零报错,
     * 只有浏览器控制台里一条 404。实测中就是这么被咬了一口:构建了几次却没重启后端。
     *
     * 单容器生产环境不太会遇到(换镜像 = 换容器 = 后端也重启),但开发环境天天遇到,
     * 而且任何「重建前端 + reload nginx 但不重启后端」的部署流程都会中招。
     */
    startWatchingBuild(): void {
        const ms = Number(process.env.SSG_WATCH_MS ?? 60000);
        if (!ms) return;
        setInterval(() => {
            void this.regenerateIfStale().catch(() => {});
        }, ms).unref?.();
    }

    // ── sitemap ─────────────────────────────────────────────────────────────
    /**
     * 只列**磁盘上真实存在**的页面。
     *
     * 不能读 manifest:那是"打算生成什么"的清单,而一页可能因为渲染失败(页面自报 error、
     * 超时)最终没有落盘。按 manifest 出 sitemap 就会把这些 URL 告诉搜索引擎 —— 实测中
     * `/a/services` 正是如此:它是 `audience=authenticated` 的栏目,对匿名访客 404,页面
     * 正确地没有生成,却仍然出现在了 sitemap 里。
     *
     * 磁盘是唯一诚实的来源:生成了什么就宣告什么,受限内容天然不在其中。
     */
    private writeSitemap() {
        const rels = this.listGeneratedPages();
        const urls = rels.map((rel) => `${SITE_URL}${relPathToUrl(rel)}`);
        const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        this.write("sitemap.xml",
            `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
            urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join("\n") +
            `\n</urlset>\n`);
    }

    /** 队列排空(测试与预览脚本用)。 */
    idle(): Promise<void> { return this.queue?.idle() ?? Promise.resolve(); }
    async shutdown(): Promise<void> { await this.pool?.close(); }
}

export const prerender = new PrerenderService();

/** 供 SystemController 判断动态内容类型是否需要预渲染(目前只有 articles 有公开页)。 */
export function isPrerenderableTable(app: any, tablename: string): boolean {
    return tablename === "articles" && !!findModelByTable(app, tablename);
}
