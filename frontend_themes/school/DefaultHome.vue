<template>
  <div class="home-page">
    <!-- 首屏大图轮播区 -->
    <div class="banner">
      <div class="banner-mask"></div>
      <div class="banner-text">厚德载物 自强不息</div>
    </div>
    
    <!-- 主体内容 -->
    <div class="container main-grid">
      <!-- 新闻活动版块 -->
      <div class="section-left">
        <div class="section-head">
          <h2 class="title">综合新闻</h2>
          <a class="more" :href="`/a/${categories?.[0]?.slug || 'news'}`">更多 &raquo;</a>
        </div>
        
        <ul class="news-list">
          <li v-for="item in (articles || []).slice(0, 7)" :key="item.id">
            <span class="bullet"></span>
            <a :href="`/a/${item.category.slug}/${item.slug}`" :title="item.title">{{ item.title }}</a>
            <span class="date">{{ formatDate(item.published_at) }}</span>
          </li>
        </ul>
      </div>

      <!-- 通知公告版块 -->
      <div class="section-right">
        <div class="section-head">
          <h2 class="title">通知公告</h2>
          <a class="more" href="#">更多 &raquo;</a>
        </div>
        
        <ul class="notice-list">
          <li v-for="item in (articles || []).slice(0, 5)" :key="item.id">
            <div class="date-box">
              <span class="day">{{ new Date(item.published_at).getDate() }}</span>
              <span class="month">{{ new Date(item.published_at).getMonth() + 1 }}月</span>
            </div>
            <a :href="`/a/${item.category.slug}/${item.slug}`">{{ item.title }}</a>
          </li>
        </ul>
      </div>
    </div>
    
    <!-- 专题卡片展区 -->
    <div class="container feature-grid">
      <div class="card card-red">
        <h3>高层次人才引进</h3>
        <p>JOIN US</p>
      </div>
      <div class="card card-blue">
        <h3>国际交流合作</h3>
        <p>GLOBAL VIEW</p>
      </div>
      <div class="card card-gray">
        <h3>数字校园平台</h3>
        <p>E-CAMPUS</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ context: any }>();
const { articles, categories } = props.context || {};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
</script>

<style scoped>
.home-page {
  background-color: #fff;
}

/* Banner */
.banner {
  position: relative;
  height: 480px;
  background: url('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80') center/cover no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
}
.banner-mask {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.3);
}
.banner-text {
  position: relative;
  z-index: 2;
  font-size: 56px;
  font-family: "STKaiti", "KaiTi", serif;
  color: #fff;
  letter-spacing: 12px;
  text-shadow: 2px 4px 10px rgba(0,0,0,0.5);
}

/* 结构布局 */
.container {
  max-width: 1200px;
  margin: 0 auto;
}
.main-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 40px;
  margin-bottom: 40px;
  margin-top: 20px;
}

/* 板块通用题头 */
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid var(--uni-primary);
  padding-bottom: 8px;
  margin-bottom: 16px;
}
.section-head .title {
  font-size: 24px;
  color: var(--uni-primary);
  font-weight: 600;
  margin: 0;
}
.section-head .more {
  font-size: 14px;
  color: #666;
  text-decoration: none;
}
.section-head .more:hover { color: var(--uni-primary); }

/* 左侧新闻列表 */
.news-list { list-style: none; padding: 0; margin: 0; }
.news-list li {
  display: flex;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px dashed #e8e8e8;
}
.news-list li .bullet {
  width: 6px; height: 6px;
  background-color: var(--uni-primary);
  margin-right: 12px;
}
.news-list li a {
  flex: 1;
  color: var(--uni-text-title);
  text-decoration: none;
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 20px;
}
.news-list li a:hover { color: var(--uni-primary); }
.news-list li .date {
  color: #999;
  font-size: 14px;
}

/* 右侧通知列表 */
.notice-list { list-style: none; padding: 0; margin: 0; }
.notice-list li {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}
.date-box {
  background: #f5f5f5;
  border: 1px solid #e8e8e8;
  padding: 4px;
  text-align: center;
  width: 50px;
  margin-right: 16px;
  display: flex;
  flex-direction: column;
}
.date-box .day { font-size: 20px; font-weight: bold; color: var(--uni-primary); }
.date-box .month { font-size: 12px; color: #666; }
.notice-list li a {
  flex: 1;
  color: var(--uni-text-title);
  text-decoration: none;
  font-size: 15px;
  line-height: 1.5;
}
.notice-list li a:hover { color: var(--uni-primary); }

/* 底部专题卡片 */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  padding-bottom: 40px;
}
.card {
  padding: 40px 20px;
  text-align: center;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.3s;
}
.card:hover { transform: translateY(-4px); }
.card h3 { font-size: 22px; font-weight: 500; margin: 0 0 10px 0; }
.card p { font-size: 12px; opacity: 0.8; margin: 0; letter-spacing: 2px; }
.card-red { background: linear-gradient(135deg, var(--uni-primary), var(--uni-primary-light)); }
.card-blue { background: linear-gradient(135deg, #004098, #0056b3); }
.card-gray { background: linear-gradient(135deg, #444, #666); }

@media (max-width: 768px) {
  .main-grid { grid-template-columns: 1fr; }
  .feature-grid { grid-template-columns: 1fr; }
  .banner-text { font-size: 32px; letter-spacing: 6px; }
}
</style>
