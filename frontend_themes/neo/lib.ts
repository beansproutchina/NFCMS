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
