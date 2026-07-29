<template>
  <main class="svc-main">
    <nav class="crumbs">
      <a href="/">首页</a>
      <template v-for="c in breadcrumbs" :key="c.id"><span class="sep">/</span><a :href="`/a/${c.slug}`">{{ c.name }}</a></template>
    </nav>

    <header class="svc-head">
      <h1>{{ category?.name || 'Services' }}</h1>
      <p v-if="category?.data?.description">{{ category.data.description }}</p>
    </header>

    <div class="svc-grid" v-if="items.length">
      <article v-for="(a, i) in items" :key="a.id" class="svc-card">
        <div class="svc-top">
          <span class="svc-icon">{{ a.data?.icon || '✦' }}</span>
          <span class="svc-no">{{ String(i + 1).padStart(2, '0') }}</span>
        </div>
        <h2>{{ a.title }}</h2>
        <p v-if="a.description">{{ a.description }}</p>
        <a class="svc-more" :href="articleUrl(a)">了解更多 →</a>
      </article>
    </div>
    <div v-else-if="!loading" class="empty">暂无服务项目</div>
    <div v-else class="empty">加载中…</div>

    <nav class="pager" v-if="totalPages > 1">
      <button :disabled="page <= 0" @click="goPage(page - 1)">← 上一页</button>
      <span>{{ page + 1 }} / {{ totalPages }}</span>
      <button :disabled="page >= totalPages - 1" @click="goPage(page + 1)">下一页 →</button>
    </nav>
  </main>
</template>

<script setup lang="ts">
import { articleUrl, useArticleList } from './lib';
const props = defineProps<{ context: any }>();
const { category, breadcrumbs } = props.context || {};
const { items, page, loading, totalPages, goPage } = useArticleList(props.context, 12);
</script>

<style scoped>
.svc-main { max-width: 1280px; margin: 0 auto; padding: 3rem 2rem 5rem; width: 100%; }
.crumbs { font-family: 'Space Mono', monospace; font-size: 0.85rem; margin-bottom: 2.5rem; }
.crumbs a { color: var(--ink); text-decoration: underline wavy var(--accent) 1px; text-underline-offset: 3px; }
.crumbs a:hover { color: var(--accent); }
.crumbs .sep { margin: 0 8px; color: var(--border-light); }

.svc-head { border-bottom: 3px solid var(--ink); padding-bottom: 1.5rem; margin-bottom: 2.5rem; }
.svc-head h1 { font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(3rem, 8vw, 5.5rem); text-transform: uppercase; line-height: 0.95; }
.svc-head p { font-family: 'Space Mono', monospace; margin-top: 1rem; max-width: 620px; color: rgba(28,28,28,.75); }

.svc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; }
.svc-card { border: 3px solid var(--ink); background: var(--surface); box-shadow: var(--shadow-hard); padding: 2rem; display: flex; flex-direction: column; transition: transform .12s, box-shadow .12s; }
.svc-card:hover { transform: translate(-3px,-3px); box-shadow: 12px 12px 0 var(--ink); }
.svc-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
.svc-icon { font-size: 2.5rem; line-height: 1; }
.svc-no { font-family: 'Space Mono', monospace; color: var(--accent); font-weight: 700; }
.svc-card h2 { font-family: 'Bricolage Grotesque', sans-serif; font-size: 1.7rem; line-height: 1.15; }
.svc-card p { margin: 0.9rem 0 1.5rem; line-height: 1.55; color: rgba(28,28,28,.8); flex: 1; }
.svc-more { font-family: 'Space Mono', monospace; font-weight: 700; text-decoration: none; color: var(--ink); border-top: 2px solid var(--border-light); padding-top: 1rem; }
.svc-more:hover { color: var(--accent); }

.empty { text-align: center; padding: 5rem; border: 3px dashed var(--border-light); font-size: 1.2rem; }
.pager { display: flex; align-items: center; justify-content: center; gap: 2rem; margin-top: 3rem; font-family: 'Space Mono', monospace; }
.pager button { background: var(--surface); border: 2px solid var(--ink); padding: 10px 20px; cursor: pointer; font-family: inherit; box-shadow: 3px 3px 0 var(--ink); }
.pager button:hover:not(:disabled) { color: var(--accent); }
.pager button:disabled { opacity: .4; cursor: not-allowed; box-shadow: none; }

@media (max-width: 900px) { .svc-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .svc-grid { grid-template-columns: 1fr; } }
</style>
