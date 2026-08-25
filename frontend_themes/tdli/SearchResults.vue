<template>
  <div class="td-main-grey">
    <div class="td-block td-block--big" style="padding-top: 2vw;">
      <div class="td-container">
        <div class="index-title">
          <h2 class="fnt45"><span>{{ t('search', locale) }}</span></h2>
        </div>
        <form class="search-bar" @submit.prevent="run">
          <input v-model="q" class="fnt18" :placeholder="t('searchPlaceholder', locale)" />
          <button type="submit" class="fnt16">{{ t('search', locale) }}</button>
        </form>

        <p v-if="loading" class="hint fnt18">…</p>
        <template v-else-if="q.trim()">
          <p class="hint fnt16">{{ hint }}</p>
          <div v-if="items.length" class="news-list">
            <a v-for="a in items" :key="a.id" class="news-item td-hover-card" :href="href(a)">
              <div class="text-box fnt18">
                <div class="title fnt24">{{ a.title }}</div>
                <div v-if="a.description" class="desc fnt16">{{ a.description }}</div>
                <div class="date">{{ formatDate(a.published_at) }}</div>
              </div>
            </a>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 站内搜索。关键词在 URL 的 `?q=` 里 —— 搜索结果因此可分享、可后退。
 *
 * 这一页刻意**不做 prefetch**:关键词来自 query 而不是路由参数,首屏没有它可取。空白的
 * 搜索页是正确的初始状态,不是没加载完。
 */
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { articleUrl, formatDate, t, type Locale } from './lib';

const props = withDefaults(defineProps<{ context: any; locale?: Locale }>(), { locale: 'zh' });
const locale = computed<Locale>(() => props.locale ?? 'zh');
const route = useRoute();
const router = useRouter();

const q = ref(String(route.query.q ?? ''));
const items = ref<any[]>([]);
const loading = ref(false);

const hint = computed(() =>
    locale.value === 'en' ? `${items.value.length} result(s) for “${q.value.trim()}”`
                          : `找到 ${items.value.length} 条与“${q.value.trim()}”相关的内容`);

const search = async () => {
    const kw = q.value.trim();
    if (!kw) { items.value = []; return; }
    const api = props.context?.api;
    if (!api?.contentAPI) return;
    loading.value = true;
    try {
        const res = await api.contentAPI.listArticles({
            filter: { $or: { title: { $contains: kw }, description: { $contains: kw } } },
            orderBy: 'published_at', orderDesc: true, page: 0, limit: 30,
        });
        items.value = res.data || [];
    } catch {
        items.value = [];
    } finally {
        loading.value = false;
    }
};

/** 外链文章(转发自公众号那类)直接跳原文,不进详情页。 */
const href = (a: any) => String(a?.data?.external_url || articleUrl(a, locale.value));

const run = () => {
    const base = locale.value === 'en' ? '/en/search' : '/search';
    router.push(`${base}?q=${encodeURIComponent(q.value.trim())}`);
};

onMounted(search);
watch(() => route.query.q, (v) => { q.value = String(v ?? ''); search(); });
</script>

<style scoped>
.index-title { margin-bottom: var(--size-30); }
.index-title h2 { color: var(--color-primary); font-weight: 600; display: inline-block; }
.index-title h2 span { position: relative; display: inline-block; }
.index-title h2 span::before {
  content: ""; position: absolute; left: 0; bottom: -10px; width: 100%; height: var(--size-4); background: var(--color-primary);
}
.search-bar { display: flex; gap: 12px; margin-bottom: var(--size-30); }
.search-bar input { flex: 1; height: 48px; padding: 0 16px; border: 0; background: #fff; }
.search-bar button { height: 48px; padding: 0 28px; border: 0; background: var(--color-primary); color: #fff; cursor: pointer; }
.hint { color: var(--color-text-secondary); margin-bottom: var(--size-20); }
.news-list { display: flex; flex-direction: column; gap: var(--size-20); }
.news-item { display: block; background: #fff; padding: var(--size-24); }
.news-item .title { color: var(--color-text-primary); }
.news-item:hover .title { color: var(--color-primary); }
.news-item .desc { color: var(--color-text-secondary); margin: var(--size-9) 0; }
.news-item .date { color: var(--color-text-secondary); }
</style>
