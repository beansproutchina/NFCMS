import { F } from "dyapi/core/datafield.js";
import { CMSModel } from "../lib/CMSModel.js";
import { CRUD, PopTarget, Inject } from "dyapi/utils/decorators.js";
import testContainer from "../containers/testContainer.js";
import CategoryModel from "./CategoryModel.js";
import { getBreadcrumbs } from "../utils/contentHelpers.js";
import { audience } from "../services/AudienceService.js";

/**
 * Core Markdown article model.
 * - Access control: RBAC via CMSModel (no static `permission`); `ownerField` enables "own" scope.
 * - Lifecycle: status (hidden|scheduled|visible) + publish_at, managed via ContentLifecycleController.
 * - enrichArticleData attaches category/breadcrumbs/template/author (via pops) and is shared by the
 *   admin CRUD path (HTTP*) and the public path (ContentController). Author password is stripped.
 */
@CRUD("articles")
@PopTarget("uid")
export default class ArticleModel extends CMSModel {
    @Inject(testContainer) declare container;
    @Inject(CategoryModel) declare categoryModel: CategoryModel;

    tablename = "articles";
    ownerField = "author_id";
    categoryField = "category_id"; // enables category-scoped grants (see PolicyService)
    datafields = [
        F.String("title").notNull(),
        F.String("slug").notNull().unique(),
        F.String("author_id"),
        F.String("description"),
        F.String("thumbnail"),
        F.String("content"),                     // MD content
        F.String("content_template"),            // per-article Vue template override
        F.String("status").default("hidden"),    // hidden | scheduled | visible (lifecycle-managed)
        F.Date("publish_at"),                     // scheduled go-live time
        F.Number("rev_version").default(0),       // reserved for optimistic locking
        F.Number("is_top").default(0),
        // 受众轴(见 docs/public-access.md):作者侧两个可覆盖字段 + 一个物化派生字段。
        F.String("audience").default(""),        // 空 = 继承栏目
        F.Number("teaser").default(-1),         // -1 = 继承栏目
        F.String("access_eff").default("public"), // 派生:public|auth|auth_teaser|restricted|restricted_teaser
        F.Number("category_id").notNull(),
        F.Date("published_at"),
        F.Date("created_at"),
        F.Date("updated_at"),
        F.Object("data"),                         // additional metadata
    ];

    /**
     * 受众轴:每次写入都重新盖章 `access_eff`(见 docs/public-access.md §3)。
     * 放在裸 `create`/`update` 上而不是 `HTTPCreate`/`HTTPUpdate`,是为了让内部写入(公开站、
     * 导入、脚本)也一律带上正确的派生值 —— 派生值陈旧等于门禁失效。
     *
     * 另外把两个"事件时间"显式置空(见下)。
     */
    async create(item) {
        /**
         * `published_at` / `publish_at` 是**事件时间**,不是创建元数据:一个记"首次公开于何时",
         * 一个记"预约何时公开"。新建的行两件事都还没发生,必须是 NULL。
         *
         * 为什么要显式写:容器给「未出现在 item 里的每个 Date 列」自动填 `new Date()`
         * (SqliteContainer 的 `#applyDefaults` → `DataField.getDefaultValue()`)。这个默认对
         * `created_at`/`updated_at` 恰好是对的,对这两个字段则是错的 —— 草稿一建出来就带着
         * "发布时间 = 现在",而 `ContentLifecycleController`/`SchedulerService` 里"首次转
         * visible 才盖章"的守卫是 `isBlankDate(row.published_at)`,字段已有值就永远跳过。
         * 净效果:`published_at` 恒等于创建时间,而它正是公开站全部日期显示、列表排序和
         * JSON-LD `datePublished` 的唯一来源。
         *
         * 用 `=== undefined` 而不是 falsy 判断:种子/导入/作者在新建时手填日期都会显式传值,
         * 那是明确意图(补录旧文章),不能被抹掉。
         */
        if (item.published_at === undefined) item.published_at = null;
        if (item.publish_at === undefined) item.publish_at = null;
        await audience.stampArticle(item);
        return await super.create(item);
    }

    async update(param, item) {
        // 纯派生值重算(AudienceService.recomputeSubtree 只写 access_eff)**不是一次内容编辑**,
        // 不能刷 updated_at:否则改一次栏目受众设置,整棵子树文章的"最后修改时间"全被污染,
        // 连带影响最近更新排序、sitemap 的 lastmod、以及作者对自己改动的认知。
        const derivedOnly = Object.keys(item).length === 1 && item.access_eff !== undefined;
        if (!derivedOnly) item.updated_at = new Date();

        // 只在这次写入可能改变派生值时重算(改了 category/audience/teaser),否则跳过——
        // 避免每次普通编辑都多读一次栏目表。access_eff 自身的写入(重算)不再递归盖章。
        const touchesAudience =
            item.category_id !== undefined || item.audience !== undefined || item.teaser !== undefined;
        if (touchesAudience && item.access_eff === undefined) {
            const existing = param?.id != null ? (await this.read({ id: param.id }))[0] : undefined;
            await audience.stampArticle(item, existing);
        }
        return await super.update(param, item);
    }

    /** Attach category/breadcrumbs/template + author (from author_id pop, password stripped). */
    async enrichArticleData(articles: any[]) {
        const categoryCache: Record<string, any> = {};
        return await Promise.all((articles || []).map(async (article: any) => {
            if (!article) return null;
            let category = null;
            let breadcrumbs: any[] = [];
            if (article.category_id) {
                if (categoryCache[article.category_id]) {
                    ({ category, breadcrumbs } = categoryCache[article.category_id]);
                } else {
                    const catRes = await this.categoryModel.read({ filter: { id: article.category_id } });
                    if (catRes && catRes.length > 0) {
                        category = catRes[0];
                        breadcrumbs = await getBreadcrumbs(article.category_id, this.categoryModel);
                        categoryCache[article.category_id] = { category, breadcrumbs };
                    }
                }
            }
            if (article.author_id_pop) {
                const author = { ...article.author_id_pop };
                delete author.password;
                article.author = author;
            }
            delete article.author_id_pop;
            const template = article.content_template || category?.content_template || "DefaultArticle";
            return { ...article, category, breadcrumbs, template };
        }));
    }

    // Admin CRUD path: RBAC (via super/CMSModel) + author pop + enrichment.
    async HTTPReadMany(state: any, query: any, body: any) {
        query.pops = Array.from(new Set([...(query.pops || []), "author_id"]));
        const res: any = await super.HTTPReadMany(state, query, body);
        res.data = await this.enrichArticleData(res.data);
        return res;
    }

    async HTTPReadOne(state: any, query: any, body: any) {
        query.pops = Array.from(new Set([...(query.pops || []), "author_id"]));
        const res: any = await super.HTTPReadOne(state, query, body);
        if (res.data) res.data = (await this.enrichArticleData([res.data]))[0];
        return res;
    }

    async HTTPCreate(state: any, query: any, body: any) {
        if (body && body.author_id == null) body.author_id = state.user?.id; // default author = creator
        return await super.HTTPCreate(state, query, body);
    }
}
