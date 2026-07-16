<template>
  <div class="diary-grid">
    <article
      v-for="(diary, idx) in diaries"
      :key="diary.id"
      class="diary-card animate-fade-in-up"
      :style="{ animationDelay: idx * 0.1 + 's' }"
      @click="$emit('open', diary)"
    >
      <div class="diary-paper">
        <div class="paper-lines">
          <div class="paper-line" v-for="i in 5" :key="i"></div>
        </div>
        <h3 class="diary-title">{{ diary.title }}</h3>
        <p class="diary-author">{{ diary.author?.nickname ?? diary.author?.username }}</p>
        <div class="diary-date">
          {{ new Date(diary.published_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) }}
        </div>
        <div v-if="diary.data?.meetup_id && meetupMap[diary.data.meetup_id]" class="diary-link">
          ✈ {{ meetupMap[diary.data.meetup_id].title }}
        </div>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  diaries: any[];
  meetupMap?: Record<string, any>;
}>();

defineEmits<{
  open: [diary: any];
}>();
</script>

<style scoped>
.diary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.2rem;
}

.diary-card {
  cursor: pointer;
  transition: all 0.4s;
}

.diary-card:hover { transform: translateY(-4px); }

.diary-paper {
  background: rgba(255, 250, 245, 0.06);
  border: 1px solid rgba(255, 107, 157, 0.15);
  border-radius: 12px;
  padding: 1.2rem 1.2rem 1rem 2.5rem;
  position: relative;
  min-height: 60px;
  backdrop-filter: blur(8px);
  line-height: 1;
  transition: all 0.4s;
  overflow: hidden;
}

.diary-paper::after {
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

.diary-card:hover .diary-paper {
  border-color: var(--accent-rose);
  box-shadow: 0 8px 32px rgba(255, 107, 157, 0.15);
}

.diary-card:hover .diary-paper::after { opacity: 1; }

.paper-lines {
  position: absolute;
  top: 2.5rem;
  left: 2.5rem;
  right: 1rem;
  bottom: 2.5rem;
  pointer-events: none;
}

.paper-line {
  height: 1px;
  background: rgba(255, 107, 157, 0.06);
  margin-bottom: calc(1.2rem);
}

.diary-paper::before {
  content: '';
  position: absolute;
  left: 2rem;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(255, 107, 157, 0.15);
}

.diary-title {
  font-family: var(--font-display);
  font-size: 1.5rem;
  line-height: 1;
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 6px;
  transition: color 0.3s;
}

.diary-author {
  font-size: 1rem;
  color: var(--ink-muted);
  margin: 0 0 8px;
  transition: color 0.3s;
}

.diary-date {
  font-size: 1rem;
  color: var(--ink-muted);
  transition: color 0.3s;
}

.diary-link {
  font-size: 1rem;
  color: var(--accent-peach);
  margin-top: 4px;
}

.diary-card:hover .diary-title { color: var(--accent-rose); }
.diary-card:hover .diary-author { color: var(--accent-lavender); }
.diary-card:hover .diary-date { color: var(--accent-lavender); }

@media (max-width: 700px) {
  .diary-grid { grid-template-columns: 1fr; }
}
</style>
