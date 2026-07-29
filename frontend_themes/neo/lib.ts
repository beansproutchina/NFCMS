import { ref, computed } from 'vue';

/** Article permalink (enriched articles carry `.category`). */
export const articleUrl = (a: any) => (a?.category?.slug ? `/a/${a.category.slug}/${a.slug}` : `/a/${a?.slug}`);

const pad = (n: number) => String(n).padStart(2, '0');
export const formatDate = (s: string) => { if (!s) return ''; const d = new Date(s); return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`; };

/**
 * Paginated article list for a category. Page 0 is seeded from the prefetched `context.articles`
 * (+ total via `context.$meta.articles`) so the first paint needs no extra request; later pages
 * are fetched client-side. `pageSize` MUST match the prefetch limit declared in theme.config.ts.
 */
export function useArticleList(context: any, pageSize: number) {
  const categoryId = context?.category?.id;
  const api = context?.api;
  const items = ref<any[]>(context?.articles || []);
  const total = ref<number>(context?.$meta?.articles?.total ?? items.value.length);
  const page = ref(0);
  const loading = ref(false);
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

  const load = async (p: number) => {
    if (!categoryId || !api?.contentAPI) return;
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
  const goPage = (p: number) => { load(p); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return { items, total, page, loading, totalPages, goPage };
}
