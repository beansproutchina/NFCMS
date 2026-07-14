import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { CRUD, PopTarget, Inject } from "dyapi/utils/decorators.js";
import testContainer from "../containers/testContainer.js";

/**
 * Grants a capability (model + action) to a role, with a row-scope.
 * scope: "any" = unrestricted; "own" = only rows the user owns or was granted (ACL).
 * A role with no matching row here has NO permission for that (model, action).
 */
@CRUD("role_permissions")
@PopTarget("uid")
export default class RolePermissionModel extends Model {
    @Inject(testContainer) declare container;
    tablename = "role_permissions";
    datafields = [
        F.Number("role_id").notNull(),
        F.String("model").notNull(),    // target tablename, e.g. "articles"
        F.String("action").notNull(),   // C / R / U / D / publish / share
        F.String("scope").default("any"), // any | own
    ];
    permission = {
        "PUBLIC": "",
        "DEFAULT": "",
        "super_admin": "C,R,U,D"
    };
}
