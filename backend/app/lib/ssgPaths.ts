/**
 * SSG 的 URL ↔ 文件路径映射与「这一页该不该落静态盘」的判定。
 *
 * 纯函数、零依赖 —— 受众轴在静态侧的执行点就是 `shouldPrerenderArticle` 这一个判断,
 * 所以它必须能被单独证伪。
 */

/** 无栏目文章的兜底目录名。 */
export const UNCATEGORIZED = "uncategorized";

/** 允许落静态盘的 `access_eff`。**只有 public** —— 见 docs/spec/001 §3-C。 */
const PRERENDERABLE_ACCESS = new Set(["public"]);

/**
 * `/a/<cat>/<slug>` 对应的生成文件。
 *
 * slug **不做 percent-encode**:nginx 会把请求里的 `%E4%BD%A0` 解成 UTF-8 再匹配 `$uri`,
 * 磁盘上必须是 `你好-world.html`。这里先编码的话 nginx 永远找不到文件。
 */
export function articleRelPath(catSlug: string | null | undefined, slug: string): string {
    const cat = catSlug ? String(catSlug) : UNCATEGORIZED;
    return `a/${cat}/${slug}.html`;
}

/** `/a/<cat>` 对应的生成文件。 */
export function categoryRelPath(catSlug: string): string {
    return `a/${catSlug}.html`;
}

/** 主题自定义路由(`/about`)对应的生成文件。 */
export function customRelPath(routePath: string): string {
    const clean = String(routePath).replace(/^\/+/, "").replace(/\/+$/, "");
    return clean === "" ? "index.html" : `${clean}.html`;
}

/** 生成文件 → 生成器应当访问的 URL 路径。与 `*RelPath` 互为逆运算。 */
export function relPathToUrl(rel: string): string {
    const noExt = String(rel).replace(/\.html$/, "");
    return noExt === "index" ? "/" : `/${noExt}`;
}

/**
 * 只有 `status=visible` 且 `access_eff=public` 的文章能落静态盘。
 *
 * teaser 两态看起来"匿名也能看到点东西",但它们能看到的只是摘要,而快照落盘的是**渲染出来的
 * 整页**。未知值一律 false(fail closed)。
 */
export function shouldPrerenderArticle(row: { status?: any; access_eff?: any }): boolean {
    return row?.status === "visible" && PRERENDERABLE_ACCESS.has(row?.access_eff as string);
}

/** 没有 `list_template` 的栏目没有列表页这个概念(面包屑里它本来就是 disabled 的)。 */
export function shouldPrerenderCategory(cat: { list_template?: any }): boolean {
    return String(cat?.list_template ?? "").trim() !== "";
}
