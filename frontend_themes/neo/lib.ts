import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

/** Article permalink (enriched articles carry `.category`). */
export const articleUrl = (a: any) => (a?.category?.slug ? `/a/${a.category.slug}/${a.slug}` : `/a/${a?.slug}`);

/**
 * Which projects the studio lists publicly: pinned ones only.
 *
 * `is_top` therefore carries two meanings in this theme — "featured" and "publicly listed". That is
 * deliberate: a studio shows a curated set, while members' own side projects stay off the studio
 * listings. Unpinned projects are NOT hidden — they keep a working permalink and still appear on
 * their author's member page (MemberPage does not apply this filter), they are merely unlisted.
 *
 * Single source of truth for both the `theme.config.ts` prefetch (page 0) and `useArticleList`
 * (pages 2+). Keep it that way: two copies would list one set on page 1 and another from page 2 on.
 */
export const LISTED_WORK_FILTER = { is_top: 1 };

/**
 * 团队页同理:只列置顶的成员。未置顶 ≠ 不可见 —— 个人页仍有固定链接,作品页的署名也照样链过去,
 * 只是不出现在团队列表里。与 `LISTED_WORK_FILTER` 一样,prefetch 与 `useArticleList` 必须共用
 * 这一个常量,否则第 1 页和第 2 页会按两套规则筛。
 */
export const LISTED_TEAM_FILTER = { is_top: 1 };

/** 团队成员的排序键:分类自定义字段 `sort`,数字小的在前;没填的一律排到最后。 */
export const memberSortKey = (a: any): number => {
  const raw = a?.data?.sort;
  const n = Number(raw);
  return raw === '' || raw == null || Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
};

/** 成员正文里声明的一条参与作品。`url` 为空表示该条目不可点(纯自述)。 */
export interface WorkEntry {
  /** 原样的链接:`/a/...` 站内 · `https://...` 站外 · 空串 = 不可点 */
  url: string;
  /** 站内条目才有:从 url 末段取,用来和文章对上号 */
  slug: string;
  /** 站外或不可点的条目自带标题;站内条目留空,由文章补 */
  title: string;
  contribution: string;
  date: string;
  image: string;
}

const WORKS_FENCE_OPEN = /^:::\s*works\s*$/;
const WORKS_FENCE_CLOSE = /^:::\s*$/;

/**
 * 解析成员正文里的参与作品块,并把这一块**从正文里摘掉**。
 *
 * ```
 * :::works
 * /a/works/aurora-coffee | 品牌视觉、包装延展
 * https://behance.net/xxx | Aurora 咖啡海报 | 主视觉 | 2025-03 | https://cdn/x.jpg
 *                         | 未公开的项目     | 交互设计 | 2024   |
 * :::
 * ```
 *
 * 判定内外**只看第一列的形状**,不数列数:
 *   · `/` 开头 → 站内,写两列(`url | 贡献`);标题/封面/时间由文章本身提供,不用作者抄。
 *   · 带协议 → 站外,写五列(`url | 标题 | 贡献 | 时间 | 图片`)。
 *   · 空 → 自述条目,同样五列,只是渲染成不可点。
 * 站外/自述条目**必须有标题**(没有标题的卡片没有意义),缺了就整行跳过 —— 弱约定格式的代价是
 * 写错不报错,所以宁可少显示一行,也不要渲染出一张空卡片。
 *
 * 摘掉整块是必须的:`:::works` 不是 markdown 标准语法,marked 不认识它,留在正文里会以字面量
 * 出现在页面上(这也是这套格式的已知代价,分类的 editor_hint 里要写明)。
 */
export function parseWorksBlock(md: string): { entries: WorkEntry[]; body: string } {
  const src = String(md || '');
  if (!src.includes(':::')) return { entries: [], body: src };

  const lines = src.split('\n');
  const entries: WorkEntry[] = [];
  const kept: string[] = [];
  let inside = false;
  let found = false;

  for (const line of lines) {
    const t = line.trim();
    if (!inside && !found && WORKS_FENCE_OPEN.test(t)) { inside = true; found = true; continue; }
    if (inside) {
      if (WORKS_FENCE_CLOSE.test(t)) { inside = false; continue; }
      if (!t) continue;
      const cols = t.split('|').map((c) => c.trim());
      const url = cols[0] || '';
      if (url.startsWith('/')) {
        const contribution = cols[1] || '';
        entries.push({ url, slug: url.split('/').filter(Boolean).pop() || '', title: '', contribution, date: '', image: '' });
      } else if (/^https?:\/\//i.test(url) || url === '') {
        const [, title = '', contribution = '', date = '', image = ''] = cols;
        if (!title) continue;   // 站外/自述条目没有标题就无从显示
        entries.push({ url, slug: '', title, contribution, date, image });
      }
      // 其余形状(既不是路径也不是链接)视为写错,跳过
      continue;
    }
    kept.push(line);
  }

  return { entries, body: kept.join('\n').trim() };
}

