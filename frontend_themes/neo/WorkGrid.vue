<template>
  <main class="work-main">
    <nav class="crumbs">
      <a href="/">首页</a>
      <template v-for="c in breadcrumbs" :key="c.id"><span class="sep">/</span><a :href="`/a/${c.slug}`">{{ c.name }}</a></template>
    </nav>

    <header class="work-head">
      <h1>{{ category?.name || 'Works' }}</h1>
      <p v-if="category?.data?.description">{{ category.data.description }}</p>
      <span class="count" v-if="total">{{ String(total).padStart(2, '0') }} projects</span>
    </header>

    <div class="work-grid" v-if="items.length">
      <a v-for="a in items" :key="a.id" class="work-card" :href="articleUrl(a)">
        <div class="thumb" :style="a.thumbnail ? { backgroundImage: `url(${a.thumbnail})` } : {}" :class="{ 'no-img': !a.thumbnail }">
          <span v-if="!a.thumbnail" class="no-img-text">{{ (a.title || '·').slice(0, 1) }}</span>
          <span class="year" v-if="a.data?.year">{{ a.data.year }}</span>
        </div>
        <div class="info">
          <h2>{{ a.title }}</h2>
          <p v-if="a.data?.client || a.data?.role" class="sub">{{ [a.data?.client, a.data?.role].filter(Boolean).join(' · ') }}</p>
          <p v-else-if="a.description" class="sub">{{ a.description }}</p>
        </div>
      </a>
    </div>
    <div v-else-if="!loading" class="empty">暂无作品</div>
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
const { items, total, page, loading, totalPages, goPage } = useArticleList(props.context, 12);
</script>

<style scoped>
.work-main { max-width: 1440px; margin: 0 auto; padding: 3rem 2rem 5rem; width: 100%; }
.crumbs { font-family: 'Space Mono', monospace; font-size: 0.85rem; margin-bottom: 2.5rem; }
.crumbs a { color: var(--ink); text-decoration: underline wavy var(--accent) 1px; text-underline-offset: 3px; }
.crumbs a:hover { color: var(--accent); }
.crumbs .sep { margin: 0 8px; color: var(--border-light); }

.work-head { border-bottom: 3px solid var(--ink); padding-bottom: 1.5rem; margin-bottom: 2.5rem; position: relative; }
.work-head h1 { font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(3rem, 8vw, 5.5rem); line-height: 0.95; text-transform: uppercase; }
.work-head p { font-family: 'Space Mono', monospace; margin-top: 1rem; max-width: 620px; color: rgba(28,28,28,.75); }
.work-head .count { position: absolute; right: 0; bottom: 1.5rem; font-family: 'Space Mono', monospace; color: var(--accent); }

.work-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2.5rem; }
.work-card { display: block; text-decoration: none; color: var(--ink); border: 3px solid var(--ink); background: var(--surface); box-shadow: var(--shadow-hard); transition: transform .12s, box-shadow .12s; }
.work-card:hover { transform: translate(-3px, -3px); box-shadow: 12px 12px 0 var(--ink); }
.thumb { position: relative; aspect-ratio: 16/10; background: var(--bg-page) center/cover no-repeat; display: flex; align-items: center; justify-content: center; border-bottom: 3px solid var(--ink); }
.thumb.no-img { background: repeating-linear-gradient(45deg, var(--bg-page), var(--bg-page) 12px, #eae5db 12px, #eae5db 24px); }
.no-img-text { font-family: 'Bricolage Grotesque', sans-serif; font-size: 4rem; font-weight: 800; color: var(--ink); opacity: .18; }
.year { position: absolute; top: 0; right: 0; background: var(--ink); color: var(--surface); font-family: 'Space Mono', monospace; font-size: 0.8rem; padding: 4px 10px; }
.info { padding: 1.5rem; }
.info h2 { font-family: 'Bricolage Grotesque', sans-serif; font-size: 1.8rem; line-height: 1.1; }
.work-card:hover .info h2 { color: var(--accent); }
.info .sub { font-family: 'Space Mono', monospace; font-size: 0.85rem; color: rgba(28,28,28,.7); margin-top: 0.6rem; }

.empty { text-align: center; padding: 5rem; border: 3px dashed var(--border-light); font-size: 1.2rem; }

.pager { display: flex; align-items: center; justify-content: center; gap: 2rem; margin-top: 3rem; font-family: 'Space Mono', monospace; }
.pager button { background: var(--surface); border: 2px solid var(--ink); padding: 10px 20px; cursor: pointer; font-family: inherit; box-shadow: 3px 3px 0 var(--ink); transition: transform .1s, box-shadow .1s; }
.pager button:hover:not(:disabled) { transform: translate(-2px,-2px); box-shadow: 5px 5px 0 var(--ink); color: var(--accent); }
.pager button:disabled { opacity: .4; cursor: not-allowed; box-shadow: none; }

@media (max-width: 800px) { .work-grid { grid-template-columns: 1fr; gap: 1.75rem; } .work-head .count { position: static; display: block; margin-top: .5rem; } }
</style>
