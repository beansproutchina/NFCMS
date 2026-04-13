<script setup lang="ts">
import { useRouter } from 'vue-router';
import AHeader from './components/AHeader.vue';
import AFooter from './components/AFooter.vue';

const props = defineProps<{ context: any }>();
const { config, category, articles, breadcrumbs } = props.context || {};
const router = useRouter();
</script>

<template>
  <div class="category-root">
    <AHeader :context="context" />
    <main class="cat-main">
      <!-- 面包屑 -->
      <div class="breadcrumbs">
        <span @click="router.push('/')">首页</span>
        <template v-for="crumb in breadcrumbs" :key="crumb.id">
          <span class="sep">/</span>
          <span @click="router.push(`/a/${crumb.slug}`)">{{ crumb.name }}</span>
        </template>
      </div>

      <header class="cat-header">
        <h1>{{ category?.name || '分类' }}</h1>
        <p v-if="category?.data?.description">{{ category.data.description }}</p>
      </header>

      <div class="cat-grid" v-if="articles?.length">
        <article v-for="item in articles" :key="item.id" class="cat-card" @click="router.push(`/a/${category?.slug}/${item.slug}`)">
          <div class="cat-card-badge" v-if="item.is_top">✦ 置顶</div>
          <h2>{{ item.title }}</h2>
          <p>{{ item.description || '暂无描述' }}</p>
          <time>{{ new Date(item.published_at).toLocaleDateString() }}</time>
        </article>
      </div>
      <div v-else class="empty">暂无文章</div>
    </main>
    <AFooter :context="context" />
  </div>
</template>

<style>
.category-root {
  --bg-page: #F4F1EA;
  --surface: #FFFFFF;
  --ink: #1C1C1C;
  --accent: #D64933;
  --border-light: #D1CCC5;
  --shadow-hard: 8px 8px 0 #1C1C1C;
  background: var(--bg-page);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: 'Manrope', sans-serif;
  color: var(--ink);
}
.cat-main {
  max-width: 1280px;
  margin: 0 auto;
  padding: 3rem 2rem;
  width: 100%;
}
.breadcrumbs {
  font-family: 'Space Mono', monospace;
  margin-bottom: 3rem;
  cursor: pointer;
}
.breadcrumbs span { text-decoration: underline 1px wavy var(--accent); }
.sep { margin: 0 8px; text-decoration: none; }
.cat-header h1 {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: 5rem;
  margin-bottom: 0.5rem;
}
.cat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2rem;
  margin-top: 3rem;
}
.cat-card {
  background: var(--surface);
  border: 3px solid var(--ink);
  padding: 2rem;
  box-shadow: var(--shadow-hard);
  cursor: pointer;
  transition: 0.15s;
}
.cat-card:hover { box-shadow: 12px 12px 0 var(--ink); }
.cat-card-badge { color: var(--accent); font-family: 'Space Mono'; }
.cat-card h2 { font-family: 'Bricolage Grotesque'; font-size: 2rem; }
@media (max-width: 700px) { .cat-grid { grid-template-columns: 1fr; } }
</style>