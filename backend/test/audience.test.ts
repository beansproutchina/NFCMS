import { test, expect, describe } from "bun:test";
import {
    inheritAudience,
    inheritAudienceDetailed,
    computeAccessEff,
    accessEffFromChain,
    resolveVisibility,
    applyVisibility,
    normalizeTeaser,
    ACCESS_EFF_ANON,
    ACCESS_EFF_AUTHED,
    type AudienceLevel,
    type ViewContext,
    type AccessEff,
} from "../app/lib/audience.js";

// ── 继承:audience 取最严 ──────────────────────────────────────────────
describe("inheritAudience —— audience 沿父链取最严", () => {
    const L = (audience: any, teaser: any = -1): AudienceLevel => ({ audience, teaser });

    test("空链 → public", () => {
        expect(inheritAudience([])).toEqual({ audience: "public", teaser: 0 });
    });

    test("全 public → public", () => {
        expect(inheritAudience([L("public"), L("public")]).audience).toBe("public");
    });

    test("子栏目不能比父栏目更宽松:父 restricted + 子 public → restricted", () => {
        expect(inheritAudience([L("restricted"), L("public")]).audience).toBe("restricted");
    });

    test("子栏目可以更严:父 public + 子 restricted → restricted", () => {
        expect(inheritAudience([L("public"), L("restricted")]).audience).toBe("restricted");
    });

    test("继承层(null)不影响:父 authenticated + 子未声明 → authenticated", () => {
        expect(inheritAudience([L("authenticated"), L(null)]).audience).toBe("authenticated");
    });

    test("脏值按 public 处理,不会意外放宽更严的祖先", () => {
        expect(inheritAudience([L("restricted"), L("garbage" as any)]).audience).toBe("restricted");
    });
});

// ── 继承:teaser 只被"真正施加限制"的层级钳制 ──────────────────────────
describe("inheritAudience —— teaser 只由非 public 层级决定", () => {
    const L = (audience: any, teaser: any = -1): AudienceLevel => ({ audience, teaser });

    test("关键用例:public 父(teaser=0 默认)不该清掉 restricted 子的 teaser=1", () => {
        // 若把所有层级的 teaser 一律取最小,这里会错成 restricted —— 而 public 父栏目
        // 根本没保护任何东西,钳制毫无意义。
        expect(accessEffFromChain([L("public", 0), L("restricted", 1)])).toBe("restricted_teaser");
    });

    test("非 public 父声明 teaser=0 时,子的 teaser=1 无效(父已隐身,子不能放宽)", () => {
        expect(accessEffFromChain([L("authenticated", 0), L("restricted", 1)])).toBe("restricted");
    });

    test("非 public 父声明 teaser=1,子未声明 → 子按默认 0 钳制成隐身", () => {
        expect(accessEffFromChain([L("authenticated", 1), L("restricted", -1)])).toBe("restricted");
    });

    test("只有叶子受限且声明 teaser=1 → teaser 生效", () => {
        expect(accessEffFromChain([L(null), L("authenticated", 1)])).toBe("auth_teaser");
    });

    test("audience 落在 public 时 teaser 一律归 0(无意义)", () => {
        expect(inheritAudience([L("public", 1)])).toEqual({ audience: "public", teaser: 0 });
    });
});

