import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { CRUD, Inject } from "dyapi/utils/decorators.js";
import testContainer from "../containers/testContainer.js";

/**
 * Additional roles for a user (beyond their primary users.role which rides in the JWT).
 * A user's effective roles = primary JWT role ∪ roles listed here.
 */
@CRUD("user_roles")
export default class UserRoleModel extends Model {
    @Inject(testContainer) declare container;
    tablename = "user_roles";
    datafields = [
        F.Number("user_id").notNull(),
        F.Number("role_id").notNull(),
    ];
    permission = {
        "PUBLIC": "",
        "DEFAULT": "",
        "super_admin": "C,R,U,D"
    };

    async HTTPReadMany(state, query, body) {
        state.settingsOverrides.maxLimit = 9999;
        return await super.HTTPReadMany(state, query, body);
    }
}
