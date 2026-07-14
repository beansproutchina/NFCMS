import { ControllerRoute, Route, Inject, ValidateBody } from "dyapi/utils/decorators.js";
import { Controller } from "dyapi/core/controller.js";
import UserModel from "../models/UserModel.js";
import { newJwt } from "dyapi/utils/jwt.js";

@ControllerRoute("user")
export default class UserController extends Controller {
    @Inject(UserModel) userModel;

    @Route("post", "/login")
    @ValidateBody({
        type: "object",
        properties: { username: { type: "string" }, password: { type: "string" } },
        required: ["username", "password"]
    })
    async login(ctx) {
        const { username, password } = ctx.request.body;
        const user = (await this.userModel.read({ filter: { username, password: this._app.settings.passwordHash(password) } }))[0];
        if (user) {
            let j = newJwt({
                id: user.id,
                username: user.username,
                role: user.role
            }, this._app);
            ctx.cookies.set("token", j, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
            return { code: 200, message: "Login successful", data: { username: user.username, role: user.role } };
        }else{
            return { code: 401, message: "Invalid username or password" };
        }
    }
}