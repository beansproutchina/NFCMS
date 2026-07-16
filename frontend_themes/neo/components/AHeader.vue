<template>
  <header class="site-header">
    <div class="header-inner">
      <div class="logo" @click="router.push('/')">
        <span class="logo-mark">◆</span>
        <span class="logo-text">{{ config?.site_name || 'BRUTAL BLOG' }}</span>
      </div>
      <nav class="nav-menu">
        <button
          v-for="item in headerMenu"
          :key="item.id"
          class="nav-link"
          @click="navigateTo(item.url)"
        >
          {{ item.label }}
        </button>
      </nav>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
const props = defineProps<{ context: any }>();
const { config, menus } = props.context || {};
const router = useRouter();

const navigateTo = (url: string) => {
  if (url.startsWith('http')) window.open(url, '_blank');
  else router.push(url);
};

const headerMenu = menus?.[0]?.items || [];
</script>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--surface);
  border-bottom: 3px solid var(--ink);
  padding: 0 2rem;
  backdrop-filter: blur(4px);
  background: rgba(255, 255, 255, 0.9);
}

.header-inner {
  max-width: 1440px;
  margin: 0 auto;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  display: flex;
  align-items: baseline;
  gap: 8px;
  cursor: pointer;
  font-family: 'Bricolage Grotesque', sans-serif;
  font-weight: 600;
  font-size: 1.6rem;
  letter-spacing: -0.02em;
}

.logo-mark {
  color: var(--accent);
  font-size: 1.8rem;
  line-height: 1;
}

.nav-menu {
  display: flex;
  gap: 2.5rem;
}

.nav-link {
  background: none;
  border: none;
  font-family: 'Manrope', sans-serif;
  font-weight: 500;
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--ink);
  cursor: pointer;
  padding: 8px 0;
  position: relative;
  transition: color 0.2s;
}

.nav-link::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 0;
  height: 3px;
  background: var(--accent);
  transition: width 0.2s ease;
}

.nav-link:hover {
  color: var(--accent);
}
.nav-link:hover::after {
  width: 100%;
}

@media (max-width: 640px) {
  .header-inner { height: 60px; }
  .logo-text { font-size: 1.2rem; }
  .nav-menu { gap: 1.5rem; }
}
</style>