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
        F.String("author_id"),
        F.String("description"),
        F.String("thumbnail"),
        F.String("content").notNull(),          // MD content
        F.String("content_template"),           // Vue template for article overrides Category
        F.Number("visible").default(1),
        F.Number("is_top").default(0),
        F.Number("category_id").notNull(),
        F.Date("published_at"),
        F.Date("created_at"),
        F.Date("updated_at"),
    ];
    permission = {
        "PUBLIC": "R",
        "DEFAULT": "R",
        "admin": "C,R,U,D",
        "super_admin": "C,R,U,D"
    };

    async update(param, item) {
        item.updated_at = new Date();
        console.log(param, item)
        return await super.update(param, item);
    }
}
