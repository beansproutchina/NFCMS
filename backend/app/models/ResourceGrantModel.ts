import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { CRUD, PopTarget, Inject } from "dyapi/utils/decorators.js";
import testContainer from "../containers/testContainer.js";

/**
 * Resource-level ACL / sharing: grant a specific content row to a user or role.
 * access: capability letters the grantee gets on that row, e.g. "R" or "R,U".
 */
@CRUD("resource_grants")
@PopTarget("uid")
export default class ResourceGrantModel extends Model {
    @Inject(testContainer) declare container;
    tablename = "resource_grants";
    datafields = [
        F.String("model").notNull(),        // target tablename
        F.Number("resource_id").notNull(),  // target row id
        F.String("grantee_type").notNull(), // "user" | "role"
        F.Number("grantee_id").notNull(),
        F.String("access").notNull(),       // e.g. "R" or "R,U"
        F.Number("granted_by"),
        F.Date("created_at"),
    ];
    permission = {
        "PUBLIC": "",
        "DEFAULT": "",
        "super_admin": "C,R,U,D"
    };

    // Admin lists fetch all grants for a role/resource in one page — lift the default cap.
    async HTTPReadMany(state, query, body) {
        state.settingsOverrides.maxLimit = 9999;
        return await super.HTTPReadMany(state, query, body);
    }
}
