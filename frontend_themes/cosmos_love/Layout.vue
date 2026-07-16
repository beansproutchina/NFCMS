<template>
  <div class="starlit-layout">
    <StarBackground />
    <AHeader :context="context" />
    <main class="layout-main">
      <slot></slot>
    </main>
    <AFooter :context="context" />
  </div>
</template>

<script setup lang="ts">
import AHeader from './components/AHeader.vue';
import AFooter from './components/AFooter.vue';
import StarBackground from './components/StarBackground.vue';
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps<{
  context?: any;
}>();
const router = useRouter();

onMounted(() => {
  if(!props.context.user){
    router.push('/login?redirect='+encodeURIComponent(router.currentRoute.value.path));
  }
});

</script>

<style>
.starlit-layout {
  --bg-deep: #0a0a1a;
  --bg-mid: #12122a;
  --surface: rgba(255, 255, 255, 0.06);
  --surface-hover: rgba(255, 255, 255, 0.12);
  --surface-solid: #1a1a3e;
  --ink: #f0e6ff;
  --ink-soft: rgba(240, 230, 255, 0.7);
  --ink-muted: rgba(240, 230, 255, 0.4);
  --accent-rose: #ff6b9d;
  --accent-peach: #ffab91;
  --accent-lavender: #b388ff;
  --accent-gold: #ffd54f;
  --border-glow: rgba(179, 136, 255, 0.3);
  --shadow-glow: 0 0 20px rgba(179, 136, 255, 0.15);
  --font-display: 'Cormorant Garamond', 'Georgia', serif;
  --font-body: 'Quicksand', "华文中宋","宋体",  -apple-system, sans-serif;

  background: var(--bg-deep);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  color: var(--ink);
  font-family: var(--font-body);
  position: relative;
  overflow-x: hidden;
}

.layout-main {
  flex: 1;
  position: relative;
  z-index: 1;
}

/* Scrollbar */
.starlit-layout ::-webkit-scrollbar { width: 6px; }
.starlit-layout ::-webkit-scrollbar-track { background: var(--bg-deep); }
.starlit-layout ::-webkit-scrollbar-thumb {
  background: var(--accent-lavender);
  border-radius: 3px;
}

/* Selection */
.starlit-layout ::selection {
  background: rgba(255, 107, 157, 0.4);
  color: #fff;
}

/* Global fade-in */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up {
  animation: fadeInUp 0.6s ease-out both;
}

/* Back */
.back-link {
  margin-bottom: 3rem;
  padding: 0.5rem;
  border-bottom: 1px solid var(--border-glow);
}
.back-link button {
  background: var(--surface);
  border: 1px solid var(--border-glow);
  color: var(--ink-soft);
  font-family: var(--font-body);
  font-size: 0.9rem;
  padding: 10px 24px;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.3s;
}
.back-link button:hover {
  border-color: var(--accent-lavender);
  color: var(--accent-lavender);
  background: rgba(179, 136, 255, 0.08);
}

</style>
