<template>
  <div class="category-page">
    <div class="page-banner">
      <div class="container"><h1>{{ category?.name || '栏目' }}</h1></div>
    </div>

    <div class="breadcrumb-bar">
      <div class="container">
        当前位置：<a href="/">首页</a>
        <template v-for="(c, i) in breadcrumbs" :key="c.id">
          <span class="sep">&gt;</span>
          <a v-if="Number(i) < breadcrumbs.length - 1 && !c.disabled" :href="`/a/${c.slug}`">{{ c.name }}</a>
          <span v-else class="current">{{ c.name }}</span>
        </template>
      </div>
    </div>

    <div class="container content-wrap">
      <!-- 子栏目以选项卡呈现,点击就地切换(有子栏目时) -->
      <div class="tabs" v-if="tabs.length > 1" role="tablist">
        <button
          v-for="t in tabs" :key="t.id"
          class="tab" :class="{ active: t.id === activeId }"
          role="tab" :aria-selected="t.id === activeId"
          @click="selectTab(t.id)"
        >{{ t.name }}</button>
      </div>

      <div class="grid" v-if="items.length">
        <a v-for="a in items" :key="a.id" class="card" :href="articleUrl(a)">
          <div class="thumb" :style="a.thumbnail ? { backgroundImage: `url(${a.thumbnail})` } : {}" :class="{ 'no-img': !a.thumbnail }">
            <span v-if="!a.thumbnail" class="no-img-text">{{ (a.title || '·').slice(0, 1) }}</span>
          </div>
          <div class="card-body">
            <h3 :title="a.title">{{ a.title }}</h3>
            <p class="desc" v-if="a.description">{{ a.description }}</p>
            <span class="date">{{ formatDate(a.published_at) }}</span>
          </div>
        </a>
      </div>
      <div v-else-if="!loading" class="empty-state">该栏目下暂无内容</div>
      <div v-else class="empty-state">加载中…</div>

      <nav class="pager" v-if="totalPages > 1">
        <button :disabled="page <= 0" @click="goPage(page - 1)">上一页</button>
        <span class="pager-info">{{ page + 1 }} / {{ totalPages }}</span>
        <button :disabled="page >= totalPages - 1" @click="goPage(page + 1)">下一页</button>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

const props = defineProps<{ context: any }>();
const { category, breadcrumbs, children, api } = props.context || {};

const articleUrl = (a: any) => (a?.category?.slug ? `/a/${a.category.slug}/${a.slug}` : `/a/${a?.slug}`);
const pad = (n: number) => String(n).padStart(2, '0');
const formatDate = (s: string) => { if (!s) return ''; const d = new Date(s); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

const PAGE_SIZE = 12;
const kids = (children && children.length) ? children : [];
// Does the parent category itself have articles? (from the prefetched page-0 + $meta total)
const parentTotal = props.context?.$meta?.articles?.total ?? (props.context?.articles?.length || 0);
const parentHasOwn = parentTotal > 0;

// Tab bar: parent ("全部" when it also has children, else its own name) + each child category.
const tabs = computed(() => {
  const t: { id: number; name: string }[] = [];
  if (parentHasOwn || kids.length === 0) t.push({ id: category?.id, name: kids.length ? '全部' : (category?.name || '全部') });
  for (const c of kids) t.push({ id: c.id, name: c.name });
  return t;
});

const activeId = ref<number>(tabs.value[0]?.id ?? category?.id);

/**
 * Seed the first tab straight from the prefetched page 0 instead of filling it in `onMounted`.
 * `fetchTab` already knew how to reuse that data, but running it after mount meant the first painted
 * frame showed the empty state and then swapped — a visible flash of "暂无内容" for no reason.
 * Only applies when the first tab IS the parent category; when the parent has no articles of its own
 * the first tab is a child, whose page still has to be fetched (its id isn't known until `children`
 * is read, and a prefetch list is static, so it can't be declared per-category).
 */
const seeded = tabs.value[0]?.id === category?.id && Array.isArray(props.context?.articles);
const items = ref<any[]>(seeded ? props.context.articles : []);
const total = ref<number>(seeded ? parentTotal : 0);
const page = ref(0);
const loading = ref(false);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));

