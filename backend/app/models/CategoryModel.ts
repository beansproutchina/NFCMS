import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { CRUD, PopTarget, Inject } from "dyapi/utils/decorators.js";
import testContainer from "../containers/testContainer.js";

/**
 * Category Model for Category Management
 * Only super_admin can manage Categories.
 */
@CRUD("categories")
@PopTarget("uid")
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
}
