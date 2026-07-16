<template>
  <div class="article-page">
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

    <!-- 文章正文区域 -->
    <main class="container article-main">
      <div class="article-wrapper">
        <!-- 标题区域 -->
        <h1 class="article-title">{{ article?.title || '文章标题' }}</h1>
        <div class="article-meta">
          发布时间：{{ formatDate(article?.published_at) }}
          <span class="divider">|</span>
          来源：{{ article?.source || config?.site_name || '本站' }}
          <span class="divider">|</span>
          阅读量：{{ article?.views || 0 }} 次
        </div>

        <!-- 正文内容 -->
        <div class="article-content" v-html="article?.content || '<p>暂无内容</p>'"></div>

        <!-- 文章附件/声明/分享等 -->
        <div class="article-footer">
          <p>责任编辑：{{ article?.author || '网管中心' }}</p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ context: any }>();
const { article, breadcrumbs, config } = props.context || {};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '未知时间';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
</script>

<style scoped>
.article-page {
  background-color: #f5f5f5;
}

.banner-min {
  height: 160px;
  background: url('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80') center/cover no-repeat;
  position: relative;
}
.banner-min::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(139, 0, 0, 0.5);
}

.container {
  max-width: 1000px;
  margin: 0 auto;
}

/* 面包屑导航 */
.breadcrumb-container {
  background-color: #fff;
  padding: 16px 0;
  font-size: 14px;
  color: #666;
  border-bottom: 1px solid var(--uni-border-light);
  margin-bottom: 40px;
}
.breadcrumb-container .container { max-width: 1200px; }
.breadcrumb-container a { color: #333; text-decoration: none; }
.breadcrumb-container a:hover { color: var(--uni-primary); }
.breadcrumb-container .sep { margin: 0 8px; color: #999; }
.breadcrumb-container .current { color: var(--uni-primary); }

/* 主区域 */
.article-main {
  background: #fff;
  padding: 50px 80px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.05);
  margin-bottom: 40px;
  border-radius: 4px;
}

.article-title {
  text-align: center;
  font-size: 28px;
  font-weight: 600;
  color: var(--uni-text-title);
  margin: 0 0 24px 0;
  line-height: 1.4;
}

.article-meta {
  text-align: center;
  color: #888;
  font-size: 14px;
  padding-bottom: 30px;
  margin-bottom: 30px;
  border-bottom: 1px dashed var(--uni-border-light);
}
.article-meta .divider {
  margin: 0 15px;
  color: #e0e0e0;
}

.article-content {
  font-size: 16px;
  line-height: 1.8;
  color: var(--uni-text-body);
  text-align: justify;
}
.article-content :deep(p) {
  margin-bottom: 1.5em;
  text-indent: 2em;
}
.article-content :deep(img) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 20px auto;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.article-content :deep(h2), .article-content :deep(h3) {
  color: var(--uni-text-title);
  margin-top: 1.5em;
  margin-bottom: 0.8em;
  text-indent: 0;
}
.article-content :deep(a) {
  color: var(--uni-primary);
  text-decoration: none;
}
.article-content :deep(a:hover) {
  text-decoration: underline;
}

.article-footer {
  margin-top: 50px;
  padding-top: 20px;
  border-top: 1px dotted var(--uni-border-light);
  text-align: right;
  font-size: 14px;
  color: #666;
}

@media (max-width: 768px) {
  .article-main { padding: 30px 20px; }
  .article-title { font-size: 22px; }
  .article-content { font-size: 15px; }
  .article-content :deep(p) { text-indent: 0; }
  .article-meta .divider { margin: 0 8px; }
}
</style>
