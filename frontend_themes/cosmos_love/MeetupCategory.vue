<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import StarBackground from './components/StarBackground.vue';

const props = defineProps<{ context: any }>();
const { config, category, articles, breadcrumbs, user } = props.context || {};
const router = useRouter();

// Article helpers
const now = new Date();
const futureMeetups = computed(() =>
  (articles || [])
    .filter((a: any) => a.data?.date && new Date(a.data.date) >= now)
    .sort((a: any, b: any) => new Date(a.data.date).getTime() - new Date(b.data.date).getTime())
);
const pastMeetups = computed(() =>
  (articles || [])
    .filter((a: any) => a.data?.date && new Date(a.data.date) < now)
    .sort((a: any, b: any) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime())
);

const daysUntil = (date: string) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / (86400000));
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

const openArticle = (article: any) => {
  router.push(`/a/${category?.slug}/${article.slug}`);
};
</script>

<template>
  <main class="galaxy-meetup">
    <!-- Star Background -->

    <!-- Hero -->
    <header class="galaxy-hero">
      <h1 class="galaxy-title">{{ category?.name || '见面记录' }}</h1>
      <p class="galaxy-subtitle" v-if="category?.data?.description">{{ category.data.description }}</p>
      <p class="galaxy-subtitle" v-else>穿越星河，只为见你</p>
    </header>

    <!-- Upcoming Meetups -->
    <section class="upcoming-section" v-if="futureMeetups.length">
      <div class="section-starline">
        <div class="starline-dot"></div>
        <span>即将相见</span>
        <div class="starline-line"></div>
      </div>
      <div class="upcoming-grid">
        <article
          v-for="meetup in futureMeetups"
          :key="meetup.id"
          class="upcoming-card animate-fade-in-up"
          @click="openArticle(meetup)"
        >
          <div class="countdown-orbit">
            <svg viewBox="0 0 100 100" class="orbit-svg">
              <circle cx="50" cy="50" r="44" class="orbit-bg" />
              <circle cx="50" cy="50" r="44" class="orbit-fill"
                :stroke-dashoffset="44 * 2 * Math.PI * (1 - Math.min(daysUntil(meetup.data.date) / 365, 1))" />
            </svg>
            <div class="countdown-number">{{ daysUntil(meetup.data.date) }}</div>
          </div>
          <div class="upcoming-info">
            <h3>{{ meetup.title }}</h3>
            <time>{{ formatDate(meetup.data.date) }}</time>
            <p>{{ meetup.description || '期待中...' }}</p>
          </div>
          <div class="upcoming-badge">还有 {{ daysUntil(meetup.data.date) }} 天</div>
        </article>
      </div>
    </section>

    <!-- Past Meetups - Timeline -->
    <section class="timeline-section" v-if="pastMeetups.length">
      <div class="section-starline">
        <div class="starline-dot"></div>
        <span>星河足迹</span>
        <div class="starline-line"></div>
      </div>
      <div class="meetup-timeline">
        <div class="timeline-line"></div>
        <article
          v-for="(meetup, idx) in pastMeetups"
          :key="meetup.id"
          class="timeline-item animate-fade-in-up"
          :style="{ animationDelay: idx * 0.1 + 's' }"
          @click="openArticle(meetup)"
        >
          <div class="timeline-star">
            <div class="star-glow"></div>
            <span>{{ idx + 1 }}</span>
          </div>
          <div class="timeline-card">
            <div class="card-date">{{ formatDate(meetup.data.date) }}</div>
            <h3>{{ meetup.title }}</h3>
            <p>{{ meetup.description || '美好的回忆...' }}</p>
          </div>
        </article>
      </div>
    </section>

    <!-- Empty State -->
    <div v-if="!articles?.length" class="empty-cosmos">
      <div class="empty-orbit"></div>
      <p>银河系里还没有见面记录</p>
      <span>在后台创建一篇"见面"文章，设置日期开始倒计时吧</span>
    </div>
  </main>
</template>

<style scoped>
.galaxy-meetup {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
  width: 100%;
}

/* Hero */
.galaxy-hero {
  text-align: center;
  padding: 3rem 0;
  position: relative;
}
.galaxy-title {
  font-family: var(--font-display);
  font-size: 3rem;
  font-weight: 700;
  color: var(--ink);
  margin: 0;
  text-shadow: 0 0 40px rgba(255, 107, 157, 0.4);
}
.galaxy-subtitle {
  font-family: var(--font-body);
  font-size: 1rem;
  color: var(--ink-soft);
  margin: 0.5rem 0 0;
  font-style: italic;
}

