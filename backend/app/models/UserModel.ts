import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { CRUD, Inject, PopTarget } from "dyapi/utils/decorators.js";
import testContainer from "../containers/testContainer.js";

@CRUD("users")
@PopTarget("uid")
export default class UserModel extends Model {
    @Inject(testContainer) declare container;
    tablename = "users";
    datafields = [
        F.String("username"),
        // Writable (create/update) but NEVER readable over HTTP — login uses a raw read that bypasses field perms.
        F.String("password").processor(this._app.settings.passwordHash).setPermission("DEFAULT", "w"),
        F.String("role").default("admin"),
        F.Date("lastontime"),
    ];
    permission = {
        "PUBLIC": "",
        "DEFAULT": "R,U",
        "admin": "R,U",
        "super_admin": "C,R,U,D"
    };

    // Config/admin table: allow fetching the full list in one request (e.g. share-target picker).
    async HTTPReadMany(state, query, body) {
        state.settingsOverrides.maxLimit = 9999;
        return await super.HTTPReadMany(state, query, body);
    }

    async HTTPRead(state, query) {
        if (state.user?.role !== "super_admin") {
            query.id = state.user?.id;
        }
        return await super.HTTPRead(state, query);
    }

    async HTTPUpdate(state, query, body) {
        if (state.user?.role !== "super_admin") {
            query.id = state.user?.id;
            delete body.role; // Prevent escalating privilege
        } else {
            // super_admin might leave password empty to not change it
            if (body.password === "") {
                delete body.password;
            }
        }
        return await super.HTTPUpdate(state, query, body);
    }
    
    async HTTPCreate(state, query, body) {
        return await super.HTTPCreate(state, query, body);
    }
}
