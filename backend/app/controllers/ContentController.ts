import { ControllerRoute, Route, Inject } from "dyapi/utils/decorators.js";
import { Controller } from "dyapi/core/controller.js";
import { newJwt, checkJwt } from "dyapi/utils/jwt.js";
import ArticleModel from "../models/ArticleModel.js";
import CategoryModel from "../models/CategoryModel.js";
import UserModel from "../models/UserModel.js";
import { policy } from "../services/PolicyService.js";

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

    /** Public homepage data: visible articles + categories. Raw reads (no RBAC), so anonymous visitors work. */
    @Route("get", "/home")
    async getHome() {
        const articles = await this.articleModel.read({
            filter: { status: "visible" },
            orderBy: "published_at",
            orderDesc: true,
            fields: ["id", "title", "slug", "description", "thumbnail", "is_top", "published_at", "category_id"],
        }) || [];
        articles.sort((a: any, b: any) => {
            if (a.is_top !== b.is_top) return a.is_top ? -1 : 1;
            return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
        });
        const categories = await this.categoryModel.read({}) || [];
        return { code: 200, data: { articles, categories } };
    }

    @Route("get", "/article")
    async getArticle(ctx: any) {
        const slug = ctx.request.query.slug;
        if (!slug) return { code: 400, message: "Slug is required" };

        const articles = await this.articleModel.read({ filter: { slug, status: "visible" } });
        if (!articles || articles.length === 0) return { code: 404, message: "Article Not Found" };

        return { code: 200, data: await this.buildArticlePayload(articles[0]) };
    }

    /**
     * Issue a short-lived preview token for a non-public content item.
     * Requires an authenticated user who can read the row (RBAC).
     */
    @Route("post", "/preview-token")
    async previewToken(ctx: any) {
        const { id } = ctx.request.body || {};
        if (id == null) return { code: 400, message: "id is required" };
        const article = (await this.articleModel.read({ id }))[0];
        if (!article) return { code: 404, message: "Article Not Found" };
        if (!(await policy.can(ctx.state, "R", this.articleModel, article))) {
            return { code: 403, message: "没有权限" };
        }
        const token = newJwt({ purpose: "preview", type: "articles", id: String(id) }, this._app);
        return { code: 200, data: { token } };
    }

    /**
     * Render a draft/scheduled article via a valid preview token, bypassing the status filter.
     * Returns the same payload shape as getArticle, plus preview:true.
     */
    @Route("get", "/preview")
    async preview(ctx: any) {
        const { id, pt } = ctx.request.query;
        const payload = checkJwt(pt, this._app);
        if (!payload || payload.purpose !== "preview" || payload.type !== "articles" || String(payload.id) !== String(id)) {
            return { code: 403, message: "Invalid or expired preview token" };
        }
        const article = (await this.articleModel.read({ id }))[0];
        if (!article) return { code: 404, message: "Article Not Found" };
        return { code: 200, data: { ...(await this.buildArticlePayload(article)), preview: true } };
    }

    @Route("get", "/category")
    async getCategory(ctx: any) {
        const slug = ctx.request.query.slug;
        if (!slug) return { code: 400, message: "Slug is required" };

        const categories = await this.categoryModel.read({ filter: { slug } });
        if (!categories || categories.length === 0) return { code: 404, message: "Category Not Found" };
        
        const category = categories[0];
        
        // As per requirement: if list_template is empty, it shouldn't render list page
        if (!category.list_template || category.list_template.trim() === "") {
             return { code: 403, message: "This category does not support list view." };
        }

        const breadcrumbs = await this.getBreadcrumbs(category.id);
        const children = await this.categoryModel.read({ filter: { parent_id: category.id } }) || [];
        const articles = await this.articleModel.read({ filter: { category_id: category.id, status: "visible" }, fields: ['id', 'title', 'description', 'thumbnail', 'is_top', 'published_at', 'slug', 'category_id'] }) || [];
        
        // Sort articles by is_top then published_at
        articles.sort((a: any, b: any) => {
            if (a.is_top !== b.is_top) return a.is_top ? -1 : 1;
            return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
        });

        return {
            code: 200,
            data: {
                category,
                children,
                articles,
                breadcrumbs,
                template: category.list_template || "DefaultCategory"
            }
        };
    }
}
