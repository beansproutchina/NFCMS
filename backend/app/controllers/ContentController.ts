import { ControllerRoute, Route, Inject } from "dyapi/utils/decorators.js";
import { Controller } from "dyapi/core/controller.js";
import ArticleModel from "../models/ArticleModel.js";
import CategoryModel from "../models/CategoryModel.js";

@ControllerRoute("content")
export default class ContentController extends Controller {
    @Inject(ArticleModel) declare articleModel: ArticleModel;
    @Inject(CategoryModel) declare categoryModel: CategoryModel;

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

    @Route("get", "/article")
    async getArticle(ctx: any) {
        const slug = ctx.request.query.slug;
        if (!slug) return { code: 400, message: "Slug is required" };

        const articles = await this.articleModel.read({ filter: { slug, visible: true } });
        if (!articles || articles.length === 0) return { code: 404, message: "Article Not Found" };
        
        const article = articles[0];
        
        let category = null;
        let breadcrumbs = [];
        if (article.category_id) {
            const catRes = await this.categoryModel.read({ filter: { id: article.category_id } });
            if (catRes && catRes.length > 0) {
                category = catRes[0];
                breadcrumbs = await this.getBreadcrumbs(article.category_id);
            }
        }
        
        // Priority: Article's content_template > Category's content_template > DefaultArticle
        const template = article.content_template || category?.content_template || "DefaultArticle";

        return {
            code: 200,
            data: {
                article,
                category,
                breadcrumbs,
                template
            }
        };
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
        const articles = await this.articleModel.read({ filter: { category_id: category.id, visible: 1 }, fields: ['id', 'title', 'description', 'thumbnail', 'is_top', 'weight', 'published_at', 'slug', 'category_id'] }) || [];
        
        // Sort articles by weight then published_at
        articles.sort((a: any, b: any) => {
            if (a.is_top !== b.is_top) return a.is_top ? -1 : 1;
            if (a.weight !== b.weight) return (a.weight) - (b.weight);
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
