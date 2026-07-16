/**
 * 内容管理相关的通用辅助函数
 */

import CategoryModel from "../models/CategoryModel.js";
import ArticleModel from "../models/ArticleModel.js";

/**
 * 生成分类的面包屑导航
 * @param categoryId - 当前分类ID
 * @param categoryModel - CategoryModel 实例
 * @returns 面包屑数组
 */
export async function getBreadcrumbs(
    categoryId: number | null,
    categoryModel: CategoryModel
): Promise<Array<{ id: number; name: string; slug: string; disabled: boolean }>> {
    const breadcrumbs = [];
    let currentId = categoryId;
    while (currentId) {
        const catRes = await categoryModel.read({ filter: { id: currentId } });
        if (catRes && catRes.length > 0) {
            const cat = catRes[0];
            breadcrumbs.unshift({
                id: cat.id,
                name: cat.name,
                slug: cat.slug,
                // 如果 list_template 为空，则在面包屑中禁用
                disabled: !cat.list_template || cat.list_template.trim() === ""
            });
            currentId = cat.parent_id;
        } else {
            break;
        }
    }
    return breadcrumbs;
}

/**
 * 获取子分类列表
 * @param categoryId - 父分类ID
 * @param categoryModel - CategoryModel 实例
 * @returns 子分类数组
 */
export async function getChildren(
    categoryId: number,
    categoryModel: CategoryModel
): Promise<any[]> {
    return await categoryModel.read({ filter: { parent_id: categoryId } }) || [];
}

/**
 * 获取分类下的文章列表（按 is_top 和 published_at 排序）
 * @param categoryId - 分类ID
 * @param articleModel - ArticleModel 实例
 * @returns 文章数组
 */
export async function getCategoryArticles(
    categoryId: number,
    articleModel: ArticleModel
): Promise<any[]> {
    const articles = await articleModel.read({
        filter: { category_id: categoryId, visible: 1 },
        fields: ['id', 'title', 'description', 'thumbnail', 'is_top', 'published_at', 'slug', 'category_id']
    }) || [];

    // 按 is_top 降序，然后按 published_at 降序排序
    articles.sort((a: any, b: any) => {
        if (a.is_top !== b.is_top) return a.is_top ? -1 : 1;
        return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
    });

    return articles;
}
