/**
 * 受众轴的**前端展示**辅助:选项表、"继承结果"的人类可读描述。
 *
 * 这里**不实现继承规则** —— 规则的唯一真相在后端 `app/lib/audience.ts`,其计算结果由分类接口
 * 以 `audience_eff` / `teaser_eff` / `access_eff` / `audience_from` / `teaser_from` 下发
 * (见 `AudienceService.annotateCategories`)。前端只负责把它说成人话。
 */
import type { Composer } from 'vue-i18n';

/**
 * "继承"在下拉里的哨兵值。**不能用空串**:PrimeVue 的 Select 用 `isNotEmpty(modelValue)` 判断
 * 有没有选中,而 `isNotEmpty('')` 是 false —— 于是空串选项永远显示成 placeholder,看起来像"没有
 * 默认值"。`0`/`-1` 不受影响(所以 parent_id 的 "None (Root)" = 0 一直是好的)。
 * 存库仍是 `''`(audience)/`-1`(teaser),由权限面板在提交时映射回去。
 */
export const INHERIT = '__inherit__';

/** 分类编辑器用:三级受众,没有"继承"项(分类自己必须表态,继承体现在有效值里)。 */
export function categoryAudienceOptions(t: Composer['t']) {
    return [
        { label: t('access.tierPublic'), value: 'public' },
        { label: t('access.tierAuthenticated'), value: 'authenticated' },
        { label: t('access.tierRestricted'), value: 'restricted' },
    ];
}


// ── 受众档位:按分类的有效受众禁用"更宽松"的档 ──────────────────────────

/** 严格性序号,与后端 `app/lib/audience.ts` 的 AUDIENCE_SEVERITY 对应。 */
const SEVERITY: Record<string, number> = { public: 0, authenticated: 1, restricted: 2 };

export interface AudienceTier {
    label: string;
    value: string;
    /** 比分类更宽松 → 选了也不会生效,所以直接禁用。 */
    disabled: boolean;
    /** 禁用原因(tooltip),仅 disabled 时有值。 */
    reason?: string;
}

/**
 * 文章侧的四个档位,并把**比分类更宽松**的置灰。
 *
 * 为什么禁用而不是"允许选 + 警告":后端沿父链**取最严**,分类是「仅指定的人可见」时文章选
 * 「所有人」根本不会生效 —— 存进库了,判定时被父链压回去。一个点了没反应的选项比一句警告更糟。
 * 详见 docs/editor-access-panel.md §7.1。
 *
 * `categoryEff` 传分类的 `audience_eff`(后端算好下发的),缺省按 public 处理(不禁任何档)。
 */
export function articleAudienceTiers(
    t: Composer['t'],
    categoryEff: string | undefined,
    categoryName?: string,
): AudienceTier[] {
    const floor = SEVERITY[categoryEff || 'public'] ?? 0;
    const reason = t('access.tooLooseHint', {
        name: categoryName || t('access.thisCategory'),
        level: t(AUDIENCE_LABEL_KEY[categoryEff || 'public'] ?? 'access.tierPublic'),
    });
    const tier = (value: string, label: string): AudienceTier => {
        const disabled = (SEVERITY[value] ?? 0) < floor;
        return { label, value, disabled, ...(disabled ? { reason } : {}) };
    };
    return [
        // 「跟随分类」永不禁用 —— 它恰恰是受限分类下的自然选择。
        { label: t('access.tierInherit'), value: INHERIT, disabled: false },
        tier('public', t('access.tierPublic')),
        tier('authenticated', t('access.tierAuthenticated')),
        tier('restricted', t('access.tierRestricted')),
    ];
}

/**
 * 分类当前生效的受众状态,**任何时候都要标出来**(包括「所有人可见」)。
 *
 * 只在受限时才显示会让作者猜:看到「跟随分类的设置」而下面什么都没写,他无法判断这是"分类是公开的"
 * 还是"这行信息没加载出来"。永远标 = 永远不用猜。
 *
 * 例:`分类当前:所有人可见` / `分类当前:仅我指定的人 · 完全隐藏(继承自「内部资料」)`
 */
export function categoryStateText(t: Composer['t'], cat: any): string {
    const eff = cat?.audience_eff || 'public';
    const parts = [t(AUDIENCE_LABEL_KEY[eff] ?? 'access.tierPublic')];
    // teaser 只在受限时有意义 —— public 下说"完全隐藏"是胡话。
    if (eff !== 'public') parts.push(cat?.teaser_eff === 1 ? t('access.teaserOn') : t('access.teaserOff'));
    let text = t('access.categoryNow', { level: parts.join(' · ') });
    const from = cat?.audience_from?.name || cat?.teaser_from?.name;
    if (from) text += t('access.inheritedSuffix', { name: from });
    return text;
}

