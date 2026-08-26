<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { renderMarkdown } from '@/lib/prose';

const props = defineProps<{ context: any }>();
const { config, article, breadcrumbs } = props.context || {};
const router = useRouter();

const renderedContent = computed(() => {
  if (!article?.content) return '';
  return renderMarkdown(article.content);
});
</script>

<template>
  <main class="article-main">
    <div class="breadcrumbs">
      <span @click="router.push('/')">首页</span>
      <template v-for="crumb in breadcrumbs" :key="crumb.id">
        <span class="sep">/</span>
        <span @click="router.push(`/a/${crumb.slug}`)">{{ crumb.name }}</span>
      </template>
      <span class="sep">/</span>
      <span class="current">{{ article?.title }}</span>
    </div>

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

<style>
.article-main {
  max-width: 1000px;
  margin: 0 auto;
  padding: 3rem 2rem;
  width: 100%;
}
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
