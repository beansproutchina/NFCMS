<template>
  <div class="countdown-card">
    <div class="countdown-icon">✈</div>
    <div class="countdown-info">
      <div class="countdown-label">下次见面倒计时</div>
      <div class="countdown-days" v-if="days >= 0">
        还有 <strong>{{ days }}</strong> 天
      </div>
      <div class="countdown-today" v-else>
        🎉 就是今天！
      </div>
    </div>
    <div v-if="date" class="countdown-date">{{ formatDate(date) }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  date: string;
}>();

const days = computed(() => {
  if (!props.date) return -1;
  const target = new Date(props.date);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
});

const formatDate = (d: string) => {
  return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
};
</script>

<style scoped>
.countdown-card {
  background: var(--surface);
  border: 1px solid var(--border-glow);
  border-radius: 16px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  backdrop-filter: blur(10px);
}

.countdown-icon {
  font-size: 2rem;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.countdown-info {
  flex: 1;
}

.countdown-label {
  font-size: 0.85rem;
  color: var(--ink-muted);
  margin-bottom: 4px;
}

.countdown-days {
  font-family: var(--font-body);
  font-size: 1.1rem;
  color: var(--ink-soft);
}

.countdown-days strong {
  color: var(--accent-peach);
  font-size: 1.5rem;
  font-family: var(--font-display);
}

.countdown-today {
  font-size: 1.2rem;
  color: var(--accent-gold);
  font-weight: 600;
}

.countdown-date {
  font-size: 0.8rem;
  color: var(--ink-muted);
  background: rgba(255, 255, 255, 0.05);
  padding: 4px 12px;
  border-radius: 12px;
}
</style>
