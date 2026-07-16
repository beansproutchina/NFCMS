import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { CRUD, PopTarget, Inject } from "dyapi/utils/decorators.js";
import testContainer from "../containers/testContainer.js";

/**
 * Menu Model covering nested items natively with JSON array
 */
@CRUD("menus")
export default class MenuModel extends Model {
    @Inject(testContainer) declare container;
    tablename = "menus";
    datafields = [
        F.String("name").notNull(),
        F.String("location"), // e.g. 'header', 'footer'
        F.Object("items"),    // Store deeply nested items here
    ];
    permission = {
        "PUBLIC": "R",
        "DEFAULT": "R",
        "super_admin": "C,R,U,D"
    };
    async HTTPUpdate(state, query, body) {
        state.settingsOverrides.maxLimit = 9999;
        return await super.HTTPUpdate(state, query, body);
    }
}
