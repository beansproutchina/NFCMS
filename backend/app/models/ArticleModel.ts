import { F } from "dyapi/core/datafield.js";
import { CMSModel } from "../lib/CMSModel.js";
import { CRUD, PopTarget, Inject } from "dyapi/utils/decorators.js";
import testContainer from "../containers/testContainer.js";

/**
 * Built-in Core Model for storing Markdown Articles.
 * Access control is governed entirely by RBAC (PolicyService) via CMSModel —
 * hence no static `permission` map. `ownerField` enables "own" row-scoping.
 */
@CRUD("articles")
@PopTarget("uid")
export default class ArticleModel extends CMSModel {
    @Inject(testContainer) declare container;
    tablename = "articles";
    ownerField = "author_id";
    datafields = [
        F.String("title").notNull(),
        F.String("slug").notNull().unique(),
        F.String("author_id"),
        F.String("description"),
        F.String("thumbnail"),
        F.String("content").notNull(),          // MD content
        F.String("content_template"),           // Vue template for article overrides Category
        F.String("status").default("hidden"),   // hidden | scheduled | visible (lifecycle-managed)
        F.Date("publish_at"),                    // scheduled go-live time (only meaningful when status=scheduled)
        F.Number("rev_version").default(0),      // reserved for optimistic locking
        F.Number("is_top").default(0),
        F.Number("category_id").notNull(),
        F.Date("published_at"),
        F.Date("created_at"),
        F.Date("updated_at"),
    ];
    async update(param, item) {
        item.updated_at = new Date();
        console.log(param, item)
        return await super.update(param, item);
    }
}
