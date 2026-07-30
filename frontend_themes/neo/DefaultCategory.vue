<template>
  <main class="cat-main">
    <nav class="crumbs">
      <a href="/">首页</a>
      <template v-for="c in breadcrumbs" :key="c.id"><span class="sep">/</span><a :href="`/a/${c.slug}`">{{ c.name }}</a></template>
    </nav>

    <header class="cat-header">
      <h1>{{ category?.name || '分类' }}</h1>
      <p v-if="category?.data?.description">{{ category.data.description }}</p>
    </header>

    <div class="cat-grid" v-if="items.length">
      <a v-for="item in items" :key="item.id" class="cat-card" :href="articleUrl(item)">
        <div class="badge" v-if="item.is_top">✦ 置顶</div>
        <h2>{{ item.title }}<span v-if="item.locked" class="lock" :title="$t('front.lockedHint')">🔒</span></h2>
        <p>{{ item.description || '暂无描述' }}</p>
        <time>{{ formatDate(item.published_at) }}</time>
      </a>
    </div>
    <div v-else-if="!loading" class="empty">暂无文章</div>
    <div v-else class="empty">加载中…</div>

    <nav class="pager" v-if="totalPages > 1">
      <button :disabled="page <= 0" @click="goPage(page - 1)">← 上一页</button>
      <span>{{ page + 1 }} / {{ totalPages }}</span>
      <button :disabled="page >= totalPages - 1" @click="goPage(page + 1)">下一页 →</button>
    </nav>
  </main>
</template>

<script setup lang="ts">
import { articleUrl, formatDate, useArticleList } from './lib';
const props = defineProps<{ context: any }>();
const { category, breadcrumbs } = props.context || {};
const { items, page, loading, totalPages, goPage } = useArticleList(props.context, 12);
</script>

<style scoped>
.cat-main { max-width: 1280px; margin: 0 auto; padding: 3rem 2rem 5rem; width: 100%; }
.crumbs { font-family: 'Space Mono', monospace; font-size: 0.85rem; margin-bottom: 2.5rem; }
.crumbs a { color: var(--ink); text-decoration: underline wavy var(--accent) 1px; text-underline-offset: 3px; }
.crumbs a:hover { color: var(--accent); }
.crumbs .sep { margin: 0 8px; color: var(--border-light); }

.cat-header { border-bottom: 3px solid var(--ink); padding-bottom: 1.5rem; margin-bottom: 3rem; }
.cat-header h1 { font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(3rem, 9vw, 6rem); line-height: 0.95; text-transform: uppercase; }
.cat-header p { font-family: 'Space Mono', monospace; margin-top: 1rem; max-width: 620px; color: rgba(28,28,28,.75); }

.cat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; }
.cat-card { display: block; text-decoration: none; color: var(--ink); background: var(--surface); border: 3px solid var(--ink); padding: 2rem; box-shadow: var(--shadow-hard); transition: transform .12s, box-shadow .12s; }
.cat-card:hover { transform: translate(-3px,-3px); box-shadow: 12px 12px 0 var(--ink); }
.badge { color: var(--accent); font-family: 'Space Mono', monospace; font-size: 0.8rem; margin-bottom: 0.75rem; }
.cat-card h2 { font-family: 'Bricolage Grotesque', sans-serif; font-size: 2rem; line-height: 1.1; }
.cat-card p { margin: 1rem 0; color: rgba(28,28,28,.8); line-height: 1.5; }
.cat-card time { font-family: 'Space Mono', monospace; font-size: 0.8rem; color: rgba(28,28,28,.6); }

.empty { text-align: center; padding: 5rem; border: 3px dashed var(--border-light); font-size: 1.2rem; }
.pager { display: flex; align-items: center; justify-content: center; gap: 2rem; margin-top: 3rem; font-family: 'Space Mono', monospace; }
.pager button { background: var(--surface); border: 2px solid var(--ink); padding: 10px 20px; cursor: pointer; font-family: inherit; box-shadow: 3px 3px 0 var(--ink); }
.pager button:hover:not(:disabled) { color: var(--accent); }
.pager button:disabled { opacity: .4; cursor: not-allowed; box-shadow: none; }

@media (max-width: 700px) { .cat-grid { grid-template-columns: 1fr; } }

/* 受众轴:摘要墙内容的锁标记(正文已在后端剥离)。 */
.lock { margin-left: .4em; font-size: .85em; opacity: .65; }
</style>