/**
 * 进入一篇内容页时回到顶部。
 *
 * 框架的 `router.scrollBehavior` 已经对新导航返回 `{ top: 0 }`,但实测在本主题里点进文章仍
 * 停在原位置,所以这里补一道主题侧的保证 —— 它**不会**和 back/forward 的位置恢复打架:
 * vue-router 把离开时的滚动位置写在 `history.state.scroll` 上,后退/前进进来的历史条目带着
 * 这份记录,于是这里直接跳过,让框架的 300ms 延迟恢复照常生效;而一次全新的 push 没有这份
 * 记录,才滚到顶。
 *
 * 只能放在**每次导航都会重挂的**模板里:布局(Layout/MemberLayout)由 DynamicView 按
 * `layouts.join('>')` 做 key,同一套布局在导航间是复用的,写在那儿只会在首次进站生效一次。
 */
export function scrollToTopOnEnter() {
  onMounted(() => {
    const restored = (window.history.state as any)?.scroll;
    if (restored) return;
    window.scrollTo({ top: 0, left: 0 });
  });
}

const pad = (n: number) => String(n).padStart(2, '0');
export const formatDate = (s: string) => { if (!s) return ''; const d = new Date(s); return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`; };

/**
 * Paginated article list for a category, with the page number in the URL as `?page=` (1-based;
 * page 1 carries no parameter, so a list has exactly one canonical URL). Page 0 is seeded from the
 * prefetched `context.articles` (+ total via `context.$meta.articles`) so the first paint needs no
 * extra request; other pages are fetched client-side. `pageSize` MUST match the prefetch limit
 * declared in theme.config.ts.
 *
 * Paging pushes a query-only navigation. No watcher is needed: `router.beforeResolve` re-runs
 * `to.meta.fetch` for every navigation (query changes included), DynamicView then bumps its render
 * key and the template remounts, so this composable re-initialises from the new URL. Back/forward
 * take the same path, which is why the page number survives history navigation.
 * Cost, stated plainly: a page change is 3 requests instead of 1, because the whole navigation
 * re-runs. Fixing that means teaching the framework's prefetch about `$query.x` — out of scope.
 *
 * `extraFilter` is merged into the server-side filter for every page. It MUST mirror the filter
 * declared for this template in theme.config.ts — the prefetch seeds page 0 while this composable
 * fetches the rest, so a mismatch shows one rule on page 1 and another from page 2 on.
 * WorkGrid passes `{ is_top: 1 }`: only pinned projects are listed publicly (see LISTED_WORK_FILTER).
 */
export function useArticleList(context: any, pageSize: number, extraFilter: Record<string, any> = {}) {
  const categoryId = context?.category?.id;
  const api = context?.api;
  const route = useRoute();
  const router = useRouter();

  const initial = Math.max(0, (Number(route.query.page) || 1) - 1);
  // Only page 0 can be seeded — the prefetch always fetches page 0. For a deep link like ?page=3
  // we start empty and loading, so the visitor gets one "loading" beat instead of a flash of page 1.
  const items = ref<any[]>(initial === 0 ? (context?.articles || []) : []);
  const total = ref<number>(context?.$meta?.articles?.total ?? items.value.length);
  const page = ref(initial);
  const loading = ref(initial > 0);
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

  const load = async (p: number) => {
    if (!categoryId || !api?.contentAPI) { loading.value = false; return; }
    loading.value = true;
    try {
      const res = await api.contentAPI.listArticles({
        filter: { category_id: categoryId, ...extraFilter },
        orderBy: 'published_at', orderDesc: true, page: p, limit: pageSize,
      });
      items.value = res.data || [];
      total.value = res.total ?? items.value.length;
      page.value = p;
    } catch { items.value = []; } finally { loading.value = false; }
  };
  onMounted(() => { if (initial > 0) load(initial); });

  // No manual scrollTo: the router's scrollBehavior already returns { top: 0 } for a new navigation
  // and the saved position for back/forward — scrolling here would fight it on back/forward.
  const goPage = (p: number) => {
    const q: any = { ...route.query };
    if (p <= 0) delete q.page; else q.page = String(p + 1);
    router.push({ query: q });   // no path: stay on the current one
  };

  return { items, total, page, loading, totalPages, goPage };
}
