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
        F.String("password").processor(this._app.settings.passwordHash),
        F.String("role").default("admin"),
        F.Date("lastontime"),
    ];
    permission = {
        "PUBLIC": "RO",
        "DEFAULT": "R,U",
        "admin": "R,U",
        "super_admin": "C,R,U,D"
    };

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
