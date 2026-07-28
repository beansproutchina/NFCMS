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

    <div class="container layout-grid">
      <aside class="sidebar">
        <h3 class="side-title">{{ (rootCrumb?.name) || category?.name || '栏目导航' }}</h3>
        <ul class="side-menu">
          <li v-for="c in sideItems" :key="c.id" :class="{ active: c.id === category?.id }">
            <a :href="`/a/${c.slug}`">{{ c.name }}</a>
          </li>
          <li v-if="!sideItems.length" class="empty">暂无子栏目</li>
        </ul>
      </aside>

      <main class="content-main">
        <div class="main-head">
          <h2>{{ category?.name || '文章列表' }}</h2>
          <span class="count" v-if="total">共 {{ total }} 篇</span>
        </div>

        <ul class="article-list" v-if="items.length">
          <li v-for="a in items" :key="a.id">
            <a :href="articleUrl(a)" :title="a.title">{{ a.title }}</a>
            <span class="date">{{ formatDate(a.published_at) }}</span>
          </li>
        </ul>
        <div v-else-if="!loading" class="empty-state">该栏目下暂无文章</div>
        <div v-else class="empty-state">加载中…</div>

        <nav class="pager" v-if="totalPages > 1">
          <button :disabled="page <= 0" @click="goPage(page - 1)">上一页</button>
          <span class="pager-info">{{ page + 1 }} / {{ totalPages }}</span>
          <button :disabled="page >= totalPages - 1" @click="goPage(page + 1)">下一页</button>
        </nav>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{ context: any }>();
const { category, breadcrumbs, children, api } = props.context || {};

const articleUrl = (a: any) => (a?.category?.slug ? `/a/${a.category.slug}/${a.slug}` : `/a/${a?.slug}`);
const pad = (n: number) => String(n).padStart(2, '0');
const formatDate = (s: string) => { if (!s) return ''; const d = new Date(s); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

// Sidebar shows sibling categories when this is a leaf, else its children.
const rootCrumb = computed(() => (breadcrumbs && breadcrumbs.length ? breadcrumbs[0] : null));
const sideItems = computed(() => (children && children.length ? children : []));

// Page 0 comes from prefetch (instant, no extra request); total from $meta. PAGE_SIZE must
// match the prefetch limit in theme.config.ts. Later pages are fetched client-side.
const PAGE_SIZE = 15;
const items = ref<any[]>(props.context?.articles || []);
const total = ref<number>(props.context?.$meta?.articles?.total ?? items.value.length);
const page = ref(0);
const loading = ref(false);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));

const load = async (p: number) => {
  if (!category?.id || !api?.contentAPI) return;
  loading.value = true;
  try {
    const res = await api.contentAPI.listArticles({
      filter: { category_id: category.id }, orderBy: 'published_at', orderDesc: true,
      page: p, limit: PAGE_SIZE,
    });
    items.value = res.data || [];
    total.value = res.total ?? items.value.length;
    page.value = p;
  } catch { items.value = []; } finally { loading.value = false; }
};
const goPage = (p: number) => { load(p); window.scrollTo({ top: 0, behavior: 'smooth' }); };
</script>

<style scoped>
.category-page { background: var(--uni-bg-page); min-height: 60vh; }
.page-banner {
  height: 150px; display: flex; align-items: center;
  background: linear-gradient(120deg, var(--uni-primary-dark), var(--uni-primary));
}
.page-banner h1 { color: #fff; font-size: 30px; margin: 0; letter-spacing: 2px; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }

.breadcrumb-bar { background: #fff; padding: 14px 0; font-size: 14px; color: #666; border-bottom: 1px solid var(--uni-border-light); margin-bottom: 30px; }
.breadcrumb-bar a { color: #555; text-decoration: none; }
.breadcrumb-bar a:hover { color: var(--uni-primary); }
.breadcrumb-bar .sep { margin: 0 8px; color: #bbb; }
.breadcrumb-bar .current { color: var(--uni-primary); }

.layout-grid { display: grid; grid-template-columns: 250px 1fr; gap: 30px; align-items: start; padding-bottom: 50px; }

.sidebar { background: #fff; border: 1px solid var(--uni-border-light); border-radius: 4px; overflow: hidden; }
.side-title { background: var(--uni-primary); color: #fff; margin: 0; padding: 16px 20px; font-size: 18px; font-weight: 500; }
.side-menu { list-style: none; padding: 0; margin: 0; }
.side-menu li { border-bottom: 1px dashed var(--uni-border-light); }
.side-menu li:last-child { border-bottom: none; }
.side-menu li a { display: block; padding: 13px 20px; color: var(--uni-text-title); text-decoration: none; font-size: 15px; transition: all .25s; }
.side-menu li a:hover, .side-menu li.active a { background: #faf2f2; color: var(--uni-primary); padding-left: 26px; }
.side-menu li.active a { font-weight: 600; border-left: 3px solid var(--uni-primary); }
.side-menu li.empty { padding: 26px 20px; text-align: center; color: #aaa; font-size: 14px; }

.content-main { background: #fff; border: 1px solid var(--uni-border-light); border-radius: 4px; padding: 26px 30px; min-height: 460px; }
.main-head { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid var(--uni-primary); padding-bottom: 12px; margin-bottom: 8px; }
.main-head h2 { font-size: 22px; color: var(--uni-primary); margin: 0; font-weight: 600; }
.main-head .count { font-size: 13px; color: #999; }

.article-list { list-style: none; padding: 0; margin: 0; }
.article-list li { display: flex; align-items: center; padding: 15px 4px; border-bottom: 1px dashed var(--uni-border-light); }
.article-list li::before { content: ''; width: 5px; height: 5px; background: var(--uni-primary); margin-right: 12px; flex-shrink: 0; }
.article-list li a { flex: 1; color: var(--uni-text-title); text-decoration: none; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-right: 16px; }
.article-list li a:hover { color: var(--uni-primary); }
.article-list li .date { color: #aaa; font-size: 14px; flex-shrink: 0; }
.empty-state { text-align: center; padding: 70px 0; color: #aaa; font-size: 15px; }

.pager { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 26px; }
.pager button { padding: 8px 20px; border: 1px solid var(--uni-border-light); background: #fff; color: var(--uni-text-title); border-radius: 4px; cursor: pointer; font-size: 14px; transition: all .2s; }
.pager button:hover:not(:disabled) { border-color: var(--uni-primary); color: var(--uni-primary); }
.pager button:disabled { opacity: .45; cursor: not-allowed; }
.pager-info { font-size: 14px; color: #666; }

@media (max-width: 860px) {
  .layout-grid { grid-template-columns: 1fr; }
  .article-list li { flex-wrap: wrap; }
  .article-list li .date { width: 100%; margin: 5px 0 0 17px; }
}
</style>
