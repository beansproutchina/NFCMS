<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { marked } from 'marked';
import * as api from '../../../api';
import DiaryGrid from './components/DiaryGrid.vue';

const props = defineProps<{ context: any }>();
const { config, article, breadcrumbs, categories } = props.context || {};
const router = useRouter();

const renderedContent = computed(() => {
  if (!article?.content) return '';
  return marked.parse(article.content);
});

const meetupDate = computed(() => {
  if (!article?.data?.date) return null;
  return new Date(article.data.date);
});

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

const daysAgo = computed(() => {
  if (!meetupDate.value) return null;
  const now = new Date();
  const diff = Math.floor((now.getTime() - meetupDate.value.getTime()) / 86400000);
  return diff;
});

const isPast = computed(() => {
  if (!meetupDate.value) return false;
  return meetupDate.value < new Date();
});

const isFuture = computed(() => {
  if (!meetupDate.value) return false;
  return meetupDate.value > new Date();
});

const daysUntil = computed(() => {
  if (!meetupDate.value || isPast.value) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(meetupDate.value);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
});

// Related diaries
const relatedDiaries = ref<any[]>([]);

onMounted(async () => {
  try {
    const diaryCat = categories?.find((c: any) => c.slug === 'diary' || c.slug === 'riji');
    if (diaryCat && article?.id) {
      const res: any = await api.crudAPI.getList('articles', {
        filter: { category_id: diaryCat.id, visible: 1, "data.meetup_id": article.id },
        orderBy: 'published_at',
        orderDesc: true,
      });
      relatedDiaries.value = res?.data || [];
    }
  } catch (e) {
    console.error('Failed to load related diaries:', e);
  }
});

const openDiary = (diary: any) => {
  router.push(`/a/${diary.category?.slug || 'diary'}/${diary.slug}`);
};
</script>

<template>
  <main class="meetup-article">
    <div class="back-link">
      <button @click="router.push(article?.category ? `/a/${article.category.slug}` : '/')">
        ← 返回{{ article?.category?.name || '列表' }}
      </button>
    </div>
    <!-- Article Content -->
    <article class="article-body">
      <header class="article-header">
        <h1>{{ article?.title }}</h1>
      </header>

      <div v-if="article?.thumbnail" class="featured-image">
        <img :src="article.thumbnail" alt="">
      </div>

    </article>
    <!-- Date Banner -->
    <div class="date-banner" :class="{ past: isPast, future: isFuture }">
      <div class="banner-orbit">
        <svg viewBox="0 0 120 120" class="orbit-svg">
          <circle cx="60" cy="60" r="52" class="orbit-bg" />
          <circle cx="60" cy="60" r="52" class="orbit-fill" v-if="isFuture"
            :stroke-dashoffset="52 * 2 * Math.PI * (1 - Math.min((daysUntil || 0) / 365, 1))" />
        </svg>
        <div class="banner-center">
          <div class="banner-day">{{ meetupDate?.getDate() }}</div>
          <div class="banner-month">{{ meetupDate ? (meetupDate.getMonth() + 1) + '月' : '' }}</div>
        </div>
      </div>
      <div class="banner-info">
        <div class="banner-date-text" v-if="meetupDate">{{ formatDate(article.data.date) }}</div>
        <div class="banner-status" v-if="isPast && daysAgo !== null">
          {{ daysAgo }} 天前相见 ✧
        </div>
        <div class="banner-status future" v-else-if="isFuture">
          还有 {{ daysUntil }} 天 ✈
        </div>
        <div class="banner-status today" v-else-if="meetupDate && !isPast && !isFuture">
          就是今天！♡
        </div>
      </div>
    </div>



    <!-- Related diaries -->
    <section class="related-diaries" v-if="relatedDiaries.length">
      <h2 class="related-title">📝 关联日记</h2>
      <DiaryGrid :diaries="relatedDiaries" @open="openDiary" :meetup-map="{[article.id]:article}"/>
    </section>
  </main>
</template>

<style scoped>
.meetup-article {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
  width: 100%;
}