// ── 继承来源(后台要显示"继承自谁") ────────────────────────────────
describe("inheritAudienceDetailed —— 指出是哪一级决定了最终值", () => {
    const L = (audience: any, teaser: any = -1): AudienceLevel => ({ audience, teaser });

    test("全 public → 没有任何层级施加限制", () => {
        const r = inheritAudienceDetailed([L("public"), L("public")]);
        expect(r.audienceFrom).toBeNull();
        expect(r.teaserFrom).toBeNull();
    });

    test("父施加限制、子未声明 → 指向父(索引 0)", () => {
        const r = inheritAudienceDetailed([L("restricted", 1), L(null)]);
        expect(r.audience).toBe("restricted");
        expect(r.audienceFrom).toBe(0);
        expect(r.teaserFrom).toBe(0);
    });

    test("子比父更严 → 指向子(索引 1)", () => {
        const r = inheritAudienceDetailed([L("authenticated", 1), L("restricted", 1)]);
        expect(r.audience).toBe("restricted");
        expect(r.audienceFrom).toBe(1);
    });

    test("audience 来自子、teaser 被父钳制 → 两个来源可以不同", () => {
        const r = inheritAudienceDetailed([L("authenticated", 0), L("restricted", 1)]);
        expect(r.audience).toBe("restricted");
        expect(r.audienceFrom).toBe(1);   // 严格性由子决定
        expect(r.teaser).toBe(0);
        expect(r.teaserFrom).toBe(0);     // 但摘要墙被父关掉了
    });

    test("public 父不参与 teaser 钳制,来源指向子", () => {
        const r = inheritAudienceDetailed([L("public", 0), L("restricted", 1)]);
        expect(r.teaser).toBe(1);
        expect(r.teaserFrom).toBe(1);
    });

    test("与 inheritAudience 的结果始终一致", () => {
        const chains = [
            [L("public")], [L("restricted", 1)], [L("authenticated", 0), L("restricted", 1)],
            [L("public", 0), L("restricted", 1)], [L(null), L(null)],
        ];
        for (const c of chains) {
            const a = inheritAudience(c); const b = inheritAudienceDetailed(c);
            expect({ audience: b.audience, teaser: b.teaser }).toEqual(a);
        }
    });
});

// ── 物化枚举 ────────────────────────────────────────────────────────
describe("computeAccessEff", () => {
    test("五种组合映射", () => {
        expect(computeAccessEff("public", 0)).toBe("public");
        expect(computeAccessEff("public", 1)).toBe("public");
        expect(computeAccessEff("authenticated", 0)).toBe("auth");
        expect(computeAccessEff("authenticated", 1)).toBe("auth_teaser");
        expect(computeAccessEff("restricted", 0)).toBe("restricted");
        expect(computeAccessEff("restricted", 1)).toBe("restricted_teaser");
    });
});

describe("normalizeTeaser", () => {
    test("-1/负数/非数 → -1(继承);0 → 0;其余 → 1", () => {
        expect(normalizeTeaser(-1)).toBe(-1);
        expect(normalizeTeaser(undefined)).toBe(-1);
        expect(normalizeTeaser("abc")).toBe(-1);
        expect(normalizeTeaser(0)).toBe(0);
        expect(normalizeTeaser("0")).toBe(0);
        expect(normalizeTeaser(1)).toBe(1);
        expect(normalizeTeaser(7)).toBe(1);
    });
});

