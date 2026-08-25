import { test, expect, describe } from "bun:test";
import { sanitizeSnapshot } from "../app/lib/ssgSanitize.js";

/**
 * 快照来自一个**跑完了的**页面,里面混着运行时产物:HMR 客户端、进度条残留、
 * PrimeVue 的 portal 容器。它们进了静态文件就会在下一次访问时以"卡死的 UI"形式出现
 * (一根永不消失的蓝色进度条,一个空的 toast 容器),而不会自己消失 —— 因为没有 JS 来收拾它们。
 */
const wrap = (body: string, head = "") =>
    `<html data-ssg-ready="1"><head>${head}</head><body>${body}</body></html>`;

describe("sanitizeSnapshot —— 清掉运行时垃圾，留下能自举的壳", () => {
    test("移除 /@vite/client 的 script 标签", () => {
        const out = sanitizeSnapshot(wrap("", `<script type="module" src="/@vite/client"></script>`));
        expect(out).not.toContain("@vite/client");
    });

    test("移除 #nprogress 残留节点（含其整棵子树）", () => {
        const out = sanitizeSnapshot(
            wrap(`<div id="nprogress"><div class="bar" style="width:40%"></div></div><main>正文</main>`),
        );
        expect(out).not.toContain("nprogress");
        expect(out).not.toContain('class="bar"');
        expect(out).toContain("正文");
    });

    test("移除 PrimeVue toast / confirmdialog 的挂载容器", () => {
        const out = sanitizeSnapshot(
            wrap(`<div class="p-toast p-component"><div class="p-toast-message"></div></div><main>正文</main>`),
        );
        expect(out).not.toContain("p-toast");
        expect(out).toContain("正文");
    });

    /** 删过头就没人接管了:静态页会永远停在匿名快照上,登录用户看到的东西永远不对。 */
    test("保留 /assets/*.js 的 module script（否则 SPA 起不来）", () => {
        const src = `<script type="module" crossorigin src="/assets/index-a1b2c3.js"></script>`;
        expect(sanitizeSnapshot(wrap("", src))).toContain("/assets/index-a1b2c3.js");
    });

    /**
     * E8:序列化时若把相对路径绝对化成 http://127.0.0.1/...,换个域名(局域网 IP、真实域名)
     * 访问静态页就会去请求生成机器的 localhost —— 图片和样式全挂。
     */
    test("不改写相对 src / href", () => {
        const out = sanitizeSnapshot(
            wrap(`<img src="/static/uploads/a.png"><a href="/a/news/other">x</a>`, `<link rel="stylesheet" href="/assets/index.css">`),
        );
        expect(out).toContain('src="/static/uploads/a.png"');
        expect(out).toContain('href="/a/news/other"');
        expect(out).toContain('href="/assets/index.css"');
        expect(out).not.toContain("127.0.0.1");
    });

    /**
     * `data-ssg-ready` 是生成期的握手信号,不该留在产物里(留着会让下一次生成误判"已就绪")。
     * 换成 `data-ssg`:这是给客户端 main.ts 看的开关 —— 有它才尝试水合。
     */
    test("<html> 上 data-ssg-ready 被替换为 data-ssg 标记", () => {
        const out = sanitizeSnapshot(wrap("<main>正文</main>"));
        expect(out).not.toContain("data-ssg-ready");
        expect(out).toMatch(/<html[^>]*\sdata-ssg(\s|=|>)/);
    });
});

/**
 * 回归:真实快照里抓到的两个形态。写在这里是因为它们是**实测发现**的,合成用例想不到 ——
 * 一个是 <html> 上的状态类,一个是必须留下的 CSS 变量块。
 */
describe("sanitizeSnapshot —— 真实快照里抓到的形态", () => {
    test("摘掉 <html> 上的 nprogress-busy(否则静态页是永久 wait 光标)", () => {
        const out = sanitizeSnapshot(`<html data-ssg-ready="1" lang="zh-CN" class="nprogress-busy dark"><body>x</body></html>`);
        expect(out).not.toContain("nprogress");
        expect(out).toContain("dark");          // 同一个 class 属性里的别的类不能被误伤
        expect(out).toContain('lang="zh-CN"');
    });

    test("保留 PrimeVue 注入的 toast CSS 变量块(删了会破坏样式)", () => {
        const css = `<style type="text/css" data-primevue-style-id="toast-variables">:root{--p-toast-close-icon-size:1rem;}</style>`;
        expect(sanitizeSnapshot(`<html><head>${css}</head><body>x</body></html>`)).toContain("--p-toast-close-icon-size");
    });
});
