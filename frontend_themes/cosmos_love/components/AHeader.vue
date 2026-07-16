<template>
  <header class="love-header">
    <div class="header-inner">
      <div class="logo" @click="router.push('/')">
        <span class="logo-icon">✧</span>
        <span class="logo-text">{{ config?.site_name || 'Our Space' }}</span>
      </div>
      <nav class="nav-menu">
        <button
          v-for="item in headerMenu"
          :key="item.id"
          class="nav-link"
          @click="navigateTo(item.url)"
        >
          <span class="nav-dot">♡</span>
          {{ item.label }}
        </button>
      </nav>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
const props = defineProps<{ context: any }>();
const { config, menus, user, api } = props.context || {};
const router = useRouter();

const navigateTo = (url: string) => {
  if (url.startsWith('http')) window.open(url, '_blank');
  else router.push(url);
};

const headerMenu = menus?.[0]?.items || [];
</script>

<style scoped>
.love-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(10, 10, 26, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-glow);
}

.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.4rem;
  color: var(--ink);
  transition: color 0.3s;
}

.logo:hover { color: var(--accent-rose); }

.logo-icon {
  font-size: 1.6rem;
  color: var(--accent-gold);
  animation: twinkle 2s ease-in-out infinite;
}

@keyframes twinkle {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.9); }
}

.nav-menu {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.nav-link {
  background: none;
  border: none;
  font-family: var(--font-body);
  font-weight: 500;
  font-size: 1rem;
  color: var(--ink-soft);
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 20px;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.nav-dot {
  font-size: 0.6rem;
  opacity: 0;
  transition: opacity 0.3s;
}

.nav-link:hover {
  color: var(--accent-rose);
  background: rgba(255, 107, 157, 0.1);
}
.nav-link:hover .nav-dot { opacity: 1; }

@media (max-width: 640px) {
  .header-inner { height: 56px; padding: 0 1rem; }
  .logo-text { font-size: 1.1rem; }
  .nav-menu { gap: 0.8rem; }
  .nav-link { font-size: 0.8rem; padding: 4px 8px; }
  .nav-dot { display: none; }
}
</style>
