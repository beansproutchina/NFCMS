import type { DYApp } from "dyapi/core/dyapiApp.js";
import {
    accessEffFromChain,
    computeAccessEff,
    inheritAudienceDetailed,
    normalizeTeaser,
    type AudienceLevel,
    type AccessEff,
} from "../lib/audience.js";
import { requireModelByTable } from "../lib/registry.js";

/**
 * 受众轴派生值(`articles.access_eff`)的维护者。
 *
 * 分工:判定规则的纯函数在 `app/lib/audience.ts`(可单测);**鉴权判定**在 PolicyService(唯一
 * 鉴权权威);本服务只负责有状态的**派生数据维护**——写入前盖章、栏目变更后批量重算。与
 * SchedulerService / StaticGenService 同类。
 *
 * 为什么要物化:公开列表 filter 因此退化成单字段 $in,不必在 SQL 里表达"字段为空则回落到栏目"。
 * 代价就是这里两个重算入口,必须都接上,否则派生值会陈旧。
 */
class AudienceService {
    private app!: DYApp;

    bind(app: DYApp) {
        this.app = app;
    }

    /**
     * 按 tablename 取模型实例,**故意不 import 模型类** —— 理由见 lib/registry.ts。
     */
    private model(tablename: string): any {
        try {
            return requireModelByTable(this.app, tablename);
        } catch (e: any) {
            throw new Error(`[audience] ${e.message}`);
        }
    }

    private get categories() {
        return this.model("categories");
    }

    private get articles() {
        return this.model("articles");
    }

    /** 全量栏目 → id 索引。栏目树很小(几十~几百),每次重算读一遍即可,不引入缓存与失效逻辑。 */
    private async categoryMap(): Promise<Map<number, any>> {
        const rows = await this.categories.read({ limit: 100000 });
        const map = new Map<number, any>();
        for (const c of rows) map.set(Number(c.id), c);
        return map;
    }

    /**
     * 栏目自身到根的链(root → leaf)。带环保护:脏数据里 parent_id 成环时不会死循环。
     */
    private chainOf(categoryId: any, map: Map<number, any>): AudienceLevel[] {
        const chain: AudienceLevel[] = [];
        const seen = new Set<number>();
        let id = Number(categoryId);
        while (Number.isFinite(id) && id > 0 && !seen.has(id)) {
            seen.add(id);
            const cat = map.get(id);
            if (!cat) break;
            chain.unshift({
                audience: cat.audience || null,
                teaser: normalizeTeaser(cat.teaser),
            });
            id = Number(cat.parent_id) || 0;
        }
        return chain;
    }

    /** 文章自身的覆盖层(空 audience / -1 teaser 表示继承)。 */
    private articleLevel(article: any): AudienceLevel {
        return {
            audience: article?.audience ? article.audience : null,
            teaser: normalizeTeaser(article?.teaser),
        };
    }

    /**
     * 给栏目行补上**继承计算的结果**,供后台 UI 显示"有效受众是什么、由谁决定"。
     *
     * 为什么由后端算而不是前端:继承规则(尤其"只有非 public 层级钳制 teaser"那条例外)是
     * `app/lib/audience.ts` 的唯一真相。前端再实现一遍就有两份,而那条例外恰恰是最容易写错的。
     *
     * 附加的字段(不落库,只在响应里):
     *   `access_eff`      —— 该栏目的有效受众枚举
     *   `audience_eff`    —— 有效 audience(三级之一)
     *   `teaser_eff`      —— 有效 teaser(0/1)
     *   `audience_from`   —— 决定 audience 的**祖先**栏目 `{id,name}`;自身决定或无限制时为 null
     *   `teaser_from`     —— 决定 teaser 的祖先栏目,同上
     */
    async annotateCategories(rows: any[]): Promise<any[]> {
        if (!rows?.length) return rows ?? [];
        const map = await this.categoryMap();
        for (const row of rows) {
            const chain = this.chainOf(row.id, map);           // root → leaf,leaf 就是本行
            const ids = this.chainIds(row.id, map);            // 与 chain 同序的栏目 id
            const d = inheritAudienceDetailed(chain);
            const self = Number(row.id);
            const srcOf = (idx: number | null) => {
                if (idx == null) return null;
                const id = ids[idx];
                if (id == null || id === self) return null;    // 自身决定 → 不必显示"继承自"
                const cat = map.get(id);
                return cat ? { id: cat.id, name: cat.name } : null;
            };
            row.audience_eff = d.audience;
            row.teaser_eff = d.teaser;
            row.access_eff = computeAccessEff(d.audience, d.teaser);
            row.audience_from = srcOf(d.audienceFrom);
            row.teaser_from = srcOf(d.teaserFrom);
        }
        return rows;
    }