// ── 判定矩阵:5 种 access_eff × 4 种身份 ────────────────────────────────
describe("resolveVisibility —— docs/public-access.md §4 的判定矩阵", () => {
    const ctx = (over: Partial<ViewContext> = {}): ViewContext => ({
        isAuthed: false,
        unrestricted: false,
        grantedCats: new Set<number>(),
        grantedIds: new Set<string>(),
        ...over,
    });

    const ANON = ctx();
    const AUTHED = ctx({ isAuthed: true });
    const GRANTED_CAT = ctx({ isAuthed: true, grantedCats: new Set([7]) });
    const UNRESTRICTED = ctx({ isAuthed: true, unrestricted: true });

    const row = (access_eff: AccessEff) => ({ access_eff, category_id: 7, id: 42 });

    const MATRIX: Array<[AccessEff, string, string, string, string]> = [
        //  access_eff             匿名        登录        有 V 授权    unrestricted
        ["public", "full", "full", "full", "full"],
        ["auth", "hidden", "full", "full", "full"],
        ["auth_teaser", "locked", "full", "full", "full"],
        ["restricted", "hidden", "hidden", "full", "full"],
        ["restricted_teaser", "locked", "locked", "full", "full"],
    ];

    for (const [eff, anon, authed, granted, unres] of MATRIX) {
        test(`${eff}: 匿名=${anon} 登录=${authed} 授权=${granted} unrestricted=${unres}`, () => {
            expect(resolveVisibility(row(eff), ANON)).toBe(anon);
            expect(resolveVisibility(row(eff), AUTHED)).toBe(authed);
            expect(resolveVisibility(row(eff), GRANTED_CAT)).toBe(granted);
            expect(resolveVisibility(row(eff), UNRESTRICTED)).toBe(unres);
        });
    }

    test("未知 access_eff → hidden(fail closed)", () => {
        expect(resolveVisibility({ access_eff: "members_only", category_id: 7, id: 1 }, ANON)).toBe("hidden");
        expect(resolveVisibility({ access_eff: null, category_id: 7, id: 1 }, AUTHED)).toBe("hidden");
        expect(resolveVisibility({}, AUTHED)).toBe("hidden");
    });

    test("行级 V 授权:单篇文章授权无需栏目授权即可放行", () => {
        const rowLevel = ctx({ isAuthed: true, grantedIds: new Set(["42"]) });
        expect(resolveVisibility(row("restricted"), rowLevel)).toBe("full");
        // 未被授权的另一篇仍然 hidden
        expect(resolveVisibility({ access_eff: "restricted", category_id: 7, id: 43 }, rowLevel)).toBe("hidden");
    });

    test("行级授权做 String 归一:id 是数字、grant 存字符串也能命中", () => {
        const c = ctx({ isAuthed: true, grantedIds: new Set(["42"]) });
        expect(resolveVisibility({ access_eff: "restricted", id: 42 }, c)).toBe("full");
        expect(resolveVisibility({ access_eff: "restricted", id: "42" }, c)).toBe("full");
    });

    test("栏目授权不误伤其它栏目", () => {
        const c = ctx({ isAuthed: true, grantedCats: new Set([7]) });
        expect(resolveVisibility({ access_eff: "restricted", category_id: 8, id: 1 }, c)).toBe("hidden");
    });

    test("category_id 为空的行不会误命中栏目授权", () => {
        const c = ctx({ isAuthed: true, grantedCats: new Set([7]) });
        expect(resolveVisibility({ access_eff: "restricted", category_id: null, id: 1 }, c)).toBe("hidden");
    });
});

// ── filter 常量与矩阵必须一致 ────────────────────────────────────────
describe("ACCESS_EFF_* 常量与判定矩阵自洽", () => {
    const ctx = (over: Partial<ViewContext> = {}): ViewContext => ({
        isAuthed: false, unrestricted: false,
        grantedCats: new Set<number>(), grantedIds: new Set<string>(), ...over,
    });
    const ALL: AccessEff[] = ["public", "auth", "auth_teaser", "restricted", "restricted_teaser"];

    test("匿名 filter 放行的集合 = 判定结果非 hidden 的集合", () => {
        const nonHidden = ALL.filter((e) => resolveVisibility({ access_eff: e, category_id: 1, id: 1 }, ctx()) !== "hidden");
        expect(new Set(ACCESS_EFF_ANON)).toEqual(new Set(nonHidden));
    });

    test("登录 filter 放行的集合 = 判定结果非 hidden 的集合", () => {
        const c = ctx({ isAuthed: true });
        const nonHidden = ALL.filter((e) => resolveVisibility({ access_eff: e, category_id: 1, id: 1 }, c) !== "hidden");
        expect(new Set(ACCESS_EFF_AUTHED)).toEqual(new Set(nonHidden));
    });
});

// ── 整形 ────────────────────────────────────────────────────────────
describe("applyVisibility", () => {
    const row = { id: 1, title: "T", description: "D", thumbnail: "t.png", content: "# 正文", data: { a: 1 } };

    test("full 原样返回", () => {
        expect(applyVisibility(row, "full")).toBe(row);
    });

    test("hidden → null", () => {
        expect(applyVisibility(row, "hidden")).toBeNull();
    });

    test("locked 剥正文、保留摘要字段、显式打 locked 标记", () => {
        const out: any = applyVisibility(row, "locked");
        expect(out.content).toBeNull();
        expect(out.data).toBeNull();
        expect(out.locked).toBe(true);
        expect(out.title).toBe("T");
        expect(out.description).toBe("D");
        expect(out.thumbnail).toBe("t.png");
    });

    test("locked 不改动原对象", () => {
        applyVisibility(row, "locked");
        expect(row.content).toBe("# 正文");
        expect((row as any).locked).toBeUndefined();
    });
});