const fetchTab = async (catId: number, p: number) => {
  // Reuse the prefetched page-0 when it's the parent's first page (no extra request).
  if (catId === category?.id && p === 0 && props.context?.articles) {
    items.value = props.context.articles;
    total.value = parentTotal;
    return;
  }
  if (!catId || !api?.contentAPI) { items.value = []; total.value = 0; return; }
  loading.value = true;
  try {
    const res = await api.contentAPI.listArticles({
      filter: { category_id: catId }, orderBy: 'published_at', orderDesc: true, page: p, limit: PAGE_SIZE,
    });
    items.value = res.data || [];
    total.value = res.total ?? items.value.length;
  } catch { items.value = []; total.value = 0; } finally { loading.value = false; }
};

const selectTab = (id: number) => { activeId.value = id; page.value = 0; fetchTab(id, 0); };
const goPage = (p: number) => { page.value = p; fetchTab(activeId.value, p); window.scrollTo({ top: 0, behavior: 'smooth' }); };

onMounted(() => { if (!seeded) fetchTab(activeId.value, 0); });
</script>

<style scoped>
.category-page { background: var(--uni-bg-page); min-height: 60vh; }
.page-banner { height: 150px; display: flex; align-items: center; background: linear-gradient(120deg, var(--uni-primary-dark), var(--uni-primary)); }
.page-banner h1 { color: #fff; font-size: 30px; margin: 0; letter-spacing: 2px; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }

.breadcrumb-bar { background: #fff; padding: 14px 0; font-size: 14px; color: #666; border-bottom: 1px solid var(--uni-border-light); margin-bottom: 30px; }
.breadcrumb-bar a { color: #555; text-decoration: none; }
.breadcrumb-bar a:hover { color: var(--uni-primary); }
.breadcrumb-bar .sep { margin: 0 8px; color: #bbb; }
.breadcrumb-bar .current { color: var(--uni-primary); }

.content-wrap { padding-bottom: 50px; }

/* 选项卡 */
.tabs { display: flex; flex-wrap: wrap; gap: 4px; border-bottom: 2px solid var(--uni-primary); margin-bottom: 26px; }
.tab {
  padding: 12px 30px; border: none; background: transparent; cursor: pointer; font-size: 16px;
  color: var(--uni-text-title); position: relative; top: 2px; border-radius: 4px 4px 0 0; transition: all .2s;
}
.tab:hover { color: var(--uni-primary); }
.tab.active { background: var(--uni-primary); color: #fff; font-weight: 500; }

.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 22px; }
.card { display: block; text-decoration: none; border: 1px solid var(--uni-border-light); border-radius: 6px; overflow: hidden; background: #fff; transition: box-shadow .25s, transform .25s; }
.card:hover { box-shadow: 0 10px 20px rgba(0,0,0,0.08); transform: translateY(-4px); }
.thumb { height: 180px; background: #f0e8e8 center/cover no-repeat; display: flex; align-items: center; justify-content: center; }
.thumb.no-img { background: linear-gradient(135deg, var(--uni-primary-light), var(--uni-primary)); }
.no-img-text { color: rgba(255,255,255,0.85); font-size: 44px; font-weight: 700; font-family: serif; }
.card-body { padding: 14px 16px; }
.card-body h3 { margin: 0 0 8px; font-size: 15px; font-weight: 500; color: var(--uni-text-title); line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card:hover .card-body h3 { color: var(--uni-primary); }
.card-body .desc { margin: 0 0 8px; font-size: 12px; color: #999; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card-body .date { font-size: 12px; color: #aaa; }

.empty-state { text-align: center; padding: 70px 0; color: #aaa; font-size: 15px; }

.pager { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 30px; }
.pager button { padding: 8px 20px; border: 1px solid var(--uni-border-light); background: #fff; color: var(--uni-text-title); border-radius: 4px; cursor: pointer; font-size: 14px; transition: all .2s; }
.pager button:hover:not(:disabled) { border-color: var(--uni-primary); color: var(--uni-primary); }
.pager button:disabled { opacity: .45; cursor: not-allowed; }
.pager-info { font-size: 14px; color: #666; }

@media (max-width: 1000px) { .grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 720px) { .grid { grid-template-columns: repeat(2, 1fr); } .tab { padding: 10px 18px; font-size: 14px; } }
@media (max-width: 460px) { .grid { grid-template-columns: 1fr; } }
</style>
