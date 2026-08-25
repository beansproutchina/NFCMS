/**
 * 给文章打上「我属于哪个一级栏目」的标记(`data.section`)。
 *
 * ## 为什么需要这个冗余字段
 *
 * 栏目树是两层的:文章挂在**子分类**上(`学术活动/学术报告`),而「学术活动 · 全部」这类
 * 父栏目页要把整棵子树的文章汇到一起。列表接口只能按单个 `category_id` 过滤,想跨子分类
 * 就得 `{ $in: [...] }` —— 但那串 id 只有运行时才知道,而 `theme.config.ts` 的 prefetch
 * 参数必须是静态的(`${data.category.children}` 是分类对象数组,不是 id 数组)。
 *
 * 于是反过来:写入时就把归属冗余到 `data.section`,读取时
 * `filter: { "data.section": "events" }` 一条静态过滤解决。父页因此也能完全 prefetch ——
 * 首帧就是满的,SSG 也能出快照(靠 `onMounted` 补数据的页面,快照下来会是空态)。
 *
 * ## 为什么是钩子
 *
 * 派生数据不该让编辑手填 —— 改一次分类归属就得记得回去改所有文章,一定会错。
 * `article_data_fields` 里也刻意不声明它,后台编辑器就不会把它渲染成一个能填错的输入框。
 *
 * 挂 `content.saved.*` 而不是新加 `content.pre_save`:现有事件已经覆盖了全部写入路径
 * (`HTTPCreate` / `HTTPUpdate` / 生命周期发布 / 定时发布)。回写用**裸 `update()`** ——
 * 裸方法不发 `doAction`,不会递归。
 */

import ArticleModel from "../models/ArticleModel.js";
import CategoryModel from "../models/CategoryModel.js";

/** 祖先链最多走这么深。分类树是人手建的,超过这个深度只可能是数据成环。 */
const MAX_DEPTH = 32;

export class SectionTagger {
    private app: any = null;

    /** 由 `index.ts` 在模型注册之后接线。取模型走 getter,与 PrerenderService 一致。 */
    bind(app: any) { this.app = app; }

    private get articles() { return this.app.I(ArticleModel); }
    private get categories() { return this.app.I(CategoryModel); }

    /**
     * `category_id → 一级栏目 slug` 的全量索引。
     *
     * 刻意不复用 `contentHelpers.getBreadcrumbs`:那是「给某一行算面包屑」,每级一次查询。
     * 这里要的是整棵树的映射 —— 分类被改父时要重标一整棵子树的文章,逐篇走链就是上千次
     * 查询。一次全表读(分类表是几十到几百行量级)换 O(1) 查表。
     *
     * 顺带把环挡住:`seen` 一旦重复访问就判定该链损坏,给空 slug 而不是转到天荒地老。
     */
    private async rootSlugIndex(): Promise<Map<number, string>> {
        const rows: any[] = await this.categories.read({});
        const byId = new Map<number, any>(rows.map((c: any) => [Number(c.id), c]));
        const index = new Map<number, string>();
        for (const row of rows) {
            const seen = new Set<number>();
            let cur: any = row, depth = 0;
            while (cur && Number(cur.parent_id) > 0 && depth++ < MAX_DEPTH) {
                if (seen.has(Number(cur.id))) { cur = null; break; }
                seen.add(Number(cur.id));
                cur = byId.get(Number(cur.parent_id));
            }
            index.set(Number(row.id), cur ? String(cur.slug ?? "") : "");
        }
        return index;
    }

    /** 一篇文章保存后:按它所在分类的祖先链打上一级栏目 slug。 */
    async onArticleSaved(id: any): Promise<void> {
        if (!this.app) return;
        const row = (await this.articles.read({ id }))[0];
        if (!row) return;                                   // 已被删掉
        const want = (await this.rootSlugIndex()).get(Number(row.category_id)) ?? "";
        if (row.data?.section === want) return;             // 已经是对的,不写
        await this.articles.update({ id: row.id }, { "data.section": want });
    }

    /**
     * 一个分类保存后:它自己或某个祖先被改了父,整棵子树的归属就变了 —— 该子树下的文章
     * 全部重标。
     *
     * 只扫这棵子树而不是全表:改一个二级栏目不该惊动另外八个一级栏目下的几百篇文章。
     */
    async onCategorySaved(id: any): Promise<void> {
        if (!this.app) return;
        const index = await this.rootSlugIndex();
        const rows: any[] = await this.categories.read({});
        const byId = new Map<number, any>(rows.map((c: any) => [Number(c.id), c]));

        const target = Number(id);
        const affected = new Set<number>();
        for (const row of rows) {
            const seen = new Set<number>();
            let cur: any = row, depth = 0;
            while (cur && depth++ < MAX_DEPTH) {
                if (Number(cur.id) === target) { affected.add(Number(row.id)); break; }
                if (seen.has(Number(cur.id))) break;
                seen.add(Number(cur.id));
                cur = Number(cur.parent_id) > 0 ? byId.get(Number(cur.parent_id)) : null;
            }
        }
        if (!affected.size) return;

        const list: any[] = await this.articles.read({ filter: { category_id: { $in: [...affected] } } });
        for (const row of list) {
            const want = index.get(Number(row.category_id)) ?? "";
            if (row.data?.section === want) continue;
            await this.articles.update({ id: row.id }, { "data.section": want });
        }
    }
}

export const sectionTag = new SectionTagger();
