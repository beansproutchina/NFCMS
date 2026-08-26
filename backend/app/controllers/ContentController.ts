import { ControllerRoute, Route, Inject } from "dyapi/utils/decorators.js";
import { Controller } from "dyapi/core/controller.js";
import ArticleModel from "../models/ArticleModel.js";
import CategoryModel from "../models/CategoryModel.js";
import UserModel from "../models/UserModel.js";
import { policy } from "../services/PolicyService.js";
import { readPublic, readPublicOne } from "../utils/contentHelpers.js";

@ControllerRoute("content")
export default class ContentController extends Controller {
    @Inject(ArticleModel) declare articleModel: ArticleModel;
    @Inject(CategoryModel) declare categoryModel: CategoryModel;
    @Inject(UserModel) declare userModel: UserModel;

    // Helper to generate parent breadcrumbs
    async getBreadcrumbs(categoryId: number | null) {
        const breadcrumbs = [];
        let currentId = categoryId;
        while (currentId) {
            const catRes = await this.categoryModel.read({ filter: { id: currentId } });
            if (catRes && catRes.length > 0) {
                const cat = catRes[0];
                breadcrumbs.unshift({
                    id: cat.id,
                    name: cat.name,
                    slug: cat.slug,
                    // If list_template is empty, requirement states it should be disabled in breadcrumbs
                    disabled: !cat.list_template || cat.list_template.trim() === ""
                });
                currentId = cat.parent_id;
            } else {
                break;
            }
        }
        return breadcrumbs;
    }

    /** Build the full public payload (category, breadcrumbs, author, template) for one article row. */
    async buildArticlePayload(article: any) {
        let category = null;
        let breadcrumbs: any[] = [];
        if (article.category_id) {
            const catRes = await this.categoryModel.read({ filter: { id: article.category_id } });
            if (catRes && catRes.length > 0) {
                category = catRes[0];
                breadcrumbs = await this.getBreadcrumbs(article.category_id);
            }
        }

        if (article.author_id) {
            const userRes = await this.userModel.read({ id: article.author_id, hideFields: ['password'] });
            if (userRes && userRes.length > 0) {
                article.author = userRes[0];
            }
        }

        // Priority: Article's content_template > Category's content_template > DefaultArticle
        const template = article.content_template || category?.content_template || "DefaultArticle";
        return { article, category, breadcrumbs, template };
    }

    /**
     * Public homepage data: visible articles + categories.
     *
     * 走 `readPublic`(裸读 + 受众轴 filter),不走 RBAC —— 公开访客没有 role_permission,走
     * 管辖轴会全部 403。门禁由受众轴提供。见 docs/public-access.md。
     */
    @Route("get", "/home")
    async getHome(ctx: any) {
        const articles = await readPublic(this.articleModel, ctx.state, {
            orderBy: "published_at",
            orderDesc: true,
            // access_eff 必须取出来:整形与排序之后前端还要靠 `locked` 渲染锁标记。
            fields: ["id", "title", "slug", "description", "thumbnail", "is_top", "published_at", "category_id", "access_eff"],
        });
        articles.sort((a: any, b: any) => {
            if (a.is_top !== b.is_top) return a.is_top ? -1 : 1;
            return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
        });
        const categories = await this.visibleCategories(ctx.state);
        return { code: 200, data: { articles, categories } };
    }

    @Route("get", "/article")
    async getArticle(ctx: any) {
        const slug = ctx.request.query.slug;
        if (!slug) return { code: 400, message: "Slug is required" };

        const hit = await readPublicOne(this.articleModel, ctx.state, { filter: { slug }, pops: ["author_id"] });
        // 不可见一律 404 而不是 403:403 等于承认"这里有东西"。teaser 内容不会走到这里 ——
        // 它的可见性是 `locked`,readPublicOne 会带着剥好的行返回。
        if (!hit) return { code: 404, message: "Article Not Found" };

        // Flat enriched shape (article + category/breadcrumbs/template/author), reusing the model's enrich.
        const data = (await this.articleModel.enrichArticleData([hit.row]))[0];
        return { code: 200, data };
    }

    /**
     * Public article list — same query format as the model CRUD (filter/orderBy/limit/page/fields),
     * but status='visible' + the audience filter are forced server-side.
     */
    @Route("get", "/articles")
    async listArticles(ctx: any) {
        const q = ctx.request.query;
        const param: any = {
            filter: { ...(q.filter || {}) },
            orderBy: q.orderBy || "published_at",
            orderDesc: q.orderDesc === undefined ? true : (q.orderDesc === "true" || q.orderDesc === true),
            limit: Math.min(q.limit ? parseInt(q.limit) : 20, 50),
            page: q.page ? parseInt(q.page) : 0,
            pops: ["author_id"],
        };
        if (q.fields) {
            const fields = typeof q.fields === "string" ? q.fields.split(",") : q.fields;
            // access_eff 必须在结果里,否则整形拿不到判定依据(前端也读不到 locked)。
            param.fields = fields.includes("access_eff") ? fields : [...fields, "access_eff"];
        }
        const rows = await readPublic(this.articleModel, ctx.state, param);
        const data = await this.articleModel.enrichArticleData(rows);
        return { code: 200, data, total: param.total, pages: param.pages };
    }

    @Route("get", "/category")
    async getCategory(ctx: any) {
        const slug = ctx.request.query.slug;
        if (!slug) return { code: 400, message: "Slug is required" };

        const categories = await this.categoryModel.read({ filter: { slug } });
        if (!categories || categories.length === 0) return { code: 404, message: "Category Not Found" };

        const category = categories[0];
        // 受众轴:此前这条路径**完全不校验可见性**(CategoryModel.enrichCategoryData 里那个
        // ForbiddenError 根本没被这里用到)。hidden → 404,不泄露存在性;locked 则照常返回栏目
        // 元信息(名字/描述),文章列表由 /content/articles 自己过滤 —— 那正是摘要墙的语义。
        const visibility = await policy.canViewCategory(ctx.state, category.id);
        if (visibility === "hidden") return { code: 404, message: "Category Not Found" };

        const breadcrumbs = await this.getBreadcrumbs(category.id);
        const viewable = await policy.viewableCategoryIds(ctx.state);
        const children = ((await this.categoryModel.read({ filter: { parent_id: category.id } })) || [])
            .filter((c: any) => viewable.has(Number(c.id)));
        // Flat: category fields + children + breadcrumbs. The article list comes from the
        // /content/articles prefetch (theme.config), keeping the query format unified.
        return { code: 200, data: { ...category, children, breadcrumbs, locked: visibility === "locked" } };
    }

    /**
     * 公开分类树。此前主题走 `crudAPI.getList('categories')` 打 `/api/categories`,靠
     * `CategoryModel.PUBLIC = "R"` 裸奔,把全部栏目(名字/slug/层级)泄漏给匿名访客。
     * 现在 PUBLIC 已降为 `""`,公开侧统一走这里 —— api.ts 的 crudAPI shim 会把
     * `getList('categories')` 重定向过来,4 个主题一行不用改。
     */
    @Route("get", "/categories")
    async listCategories(ctx: any) {
        return { code: 200, data: await this.visibleCategories(ctx.state) };
    }

    /** 受众轴过滤后的栏目列表(hidden 的移除,teaser 的保留 —— 它就是要露出来的)。 */
    private async visibleCategories(state: any): Promise<any[]> {
        const viewable = await policy.viewableCategoryIds(state);
        const rows = (await this.categoryModel.read({ limit: 100000 })) || [];
        return rows.filter((c: any) => viewable.has(Number(c.id)));
    }
}
