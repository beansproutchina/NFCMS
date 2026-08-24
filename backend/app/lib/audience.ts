/**
 * 受众轴(公开站门禁)的全部**纯函数**。零依赖、可单测——判定规则的唯一出处。
 *
 * 与 RBAC 管辖轴的关系:两根正交的轴。管辖轴(PolicyService.can/scopeFilter)回答"登录用户
 * 能改什么";受众轴回答"访客能看什么"。设计详见 docs/public-access.md。
 *
 * 作者侧是两个正交字段(audience + teaser),派生侧物化成单个枚举 access_eff —— 因为公开列表
 * 查询只需要单字段 $in。
 */

/** 作者声明的受众级别。严格性 public < authenticated < restricted。 */
export type Audience = "public" | "authenticated" | "restricted";

/** 物化的派生值,写入 articles.access_eff(受 lifecycleFields 保护,不可经普通 CRUD 写)。 */
export type AccessEff =
    | "public"              // 匿名可见全文
    | "auth"                // 需登录;未登录时列表不出现、详情 404
    | "auth_teaser"         // 需登录;未登录时列表出摘要卡片、详情 200 + 引导
    | "restricted"          // 需 V 授权;无授权时列表不出现、详情 404
    | "restricted_teaser";  // 需 V 授权;无授权时列表出摘要卡片、详情 200 + 引导

/** 单条内容对当前访客的可见性。 */
export type Visibility =
    | "full"     // 全文
    | "locked"   // 摘要可见、正文剥离(teaser)
    | "hidden";  // 完全不可见 —— 列表不出现,详情 404(不是 403,不泄露存在性)

export const AUDIENCES: Audience[] = ["public", "authenticated", "restricted"];

/** 严格性序号,越大越严。用于沿父链"取最严"。 */
const AUDIENCE_SEVERITY: Record<Audience, number> = {
    public: 0,
    authenticated: 1,
    restricted: 2,
};

/** 未知/脏值一律按最严处理(fail closed)。 */
export function normalizeAudience(v: any): Audience {
    return v === "authenticated" || v === "restricted" ? v : v === "public" ? "public" : "public";
}

/** `-1` 表示"继承",其余非 0 视为 1。 */
export function normalizeTeaser(v: any): 0 | 1 | -1 {
    const n = Number(v);
    if (!Number.isFinite(n)) return -1;
    if (n < 0) return -1;
    return n === 0 ? 0 : 1;
}

/** 一个参与继承的层级:栏目链上的每个栏目,以及(可选的)文章自身覆盖。 */
export interface AudienceLevel {
    /** 未声明(继承)时传 null。 */
    audience: Audience | null;
    /** 未声明(继承)时传 -1。 */
    teaser: 0 | 1 | -1;
}

/**
 * 沿层级链(root → leaf,文章覆盖作为最后一级)求有效受众。
 *
 * **audience 取最严**:子栏目不能比父栏目更宽松。
 *
 * **teaser 只被"真正施加限制"的层级钳制**:teaser 是受限时的修饰符,只在 `audience != public`
 * 的层级上有意义。若把所有层级的 teaser 一律取最小,那么任何 public 父栏目(其 teaser 默认 0)
 * 都会把子栏目显式声明的 teaser=1 清掉 —— 而 public 父栏目根本没有保护任何东西,钳制毫无意义。
 * 因此只在非 public 的层级之间取最小(0 更严)。
 *
 * 例:父 `public,teaser=0` + 子 `restricted,teaser=1` → `restricted_teaser`(子的声明生效)。
 * 例:父 `authenticated,teaser=0` + 子 `restricted,teaser=1` → `restricted`(父已隐身,子无法放宽)。
 */
export function inheritAudience(chain: AudienceLevel[]): { audience: Audience; teaser: 0 | 1 } {
    const { audience, teaser } = inheritAudienceDetailed(chain);
    return { audience, teaser };
}

/**
 * 同 `inheritAudience`,但额外告诉调用方**是链上哪一级决定了最终值**(索引,`null` 表示没有任何
 * 层级施加限制)。
 *
 * 为什么需要:后台要能显示"有效受众:仅被授权者(继承自「内部资料」)"。继承结果不可见的话,作者
 * 面对一个自己设成 public、实际却受限的栏目会完全懵 —— 而"这条规则算出来是什么"只有这里知道,
 * 不能让 UI 自己再实现一遍(那就有第二份真相了,而 teaser 那条例外恰恰是最容易实现错的地方)。
 */
