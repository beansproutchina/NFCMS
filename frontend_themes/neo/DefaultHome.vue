<script setup lang="ts">
import { useRouter } from 'vue-router';
import AHeader from './components/AHeader.vue';
import AFooter from './components/AFooter.vue';

const props = defineProps<{ context: any }>();
const { config, articles, categories } = props.context || {};
const router = useRouter();

const getCategorySlug = (id: number) => categories?.find((c: any) => c.id === id)?.slug || '';
const getCategoryName = (id: number) => categories?.find((c: any) => c.id === id)?.name || '';

const openArticle = (article: any) => {
  const catSlug = getCategorySlug(article.category_id);
  router.push(`/a/${catSlug}/${article.slug}`);
};

// 将文章分为特色与列表（前2篇为特色，其余为网格）
const featuredArticles = articles?.slice(0, 2) || [];
const gridArticles = articles?.slice(2) || [];
</script>

<template>
  <div class="home-root">
    <AHeader :context="context" />
    
    <main class="home-main">
      <!-- Hero 区域：使用超大留白与边框 -->
      <section class="hero">
        <h1 class="hero-title">
          <span class="hero-line1">{{ config?.site_name || 'BRUTAL' }}</span>
          <span class="hero-line2">EDITORIAL</span>
        </h1>
        <p class="hero-sub">{{ config?.subtitle || '硬朗与温度并存的文字容器' }}</p>
        <div class="hero-decor">⸺</div>
      </section>

      <!-- 特色文章区 (2列，不对称) -->
      <section class="featured-section" v-if="featuredArticles.length">
        <div class="featured-grid">
          <article 
            v-for="(item, idx) in featuredArticles" 
            :key="item.id"
            class="featured-card"
            :class="{ 'featured-primary': idx === 0 }"
            @click="openArticle(item)"
          >
            <div class="card-label">
              <span v-if="item.is_top">✦ 置顶</span>
              <span v-else>✦ 编辑推荐</span>
            </div>
            <h2 class="card-title">{{ item.title }}</h2>
            <p class="card-desc">{{ item.description || '暂无描述…' }}</p>
            <div class="card-meta">
              <span>{{ getCategoryName(item.category_id) }}</span>
              <span>{{ new Date(item.published_at).toLocaleDateString() }}</span>
            </div>
          </article>
        </div>
      </section>

      <!-- 文章网格（3列） -->
      <section class="grid-section" v-if="gridArticles.length">
        <div class="section-header">
          <h3>最新文章 <span class="header-arrow">→</span></h3>
        </div>
        <div class="article-grid">
          <article 
            v-for="item in gridArticles" 
            :key="item.id"
            class="grid-card"
            @click="openArticle(item)"
          >
            <div class="grid-card-inner">
              <div class="card-category">{{ getCategoryName(item.category_id) }}</div>
              <h4>{{ item.title }}</h4>
              <div class="grid-meta">{{ new Date(item.published_at).toLocaleDateString() }}</div>
            </div>
          </article>
        </div>
      </section>

      <div v-if="!articles?.length" class="empty-state">暂无文章</div>
    </main>

    <AFooter :context="context" />
  </div>
</template>

<style>
/* 全局设计变量注入 */
.home-root {
  --bg-page: #F4F1EA;
  --surface: #FFFFFF;
  --ink: #1C1C1C;
  --accent: #D64933;
  --border-light: #D1CCC5;
  --shadow-hard: 8px 8px 0 #1C1C1C;
  --shadow-soft: 4px 4px 0 #1C1C1C;
  
  background: var(--bg-page);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: 'Manrope', sans-serif;
  color: var(--ink);
}

.home-main {
  flex: 1;
  max-width: 1440px;
  margin: 0 auto;
  padding: 2rem 2rem 4rem;
  width: 100%;
}

/* Hero */
.hero {
  margin: 4rem 0 6rem;
  border-bottom: 3px solid var(--ink);
  padding-bottom: 3rem;
}

.hero-title {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: clamp(4rem, 12vw, 8rem);
  font-weight: 700;
  line-height: 0.9;
  letter-spacing: -0.03em;
  text-transform: uppercase;
  display: flex;
  flex-direction: column;
}

.hero-line2 {
  color: var(--accent);
  margin-left: 2rem;
  -webkit-text-stroke: 2px var(--ink);
  text-stroke: 2px var(--ink);
  color: transparent;
}

.hero-sub {
  font-family: 'Space Mono', monospace;
  font-size: 1.2rem;
  margin-top: 1.5rem;
  max-width: 600px;
  border-left: 12px solid var(--accent);
  padding-left: 1.5rem;
}

.hero-decor {
  margin-top: 2rem;
  font-size: 3rem;
  color: var(--border-light);
}

/* Featured 不对称网格 */
.featured-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;
  margin: 3rem 0;
}

.featured-card {
  background: var(--surface);
  border: 3px solid var(--ink);
  padding: 2rem;
  box-shadow: var(--shadow-hard);
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.1s;
  display: flex;
  flex-direction: column;
}

.featured-card:hover {
  box-shadow: 12px 12px 0 var(--ink);
  transform: translate(-2px, -2px);
}

.card-label {
  font-family: 'Space Mono', monospace;
  font-size: 0.8rem;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 1.5rem;
  letter-spacing: 1px;
}

.card-title {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: 2.5rem;
  font-weight: 600;
  line-height: 1.1;
  margin-bottom: 1rem;
}

.featured-primary .card-title {
  font-size: 3.5rem;
}

.card-desc {
  color: rgba(28, 28, 28, 0.8);
  margin: 1rem 0 2rem;
  line-height: 1.5;
}

.card-meta {
  margin-top: auto;
  display: flex;
  gap: 1.5rem;
  font-family: 'Space Mono', monospace;
  border-top: 2px solid var(--border-light);
  padding-top: 1.5rem;
}

/* 网格区 */
.section-header {
  margin: 5rem 0 2rem;
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: 2rem;
  border-bottom: 3px solid var(--ink);
  display: inline-block;
}

.article-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}

.grid-card {
  background: var(--surface);
  border: 2px solid var(--ink);
  box-shadow: var(--shadow-soft);
  cursor: pointer;
  transition: all 0.15s;
  padding: 1.5rem;
}

.grid-card:hover {
  box-shadow: 6px 6px 0 var(--ink);
  background: var(--ink);
  color: var(--surface);
}

.grid-card:hover .card-category { color: var(--accent); }
.grid-card h4 {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: 1.5rem;
  margin: 0.75rem 0 1rem;
}

.grid-meta {
  font-family: 'Space Mono', monospace;
  font-size: 0.8rem;
}

.empty-state {
  text-align: center;
  padding: 6rem;
  font-size: 1.5rem;
  border: 3px dashed var(--border-light);
}

@media (max-width: 900px) {
  .featured-grid { grid-template-columns: 1fr; }
  .article-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 600px) {
  .article-grid { grid-template-columns: 1fr; }
}
</style>