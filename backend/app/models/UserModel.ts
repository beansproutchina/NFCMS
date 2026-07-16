import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { CRUD, Inject, PopTarget } from "dyapi/utils/decorators.js";
import testContainer from "../containers/testContainer.js";

@CRUD("users")
@PopTarget("uid")
@PopTarget("author_id")
export default class UserModel extends Model {
    @Inject(testContainer) declare container;
    tablename = "users";
    datafields = [
        F.String("username"),
        // Hashed explicitly in HTTPCreate/HTTPUpdate (NOT via a field processor, so raw
        // create() during export/import stores an already-hashed value as-is).
        // NEVER readable over HTTP — login uses a raw read that bypasses field perms.
        F.String("password").setPermission("DEFAULT", "w"),
        F.String("nickname"),
        F.String("role").default("admin"),
        F.Date("lastontime"),
    ];
    permission = {
        "PUBLIC": "",
        "DEFAULT": "R,U",
        "admin": "R,U",
        "super_admin": "C,R,U,D"
    };

    async HTTPReadOne(state, query, body) {
        if (state.user?.role !== "super_admin") {
            query.id = state.user?.id;
        }
        return await super.HTTPReadOne(state, query, body);
    }

    // Config/admin table: allow fetching the full list in one request (e.g. share-target picker).
    async HTTPReadMany(state, query, body) {
        state.settingsOverrides.maxLimit = 9999;
        return await super.HTTPReadMany(state, query, body);
    }

    async HTTPUpdate(state, query, body) {
        if (state.user?.role !== "super_admin") {
            query.id = state.user?.id;
            delete body.role; // Prevent escalating privilege
        }
        if (body.password === "" || body.password == null) {
            delete body.password; // leave empty -> keep unchanged
        } else {
            body.password = this._app.settings.passwordHash(body.password);
        }
        return await super.HTTPUpdate(state, query, body);
    }

    async HTTPCreate(state, query, body) {
        if (body.password) body.password = this._app.settings.passwordHash(body.password);
        return await super.HTTPCreate(state, query, body);
    }
}
