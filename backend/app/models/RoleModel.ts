import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { CRUD, PopTarget, Inject } from "dyapi/utils/decorators.js";
import testContainer from "../containers/testContainer.js";

/**
 * RBAC Role. Managed by super_admin only.
 */
@CRUD("roles")
@PopTarget("uid")
export default class RoleModel extends Model {
    @Inject(testContainer) declare container;
    tablename = "roles";
    datafields = [
        F.String("name").notNull().unique(),   // machine key: super_admin/admin/editor/author
        F.String("label"),
        F.String("description"),
        F.Number("is_system").default(0),       // seeded roles cannot be deleted
    ];
    permission = {
        "PUBLIC": "",
        "DEFAULT": "",
        "super_admin": "C,R,U,D"
    };

    // Config table: allow the admin UI to fetch the whole list in one request.
    async HTTPReadMany(state, query, body) {
        state.settingsOverrides.maxLimit = 9999;
        return await super.HTTPReadMany(state, query, body);
    }
}
