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
        F.Number("weight").default(50),
    ];
    permission = {
        "PUBLIC": "",
        "DEFAULT": "",
        "super_admin": "C,R,U,D"
    };
}
