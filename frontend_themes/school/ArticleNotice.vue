<template>
  <div class="notice-page">
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

    <main class="container notice-main">
      <article class="notice-card">
        <h1 class="notice-title">{{ article?.title || '通知公告' }}</h1>

        <!-- 公文信息:仅在文章自定义字段(article.data)提供时显示 -->
        <div class="notice-header" v-if="department || docNumber || article?.published_at">
          <span v-if="department">发文单位：{{ department }}</span>
          <span v-if="docNumber">发文字号：{{ docNumber }}</span>
          <span v-if="article?.published_at">发文日期：{{ formatDate(article.published_at) }}</span>
        </div>

        <div class="notice-content" v-html="renderedContent"></div>

        <!-- 落款:仅在有发文单位时显示 -->
        <div class="notice-sign" v-if="department">
          <div class="sign-org">{{ department }}</div>
          <div class="sign-date" v-if="article?.published_at">{{ formatDateCN(article.published_at) }}</div>
        </div>
      </article>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { renderMarkdown } from '@/lib/prose';

const props = defineProps<{ context: any }>();
const { article, breadcrumbs } = props.context || {};

// content is Markdown (see ArticleModel); render to HTML like the other themes / SSG.
const renderedContent = computed(() => (article?.content ? (renderMarkdown(article.content)) : '<p>暂无正文</p>'));

const pad = (n: number) => String(n).padStart(2, '0');
const formatDate = (s: string) => { if (!s) return ''; const d = new Date(s); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const formatDateCN = (s: string) => { if (!s) return ''; const d = new Date(s); return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`; };

// Official-document fields come from the article's custom data (category article_data_fields).
// Nothing is fabricated — if the school doesn't define these, the blocks simply don't render.
const department = computed(() => article?.data?.department || '');
const docNumber = computed(() => article?.data?.doc_number || article?.data?.docNumber || '');
</script>

<style scoped>
.notice-page { background: #f0f2f5; min-height: 60vh; }
.container { max-width: 1000px; margin: 0 auto; padding: 0 20px; }

.breadcrumb-bar { background: #fff; padding: 14px 0; font-size: 14px; color: #666; border-bottom: 1px solid var(--uni-border-light); margin-bottom: 30px; }
.breadcrumb-bar a { color: #555; text-decoration: none; }
.breadcrumb-bar a:hover { color: var(--uni-primary); }
.breadcrumb-bar .sep { margin: 0 8px; color: #bbb; }
.breadcrumb-bar .current { color: var(--uni-primary); }

.notice-main { max-width: 900px; margin: 0 auto; padding-bottom: 50px; }
.notice-card { background: #fff; border: 1px solid #e0e0e0; border-top: 4px solid var(--uni-primary); padding: 56px 72px; }

.notice-title {
  text-align: center; font-size: 30px; font-weight: bold; color: var(--uni-primary);
  margin: 0 0 26px; letter-spacing: 2px; line-height: 1.5;
  border-bottom: 2px solid var(--uni-primary); padding-bottom: 20px;
}
.notice-header {
  display: flex; justify-content: center; flex-wrap: wrap; gap: 8px 28px;
  font-size: 14px; color: #666; margin-bottom: 36px;
}

.notice-content { font-size: 17px; line-height: 2; color: #222; font-family: "FangSong", "STFangsong", "Microsoft YaHei", serif; }
.notice-content :deep(p) { margin-bottom: 1.2em; text-indent: 2em; }
.notice-content :deep(img) { max-width: 100%; height: auto; display: block; margin: 20px auto; text-indent: 0; }
.notice-content :deep(h2), .notice-content :deep(h3) { text-indent: 0; }
.notice-content :deep(table) { border-collapse: collapse; width: 100%; margin: 1em 0; }
.notice-content :deep(td), .notice-content :deep(th) { border: 1px solid #ccc; padding: 8px 12px; text-indent: 0; }

.notice-sign {
  margin-top: 60px; text-align: right; font-size: 17px;
  font-family: "FangSong", "STFangsong", "Microsoft YaHei", serif; color: #222;
}
.notice-sign .sign-org { font-weight: 600; margin-bottom: 8px; }
.notice-sign .sign-date { color: #444; }

@media (max-width: 768px) {
  .notice-card { padding: 30px 22px; }
  .notice-title { font-size: 22px; }
  .notice-content { font-size: 16px; }
}
</style>
