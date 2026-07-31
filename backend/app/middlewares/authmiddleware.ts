import { checkJwt } from "dyapi/utils/jwt.js";
import { policy } from "../services/PolicyService.js";

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
            ctx.state.usertype = b.role; // primary role still drives legacy (non-CMSModel) models
        }
        // Expand into effective roles/permissions for RBAC (CMSModel). No-op cost for PUBLIC.
        await policy.resolve(ctx.state);
        /**
         * **附加角色拿到的 super_admin 必须与主角色列的 super_admin 同级。**
         *
         * `usertype` 只有一个值,来自 JWT 里的主角色列,dyapi 的静态 permission map 与 `@Auth()`
         * 都只看它。于是"通过 user_roles 授予 super_admin"的人,在所有非 CMSModel 的表上
         * (users / categories / menus / system_config / RBAC 三张表)都不被当 super —— 同一个
         * 角色因来路不同而权限不同,在用户看来就是 bug(RevisionModel 的注释里记过这个坑)。
         * `state.roles` 是主角色 ∪ 附加角色,以它为准把 usertype 抬上去,一处解决全部遗留路径。
         */
        if (policy.isSuper(ctx.state)) ctx.state.usertype = "super_admin";
        await next();
    };
}