/* Section Starline */
.section-starline {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 2rem;
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--ink);
}
.starline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent-rose);
  box-shadow: 0 0 12px var(--accent-rose);
}
.starline-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, var(--border-glow), transparent);
}

/* Upcoming Cards */
.upcoming-grid {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.upcoming-card {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  background: var(--surface);
  border: 1px solid var(--border-glow);
  border-radius: 20px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.4s;
  backdrop-filter: blur(10px);
  position: relative;
  overflow: hidden;
}
.upcoming-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--accent-rose), var(--accent-lavender), var(--accent-peach));
  opacity: 0;
  transition: opacity 0.4s;
}
.upcoming-card:hover {
  border-color: var(--accent-rose);
  box-shadow: 0 8px 32px rgba(255, 107, 157, 0.2);
  transform: translateY(-3px);
}
.upcoming-card:hover::before { opacity: 1; }

/* Countdown Orbit */
.countdown-orbit {
  position: relative;
  width: 80px;
  height: 80px;
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
  stroke: var(--accent-rose);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: 276.46;
  transition: stroke-dashoffset 1.5s ease-out;
  filter: drop-shadow(0 0 8px rgba(255, 107, 157, 0.6));
}
.countdown-number {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: var(--font-display);
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--accent-rose);
}

.upcoming-info { flex: 1; min-width: 0; }
.upcoming-info h3 {
  font-family: var(--font-display);
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 6px;
}
.upcoming-info time {
  font-size: 0.85rem;
  color: var(--accent-peach);
}
.upcoming-info p {
  font-size: 0.9rem;
  color: var(--ink-muted);
  margin: 6px 0 0;
}
.upcoming-badge {
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--accent-gold);
  background: rgba(255, 213, 79, 0.12);
  padding: 6px 14px;
  border-radius: 20px;
  flex-shrink: 0;
}

/* Timeline */
.timeline-section { margin-top: 3rem; }
.meetup-timeline {
  position: relative;
  padding-left: 3rem;
}
.timeline-line {
  position: absolute;
  left: 14px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(to bottom, var(--accent-rose), var(--accent-lavender), transparent);
}
.timeline-item {
  position: relative;
  margin-bottom: 2rem;
  cursor: pointer;
}
.timeline-item:last-child { margin-bottom: 0; }

.timeline-star {
  position: absolute;
  left: -3rem;
  top: 0;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--bg-deep);
  border: 2px solid var(--accent-rose);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--accent-rose);
  z-index: 1;
}
.star-glow {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: var(--accent-rose);
  opacity: 0;
  filter: blur(8px);
  transition: opacity 0.3s;
}
.timeline-item:hover .star-glow { opacity: 0.4; }

.timeline-card {
  background: var(--surface);
  border: 1px solid var(--border-glow);
  border-radius: 16px;
  padding: 1.2rem 1.5rem;
  transition: all 0.3s;
  backdrop-filter: blur(8px);
}
.timeline-item:hover .timeline-card {
  border-color: var(--accent-lavender);
  box-shadow: 0 4px 24px rgba(179, 136, 255, 0.15);
  transform: translateX(4px);
}
.card-date {
  font-size: 0.8rem;
  color: var(--accent-peach);
  font-weight: 500;
  margin-bottom: 4px;
}
.timeline-card h3 {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 4px;
}
.timeline-card p {
  font-size: 0.85rem;
  color: var(--ink-muted);
  margin: 0;
}

/* Empty */
.empty-cosmos {
  text-align: center;
  padding: 5rem 2rem;
  color: var(--ink-muted);
}
.empty-orbit {
  width: 80px;
  height: 80px;
  border: 2px dashed var(--border-glow);
  border-radius: 50%;
  margin: 0 auto 1.5rem;
  animation: spin 20s linear infinite;
}
.empty-cosmos p {
  font-family: var(--font-display);
  font-size: 1.2rem;
  color: var(--ink-soft);
  margin-bottom: 0.5rem;
}
.empty-cosmos span {
  font-size: 0.85rem;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 700px) {
  .galaxy-meetup { padding: 1.5rem 1rem 5rem; }
  .galaxy-hero { padding: 2rem 0; }
  .galaxy-title { font-size: 2rem; }
  .upcoming-card {  gap: 1rem; padding: 1.2rem; }
  .upcoming-badge { align-self: flex-start; }
  .timeline-card { padding: 1rem; }
  .timeline-card h3 { font-size: 1rem; }
}
</style>
