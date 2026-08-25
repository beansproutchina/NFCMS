import { test, expect, describe } from "bun:test";
import { emptyManifest, planArticleWrites, type SsgManifest } from "../app/lib/ssgManifest.js";

/**
 * manifest diff 是本轮的收敛点:S7(撤下) / S11(转受限) / S16(删除) / S18(栏目改名) / E10(改 slug)
 * 五条 story 共用这一个算法,差别只在调用方算出来的 `rel` 是什么。
 */
const withArticles = (articles: Record<string, string>): SsgManifest => ({
    ...emptyManifest(),
    articles,
});

describe("planArticleWrites —— 一次 diff 覆盖五条 story", () => {
    test("文章 slug 变更 → 产出旧路径删除项 + 新路径写入项", () => {
        const m = withArticles({ "12": "a/news/hello.html" });
        const r = planArticleWrites(m, [{ id: 12, rel: "a/news/hello-2.html" }]);
        expect(r.remove).toEqual(["a/news/hello.html"]);
        expect(r.write).toEqual(["a/news/hello-2.html"]);
        expect(r.next.articles["12"]).toBe("a/news/hello-2.html");
    });

    /** S11:受众收紧。文件必须消失,且不能再写回去。 */
    test("文章转为非 public（rel=null）→ 只产出删除项，无写入项", () => {
        const m = withArticles({ "12": "a/news/hello.html" });
        const r = planArticleWrites(m, [{ id: 12, rel: null }]);
        expect(r.remove).toEqual(["a/news/hello.html"]);
        expect(r.write).toEqual([]);
    });

    /** S16:文章被删除。manifest 里也要清干净,否则下次全量会拿它当"已生成"。 */
    test("文章被删除（rel=null）→ 删除项产出且 manifest 不再持有该 id", () => {
        const m = withArticles({ "12": "a/news/hello.html", "13": "a/news/world.html" });
        const r = planArticleWrites(m, [{ id: 12, rel: null }]);
        expect(r.remove).toEqual(["a/news/hello.html"]);
        expect(r.next.articles).not.toHaveProperty("12");
        expect(r.next.articles["13"]).toBe("a/news/world.html");
    });

    /** S18:栏目改名会让其下每篇文章的 URL 都变。 */
    test("栏目 slug 变更 → 其下每篇文章各产出一对「删旧 / 写新」", () => {
        const m = withArticles({
            "1": "a/news/hello.html",
            "2": "a/news/world.html",
            "3": "a/news/带图.html",
        });
        const r = planArticleWrites(m, [
            { id: 1, rel: "a/press/hello.html" },
            { id: 2, rel: "a/press/world.html" },
            { id: 3, rel: "a/press/带图.html" },
        ]);
        expect(r.remove.sort()).toEqual(["a/news/hello.html", "a/news/world.html", "a/news/带图.html"].sort());
        expect(r.write.sort()).toEqual(["a/press/hello.html", "a/press/world.html", "a/press/带图.html"].sort());
    });

    /**
     * 天真写法是「先删 prev，再写 want」。路径没变时那等于**先把线上能用的页面删掉**,
     * 再去生成 —— 生成一旦失败(chromium 起不来、超时),这一页就凭空消失了。
     */
    test("路径未变化时不产生删除项（不会先删后写同一个文件）", () => {
        const m = withArticles({ "12": "a/news/hello.html" });
        const r = planArticleWrites(m, [{ id: 12, rel: "a/news/hello.html" }]);
        expect(r.remove).toEqual([]);
        expect(r.write).toEqual(["a/news/hello.html"]);
    });

    test("未被传入的 id 不受影响（增量重算不动别人）", () => {
        const m = withArticles({ "12": "a/news/hello.html", "99": "a/press/keep.html" });
        const r = planArticleWrites(m, [{ id: 12, rel: null }]);
        expect(r.next.articles["99"]).toBe("a/press/keep.html");
        expect(r.remove).not.toContain("a/press/keep.html");
    });
});
