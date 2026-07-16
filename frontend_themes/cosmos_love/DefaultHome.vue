<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import LoveCounter from './components/LoveCounter.vue';
import CountdownCard from './components/CountdownCard.vue';
import VinylPlayer from './components/VinylPlayer.vue';
import DiaryGrid from './components/DiaryGrid.vue';

const props = defineProps<{ context: any }>();
const { config, articles, categories, user } = props.context || {};
const router = useRouter();
// Category helpers
const getCategorySlug = (id: number) => categories?.find((c: any) => c.id === id)?.slug || '';
const getCategoryName = (id: number) => categories?.find((c: any) => c.id === id)?.name || '';
const getCategoryBySlug = (slug: string) => categories?.find((c: any) => c.slug === slug);
const getCategoryArticles = (slug: string) => articles?.filter((a: any) => getCategorySlug(a.category_id) === slug) || [];

// Categories by type
const meetupCat = computed(() => getCategoryBySlug('meetup') || getCategoryBySlug('jianmian'));
const diaryCat = computed(() => getCategoryBySlug('diary') || getCategoryBySlug('riji'));
const musicCat = computed(() => getCategoryBySlug('music') || getCategoryBySlug('yinyue'));

const meetupArticles = computed(() => getCategoryArticles(meetupCat.value?.slug || ''));
const diaryArticles = computed(() => getCategoryArticles(diaryCat.value?.slug || ''));
const musicArticles = computed(() => getCategoryArticles(musicCat.value?.slug || ''));

// Meetup name resolution
const meetupMap = ref<Record<string, any>>({});
onMounted(() => {
  for (const m of meetupArticles.value) {
    meetupMap.value[m.id] = m;
  }
});

// Love start date from config subtitle or default
const loveStartDate = computed(() => config?.subtitle || '2026-03-03');

// Next meetup countdown
const nextMeetup = computed(() => {
  if (!meetupArticles.value.length) return null;
  const now = new Date();
  const future = meetupArticles.value
    .filter((a: any) => a.data?.date && new Date(a.data.date) >= now)
    .sort((a: any, b: any) => new Date(a.data.date).getTime() - new Date(b.data.date).getTime());
  return future[0] || null;
});

// Recent meetups (past)
const recentMeetups = computed(() => {
  const now = new Date();
  return meetupArticles.value
    .filter((a: any) => a.data?.date && new Date(a.data.date) < now)
    .sort((a: any, b: any) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime())
    .slice(0, 3);
});

// Navigation
const openArticle = (article: any) => {
  const catSlug = getCategorySlug(article.category_id);
  router.push(`/a/${catSlug}/${article.slug}`);
};

const openCategory = (slug: string) => {
  router.push(`/a/${slug}`);
};

// Latest diary entries
const latestDiaries = computed(() => diaryArticles.value.slice(0, 4));
</script>

<template>
  <main class="home-main">
    <!-- Hero Section -->
    <section class="hero">
      <div class="hero-glow"></div>
      <div class="hero-content animate-fade-in-up">
        <LoveCounter :start-date="loveStartDate" />
        <CountdownCard v-if="nextMeetup" :date="nextMeetup.data?.date" />
        <p v-else class="no-countdown">期待下一次见面 ♡</p>
      </div>
    </section>

    <!-- Meetup Timeline -->
    <section class="section" v-if="recentMeetups.length">
      <div class="section-header">
        <span class="section-icon">✈</span>
        <h2>见面记录</h2>
        <button v-if="meetupCat" class="see-all" @click="openCategory(meetupCat.slug)">查看全部 →</button>
      </div>
      <div class="meetup-timeline">
        <article
          v-for="meetup in recentMeetups"
          :key="meetup.id"
          class="meetup-card animate-fade-in-up"
          @click="openArticle(meetup)"
        >
          <div class="meetup-date-badge">
            <span class="date-day">{{ new Date(meetup.data?.date).getDate() }}</span>
            <span class="date-month">{{ new Date(meetup.data?.date).getMonth() + 1 }}月</span>
          </div>
          <div class="meetup-info">
            <h3>{{ meetup.title }}</h3>
            <p>{{ meetup.description || '美好的回忆...' }}</p>
          </div>
        </article>
      </div>
    </section>

    <!-- Diary Section -->
    <section class="section" v-if="diaryCat">
      <div class="section-header">
        <span class="section-icon">📝</span>
        <h2>日记本</h2>
        <button class="see-all" @click="openCategory(diaryCat.slug)">查看全部 →</button>
      </div>
      <DiaryGrid :diaries="latestDiaries" :meetup-map="meetupMap" @open="openArticle" />
      <div v-if="!latestDiaries.length" class="empty-section">
        <span class="empty-icon">✎</span>
        <p>还没有日记，开始写第一篇吧</p>
      </div>
    </section>

    <!-- Music Section -->
    <section class="section" v-if="musicCat">
      <div class="section-header">
        <span class="section-icon">♪</span>
        <h2>音乐盒</h2>
        <button class="see-all" @click="openCategory(musicCat.slug)">查看全部 →</button>
      </div>
      <div class="music-shelf">
        <div
          v-for="(track, idx) in musicArticles.slice(0, 4)"
          :key="track.id"
          class="music-item animate-fade-in-up"
          :style="{ animationDelay: idx * 0.1 + 's' }"
        >
          <VinylPlayer
            :src="track.data?.audio_url || ''"
            :title="track.title"
          />
        </div>
      </div>
      <div v-if="!musicArticles.length" class="empty-section">
        <span class="empty-icon">♪</span>
        <p>音乐盒还是空的，上传第一首歌吧</p>
      </div>
    </section>

  </main>