/**
 * 分类链是否已经把「完全隐藏」钉死 —— 钉死了,文章再勾「公开摘要」也不会生效。
 *
 * 后端规则:`teaser` 在**所有施加了限制的层级**之间取**最小值**(0 更严),所以文章只能把摘要墙
 * 关得更严,**不能放宽**。分类链有非 public 层且其 `teaser_eff===0` 时,文章的 1 会被压回 0。
 * 见 docs/public-access.md §3 的继承规则。
 */
export function isTeaserLockedByCategory(cat: any): boolean {
    return (cat?.audience_eff || 'public') !== 'public' && Number(cat?.teaser_eff) !== 1;
}

// ── 人员权限档位:一份名单,每人一档 ────────────────────────────────────

/** 档位 → 存库的 access 字符串。顺序即下拉顺序(由松到紧)。 */
export const PERM_TIERS = [
    { key: 'view', access: 'V' },
    { key: 'edit', access: 'V,R,U' },
    { key: 'manage', access: 'V,R,U,D,publish' },
] as const;

export type PermTierKey = (typeof PERM_TIERS)[number]['key'] | 'custom';

/** 不匹配任何档位的存量数据用这个值占位(下拉里禁用,选不中)。 */
export const PERM_CUSTOM = 'custom';

const normAccess = (access: string) =>
    String(access || '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .sort()
        .join(',');

/** access 字符串 → 档位 key;不匹配返回 `'custom'`。 */
export function permTierOf(access: string): PermTierKey {
    const n = normAccess(access);
    for (const tp of PERM_TIERS) if (normAccess(tp.access) === n) return tp.key;
    return PERM_CUSTOM;
}

/** 档位 key → access 字符串。`custom` 无对应值(不允许选中),返回 null。 */
export function accessOfPermTier(key: string): string | null {
    return PERM_TIERS.find((tp) => tp.key === key)?.access ?? null;
}

export function permTierOptions(t: Composer['t'], currentAccess?: string) {
    const opts: { label: string; value: string; disabled?: boolean }[] = PERM_TIERS.map((tp) => ({
        label: t(`access.perm_${tp.key}`),
        value: tp.key,
    }));
    // 存量的非标准组合:补一个**禁用**的「自定义」项,好让下拉能显示当前值而不是空白。
    // 选不中它 = 用户一旦改就只能改成标准档,这是可预期的;不改就永远不写库。
    if (currentAccess && permTierOf(currentAccess) === PERM_CUSTOM) {
        opts.push({ label: t('access.perm_custom'), value: PERM_CUSTOM, disabled: true });
    }
    return opts;
}

/** 动作字母 → 人话,用于给「自定义」行说明它实际含什么。 */
const ACTION_LABEL_KEY: Record<string, string> = {
    V: 'access.act_view',
    R: 'access.act_read',
    U: 'access.act_update',
    D: 'access.act_delete',
    publish: 'access.act_publish',
};

/** 把 access 字符串说成人话:`"R,U,D"` → "可读取、可修改、可删除"。 */
export function describeAccess(t: Composer['t'], access: string): string {
    const parts = String(access || '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .map((a) => (ACTION_LABEL_KEY[a] ? t(ACTION_LABEL_KEY[a]) : a));
    return parts.join('、');
}

const AUDIENCE_LABEL_KEY: Record<string, string> = {
    public: 'access.tierPublic',
    authenticated: 'access.tierAuthenticated',
    restricted: 'access.tierRestricted',
};

/**
 * 把后端下发的继承结果说成一句话,例如:
 *   "有效:仅被授权的用户/角色 · 公开摘要(受众继承自「内部资料」)"
 *
 * `cat` 是带 annotate 字段的分类行。缺字段(老接口/未 annotate)时返回空串,调用方据此不显示。
 */
export function effectiveAudienceText(t: Composer['t'], cat: any): string {
    if (!cat?.audience_eff) return '';
    const parts = [t(AUDIENCE_LABEL_KEY[cat.audience_eff] ?? 'access.tierPublic')];
    if (cat.audience_eff !== 'public') {
        parts.push(cat.teaser_eff === 1 ? t('access.teaserOn') : t('access.teaserOff'));
    }
    let text = `${t('access.effective')}: ${parts.join(' · ')}`;

    // 只有"祖先决定"才值得点名 —— 自身决定时后端给的是 null。
    const from: string[] = [];
    if (cat.audience_from?.name) from.push(t('access.fromAudience', { name: cat.audience_from.name }));
    if (cat.teaser_from?.name && cat.teaser_from.id !== cat.audience_from?.id) {
        from.push(t('access.fromTeaser', { name: cat.teaser_from.name }));
    }
    if (from.length) text += `(${from.join('、')})`;
    return text;
}
