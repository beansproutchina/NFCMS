import { ControllerRoute, Route, Inject, ValidateBody } from "dyapi/utils/decorators.js";
import { Controller } from "dyapi/core/controller.js";
import UserModel from "../models/UserModel.js";
import { checkJwt, newJwt } from "dyapi/utils/jwt.js";

@ControllerRoute("user")
export default class UserController extends Controller {
    @Inject(UserModel) userModel;

    @Route("post", "/login")
    @ValidateBody({ username: "string", password: "string" })
    async login(ctx) {
        const { username, password } = ctx.request.body;
        const user = (await this.userModel.read({ filter: { username, password: this._app.settings.passwordHash(password) } }))[0];
        if (user) {
            const userInfo = {
                id: user.id,
                username: user.username,
                role: user.role
            }
            let j = newJwt(userInfo, this._app);
            ctx.cookies.set("token", j, { httpOnly: true, maxAge: this._app.settings.jwtExpire });
            return { code: 200, message: "Login successful", data: userInfo };
        }else{
            return { code: 401, message: "Invalid username or password" };
        }
    }

    @Route("post", "/logout")
    async logout(ctx) {
        ctx.cookies.set("token", "", { httpOnly: true, maxAge: 0 });
        return { code: 200, message: "Logout successful" };
    }

    @Route("get", "/loginInfo")
    async loginInfo(ctx) {
        const token = ctx.cookies.get("token");
        if (token) {
            const jwt = checkJwt(token, this._app);
            if (!jwt) {
                return { code: 401, message: "Invalid token or expired" };
            }
            const user = (await this.userModel.read({ id: jwt.id  }))[0];
            if (!user) {
                return { code: 401, message: "Invalid token or expired" };
            }
            let message = "Login info";
            // 自动续期
            if(Number(jwt.exp) - Date.now() < 0.5*this._app.settings.jwtExpire){
                let j = newJwt(jwt, this._app);
                ctx.cookies.set("token", j, { httpOnly: true, maxAge: this._app.settings.jwtExpire });
                message = "Renewed token";
            }
            return { code: 200, message, data: user, exp: jwt.exp };
        } else {
            return { code: 401, message: "Not logged in" };
        }
    }
}