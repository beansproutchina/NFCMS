import { F } from "dyapi/core/datafield.js";
import { CMSModel } from "../lib/CMSModel.js";
import { CRUD, PopTarget, Inject } from "dyapi/utils/decorators.js";
import testContainer from "../containers/testContainer.js";
import CategoryModel from "./CategoryModel.js";
import { getBreadcrumbs } from "../utils/contentHelpers.js";

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
        F.Number("category_id").notNull(),
        F.Date("published_at"),
        F.Date("created_at"),
        F.Date("updated_at"),
        F.Object("data"),                         // additional metadata
    ];

    async update(param, item) {
        item.updated_at = new Date();
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
