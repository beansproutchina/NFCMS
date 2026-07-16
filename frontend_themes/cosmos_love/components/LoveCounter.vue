<template>
  <div class="love-counter">
    <div class="counter-ring">
      <svg viewBox="0 0 120 120" class="ring-svg">
        <circle cx="60" cy="60" r="54" class="ring-bg" />
        <circle cx="60" cy="60" r="54" class="ring-fill" :stroke-dashoffset="ringOffset" />
      </svg>
      <div class="counter-number">{{ days }}</div>
    </div>
    <div class="counter-label">
      <span class="label-icon">♡</span>
      在一起已经 <strong>{{ days }}</strong> 天
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  startDate: string;
}>();

const days = computed(() => {
  if (!props.startDate) return 0;
  const start = new Date(props.startDate);
  const now = new Date();
  const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(0, diff);
});

const ringOffset = computed(() => {
  const circumference = 2 * Math.PI * 54;
  const progress = Math.min(days.value / 365, 1);
  return circumference * (1 - progress);
});
</script>

<style scoped>
.love-counter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.counter-ring {
  position: relative;
  width: 120px;
  height: 120px;
}

.ring-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-bg {
  fill: none;
  stroke: rgba(255, 107, 157, 0.15);
  stroke-width: 3;
}

.ring-fill {
  fill: none;
  stroke: var(--accent-rose);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: 339.292;
  transition: stroke-dashoffset 1s ease-out;
  filter: drop-shadow(0 0 6px rgba(255, 107, 157, 0.5));
}

.counter-number {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -66%);
  font-family: var(--font-display);
  font-size: 4rem;
  font-weight: 700;
  color: var(--ink);
  line-height: 1;
}

.counter-label {
  font-family: var(--font-body);
  font-size: 1rem;
  color: var(--ink-soft);
  text-align: center;
}

.counter-label strong {
  color: var(--accent-rose);
  font-size: 1.1rem;
}

.label-icon {
  color: var(--accent-rose);
}
</style>
