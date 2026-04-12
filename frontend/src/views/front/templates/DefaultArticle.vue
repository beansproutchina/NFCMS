<template>
  <div class="bg-white min-h-screen font-text">
    <article class="max-w-4xl mx-auto px-6 py-16">
      
      <!-- Breadcrumbs -->
      <Breadcrumb class="mb-12" v-if="breadcrumbs && breadcrumbs.length" :items="breadcrumbs" :current="article.title" />

      <!-- Article Header -->
      <header class="mb-14 pb-8 border-b border-[rgba(0,0,0,0.05)] text-center max-w-3xl mx-auto">
        <h1 class="text-[56px] font-display font-semibold tracking-[-0.015em] leading-[1.07] text-[#1d1d1f] mb-6">
          {{ article.title }}
        </h1>
        <div class="flex items-center justify-center gap-4 text-[14px] text-[rgba(0,0,0,0.6)]">
          <span>By {{ article.author_id || 'Admin' }}</span>
          <span>&bull;</span>
          <span>{{ new Date(article.published_at || article.created_at).toLocaleDateString() }}</span>
        </div>
      </header>

      <div v-if="article.thumbnail" class="mb-16">
        <img :src="article.thumbnail" class="w-full h-auto max-h-[500px] object-cover rounded-[12px] shadow-[0px_5px_30px_rgba(0,0,0,0.1)]"/>
      </div>

      <!-- Article Content (Markdown) -->
      <div 
        class="prose prose-lg prose-blue max-w-3xl mx-auto md-content" 
        v-html="renderedContent"
      ></div>

    </article>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';
import Breadcrumb from '../../../components/Breadcrumb.vue';

const props = defineProps<{
  article: any,
  category: any,
  breadcrumbs: any[],
  config?: any,
  api?: any,
  user?: any
}>();

const renderedContent = computed(() => {
  if (!props.article?.content) return '';
  return marked.parse(props.article.content);
});
</script>

<style>
/* Mimic Apple Typography in markdown */
.md-content h1, .md-content h2, .md-content h3 {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  font-weight: 600;
  letter-spacing: -0.015em;
  color: #1d1d1f;
}
.md-content p {
  color: rgba(0,0,0,0.8);
  line-height: 1.6;
  font-size: 17px;
}
.md-content a {
  color: #0066cc;
  text-decoration: none;
}
.md-content a:hover {
  text-decoration: underline;
}
</style>
