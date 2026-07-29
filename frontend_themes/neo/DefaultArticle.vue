<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';

const props = defineProps<{ context: any }>();
const { article, breadcrumbs } = props.context || {};

const renderedContent = computed(() => {
  if (!article?.content) return '';
  return marked.parse(article.content) as string;
});
</script>

<template>
  <main class="article-main">
    <nav class="breadcrumbs">
      <a href="/">首页</a>
      <template v-for="crumb in breadcrumbs" :key="crumb.id">
        <span class="sep">/</span>
        <a :href="`/a/${crumb.slug}`">{{ crumb.name }}</a>
      </template>
      <span class="sep">/</span>
      <span class="current">{{ article?.title }}</span>
    </nav>

    <article class="article-body">
      <header class="article-header">
        <h1>{{ article?.title }}</h1>
        <div class="meta">
          <span>By {{ article?.author?.nickname || article?.author?.username }}</span>
          <span class="dot">•</span>
          <time>{{ article?.published_at ? new Date(article.published_at).toLocaleDateString() : '' }}</time>
        </div>
      </header>

      <div v-if="article?.thumbnail" class="featured-image">
        <img :src="article.thumbnail" alt="">
      </div>

      <div class="content" v-html="renderedContent"></div>
    </article>
  </main>
</template>

<style scoped>
.article-main {
  max-width: 1000px;
  margin: 0 auto;
  padding: 3rem 2rem;
  width: 100%;
}
.breadcrumbs { font-family: 'Space Mono', monospace; font-size: 0.85rem; }
.breadcrumbs a { color: var(--ink); text-decoration: underline wavy var(--accent) 1px; text-underline-offset: 3px; }
.breadcrumbs a:hover { color: var(--accent); }
.breadcrumbs .sep { margin: 0 8px; color: var(--border-light); }
.breadcrumbs .current { color: rgba(28,28,28,.6); }
.article-header h1 {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: 4.5rem;
  line-height: 1.05;
  margin: 2rem 0 1rem;
  border-left: 16px solid var(--accent);
  padding-left: 1.5rem;
}
.meta {
  font-family: 'Space Mono', monospace;
  display: flex;
  gap: 1rem;
  margin: 2rem 0;
}
.featured-image {
  margin: 2rem -2rem;
  border-top: 3px solid var(--ink);
  border-bottom: 3px solid var(--ink);
}
.featured-image img { width: 100%; display: block; }
.content {
  max-width: 680px;
  margin-left: 0; /* 偏左不对称 */
  font-size: 1.2rem;
  line-height: 1.6;
}
.content :deep(h2) { font-family: 'Bricolage Grotesque'; margin-top: 3rem; }
.content :deep(blockquote) {
  border-left: 12px solid var(--accent);
  background: var(--surface);
  padding: 1.5rem;
  box-shadow: 6px 6px 0 var(--ink);
  margin: 2rem 0;
}
</style>
