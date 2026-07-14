import fs from "fs";
import path from "path";
import { marked } from "marked";
import ArticleModel from "../models/ArticleModel.js";
import CategoryModel from "../models/CategoryModel.js";
import SystemConfigModel from "../models/SystemConfigModel.js";

const SSG_DIR = process.env.SSG_DIR || path.join(process.cwd(), "static", "ssg");
const SITE_URL = (process.env.SITE_URL || "http://localhost").replace(/\/$/, "");
const SPA_SHELL = path.join(process.cwd(), "..", "frontend", "dist", "index.html");

/**
 * StaticGenService — SSG / incremental regeneration for the public site.
 *
 * Generates SEO-complete static HTML (title/meta/OG/canonical/JSON-LD + server-rendered
 * Markdown) for visible articles, categories and the home page, plus sitemap.xml. Driven by
 * the content.published / content.saved hooks so the static site stays fresh without a rebuild.
 *
 * When the built SPA (frontend/dist/index.html) is present it is used as the shell — SEO
 * content is injected into <head> and #app so crawlers get real content while browsers still
 * boot the full themed SPA. Otherwise a minimal standalone shell is emitted.
 *
 * NOTE: this renders Markdown to HTML rather than executing the Vue theme components; a future
 * upgrade can swap `renderBody` for a Vite-SSR render of the actual templates.
 */
class StaticGenService {
    private app: any;

    bind(app: any) {
        this.app = app;
    }

