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
        F.String("password"),
        F.String("nickname"),
        F.String("role").default("admin"),
        F.Date("lastontime"),
    ];
    permission = {
        "PUBLIC": "RO",
        "DEFAULT": "R,U",
        "admin": "R,U",
        "super_admin": "C,R,U,D"
    };

    async HTTPReadOne(state, query,body) {
        if (state.user?.role !== "super_admin") {
            query.id = state.user?.id;
        }
        return await super.HTTPReadOne(state, query,body);
    }

    async HTTPUpdate(state, query, body) {
        if (state.user?.role !== "super_admin") {
            query.id = state.user?.id;
            delete body.role; // Prevent escalating privilege
        } else {
            // super_admin might leave password empty to not change it
            if (body.password === "") {
                delete body.password;
            } else if (body.password) {
                body.password = this._app.settings.passwordHash(body.password);
            }
        }
        return await super.HTTPUpdate(state, query, body);
    }
    
    async HTTPCreate(state, query, body) {
        body.password=this._app.settings.passwordHash(body.password);
        return await super.HTTPCreate(state, query, body);
    }
}
