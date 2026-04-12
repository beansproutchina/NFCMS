import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { CRUD, PopTarget } from "dyapi/utils/decorators.js";

/**
 * 分类管理：树状结构，支持独立模板渲染
 * 仅 super_admin 可以管理
 */
@CRUD("categories")
@PopTarget("uid")
export default class CategoryModel extends Model {
    tablename = "categories";
    datafields = [
        F.String("name").notNull(),
        F.String("slug").notNull().unique(),
        F.String("parent_id").default(null), // 父级分类ID，实现树状结构
        F.String("list_template").default(""), // 分类列表页Vue模板
        F.String("view_template").default(""), // 分类内容页Vue模板
        F.Int("weight").default(50), // 排序权重
        F.Object("extra_data").default({}), // 其他数据(JSON存储)
    ];
    permission = {
        "PUBLIC": "R",
        "super_admin": "C,R,U,D"
    };
}