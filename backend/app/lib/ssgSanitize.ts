/**
 * 快照清洗。
 *
 * 快照来自一个**跑完了的**页面,里面混着运行时产物:HMR 客户端、nprogress 残留、PrimeVue 的
 * portal 容器。它们进了静态文件就会以「卡死的 UI」形式出现 —— 一根永不消失的进度条、一个空的
 * toast 壳 —— 而且**不会自己消失**,因为静态页上没有 JS 来收拾它们。
 *
 * 同时把生成期的握手信号 `data-ssg-ready` 换成给客户端看的 `data-ssg` 开关(main.ts 靠它决定
 * 走水合还是普通挂载)。
 *
 * 用正则而不是 DOM:后端跑在 bun 里,没有 DOM,而引入一个 HTML 解析器只为删几个已知节点不划算。
 * 代价是模式必须写死成「我们自己产生的那几种标记」,不追求通用 —— 输入不是任意 HTML,是我们
 * 自己的 SPA 渲染出来的页面。
 */

/** 整段删掉一个带 id/class 的元素及其子树(非贪婪配对同名标签,够用于这几个已知的平坦容器)。 */
function dropElement(html: string, attr: "id" | "class", value: string): string {
    const re = new RegExp(
        `<(\\w+)[^>]*\\s${attr}="[^"]*\\b${value}\\b[^"]*"[^>]*>[\\s\\S]*?<\\/\\1>`,
        "gi",
    );
    let out = html;
    // 反复删到不动为止:同类容器可能有多个,且删掉外层后内层的匹配位置会变。
    for (let i = 0; i < 5; i++) {
        const next = out.replace(re, "");
        if (next === out) break;
        out = next;
    }
    // 自闭合/无子节点的形态
    return out.replace(new RegExp(`<\\w+[^>]*\\s${attr}="[^"]*\\b${value}\\b[^"]*"[^>]*\\/?>(?![\\s\\S]*?<\\/)`, "gi"), "");
}

export function sanitizeSnapshot(html: string): string {
    let out = String(html);

    // vite 的 HMR 客户端:静态页上它只会去连一个不存在的 ws。
    out = out.replace(/<script\b[^>]*\bsrc="\/@[^"]*"[^>]*><\/script>/gi, "");

    // nprogress 的进度条残留(导航被快照截停时它可能停在半路)。
    out = dropElement(out, "id", "nprogress");

    // PrimeVue 的 portal 容器:toast / confirmdialog 挂在 body 末尾,快照会把空壳带上。
    for (const cls of ["p-toast", "p-confirmdialog", "p-dialog-mask"]) out = dropElement(out, "class", cls);

    /**
     * nprogress 的"导航进行中"状态类。
     *
     * 快照抓在 `router.afterEach` 调 `NProgress.done()` **之前**(就绪信号由 DynamicView 在
     * 渲染完成时发出,早于 afterEach),于是 `<html class="nprogress-busy">` 被固化进静态页。
     * 后果是访客看到一个**永远不会消失的 wait 光标** —— 静态页上没有 JS 来摘掉它。
     *
     * 不去调整信号时机:让就绪信号依赖 router 钩子的相对顺序,比在这里删一个 class 脆弱得多。
     */
    out = out.replace(/(<html\b[^>]*\sclass=")([^"]*)"/i, (_m, head, cls) => {
        const kept = cls.split(/\s+/).filter((c: string) => c && !c.startsWith("nprogress")).join(" ");
        return kept ? `${head}${kept}"` : `${head}"`;
    });

    // 生成期握手信号 → 客户端水合开关。留着 ready 会让下一次生成误判"已就绪"。
    out = out.replace(/\sdata-ssg-(ready|error)="[^"]*"/gi, "");
    out = out.replace(/<html\b/i, (m) => `${m} data-ssg`);

    return out;
}
