<template>
  <div class="article-page notice-theme theme-uni">
    <AHeader :context="context" />

    <!-- 精简版面包屑 -->
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

    <!-- 通知正文区域 (无侧边栏卡片风格) -->
    <main class="container notice-main">
      <div class="notice-card">
        <h1 class="notice-title">{{ article?.title || '通知公告' }}</h1>
        <div class="notice-header">
          <div class="meta-item">
            <span class="label">发文单位：</span>
            <span class="value">{{ article?.department || '教务处' }}</span>
          </div>
          <div class="meta-item">
            <span class="label">发文日期：</span>
            <span class="value">{{ formatDate(article?.published_at) }}</span>
          </div>
          <div class="meta-item">
             <span class="label">字政号：</span>
            <span class="value">校教字〔{{ new Date().getFullYear() }}〕{{ article?.id || '01' }}号</span>
          </div>
        </div>

        <div class="notice-content" v-html="article?.content || '<p>通知正文</p>'"></div>

        <div class="notice-signature">
           <div>此致，</div>
           <div>全体师生</div>
           <div class="sign-date">{{ formatDate(article?.published_at) }}</div>
        </div>
      </div>
    </main>

    <AFooter :context="context" />
  </div>
</template>

<script setup lang="ts">
import AHeader from './components/AHeader.vue';
import AFooter from './components/AFooter.vue';

const props = defineProps<{ context: any }>();
const { article, breadcrumbs } = props.context || {};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '未知时间';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
</script>

<style scoped>
.theme-uni {
  --uni-primary: #8B0000;
  --uni-text-title: #222222;
  --uni-text-body: #444444;
  --uni-border-light: #E8E8E8;
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
  background-color: #f0f2f5;
  min-height: 100vh;
}

.breadcrumb-container {
  background-color: #fff;
  padding: 16px 0;
  font-size: 14px;
  color: #666;
  border-bottom: 1px solid var(--uni-border-light);
  margin-bottom: 30px;
}
.breadcrumb-container .container { max-width: 1000px; margin: 0 auto; }
.breadcrumb-container a { color: #333; text-decoration: none; }
.breadcrumb-container a:hover { color: var(--uni-primary); }
.breadcrumb-container .sep { margin: 0 8px; color: #999; }
.breadcrumb-container .current { color: var(--uni-primary); }

.notice-main {
  max-width: 900px;
  margin: 0 auto 50px;
}

.notice-card {
  background: #fff;
  border: 1px solid #d9d9d9;
  border-top: 4px solid var(--uni-primary);
  padding: 60px 80px;
  position: relative;
}

.notice-title {
  text-align: center;
  font-size: 32px;
  font-weight: bold;
  color: var(--uni-primary);
  margin: 0 0 30px 0;
  letter-spacing: 4px;
  border-bottom: 2px solid var(--uni-primary);
  padding-bottom: 20px;
}

.notice-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 40px;
  font-size: 15px;
  color: #333;
}
.meta-item .label { color: #999; }

.notice-content {
  font-size: 18px; /* 公文正文字体偏大 */
  line-height: 2;
  color: #222;
  font-family: "FangSong", "STFangsong", serif; /* 仿宋体公文标准 */
  min-height: 300px;
}
.notice-content :deep(p) {
  text-indent: 2em;
  margin-bottom: 1.5em;
}

.notice-signature {
  margin-top: 80px;
  text-align: right;
  font-size: 18px;
  font-family: "FangSong", "STFangsong", serif;
  color: #222;
  border-top: 1px dashed var(--uni-border-light);
  padding-top: 30px;
}
.notice-signature > div { margin-bottom: 10px; }
.sign-date { margin-top: 20px; color: #666; font-size: 16px; }

@media (max-width: 768px) {
  .notice-card { padding: 30px 20px; }
  .notice-title { font-size: 24px; letter-spacing: 2px; }
  .notice-header { flex-direction: column; gap: 10px; }
  .notice-content { font-size: 16px; }
}
</style>
