<template>
  <div class="category-page theme-uni">
    <AHeader :context="context" />

    <!-- 顶栏面包屑 -->
    <div class="banner-min"></div>
    <div class="breadcrumb-container">
      <div class="container">
        当前位置：
        <a href="/">首页</a> 
        <span class="sep">&gt;</span>
        <span v-for="(crumb, index) in breadcrumbs" :key="crumb.id">
          <a v-if="index < breadcrumbs.length - 1" :href="`/category/${crumb.id}`">{{ crumb.name }}</a>
          <span v-else class="current">{{ crumb.name }}</span>
          <span class="sep" v-if="index < breadcrumbs.length - 1">&gt;</span>
        </span>
      </div>
    </div>

    <!-- 列表页主体 (左右分栏，左导航右列表) -->
    <div class="container layout-grid">
      <!-- 左侧边栏导航 -->
      <aside class="sidebar">
        <h3 class="side-title">{{ category?.name || '分类列表' }}</h3>
        <ul class="side-menu" v-if="children && children.length > 0">
          <li v-for="child in children" :key="child.id">
            <a :href="`/category/${child.id}`">{{ child.name }}</a>
          </li>
        </ul>
        <div v-else class="side-menu-empty">暂无子分类</div>
      </aside>

      <!-- 右侧文章列表 -->
      <main class="content-main">
        <h2 class="content-title">{{ category?.name || '文章列表' }}</h2>
        
        <ul class="article-list" v-if="articles && articles.length > 0">
          <li v-for="item in articles" :key="item.id">
            <span class="bullet"></span>
            <a :href="`/article/${item.id}`" :title="item.title">{{ item.title }}</a>
            <span class="date">{{ formatDate(item.published_at) }}</span>
          </li>
        </ul>
        
        <div class="empty-state" v-else>
          <p>该分类下暂无文章</p>
        </div>
      </main>
    </div>

    <AFooter :context="context" />
  </div>
</template>

<script setup lang="ts">
import AHeader from './components/AHeader.vue';
import AFooter from './components/AFooter.vue';

const props = defineProps<{ context: any }>();
const { category, articles, breadcrumbs, children } = props.context || {};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
</script>

<style scoped>
.theme-uni {
  --uni-primary: #8B0000;
  --uni-bg-page: #F5F5F5;
  --uni-text-title: #222222;
  --uni-text-body: #444444;
  --uni-border-light: #E8E8E8;
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
  background-color: var(--uni-bg-page);
  min-height: 100vh;
}

.banner-min {
  height: 200px;
  background: url('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80') center/cover no-repeat;
  position: relative;
}
.banner-min::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(139, 0, 0, 0.4);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

/* 面包屑导航 */
.breadcrumb-container {
  background-color: #fff;
  padding: 16px 0;
  font-size: 14px;
  color: #666;
  border-bottom: 1px solid var(--uni-border-light);
  margin-bottom: 30px;
}
.breadcrumb-container a { color: #333; text-decoration: none; }
.breadcrumb-container a:hover { color: var(--uni-primary); }
.breadcrumb-container .sep { margin: 0 8px; color: #999; }
.breadcrumb-container .current { color: var(--uni-primary); }

/* 左右结构 */
.layout-grid {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 30px;
  align-items: start;
}

/* 侧边栏 */
.sidebar {
  background: #fff;
  border: 1px solid var(--uni-border-light);
}
.side-title {
  background-color: var(--uni-primary);
  color: #fff;
  margin: 0;
  padding: 16px 20px;
  font-size: 20px;
  font-weight: 500;
  text-align: center;
}
.side-menu { list-style: none; padding: 0; margin: 0; }
.side-menu li { border-bottom: 1px dashed var(--uni-border-light); }
.side-menu li:last-child { border-bottom: none; }
.side-menu li a {
  display: block;
  padding: 14px 20px;
  color: var(--uni-text-title);
  text-decoration: none;
  font-size: 15px;
  transition: all 0.3s;
}
.side-menu li a:hover {
  background-color: #f0f5fa;
  color: var(--uni-primary);
  padding-left: 25px;
}
.side-menu-empty { padding: 30px; text-align: center; color: #999; }

/* 主区域 */
.content-main {
  background: #fff;
  padding: 30px;
  border: 1px solid var(--uni-border-light);
  min-height: 500px;
}
.content-title {
  font-size: 24px;
  color: var(--uni-primary);
  border-bottom: 2px solid var(--uni-primary);
  padding-bottom: 12px;
  margin: 0 0 20px 0;
  font-weight: 500;
}

/* 文章列表 */
.article-list { list-style: none; padding: 0; margin: 0; }
.article-list li {
  display: flex;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px dashed #e8e8e8;
}
.article-list li .bullet {
  width: 6px; height: 6px;
  background-color: var(--uni-primary);
  margin-right: 12px;
}
.article-list li a {
  flex: 1;
  color: var(--uni-text-title);
  text-decoration: none;
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 20px;
}
.article-list li a:hover { color: var(--uni-primary); }
.article-list li .date {
  color: #999;
  font-size: 14px;
}
.empty-state { text-align: center; padding: 80px 0; color: #999; font-size: 15px; }

@media (max-width: 768px) {
  .layout-grid { grid-template-columns: 1fr; }
  .article-list li .date { display: block; width: 100%; text-align: left; margin-top: 5px; }
  .article-list li { flex-wrap: wrap; }
}
</style>
