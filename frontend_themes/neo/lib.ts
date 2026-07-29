import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

/** Article permalink (enriched articles carry `.category`). */
export const articleUrl = (a: any) => (a?.category?.slug ? `/a/${a.category.slug}/${a.slug}` : `/a/${a?.slug}`);

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
 */
export function useArticleList(context: any, pageSize: number) {
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
        filter: { category_id: categoryId }, orderBy: 'published_at', orderDesc: true, page: p, limit: pageSize,
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
