import { checkJwt } from "dyapi/utils/jwt.js";

export const authMiddlewareFactory = (app) => {
    return async (ctx, next) => {
        ctx.state.usertype = "PUBLIC";
        let a, b;
        if (app.settings.cookieLogin) {
            if (a = ctx.cookies.get("token")) {
                b = checkJwt(a, app);
            }
        } else {
            if (a = ctx.get("Authorization")) {
                if (a.startsWith("Bearer ")) {
                    a = a.slice(7);
                    b = checkJwt(a, app);
                }
            }
        }
        if (b) {
            ctx.state.user = b;
            ctx.state.usertype = b.role;
        }
        await next();
    };
}