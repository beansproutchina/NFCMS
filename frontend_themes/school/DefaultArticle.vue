<template>
  <div class="article-page">
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

    <main class="container article-main">
      <article class="article-card">
        <h1 class="article-title">{{ article?.title || '文章标题' }}</h1>

        <div class="article-meta">
          <span v-if="article?.published_at">{{ formatDate(article.published_at) }}</span>
          <span class="dot" v-if="authorName">·</span>
          <span v-if="authorName">作者：{{ authorName }}</span>
          <span class="dot" v-if="source">·</span>
          <span v-if="source">来源：{{ source }}</span>
        </div>

        <div v-if="article?.description" class="article-summary">{{ article.description }}</div>

        <div class="article-content" v-html="renderedContent"></div>

        <div class="article-foot" v-if="authorName">
          <span>责任编辑：{{ authorName }}</span>
        </div>
      </article>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';

const props = defineProps<{ context: any }>();
const { article, breadcrumbs } = props.context || {};

// content is Markdown (see ArticleModel); render to HTML like the other themes / SSG.
const renderedContent = computed(() => (article?.content ? (marked.parse(article.content) as string) : '<p>暂无内容</p>'));

const pad = (n: number) => String(n).padStart(2, '0');
const formatDate = (s: string) => { if (!s) return ''; const d = new Date(s); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

// `author` is the enriched user object (password stripped) — show a name, not [object Object].
const authorName = computed(() => {
  const a = article?.author;
  if (!a) return '';
  return a.nickname || a.username || '';
});
// Optional "来源" from the article's custom data (category article_data_fields → article.data).
const source = computed(() => article?.data?.source || '');
</script>

<style scoped>
.article-page { background: var(--uni-bg-page); min-height: 60vh; }
.container { max-width: 1000px; margin: 0 auto; padding: 0 20px; }

.breadcrumb-bar { background: #fff; padding: 14px 0; font-size: 14px; color: #666; border-bottom: 1px solid var(--uni-border-light); }
.breadcrumb-bar .container { max-width: 1200px; }
.breadcrumb-bar a { color: #555; text-decoration: none; }
.breadcrumb-bar a:hover { color: var(--uni-primary); }
.breadcrumb-bar .sep { margin: 0 8px; color: #bbb; }
.breadcrumb-bar .current { color: var(--uni-primary); }

.article-main { padding: 36px 20px 60px; }
.article-card { background: #fff; border-radius: 6px; padding: 48px 64px; box-shadow: 0 2px 10px rgba(0,0,0,0.04); }

.article-title { text-align: center; font-size: 28px; font-weight: 700; color: var(--uni-text-title); margin: 0 0 22px; line-height: 1.45; }
.article-meta {
  display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 10px;
  color: #999; font-size: 14px; padding-bottom: 22px; margin-bottom: 30px;
  border-bottom: 1px solid var(--uni-border-light);
}
.article-meta .dot { color: #ddd; }

.article-summary {
  background: #faf7f7; border-left: 3px solid var(--uni-primary); color: #666;
  font-size: 15px; line-height: 1.8; padding: 14px 20px; margin-bottom: 28px; border-radius: 0 4px 4px 0;
}

.article-content { font-size: 16px; line-height: 1.9; color: var(--uni-text-body); }
.article-content :deep(p) { margin-bottom: 1.4em; }
.article-content :deep(img) { max-width: 100%; height: auto; display: block; margin: 22px auto; border-radius: 4px; }
.article-content :deep(h2), .article-content :deep(h3) { color: var(--uni-text-title); margin: 1.6em 0 .7em; }
.article-content :deep(a) { color: var(--uni-primary); text-decoration: none; }
.article-content :deep(a:hover) { text-decoration: underline; }
.article-content :deep(blockquote) { border-left: 3px solid var(--uni-border-light); padding-left: 16px; color: #888; margin: 1.2em 0; }
.article-content :deep(table) { border-collapse: collapse; width: 100%; margin: 1.2em 0; }
.article-content :deep(td), .article-content :deep(th) { border: 1px solid var(--uni-border-light); padding: 8px 12px; }

.article-foot { margin-top: 44px; padding-top: 18px; border-top: 1px dashed var(--uni-border-light); text-align: right; font-size: 14px; color: #888; }

@media (max-width: 768px) {
  .article-card { padding: 28px 20px; }
  .article-title { font-size: 22px; }
  .article-content { font-size: 15px; }
}
</style>
