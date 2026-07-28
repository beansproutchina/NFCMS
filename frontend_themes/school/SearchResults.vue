<template>
  <div class="search-page">
    <div class="page-banner">
      <div class="container"><h1>站内搜索</h1></div>
    </div>

    <div class="container search-body">
      <form class="search-bar" @submit.prevent="submit">
        <input v-model="term" type="text" placeholder="输入关键词搜索新闻、通知…" aria-label="搜索关键词" />
        <button type="submit">搜索</button>
      </form>

      <div class="result-head" v-if="query">
        <template v-if="!loading">
          关于 “<b>{{ query }}</b>” 的搜索结果<span v-if="total">，共 {{ total }} 条</span>
        </template>
        <template v-else>搜索中…</template>
      </div>

      <ul class="result-list" v-if="items.length">
        <li v-for="a in items" :key="a.id">
          <a class="r-title" :href="articleUrl(a)" :title="a.title">{{ a.title }}</a>
          <p class="r-desc" v-if="a.description">{{ a.description }}</p>
          <div class="r-meta">
            <span v-if="a.category">{{ a.category.name }}</span>
            <span class="dot" v-if="a.category && a.published_at">·</span>
            <span v-if="a.published_at">{{ formatDate(a.published_at) }}</span>
          </div>
        </li>
      </ul>

      <div class="empty" v-else-if="query && !loading">未找到与 “{{ query }}” 相关的内容</div>
      <div class="empty" v-else-if="!query">请输入关键词开始搜索</div>

      <nav class="pager" v-if="totalPages > 1">
        <button :disabled="page <= 0" @click="goPage(page - 1)">上一页</button>
        <span class="pager-info">{{ page + 1 }} / {{ totalPages }}</span>
        <button :disabled="page >= totalPages - 1" @click="goPage(page + 1)">下一页</button>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const props = defineProps<{ context: any }>();
const { api } = props.context || {};
const route = useRoute();
const router = useRouter();

const articleUrl = (a: any) => (a?.category?.slug ? `/a/${a.category.slug}/${a.slug}` : `/a/${a?.slug}`);
const pad = (n: number) => String(n).padStart(2, '0');
const formatDate = (s: string) => { if (!s) return ''; const d = new Date(s); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

const query = computed(() => String(route.query.q || '').trim());
const term = ref(query.value);

const PAGE_SIZE = 12;
const items = ref<any[]>([]);
const total = ref(0);
const page = ref(0);
const loading = ref(false);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));

const run = async () => {
  const q = query.value;
  if (!q || !api?.contentAPI) { items.value = []; total.value = 0; return; }
  loading.value = true;
  try {
    const res = await api.contentAPI.listArticles({
      filter: { $or: { title: { $contains: q }, description: { $contains: q } } },
      orderBy: 'published_at', orderDesc: true, page: page.value, limit: PAGE_SIZE,
    });
    items.value = res.data || [];
    total.value = res.total ?? items.value.length;
  } catch { items.value = []; total.value = 0; } finally { loading.value = false; }
};

// Submitting updates the URL query; the watcher re-runs the search (also enables shareable URLs).
const submit = () => {
  const t = term.value.trim();
  if (!t) return;
  page.value = 0;
  router.push(`/search?q=${encodeURIComponent(t)}`);
};
const goPage = (p: number) => { page.value = p; run(); window.scrollTo({ top: 0, behavior: 'smooth' }); };

watch(query, () => { page.value = 0; term.value = query.value; run(); });
onMounted(run);
</script>

<style scoped>
.search-page { background: var(--uni-bg-page); min-height: 60vh; }
.page-banner { height: 150px; display: flex; align-items: center; background: linear-gradient(120deg, var(--uni-primary-dark), var(--uni-primary)); }
.page-banner h1 { color: #fff; font-size: 30px; margin: 0; letter-spacing: 2px; }
.container { max-width: 1000px; margin: 0 auto; padding: 0 20px; }
.search-body { padding: 36px 20px 60px; }

.search-bar { display: flex; max-width: 640px; margin: 0 auto 30px; }
.search-bar input { flex: 1; padding: 12px 16px; border: 1px solid #d8d8d8; border-right: none; outline: none; border-radius: 4px 0 0 4px; font-size: 15px; }
.search-bar input:focus { border-color: var(--uni-primary); }
.search-bar button { padding: 12px 30px; border: none; background: var(--uni-primary); color: #fff; cursor: pointer; border-radius: 0 4px 4px 0; font-size: 15px; transition: background .2s; }
.search-bar button:hover { background: var(--uni-primary-dark); }

.result-head { color: #666; font-size: 14px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid var(--uni-border-light); }
.result-head b { color: var(--uni-primary); }

.result-list { list-style: none; padding: 0; margin: 0; }
.result-list li { padding: 20px 0; border-bottom: 1px dashed var(--uni-border-light); }
.r-title { font-size: 18px; color: var(--uni-text-title); text-decoration: none; font-weight: 500; }
.r-title:hover { color: var(--uni-primary); }
.r-desc { margin: 8px 0; font-size: 14px; color: #888; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.r-meta { font-size: 13px; color: #aaa; display: flex; gap: 8px; align-items: center; }
.r-meta .dot { color: #ddd; }

.empty { text-align: center; padding: 70px 0; color: #aaa; font-size: 15px; }

.pager { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 30px; }
.pager button { padding: 8px 20px; border: 1px solid var(--uni-border-light); background: #fff; color: var(--uni-text-title); border-radius: 4px; cursor: pointer; font-size: 14px; transition: all .2s; }
.pager button:hover:not(:disabled) { border-color: var(--uni-primary); color: var(--uni-primary); }
.pager button:disabled { opacity: .45; cursor: not-allowed; }
.pager-info { font-size: 14px; color: #666; }
</style>
