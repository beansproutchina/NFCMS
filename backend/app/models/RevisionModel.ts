import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { CRUD, Inject } from "dyapi/utils/decorators.js";
import { assert, ForbiddenError } from "dyapi/utils/error.js";
import testContainer from "../containers/testContainer.js";
import { policy } from "../services/PolicyService.js";

/**
 * Immutable content revision snapshots. Written only via RevisionService (raw create),
 * never through the HTTP CRUD path (no C/U/D granted). Contains unpublished content,
 * so it must never be publicly listable.
 */
@CRUD("revisions")
export default class RevisionModel extends Model {
    @Inject(testContainer) declare container;
    tablename = "revisions";
    datafields = [
        F.String("content_type").notNull(),   // target tablename, e.g. "articles"
        F.String("content_id").notNull(),      // stringified target row id
        F.Number("version_no").notNull(),
        F.Object("data"),                       // full field snapshot
        F.String("author_id"),
        F.String("note"),
        F.String("status_at_snapshot"),
        F.Date("created_at"),
    ];
    /**
     * 静态 map 只管**写**(以及 super_admin 的一切)。读走下面的 RBAC 闸门 —— 所以这里不再有
     * 按角色名硬编码的 `"admin": "R"`。
     */
    permission = {
        "PUBLIC": "",
        "DEFAULT": "",
        "super_admin": "R,D"
    };

    /** 只有**读**走 RBAC(见下面两个重写);写仍然只有 super_admin。权限矩阵据此只列 R。 */
    rbacActions = ["R"];

    /**
     * 读改由 RBAC 决定:配一行 `role_permissions(revisions, R, any)` 即可,不再认角色名。
     *
     * 为什么不沿用 DYAPI 的静态 map:那套 map 匹配的是 `state.usertype`,而 authmiddleware 里
     * `usertype` **只取 JWT 主角色** —— 于是把某角色作为「附加角色」(`user_roles`)授出去时,静态
     * map 完全看不见它。同一个角色因来路不同而权限不同,在用户看来就是 bug。PolicyService 的
     * `state.roles` 是主角色 ∪ 附加角色,没有这个毛病。
     *
     * 刻意不调 `super.HTTPRead*`:那会再跑一遍静态 map 检查(DEFAULT 为空 → 直接 403)。这里照
     * CMSModel 的既有做法自己组装查询,两套机制不重叠。
     */
    async HTTPReadMany(state, query) {
        assert(policy.hasAnyScope(state, "R", this), ForbiddenError, "没有权限");
        state.settingsOverrides.maxLimit = 9999; // 后台版本历史面板一次拉全量
        const param: any = this.processReadQuery(state, query);
        const rows = await this.read(param);
        return { code: 200, data: rows, total: param.total, pages: param.pages };
    }

    async HTTPReadOne(state, query) {
        assert(policy.hasAnyScope(state, "R", this), ForbiddenError, "没有权限");
        const param: any = this.processReadQuery(state, query);
        param.limit = 1;
        param.offset = 0;
        param.page = 0;
        return { code: 200, data: (await this.read(param))[0] };
    }
}
