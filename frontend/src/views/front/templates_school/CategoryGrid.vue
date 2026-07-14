<template>
  <div class="category-page theme-uni">
    <AHeader :context="context" />

    <!-- 顶栏图 -->
    <div class="banner-min"></div>
    <div class="breadcrumb-container">
      <div class="container">
        当前位置：
        <a href="/">首页</a> 
        <span class="sep">&gt;</span>
        <span v-for="(crumb, index) in breadcrumbs" :key="crumb.id">
          <a v-if="Number(index) < breadcrumbs.length - 1" :href="`/category/${crumb.id}`">{{ crumb.name }}</a>
          <span v-else class="current">{{ crumb.name }}</span>
          <span class="sep" v-if="Number(index) < breadcrumbs.length - 1">&gt;</span>
        </span>
      </div>
    </div>

    <!-- 列表页主体 (左右分栏，左导航右网格) -->
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

      <!-- 右侧图文网格 -->
      <main class="content-main">
        <h2 class="content-title">{{ category?.name || '图文列表' }}</h2>
        
        <div class="article-grid" v-if="articles && articles.length > 0">
          <a v-for="item in articles" :key="item.id" :href="`/article/${item.id}`" class="card-item">
            <div class="img-wrap">
              <img :src="item.thumbnail || 'https://via.placeholder.com/320x180/8B0000/fff?text=No+Image'" alt="封面" />
            </div>
            <div class="card-info">
              <h3 class="title" :title="item.title">{{ item.title }}</h3>
              <p class="date">{{ formatDate(item.published_at) }}</p>
            </div>
          </a>
        </div>
        
        <div class="empty-state" v-else>
          <p>该分类下暂无内容</p>
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
  background: rgba(0, 64, 152, 0.4); /* 使用理工蓝点缀改变气氛 */
}

.container { max-width: 1200px; margin: 0 auto; }

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
.sidebar { background: #fff; border: 1px solid var(--uni-border-light); }
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
.side-menu li a { display: block; padding: 14px 20px; color: var(--uni-text-title); text-decoration: none; font-size: 15px; transition: all 0.3s; }
.side-menu li a:hover { background-color: #f0f5fa; color: var(--uni-primary); padding-left: 25px; }
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
  margin: 0 0 24px 0;
  font-weight: 500;
}

/* 图文网格 */
.article-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
.card-item {
  display: block;
  text-decoration: none;
  border: 1px solid var(--uni-border-light);
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
  transition: box-shadow 0.3s, transform 0.3s;
}
.card-item:hover {
  box-shadow: 0 8px 16px rgba(0,0,0,0.08);
  transform: translateY(-4px);
  border-color: var(--uni-primary);
}
.img-wrap {
  width: 100%;
  height: 160px;
  overflow: hidden;
  background: #f0f0f0;
}
.img-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}
.card-item:hover .img-wrap img { transform: scale(1.05); }

.card-info { padding: 16px; }
.card-info .title {
  color: var(--uni-text-title);
  font-size: 16px;
  margin: 0 0 10px 0;
  font-weight: normal;
  /* 多行省略 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}
.card-info .date { color: #999; font-size: 12px; margin: 0; text-align: right; }

.card-item:hover .title { color: var(--uni-primary); }

.empty-state { text-align: center; padding: 80px 0; color: #999; font-size: 15px; }

@media (max-width: 768px) {
  .layout-grid { grid-template-columns: 1fr; }
  .article-grid { grid-template-columns: repeat(2, 1fr); gap: 15px; }
  .img-wrap { height: 120px; }
}

@media (max-width: 480px) {
  .article-grid { grid-template-columns: 1fr; }
}
</style>
