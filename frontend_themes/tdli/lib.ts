/**
 * tdli 主题的共享逻辑 —— URL 拼装、日期格式、列表分页、中英文案。
 *
 * 中英是**两棵独立的内容树**:英文分类/文章的 slug 带 `en-` 前缀(slug 全局唯一,必须区分),
 * 而对外 URL 里不该出现两次 "en"。所以前缀只活在数据层,由这里的 `stripEn` / theme.config
 * 的 `en-${params.x}` 两头对消,URL 就是干净的 `/en/a/posts/xxx`。
 */

import { ref, computed } from 'vue';

export type Locale = 'zh' | 'en';

/** 英文侧 slug 的数据层前缀。URL 里不出现,只在查库时补上。 */
export const EN_PREFIX = 'en-';

export const stripEn = (slug: string) => String(slug || '').replace(/^en-/, '');

/** 当前页面语言。英文侧模板由 theme.config 的自定义路由挂载,统一显式传 'en'。 */
export const isEn = (locale?: Locale) => locale === 'en';

/** 文章详情页 URL。分类缺失时退化成无栏目路径,不至于拼出 `/a/undefined/xxx`。 */
export function articleUrl(a: any, locale: Locale = 'zh'): string {
    const base = locale === 'en' ? '/en/a' : '/a';
    const slug = locale === 'en' ? stripEn(a?.slug) : a?.slug;
    const cat = a?.category?.slug ? (locale === 'en' ? stripEn(a.category.slug) : a.category.slug) : '';
    return cat ? `${base}/${cat}/${slug}` : `${base}/${slug}`;
}

/** 栏目列表页 URL。 */
export function categoryUrl(slug: string, locale: Locale = 'zh'): string {
    return locale === 'en' ? `/en/a/${stripEn(slug)}` : `/a/${slug}`;
}

/** 语言切换目标:纯路径变换,不需要中英对照表。对端不存在时由目标页渲染空态。 */
export function switchLocaleUrl(fullPath: string, to: Locale): string {
    const path = fullPath.split('?')[0];
    if (to === 'en') return path === '/' ? '/en' : `/en${path}`;
    return path.replace(/^\/en(?=\/|$)/, '') || '/';
}

