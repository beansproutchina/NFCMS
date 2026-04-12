import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { CRUD, Inject, PopTarget } from "dyapi/utils/decorators.js";
import testContainer from "../containers/testContainer.js";

@CRUD("users")
@PopTarget("uid")
export default class UserModel extends Model{
    @Inject(testContainer) declare container;
    tablename = "users";
    datafields = [
        F.String("username"),
        F.String("password").processor(this._app.settings.passwordHash),
        F.String("role").default("user"),
        F.Date("lastontime"),
    ];
    permission = {
        "PUBLIC": "RO",
        "DEFAULT": "R,U",
        "admin": "C,R,U,D",
    };
    async update(param,item){
        const r = await super.update(param,item);
        console.log("update", param, item);
        return r;
    }
    async HTTPUpdate(state, query, body){
        query.id = state.user?.id;
        return await super.HTTPUpdate(state, query, body);
    }
}