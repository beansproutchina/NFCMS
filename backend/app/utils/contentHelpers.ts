/**
 * 内容管理相关的通用辅助函数
 */

import CategoryModel from "../models/CategoryModel.js";
import { policy } from "../services/PolicyService.js";
import { mergeFilter } from "./filters.js";
import { applyVisibility, type Visibility } from "../lib/audience.js";

/**
 * **公开读的唯一入口。** 强制 `status='visible'`,AND 进受众轴 filter,再逐行按可见性整形
 * (`locked` 剥正文并打显式标记,`hidden` 防御性丢弃)。
 *
 * 为什么必须收口在这里:ContentController 从前有 5 处各自裸 `read()`,分散就一定漏。这是受众轴
 * 在公开侧唯一的执行点 —— 任何绕过它的裸读都等于绕过门禁。**新增公开读接口一律走这个函数。**
 *
 * 注意它用裸 `read()`(不经 RBAC 的 HTTP 方法):公开站访客没有任何 role_permission,走 RBAC 全 403。
 * 门禁由受众轴而非管辖轴提供 —— 这正是两轴分离的意义。
 */
export async function readPublic(
    model: any,
    state: any,
    param: any = {},
): Promise<any[]> {
    const merged = {
        ...param,
        filter: mergeFilter(
            mergeFilter(param.filter, { status: "visible" }), // 强制,不可被 query 覆盖
            await policy.viewFilter(state),
        ),
    };
    const rows = (await model.read(merged)) || [];
    // 把翻页元信息回填给调用方(dyapi 把 total/pages 写回 param 对象)。
    param.total = merged.total;
    param.pages = merged.pages;

    const out: any[] = [];
    for (const row of rows) {
        const shaped = applyVisibility(row, await policy.canView(state, row));
        if (shaped) out.push(shaped);
    }
    return out;
}

/**
 * 单条公开读:命中返回整形后的行,不可见返回 `null`(调用方给 404 —— 不是 403,不泄露存在性)。
 */
export async function readPublicOne(
    model: any,
    state: any,
    param: any = {},
): Promise<{ row: any; visibility: Visibility } | null> {
    const rows = (await model.read({
        ...param,
        filter: mergeFilter(param.filter, { status: "visible" }),
    })) || [];
    const row = rows[0];
    if (!row) return null;
    const visibility = await policy.canView(state, row);
    const shaped = applyVisibility(row, visibility);
    return shaped ? { row: shaped, visibility } : null;
}

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