.cosmic-crumbs {
  font-family: var(--font-body);
  font-size: 0.85rem;
  color: var(--ink-muted);
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.cosmic-crumbs span { cursor: pointer; transition: color 0.3s; }
.cosmic-crumbs span:hover { color: var(--accent-rose); }
.crumb-sep { color: var(--accent-lavender); opacity: 0.5; }
.crumb-current { color: var(--accent-rose); cursor: default; }

/* Date Banner */
.date-banner {
  display: flex;
  align-items: center;
  gap: 2rem;
  background: var(--surface);
  border: 1px solid var(--border-glow);
  border-radius: 24px;
  padding: 2rem;
  margin-bottom: 3rem;
  backdrop-filter: blur(10px);
  position: relative;
  overflow: hidden;
}
.date-banner::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 30% 50%, rgba(255, 107, 157, 0.08), transparent 60%);
  pointer-events: none;
}
.date-banner.future {
  border-color: rgba(255, 213, 79, 0.3);
}
.date-banner.future::before {
  background: radial-gradient(ellipse at 30% 50%, rgba(255, 213, 79, 0.08), transparent 60%);
}

.banner-orbit {
  position: relative;
  width: 100px;
  height: 100px;
  flex-shrink: 0;
}
.orbit-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}
.orbit-bg {
  fill: none;
  stroke: rgba(255, 107, 157, 0.12);
  stroke-width: 3;
}
.orbit-fill {
  fill: none;
  stroke: var(--accent-gold);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: 326.73;
  transition: stroke-dashoffset 1.5s ease-out;
  filter: drop-shadow(0 0 10px rgba(255, 213, 79, 0.6));
}
.banner-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}
.banner-day {
  font-family: var(--font-display);
  font-size: 2.2rem;
  font-weight: 700;
  color: var(--ink);
  line-height: 1;
}
.banner-month {
  font-family: var(--font-body);
  font-size: 0.8rem;
  color: var(--accent-peach);
  margin-top: 2px;
}

.banner-info { position: relative; z-index: 1; }
.banner-date-text {
  font-family: var(--font-display);
  font-size: 1.1rem;
  color: var(--ink-soft);
  margin-bottom: 0.5rem;
}
.banner-status {
  font-family: var(--font-body);
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--accent-rose);
}
.banner-status.future {
  color: var(--accent-gold);
}
.banner-status.today {
  color: var(--accent-peach);
  font-size: 1.4rem;
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

/* Article */
.article-header h1 {
  font-family: var(--font-display);
  font-size: 2.8rem;
  font-weight: 700;
  color: var(--ink);
  margin: 0 0 1rem;
  line-height: 1.2;
}
.meta {
  font-family: var(--font-body);
  font-size: 0.85rem;
  color: var(--ink-muted);
  display: flex;
  gap: 0.8rem;
  align-items: center;
  margin-bottom: 2rem;
}
.dot { color: var(--accent-lavender); }

.featured-image {
  margin: 2rem 0;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--border-glow);
}
.featured-image img { width: 100%; display: block; }

.content {
  font-family: var(--font-body);
  font-size: 1.05rem;
  line-height: 1.8;
  color: var(--ink-soft);
  max-width: 680px;
}
.content :deep(h2) {
  font-family: var(--font-display);
  font-size: 1.6rem;
  color: var(--ink);
  margin-top: 2.5rem;
  margin-bottom: 1rem;
}
.content :deep(p) { margin: 1rem 0; }
.content :deep(blockquote) {
  border-left: 3px solid var(--accent-rose);
  background: rgba(255, 107, 157, 0.06);
  padding: 1rem 1.5rem;
  margin: 1.5rem 0;
  border-radius: 0 12px 12px 0;
  font-style: italic;
  color: var(--ink-soft);
}
.content :deep(img) {
  border-radius: 12px;
  max-width: 100%;
}



/* Related Diaries */
.related-diaries {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid var(--border-glow);
}
.related-title {
  font-family: var(--font-display);
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 1.5rem;
}

@media (max-width: 700px) {
  .meetup-article { padding: 1.5rem 1rem 4rem; }
  .date-banner { flex-direction: column; text-align: center; gap: 1.5rem; padding: 1.5rem; }
  .banner-orbit { width: 80px; height: 80px; }
  .banner-day { font-size: 1.8rem; }
  .article-header h1 { font-size: 1.8rem; }
  .content { font-size: 0.95rem; }

  .related-diaries { margin-top: 2rem; padding-top: 1.5rem; }
  .related-title { font-size: 1.1rem; }
}
</style>
