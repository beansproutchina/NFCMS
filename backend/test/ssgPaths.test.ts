import { test, expect, describe } from "bun:test";
import {
    articleRelPath,
    categoryRelPath,
    customRelPath,
    relPathToUrl,
    shouldPrerenderArticle,
    shouldPrerenderCategory,
    UNCATEGORIZED,
} from "../app/lib/ssgPaths.js";

// ── URL ↔ 文件路径 ───────────────────────────────────────────────────
describe("relPath —— URL 与生成文件的双向映射", () => {
    test("articleRelPath 用栏目 slug 与文章 slug 拼出 a/<cat>/<slug>.html", () => {
        expect(articleRelPath("news", "hello")).toBe("a/news/hello.html");
    });

    test("articleRelPath 对无栏目文章回落 uncategorized", () => {
        expect(articleRelPath(null, "hello")).toBe(`a/${UNCATEGORIZED}/hello.html`);
        expect(articleRelPath(undefined, "hello")).toBe(`a/${UNCATEGORIZED}/hello.html`);
        expect(articleRelPath("", "hello")).toBe(`a/${UNCATEGORIZED}/hello.html`);
    });

    /**
     * 落盘用的是**解码后**的名字。nginx 会把请求里的 %E4%BD%A0 解成 UTF-8 再匹配 $uri,
     * 所以磁盘上必须是 `你好-world.html`;若这里先 encodeURIComponent,nginx 永远找不到文件。
     */
    test("articleRelPath 保留中文 slug 原样，不做 percent-encode", () => {
        expect(articleRelPath("news", "你好-world")).toBe("a/news/你好-world.html");
    });

    test("categoryRelPath 产出 a/<cat>.html", () => {
        expect(categoryRelPath("news")).toBe("a/news.html");
    });

    test("customRelPath 把主题自定义路由映射到根下的 html", () => {
        expect(customRelPath("/about")).toBe("about.html");
        expect(customRelPath("/search")).toBe("search.html");
    });

    test("relPathToUrl 把 a/news/hello.html 还原成 /a/news/hello", () => {
        expect(relPathToUrl("a/news/hello.html")).toBe("/a/news/hello");
    });

    test("relPathToUrl 把 index.html 还原成 /", () => {
        expect(relPathToUrl("index.html")).toBe("/");
    });

    test("relPathToUrl 与 articleRelPath 互为逆运算（含中文 slug）", () => {
        for (const [cat, slug] of [["news", "hello"], ["news", "你好-world"], ["press", "a-b-c"]]) {
            expect(relPathToUrl(articleRelPath(cat, slug))).toBe(`/a/${cat}/${slug}`);
        }
    });
});

// ── 可生成判定:受众轴的静态侧执行点 ──────────────────────────────────
describe("shouldPrerenderArticle —— 只有 public 全文能落静态盘", () => {
    test("status=visible 且 access_eff=public 时为真", () => {
        expect(shouldPrerenderArticle({ status: "visible", access_eff: "public" })).toBe(true);
    });

    test("status 非 visible 一律为假", () => {
        for (const status of ["hidden", "scheduled", "", null, undefined]) {
            expect(shouldPrerenderArticle({ status, access_eff: "public" })).toBe(false);
        }
    });

    /**
     * 这条是安全红线:teaser 两态看起来"匿名也能看到点东西",但它们能看到的只是摘要,
     * 而快照落盘的是**渲染出来的整页**。只要 access_eff 不是 public 就不许落盘。
     */
    test("对 auth / auth_teaser / restricted / restricted_teaser 四值一律为假", () => {
        for (const eff of ["auth", "auth_teaser", "restricted", "restricted_teaser"]) {
            expect(shouldPrerenderArticle({ status: "visible", access_eff: eff })).toBe(false);
        }
    });

    test("对未知 / 缺失 access_eff 为假（fail closed）", () => {
        expect(shouldPrerenderArticle({ status: "visible", access_eff: "wat" })).toBe(false);
        expect(shouldPrerenderArticle({ status: "visible", access_eff: null })).toBe(false);
        expect(shouldPrerenderArticle({ status: "visible" })).toBe(false);
    });
});

describe("shouldPrerenderCategory —— 没有列表模板就没有列表页", () => {
    test("有 list_template 时为真", () => {
        expect(shouldPrerenderCategory({ list_template: "DefaultCategory" })).toBe(true);
    });

    test("对空串与纯空格 list_template 为假", () => {
        for (const v of ["", "   ", "\t\n", null, undefined]) {
            expect(shouldPrerenderCategory({ list_template: v })).toBe(false);
        }
    });
});