</template>

<style scoped>
.home-main {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
  width: 100%;
}

/* Hero */
.hero {
  position: relative;
  text-align: center;
  padding: 4rem 0 3rem;
}

.hero-glow {
  position: absolute;
  top: -50%;
  left: 50%;
  transform: translateX(-50%);
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(255, 107, 157, 0.12) 0%, rgba(179, 136, 255, 0.06) 40%, transparent 70%);
  pointer-events: none;
}

.hero-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
}

.no-countdown {
  font-family: var(--font-display);
  font-size: 1.1rem;
  color: var(--ink-muted);
  font-style: italic;
}

/* Sections */
.section {
  margin-top: 3.5rem;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 1.5rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid var(--border-glow);
}

.section-icon {
  font-size: 1.4rem;
}

.section-header h2 {
  font-family: var(--font-display);
  font-size: 1.8rem;
  font-weight: 600;
  margin: 0;
  color: var(--ink);
}

.see-all {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--accent-lavender);
  font-family: var(--font-body);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 12px;
  transition: all 0.2s;
}

.see-all:hover {
  color: var(--accent-rose);
  background: rgba(255, 107, 157, 0.1);
}

/* Meetup Timeline */
.meetup-timeline {
  display: flex;
  gap: 1.2rem;
  overflow-x: auto;
  padding-bottom: 8px;
}

.meetup-card {
  display: flex;
  gap: 1rem;
  background: var(--surface);
  border: 1px solid var(--border-glow);
  border-radius: 14px;
  padding: 1.2rem;
  cursor: pointer;
  transition: all 0.3s;
  min-width: 260px;
  backdrop-filter: blur(8px);
}

.meetup-card:hover {
  border-color: var(--accent-rose);
  box-shadow: 0 4px 20px rgba(255, 107, 157, 0.15);
  transform: translateY(-2px);
}

.meetup-date-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--accent-rose), var(--accent-peach));
  flex-shrink: 0;
}

.date-day {
  font-size: 1.3rem;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}

.date-month {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.8);
}

.meetup-info { flex: 1; min-width: 0; }

.meetup-info h3 {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 4px;
  color: var(--ink);
}

.meetup-info p {
  font-size: 0.85rem;
  color: var(--ink-muted);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Music Shelf */
.music-shelf {
  display: flex;
  gap: 1.5rem;
  overflow-x: auto;
  padding: 1rem 0 1.5rem;
}

.music-item {
  cursor: pointer;
  transition: transform 0.3s;
  flex-shrink: 1;
  width: 30vw;
}

.music-item:hover { transform: scale(1.05); }

/* All Articles Grid */
.all-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.2rem;
}

.all-card {
  background: var(--surface);
  border: 1px solid var(--border-glow);
  border-radius: 14px;
  padding: 1.2rem;
  cursor: pointer;
  transition: all 0.3s;
  backdrop-filter: blur(8px);
}

.all-card:hover {
  border-color: var(--accent-lavender);
  box-shadow: 0 4px 20px rgba(179, 136, 255, 0.15);
  transform: translateY(-2px);
}

.card-cat-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 10px;
  display: inline-block;
  margin-bottom: 8px;
}

.card-cat-badge.cat-meetup,
.card-cat-badge.cat-jianmian {
  background: rgba(255, 107, 157, 0.15);
  color: var(--accent-rose);
}

.card-cat-badge.cat-diary,
.card-cat-badge.cat-riji {
  background: rgba(179, 136, 255, 0.15);
  color: var(--accent-lavender);
}

.card-cat-badge.cat-music,
.card-cat-badge.cat-yinyue {
  background: rgba(255, 171, 145, 0.15);
  color: var(--accent-peach);
}

.all-card h3 {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 600;
  margin: 0 0 6px;
}

.all-card p {
  font-size: 0.85rem;
  color: var(--ink-muted);
  margin: 0 0 8px;
}

.all-card time {
  font-size: 0.75rem;
  color: var(--ink-muted);
}

/* Empty states */
.empty-section {
  text-align: center;
  padding: 2rem;
  color: var(--ink-muted);
}

.empty-icon {
  font-size: 2rem;
  display: block;
  margin-bottom: 8px;
  opacity: 0.5;
}

.empty-state {
  text-align: center;
  padding: 5rem 2rem;
  color: var(--ink-muted);
}

.empty-heart {
  font-size: 4rem;
  color: var(--accent-rose);
  opacity: 0.3;
  margin-bottom: 1rem;
}

@media (max-width: 700px) {
  .home-main { padding: 1.5rem 1rem 4rem; }
  .hero { padding: 2.5rem 0 2rem; }
  .section-header h2 { font-size: 1.4rem; }
  .all-grid { grid-template-columns: 1fr; }
  .meetup-timeline { flex-direction: column; }
  .meetup-card { min-width: auto; }
  .music-shelf { flex-wrap: wrap; }
}
</style>
