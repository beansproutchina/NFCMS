import type { DYApp } from "dyapi/core/dyapiApp.js";
import RoleModel from "../models/RoleModel.js";
import RolePermissionModel from "../models/RolePermissionModel.js";

/**
 * Default RBAC roles. `super_admin` owns no role_permissions rows — it is hard-allowed by
 * PolicyService. `is_system` marks them undeletable in the admin UI.
 */
export const DEFAULT_ROLES = [
    // `is_system: 1` 的含义很窄:**代码真的依赖这个名字**,所以后台 UI 不许删。
    // 全部默认角色里只有 super_admin 满足 —— `policy.isSuper` 硬编码检查它,各模型的静态
    // `permission` 映射里也有它,共 20 处引用。它是基础设施,不是种子。
    { name: "super_admin", label: "Super Admin", is_system: 1 },

    // 以下三个是**开箱起点**,可改名可删除(is_system: 0)。权限行由首次播种落库,之后完全归
    // 站点所有者。**代码里没有任何地方按名字引用它们** —— 曾经有 5 处(见下),已全部去掉:
    //   · RevisionModel / ContentSchemaModel 的 `"admin": "R"` 静态键 → 改成 RBAC 读闸门,
    //     权限变成本文件下方 DEFAULT_ROLE_PERMISSIONS 里的两行数据。
    //   · UserModel 的 `"admin": "R,U"` → 与 DEFAULT 完全重复,是死代码,已删。
    //   · UserModel.role 的字段默认值 `"admin"` → 改成空串(缺省不该给角色)。
    //   · seedDynamicPerms 按名字找 admin → 改成按能力找(`articles:C any`)。
    { name: "admin", label: "Admin", is_system: 0 },
    // editor / author 零运行时耦合:只在 setup 的 demo 数据里被按名字引用一次。
    { name: "editor", label: "Editor", is_system: 0 },
    { name: "author", label: "Author", is_system: 0 },
    // 受众轴的前台会员角色:**故意零 role_permissions**。因为「分类授权 / 行级 ACL 不需要基础
    // 角色权限也能生效」,它只要出现在 `articles_audience` 的 V 授权里就能看受限内容,而后台每个
    // 接口都会拒绝它 —— 不需要"前台用户 vs 后台用户"的二分表。见 docs/public-access.md §2。
    //
    // `is_system: 0`(与上面四个不同):代码里**没有任何地方**依赖 "member" 这个名字,它纯粹是
    // 一个开箱可用的起点。站点想改叫「客户」「师生」「订阅者」都行,想删也行。
    { name: "member", label: "Member", description: "前台会员示例:可被授权访问受限内容,无后台权限", is_system: 0 },
];

/**
 * Default permissions as [role, model, action, scope].
 *
 * NOTE: create ("C") is never granted with scope "own" — whatever you create is yours, so
 * "own C" is meaningless. Blanket create = scope "any"; category-limited create is expressed
 * via category grants (resource_grants, model="articles_category"). editor/author manage their
 * OWN content everywhere; a category grant additionally lets them create & manage ALL articles
 * in a category subtree (see the demo grant seeded in setup).
 */
export const DEFAULT_ROLE_PERMISSIONS = [
    ["admin", "articles", "C", "any"], ["admin", "articles", "R", "any"],
    ["admin", "articles", "U", "any"], ["admin", "articles", "D", "any"],
    ["admin", "articles", "publish", "any"],
    ["editor", "articles", "R", "own"], ["editor", "articles", "U", "own"],
    ["editor", "articles", "D", "own"], ["editor", "articles", "publish", "own"],
    ["author", "articles", "R", "own"], ["author", "articles", "U", "own"],
    // Media library (shared): let content roles manage attachments so the Files page works.
    ["admin", "attachments", "C", "any"], ["admin", "attachments", "R", "any"],
    ["admin", "attachments", "U", "any"], ["admin", "attachments", "D", "any"],
    ["editor", "attachments", "C", "any"], ["editor", "attachments", "R", "any"], ["editor", "attachments", "D", "any"],
    // author 只看自己上传的:`uploader_id` 落地后 `own` 才真的可用(以前属主列不存在,配 own 是静默无效)。
    // 只影响**新建站点** —— 这张表只在 /setup 播种,现有站点的 role_permissions 行不动。
    // 代价说清楚:author 因此看不到别人上传的素材,想复用同事的图就得由 admin 上传或改成 any。
    ["author", "attachments", "C", "any"], ["author", "attachments", "R", "own"],
    // 基础设施表的**读**权限。这两行取代了以前写在模型里的 `"admin": "R"` 静态键 —— 现在是
    // 一行可配置的数据,而不是硬编码的角色名。写入仍只有 super_admin(模型静态 map 里)。
    ["admin", "revisions", "R", "any"],   // 后台的版本历史面板
    ["admin", "schemas", "R", "any"],     // 内容类型列表
];

/**
 * Seed the default roles + permissions. Called from `/system/setup` ONLY — never at boot.
 *
 * Why not at boot: setup can restore an exported site, and that dump carries its own `roles`
 * rows plus `role_permissions`/`user_roles`/`resource_grants` that reference role ids. If boot
 * had already burned ids 1..4, every imported role would land on a fresh id (5..8) — a visible
 * duplicate with no permissions — while the imported permission rows still pointed at the
 * seeded ids. Seeding inside setup keeps the roles table empty until setup decides what goes
 * in it, so imported ids stay intact.
 *
 * Idempotent: does nothing if any role already exists (e.g. an import brought its own).
 * Returns true when it seeded.
 */
export async function seedDefaultRbac(app: DYApp): Promise<boolean> {
    const roleModel = app.I(RoleModel);
    const rpModel = app.I(RolePermissionModel);
    if ((await roleModel.read({})).length > 0) return false;

    const idByName: Record<string, any> = {};
    for (const r of DEFAULT_ROLES) idByName[r.name] = await roleModel.create(r);

    for (const [role, model, action, scope] of DEFAULT_ROLE_PERMISSIONS) {
        await rpModel.create({ role_id: idByName[role], model, action, scope });
    }
    console.log("[RBAC] seeded default roles and permissions");
    return true;
}

/**
 * 注意:**没有**"按 name 补齐系统角色"的 boot 时逻辑,这是刻意的。
 *
 * 播种只发生在 setup 那一次,之后 `roles` 表就完全归站点所有者:改名、删除、新建都是他的事。
 * 如果 boot 每次都按 name 把 DEFAULT_ROLES 补回去,就变成了「框架和用户抢同一张表」——
 * 删掉的角色会复活,而每个新版本新增的角色名都会静默改写所有已有站点的数据。
 *
 * 后续版本要新增角色时:只加进 DEFAULT_ROLES(影响新站点),已有站点由所有者在「角色与权限」页
 * 自己建,名字按自己站点的语义取。这不会缺功能,因为**除 `super_admin` 外没有任何角色名被代码
 * 依赖** —— 授权(含受众轴的 `V`)一律按 role id 落在 `resource_grants` 上,不认名字。
 */