/** `2026-08-24`。原站列表与详情页统一这个格式。 */
export function formatDate(s: string): string {
    if (!s) return '';
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 日历块用的「日 / 月」两段。 */
export function dayMonth(s: string): { day: string; month: string } {
    if (!s) return { day: '', month: '' };
    const d = new Date(s);
    if (isNaN(d.getTime())) return { day: '', month: '' };
    const p = (n: number) => String(n).padStart(2, '0');
    return { day: p(d.getDate()), month: `${d.getFullYear()}.${p(d.getMonth() + 1)}` };
}

const WEEK_ZH = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const WEEK_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** 活动时间行:`星期三 2026-08-26 14:00 - 16:00`。缺 end 时只显示起始。 */
export function formatEventTime(start: string, end: string, locale: Locale = 'zh'): string {
    if (!start) return '';
    const s = new Date(start);
    if (isNaN(s.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    const week = (locale === 'en' ? WEEK_EN : WEEK_ZH)[s.getDay()];
    const date = `${s.getFullYear()}-${p(s.getMonth() + 1)}-${p(s.getDate())}`;
    const from = `${p(s.getHours())}:${p(s.getMinutes())}`;
    const e = end ? new Date(end) : null;
    const to = e && !isNaN(e.getTime()) ? ` - ${p(e.getHours())}:${p(e.getMinutes())}` : '';
    return `${week} ${date} ${from}${to}`;
}

/**
 * 目录页的列表 + 分页。
 *
 * **数据源有两个**,由"当前分类有没有子栏目"决定:
 *
 * - 有子栏目 → 这是父栏目的「全部」页,文章挂在子栏目上,按 `data.section` 聚合整棵子树
 * - 没有子栏目 → 文章就挂在它自己身上,按 `category_id` 取
 *
 * 两个 key 都由 theme.config 并行 prefetch(那里是静态字面量,判断不了有没有子栏目),
 * 这里只负责挑一个用。翻页时沿用同一个判断,保证第二页和首屏是同一批数据。
 *
 * `pageSize` **必须等于** theme.config 里该 prefetch 的 `limit`,否则第二页起会错位。
 */
export function useCategoryList(context: any, pageSize: number) {
    const aggregate = (context?.children?.length ?? 0) > 0;
    const categoryId = context?.category?.id;
    const section = context?.category?.slug;
    const api = context?.api;

    const key = aggregate ? 'sectionArticles' : 'articles';
    const items = ref<any[]>(context?.[key] ?? []);
    const total = ref<number>(context?.$meta?.[key]?.total ?? items.value.length);
    const page = ref(0);
    const loading = ref(false);
    const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

    /** 本页的取数范围。暴露出去,好让搜索/筛选在**同一范围内**查,而不是各写一套。 */
    const baseFilter = (): Record<string, any> =>
        aggregate ? { 'data.section': section } : { category_id: categoryId };

    const load = async (p: number) => {
        if (!api?.contentAPI) return;
        loading.value = true;
        try {
            const filter = baseFilter();
            const res = await api.contentAPI.listArticles({
                filter, orderBy: 'published_at', orderDesc: true, page: p, limit: pageSize,
            });
            items.value = res.data || [];
            total.value = res.total ?? items.value.length;
            page.value = p;
        } catch {
            items.value = [];
        } finally {
            loading.value = false;
        }
    };

    const goPage = (p: number) => {
        load(p);
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return { items, total, page, loading, totalPages, goPage, baseFilter };
}

/**
 * 主题内的界面文案。
 *
 * 不走 `frontend/src/i18n.ts`:那是**后台**的语言包,按 `navigator.language` 一次性选定且
 * 不可切换 —— 而这里的语言是由 URL(`/en/...`)决定的,同一个浏览器要能同时看两种。
 * 主题自带文案也让主题保持自包含,不必为了加一句话去改 `frontend/src/`。
 */
const DICT = {
    more: { zh: '查看更多', en: 'More' },
    home: { zh: '首页', en: 'Home' },
    search: { zh: '搜索', en: 'Search' },
    searchPlaceholder: { zh: '请输入搜索关键词...', en: 'Enter keywords...' },
    empty: { zh: '暂无内容', en: 'No content yet' },
    noEnglish: { zh: '该内容暂无英文版本', en: 'This content is not available in English' },
    notFound: { zh: '页面不存在', en: 'Page not found' },
    backHome: { zh: '返回首页', en: 'Back to home' },
    prev: { zh: '上一页', en: 'Previous' },
    next: { zh: '下一页', en: 'Next' },
    date: { zh: '日期', en: 'Date' },
    speaker: { zh: '主讲人', en: 'Speaker' },
    venue: { zh: '地点', en: 'Venue' },
    department: { zh: '发文单位', en: 'Department' },
    docNumber: { zh: '发文字号', en: 'Document No.' },
    indico: { zh: 'Indico 链接', en: 'Indico link' },
    education: { zh: '教育背景', en: 'Education' },
    experience: { zh: '工作经历', en: 'Experience' },
    research: { zh: '研究方向', en: 'Research Areas' },
    honors: { zh: '荣誉信息', en: 'Honors' },
    publications: { zh: '代表性论文专著', en: 'Selected Publications' },
    allDivisions: { zh: '所有研究部', en: 'All Divisions' },
    byLetter: { zh: '按姓氏首字母', en: 'By initial' },
    namePlaceholder: { zh: '请输入教师姓名', en: 'Search by name' },
    all: { zh: '全部', en: 'All' },
} as const;

export type TextKey = keyof typeof DICT;

export const t = (key: TextKey, locale: Locale = 'zh'): string => DICT[key]?.[locale] ?? '';

/** 分类的显示名。英文树的分类自己就是英文名,所以直接取 `name`。 */
export const catName = (c: any) => String(c?.name ?? '');

/** 分类的英文副标题(左侧菜单头部那行小写英文),存在 `category.data.name_en`。 */
export const catNameEn = (c: any) => String(c?.data?.name_en ?? '');