export function inheritAudienceDetailed(chain: AudienceLevel[]): {
    audience: Audience;
    teaser: 0 | 1;
    /** 决定最终 audience 的层级索引;null = 全链都没提高严格性(结果是 public)。 */
    audienceFrom: number | null;
    /** 决定最终 teaser 的层级索引;null = 没有任何非 public 层级(teaser 无意义)。 */
    teaserFrom: number | null;
} {
    let audience: Audience = "public";
    let audienceFrom: number | null = null;
    let teaser: 0 | 1 | null = null; // null = 还没有任何非 public 层级发过言
    let teaserFrom: number | null = null;

    for (let i = 0; i < chain.length; i++) {
        const level = chain[i];
        const lv = level.audience == null ? null : normalizeAudience(level.audience);
        if (lv && AUDIENCE_SEVERITY[lv] > AUDIENCE_SEVERITY[audience]) {
            audience = lv;
            audienceFrom = i;
        }

        // 只有"施加了限制"的层级才对 teaser 有发言权。
        const imposes = lv != null && lv !== "public";
        if (imposes) {
            const t = level.teaser === -1 ? 0 : level.teaser; // 该层未声明 → 按默认 0(隐身)
            if (teaser === null || t < teaser) {
                teaser = t as 0 | 1;
                teaserFrom = i;
            }
        }
    }

    if (audience === "public") return { audience, teaser: 0, audienceFrom, teaserFrom: null };
    return { audience, teaser: (teaser ?? 0) as 0 | 1, audienceFrom, teaserFrom };
}

/** 把有效 (audience, teaser) 合成物化枚举。 */
export function computeAccessEff(audience: Audience, teaser: 0 | 1): AccessEff {
    if (audience === "public") return "public";
    const base = audience === "authenticated" ? "auth" : "restricted";
    return (teaser === 1 ? `${base}_teaser` : base) as AccessEff;
}

/** 链 → access_eff 的一步式便捷函数(AudienceService 写库时用)。 */
export function accessEffFromChain(chain: AudienceLevel[]): AccessEff {
    const { audience, teaser } = inheritAudience(chain);
    return computeAccessEff(audience, teaser);
}

/** `access_eff` 中匿名访客能查到的取值(列表 filter 用;后两者会被剥成 locked)。 */
export const ACCESS_EFF_ANON: AccessEff[] = ["public", "auth_teaser", "restricted_teaser"];

/** 已登录(但无任何 V 授权)访客能查到的取值。 */
export const ACCESS_EFF_AUTHED: AccessEff[] = ["public", "auth", "auth_teaser", "restricted_teaser"];

/**
 * 判定上下文。由 PolicyService 组装 —— 它是唯一读 resource_grants 的地方。
 *
 * `grantedIds` 用字符串集合:`resource_grants.resource_id` 是 Number 而行 id 的类型随容器变化
 * (SQLite 数字自增 / Mongo ObjectID 字符串),现有 aclIds 靠 `==` 松比较兜住。用 Set 就没有
 * 松比较了,所以统一 String() 归一。`grantedCats` 沿用既有的 Number 约定。
 */
export interface ViewContext {
    isAuthed: boolean;
    /** super_admin 或持有 `articles:R any` —— 后台用户预览受限内容天然可行。 */
    unrestricted: boolean;
    /** 栏目级 V 授权,已级联展开到整棵子树。 */
    grantedCats: Set<number>;
    /** 行级 V 授权(单篇文章授权),String() 归一。 */
    grantedIds: Set<string>;
}

/** 只需要 access_eff / category_id / id 三个字段,不要求完整行。 */
export interface ViewRow {
    access_eff?: string | null;
    category_id?: number | string | null;
    id?: any;
}

/**
 * 受众轴的唯一判定函数。列表、详情、(将来的)SSG 必须都调它,否则一定漂移。
 *
 * 未知 access_eff → hidden(fail closed)。
 */
export function resolveVisibility(row: ViewRow, ctx: ViewContext): Visibility {
    if (ctx.unrestricted) return "full";

    const granted =
        (row.category_id != null && ctx.grantedCats.has(Number(row.category_id))) ||
        (row.id != null && ctx.grantedIds.has(String(row.id)));

    switch (row.access_eff) {
        case "public":
            return "full";
        case "auth":
            return ctx.isAuthed || granted ? "full" : "hidden";
        case "auth_teaser":
            return ctx.isAuthed || granted ? "full" : "locked";
        case "restricted":
            return granted ? "full" : "hidden";
        case "restricted_teaser":
            return granted ? "full" : "locked";
        default:
            return "hidden";
    }
}

/** locked 行要剥掉的正文字段。摘要类字段(title/description/thumbnail)保留 —— 那正是 teaser。 */
export const LOCKED_STRIP_FIELDS = ["content", "data"];

/**
 * 把一行按可见性整形:`locked` 剥正文并打显式标记。
 * `locked: true` 必须显式下发 —— 不能让主题去猜"content 为空",那和"真的没写正文"混淆。
 */
export function applyVisibility<T extends Record<string, any>>(row: T, vis: Visibility): T | null {
    if (vis === "hidden") return null;
    if (vis === "full") return row;
    const out: any = { ...row };
    for (const f of LOCKED_STRIP_FIELDS) if (f in out) out[f] = null;
    out.locked = true;
    return out;
}
