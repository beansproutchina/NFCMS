/**
 * 生成产物清单。**stale 文件的唯一真相** —— 没有它就无从知道「这个 id 上次生成到哪个路径」,
 * 改 slug / 改栏目 / 转受限 / 删除 之后的残留文件永远清不掉,旧 URL 会一直返回僵尸页面
 * (比 404 坏得多,因为它看起来是好的)。
 */

export interface SsgManifest {
    version: number;
    /** dist/index.html 的 hash。换主题 / 换构建必变 → 触发全量重生成。 */
    fingerprint?: string;
    /** 文章 id → 生成文件相对路径。 */
    articles: Record<string, string>;
    /** 栏目 id → 生成文件相对路径。 */
    categories: Record<string, string>;
    /** 主题自定义路由的生成文件。 */
    custom: string[];
}

export const MANIFEST_VERSION = 1;

export function emptyManifest(): SsgManifest {
    return { version: MANIFEST_VERSION, articles: {}, categories: {}, custom: [] };
}

/**
 * 增量重算一批文章。`rel = null` 表示「这一页不该存在」—— 撤下 / 转受限 / 被删除都归到这一种。
 *
 * 一个算法覆盖五条 story(S7 / S11 / S16 / S18 / E10),差别只在调用方算出来的 `rel` 是什么。
 *
 * 只处理传入的 id,不动其他条目 —— 增量重算不能误伤别人。
 *
 * **路径未变时不产出删除项。** 天真写法是「先删 prev,再写 want」,路径没变时那等于先把线上
 * 能用的页面删掉再去生成 —— 生成一旦失败(chromium 起不来、超时),这一页就凭空消失了。
 */
export function planArticleWrites(
    manifest: SsgManifest,
    wants: Array<{ id: any; rel: string | null }>,
): { write: string[]; remove: string[]; next: SsgManifest } {
    const next: SsgManifest = {
        ...manifest,
        articles: { ...manifest.articles },
        categories: { ...manifest.categories },
        custom: [...manifest.custom],
    };
    const write: string[] = [];
    const remove: string[] = [];

    for (const { id, rel } of wants) {
        const key = String(id);
        const prev = next.articles[key];
        if (prev && prev !== rel) remove.push(prev);
        if (rel) {
            write.push(rel);
            next.articles[key] = rel;
        } else {
            delete next.articles[key];
        }
    }
    return { write, remove, next };
}