    private shell(): string {
        try {
            if (fs.existsSync(SPA_SHELL)) return fs.readFileSync(SPA_SHELL, "utf8");
        } catch { /* fall through */ }
        return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="app"></div></body></html>`;
    }

    /** Minimal server-side sanitization for editor-authored Markdown output. */
    private sanitize(html: string): string {
        return String(html)
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
            .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
            .replace(/javascript:/gi, "");
    }

    private esc(s: any): string {
        return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    private injectHead(shell: string, head: string): string {
        return shell.includes("</head>") ? shell.replace("</head>", `${head}\n</head>`) : head + shell;
    }

    /** Inject SEO body into #app so it is present in the initial HTML (SPA replaces it on mount). */
    private injectApp(shell: string, body: string): string {
        if (/<div id="app">\s*<\/div>/.test(shell)) {
            return shell.replace(/<div id="app">\s*<\/div>/, `<div id="app"><div data-ssg>${body}</div></div>`);
        }
        return shell.replace("</body>", `<div data-ssg>${body}</div></body>`);
    }

    private write(rel: string, html: string) {
        const full = path.join(SSG_DIR, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, html);
    }

    private remove(rel: string) {
        const full = path.join(SSG_DIR, rel);
        try { if (fs.existsSync(full)) fs.unlinkSync(full); } catch { /* ignore */ }
    }

    private page(title: string, headExtra: string, body: string): string {
        // Drop the shell's own <title> so ours is authoritative (no duplicate title tags).
        const shell = this.shell().replace(/<title>[\s\S]*?<\/title>/i, "");
        const head = `<title>${this.esc(title)}</title>\n${headExtra}`;
        return this.injectApp(this.injectHead(shell, head), body);
    }

    /** Regenerate one article page (or remove it if the article is no longer visible). */
    async regenerateArticle(id: any) {
        const article = (await this.app.I(ArticleModel).read({ id }))[0];
        if (!article) return;
        const cat = article.category_id ? (await this.app.I(CategoryModel).read({ id: article.category_id }))[0] : null;
        const catSlug = cat?.slug || "uncategorized";
        const rel = `a/${catSlug}/${article.slug}.html`;

        if (article.status !== "visible") { this.remove(rel); return; }

        const canonical = `${SITE_URL}/a/${catSlug}/${article.slug}`;
        const contentHtml = this.sanitize(marked.parse(article.content || "") as string);
        const ld = {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: article.title,
            description: article.description || "",
            datePublished: article.published_at || undefined,
        };
        const head = [
            `<meta name="description" content="${this.esc(article.description)}">`,
            `<link rel="canonical" href="${this.esc(canonical)}">`,
            `<meta property="og:type" content="article">`,
            `<meta property="og:title" content="${this.esc(article.title)}">`,
            `<meta property="og:description" content="${this.esc(article.description)}">`,
            article.thumbnail ? `<meta property="og:image" content="${this.esc(article.thumbnail)}">` : "",
            article.published_at ? `<meta property="article:published_time" content="${this.esc(new Date(article.published_at).toISOString())}">` : "",
            `<script type="application/ld+json">${JSON.stringify(ld)}</script>`,
        ].filter(Boolean).join("\n");
        const body = `<article><h1>${this.esc(article.title)}</h1>${contentHtml}</article>`;
        this.write(rel, this.page(article.title, head, body));
    }

    /** Regenerate one category listing page. */
    async regenerateCategory(id: any) {
        const cat = (await this.app.I(CategoryModel).read({ id }))[0];
        if (!cat) return;
        const rel = `a/${cat.slug}.html`;
        if (!cat.list_template || String(cat.list_template).trim() === "") { this.remove(rel); return; }
        const articles = await this.app.I(ArticleModel).read({
            filter: { category_id: cat.id, status: "visible" },
            fields: ["title", "slug", "description"],
        });
        const links = articles.map((a: any) => `<li><a href="/a/${this.esc(cat.slug)}/${this.esc(a.slug)}">${this.esc(a.title)}</a></li>`).join("");
        const canonical = `${SITE_URL}/a/${cat.slug}`;
        const head = `<meta name="description" content="${this.esc(cat.name)}">\n<link rel="canonical" href="${this.esc(canonical)}">`;
        this.write(rel, this.page(cat.name, head, `<h1>${this.esc(cat.name)}</h1><ul>${links}</ul>`));
    }

    async regenerateHome() {
        const cfg: Record<string, string> = {};
        for (const row of await this.app.I(SystemConfigModel).read({})) cfg[row.key] = row.value;
        const siteName = cfg.site_name || "NFCMS";
        const recent = await this.app.I(ArticleModel).read({
            filter: { status: "visible" }, fields: ["title", "slug", "category_id"], orderBy: "published_at", orderDesc: true, limit: 20,
        });
        const cats: Record<string, string> = {};
        for (const c of await this.app.I(CategoryModel).read({})) cats[c.id] = c.slug;
        const links = recent.map((a: any) => `<li><a href="/a/${this.esc(cats[a.category_id] || "uncategorized")}/${this.esc(a.slug)}">${this.esc(a.title)}</a></li>`).join("");
        const head = `<meta name="description" content="${this.esc(cfg.subtitle || siteName)}">\n<link rel="canonical" href="${SITE_URL}/">`;
        this.write("index.html", this.page(siteName, head, `<h1>${this.esc(siteName)}</h1><ul>${links}</ul>`));
    }

    async generateSitemap() {
        const urls: string[] = [`${SITE_URL}/`];
        const cats: Record<string, string> = {};
        for (const c of await this.app.I(CategoryModel).read({})) {
            cats[c.id] = c.slug;
            if (c.list_template) urls.push(`${SITE_URL}/a/${c.slug}`);
        }
        for (const a of await this.app.I(ArticleModel).read({ filter: { status: "visible" }, fields: ["slug", "category_id"] })) {
            urls.push(`${SITE_URL}/a/${cats[a.category_id] || "uncategorized"}/${a.slug}`);
        }
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${this.esc(u)}</loc></url>`).join("\n")}\n</urlset>\n`;
        this.write("sitemap.xml", xml);
    }

    /** Full rebuild (cold start / theme change). */
    async regenerateAll() {
        await this.regenerateHome();
        for (const c of await this.app.I(CategoryModel).read({})) await this.regenerateCategory(c.id);
        for (const a of await this.app.I(ArticleModel).read({ filter: { status: "visible" }, fields: ["id"] })) {
            await this.regenerateArticle(a.id);
        }
        await this.generateSitemap();
        console.log(`[ssg] full regenerate complete -> ${SSG_DIR}`);
    }
}

export const staticgen = new StaticGenService();
