import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { CRUD, PopTarget, Inject } from "dyapi/utils/decorators.js";
import { ForbiddenError } from "dyapi/utils/error.js";
import testContainer from "../containers/testContainer.js";
import { getBreadcrumbs, getChildren } from "../utils/contentHelpers.js";

/**
 * Category Model for Category Management
 * Only super_admin can manage Categories.
 */
@CRUD("categories")
export default class CategoryModel extends Model {
    @Inject(testContainer) declare container;

    tablename = "categories";
    datafields = [
        F.String("name").notNull(),
        F.String("slug").notNull().unique(),
        F.Number("parent_id").default(0),
        F.String("list_template"), // Vue template for the list page (leave empty to not render)
        F.String("content_template"), // Vue template for the individual category content
        F.Number("weight").default(50),  // Order
        F.Object("article_data_fields"),
        F.Object("data"),             // Additional JSON data
    ];
    permission = {
        "PUBLIC": "R",
        "DEFAULT": "R",
        "super_admin": "C,R,U,D"
    };

    async update(param, item) {
        return await super.update(param, item);
    }

    /**
     * 处理单条分类详情，添加关联数据
     */
    async enrichCategoryData(category: any) {
        // 如果 list_template 为空，则不支持列表页渲染
        if (!category.list_template || category.list_template.trim() === "") {
            throw new ForbiddenError("This category does not support list view.");
        }

        // 获取面包屑、子分类和文章列表
        const breadcrumbs = await getBreadcrumbs(category.id, this);
        const children = await getChildren(category.id, this);

        return {
            ...category,
            children,
            breadcrumbs,
        };
    }

    /**
     * 重写 HTTPReadOne，支持 {slug} 格式查询
     */
    // @ts-ignore - 重写基类方法以支持 slug 查询
    async HTTPReadOne(state, query, body) {
        // 如果 id 是 {slug} 格式，提取 slug 并转为 filter 查询
        if (query.id !== undefined && typeof query.id === 'string' && query.id.startsWith('{') && query.id.endsWith('}')) {
            const slug = query.id.slice(1, -1); // 去掉首尾大括号
            query.filter = { slug };
            delete query.id;
        }

        const originalResult = await super.HTTPReadOne(state, query, body);

        // 组装完整内容数据
        const enrichedData = await this.enrichCategoryData(originalResult.data);

        return {
            code: 200,
            data: enrichedData
        };
    }
}