    /** 与 `chainOf` 同序的栏目 id 列表(root → leaf),用于把"哪一级决定"映射回具体栏目。 */
    private chainIds(categoryId: any, map: Map<number, any>): number[] {
        const ids: number[] = [];
        const seen = new Set<number>();
        let id = Number(categoryId);
        while (Number.isFinite(id) && id > 0 && !seen.has(id)) {
            seen.add(id);
            if (!map.has(id)) break;
            ids.unshift(id);
            id = Number(map.get(id).parent_id) || 0;
        }
        return ids;
    }

    /** 算一篇文章的有效 access_eff。`map` 可复用以避免批量重算时重复读栏目表。 */
    async effFor(article: any, map?: Map<number, any>): Promise<AccessEff> {
        const m = map ?? (await this.categoryMap());
        return accessEffFromChain([...this.chainOf(article?.category_id, m), this.articleLevel(article)]);
    }

    /**
     * 写入前盖章:把算好的 `access_eff` 塞进 item。
     *
     * 供 ArticleModel.create/update 调用。`access_eff` 在 `lifecycleFields` 里,所以客户端传的
     * 值已被 CMSModel 丢弃;这里是它唯一的合法写入点。
     *
     * update 时 item 可能只带部分字段(如只改 title),所以需要 `existing` 兜出 category_id /
     * audience / teaser 的当前值——否则会按"字段缺失=继承"算出错误的派生值。
     */
    async stampArticle(item: any, existing?: any): Promise<void> {
        if (!item) return;
        const merged = {
            category_id: item.category_id ?? existing?.category_id,
            audience: item.audience !== undefined ? item.audience : existing?.audience,
            teaser: item.teaser !== undefined ? item.teaser : existing?.teaser,
        };
        item.access_eff = await this.effFor(merged);
    }

    /**
     * 栏目的 audience/teaser/parent_id 变更后,重算该栏目**整棵子树**下所有文章。
     *
     * 逐篇 update 而不是一条 SQL:派生值依赖每篇自己的覆盖字段,无法用单条等值 UPDATE 表达。
     * 只写真正变化的行,避免无谓的写放大与 hook 噪音。返回改动行数。
     */
    async recomputeSubtree(categoryId: any): Promise<number> {
        const map = await this.categoryMap();

        // 子树展开(与 PolicyService.expandCategories 同形:按 parent_id 建子表后 DFS)。
        const childrenOf = new Map<number, number[]>();
        for (const c of map.values()) {
            const p = Number(c.parent_id) || 0;
            (childrenOf.get(p) ?? childrenOf.set(p, []).get(p)!).push(Number(c.id));
        }
        const ids: number[] = [];
        const stack = [Number(categoryId)];
        const seen = new Set<number>();
        while (stack.length) {
            const id = stack.pop()!;
            if (!Number.isFinite(id) || seen.has(id)) continue;
            seen.add(id);
            ids.push(id);
            for (const ch of childrenOf.get(id) ?? []) stack.push(ch);
        }
        if (!ids.length) return 0;

        const rows = await this.articles.read({
            filter: { category_id: { $in: ids } },
            fields: ["id", "category_id", "audience", "teaser", "access_eff"],
            limit: 100000,
        });

        let changed = 0;
        for (const row of rows) {
            const eff = await this.effFor(row, map);
            if (eff === row.access_eff) continue;
            // 裸 update:绕过 CMSModel 的 lifecycleFields 白名单(这里正是那个受控写入点),
            // 也不触发版本快照 —— 派生值变化不是一次内容编辑。
            await this.articles.update({ id: row.id }, { access_eff: eff });
            changed++;
        }
        if (changed) console.log(`[audience] recomputed access_eff for ${changed} article(s) under category ${categoryId}`);
        return changed;
    }

    /** 全量重算。迁移/修数据用(老库的文章没有 access_eff 值)。返回改动行数。 */
    async recomputeAll(): Promise<number> {
        const map = await this.categoryMap();
        const rows = await this.articles.read({
            fields: ["id", "category_id", "audience", "teaser", "access_eff"],
            limit: 1000000,
        });
        let changed = 0;
        for (const row of rows) {
            const eff = await this.effFor(row, map);
            if (eff === row.access_eff) continue;
            await this.articles.update({ id: row.id }, { access_eff: eff });
            changed++;
        }
        if (changed) console.log(`[audience] backfilled access_eff for ${changed} article(s)`);
        return changed;
    }
}

export const audience = new AudienceService();
