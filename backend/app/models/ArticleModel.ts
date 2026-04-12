import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { CRUD, PopTarget, Inject } from "dyapi/utils/decorators.js";
import testContainer from "../containers/testContainer.js";

/**
 * Built-in Core Model for storing Markdown Articles
 */
@CRUD("articles")
@PopTarget("uid")
export default class ArticleModel extends Model {
    @Inject(testContainer) declare container;
    tablename = "articles";
    datafields = [
        F.String("title").notNull(),
        F.String("slug").notNull().unique(),
        F.String("category_id").default(null), // 关联分类
        F.String("content").notNull(),
        F.String("excerpt"),
        F.String("cover_image"),
        F.String("view_template").default(""), // 内容页Vue模板（覆盖分类设置）
        F.Int("weight").default(50), // 排序权重
        F.Boolean("is_visible").default(true), // 是否显示
        F.Boolean("is_top").default(false), // 是否置顶
        F.String("status").default("draft"),
        F.String("author_id"),
        F.Date("published_at"),
        F.Date("created_at"),
        F.Date("updated_at"),
    ];
    permission = {
        "PUBLIC": "R",
        "DEFAULT": "R,U,C,D",
        "admin": "C,R,U,D"
    };

    async update(param, item) {
        item.updated_at = new Date();
        console.log(param, item)
        return await super.update(param, item);
    }
}
