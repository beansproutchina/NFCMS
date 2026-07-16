import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { CRUD, PopTarget, Inject } from "dyapi/utils/decorators.js";
import { ForbiddenError, NotFoundError } from "dyapi/utils/error.js";
import testContainer from "../containers/testContainer.js";
import CategoryModel from "./CategoryModel.js";
import UserModel from "./UserModel.js";
import { getBreadcrumbs } from "../utils/contentHelpers.js";

/**
 * Built-in Core Model for storing Markdown Articles
 */
@CRUD("articles")
export default class ArticleModel extends Model {
    @Inject(testContainer) declare container;
    @Inject(CategoryModel) declare categoryModel: CategoryModel;
    @Inject(UserModel) declare userModel: UserModel;

    tablename = "articles";
    datafields = [
        F.String("title").notNull(),
        F.String("slug").notNull().unique(),
        F.String("author_id"),
        F.String("description"),
        F.String("thumbnail"),
        F.String("content"),          // MD content
        F.String("content_template"),           // Vue template for article overrides Category
        F.Number("visible").default(1),
        F.Number("is_top").default(0),
        F.Number("category_id").notNull(),
        F.Date("published_at"),
        F.Date("created_at"),
        F.Date("updated_at"),
        F.Object("data"), // Additional metadata
    ];
    permission = {
        "PUBLIC": "R",
        "DEFAULT": "R",
        "admin": "C,R,U,D",
        "super_admin": "C,R,U,D"
    };

    async update(param, item) {
        item.updated_at = new Date();
        return await super.update(param, item);
    }

    /**
     * 处理单条文章详情，添加关联数据
     */
    async enrichArticleData(articles: any) {
        // 获取关联的分类信息

        let categoryCache = {};
        return (await Promise.all(articles.map(async (article) => {
            if (!article){
                return null;
            }
            let category = null;
            let breadcrumbs = [];
            if (article.category_id) {
                if (categoryCache[article.category_id]) {
                    category = categoryCache[article.category_id].category;
                    breadcrumbs = categoryCache[article.category_id].breadcrumbs;
                } else {
                    const catRes = await this.categoryModel.read({ filter: { id: article.category_id } });
                    if (catRes && catRes.length > 0) {
                        category = catRes[0];
                        breadcrumbs = await getBreadcrumbs(article.category_id, this.categoryModel);
                        categoryCache[article.category_id] = { category, breadcrumbs };
                    }
                }
            }
            article.author = article.author_id_pop;
            delete article.author_id_pop;
            // 优先级：文章的 content_template > 分类的 content_template > DefaultArticle
            const template = article.content_template || category?.content_template || "DefaultArticle";

            return {
                ...article,
                category,
                breadcrumbs,
                template,
            };
        })));

    }

    /**
     * 重写 HTTPReadOne，支持 slug 查询（当 id 不是数字时）
     */
    // @ts-ignore
    async HTTPReadOne(state, query, body) {
        // 如果 id 存在但不是数字（如 slug），转为 filter 查询
        if (query.id !== undefined && typeof query.id === 'string' && query.id.startsWith('{') && query.id.endsWith('}')) {
            const slug = query.id.slice(1, -1); // 去掉首尾大括号
            query.filter = { slug };
            delete query.id;
        }
        query.pops = ["author_id"];

        const originalResult = await super.HTTPReadOne(state, query, body);

        // 组装完整内容数据
        const enrichedData = (await this.enrichArticleData([originalResult.data]))[0];

        return {
            code: 200,
            data: enrichedData
        };
    }
    // @ts-ignore
    async HTTPReadMany(state, query, body) {
        query.pops = ["author_id"];
        const originalResult = await super.HTTPReadMany(state, query, body);

        // 组装完整内容数据
        const enrichedData = await this.enrichArticleData(originalResult.data);

        return {
            code: 200,
            data: enrichedData,
            total: originalResult.total,
            pages: originalResult.pages,
        };
    }

    // @ts-ignore
    async HTTPCreate(state, query, body) {
        body.author_id = state.user?.id;
        return await super.HTTPCreate(state, query, body);
    }
}
