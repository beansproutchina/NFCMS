<template>
  <header class="site-header">
    <div class="header-inner">
      <a class="logo" href="/">
        <span class="logo-mark">◆</span>
        <span class="logo-text">{{ config?.site_name || 'NEO STUDIO' }}</span>
      </a>

      <nav class="nav-menu" :class="{ open: mobileOpen }">
        <template v-for="(item, i) in navItems" :key="i">
          <div class="nav-item" :class="{ 'has-children': item.children && item.children.length }">
            <a class="nav-link" :href="item.url" @click="mobileOpen = false">{{ item.label }}</a>
            <div class="sub-nav" v-if="item.children && item.children.length">
              <a v-for="(c, ci) in item.children" :key="ci" :href="c.url" @click="mobileOpen = false">{{ c.label }}</a>
            </div>
          </div>
        </template>
        <a v-if="ctaText" class="nav-cta" :href="ctaLink" @click="mobileOpen = false">{{ ctaText }} →</a>
      </nav>

      <div class="header-right">
        <Socials :context="context" class="header-socials" />
        <button class="hamburger" :class="{ open: mobileOpen }" @click="mobileOpen = !mobileOpen" aria-label="菜单">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import Socials from './Socials.vue';

const props = defineProps<{ context: any }>();
const { config, menus } = props.context || {};

const navItems = computed(() => {
  const m = (menus || []).find((x: any) => x.location === 'header');
  return (m ? m.items : menus?.[0]?.items) || [];
});
const ctaText = computed(() => config?.theme_neo_nav_cta_text || '');
const ctaLink = computed(() => config?.theme_neo_nav_cta_link || '/contact');

const mobileOpen = ref(false);
</script>

<style scoped>
.site-header {
  position: sticky; top: 0; z-index: 50;
  border-bottom: 3px solid var(--ink);
  background: rgba(255, 255, 255, 0.92); backdrop-filter: blur(6px);
  padding: 0 2rem;
}
.header-inner { max-width: 1440px; margin: 0 auto; height: 76px; display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; }

.logo { display: flex; align-items: baseline; gap: 8px; text-decoration: none; color: var(--ink); font-family: 'Bricolage Grotesque', sans-serif; font-weight: 700; font-size: 1.6rem; letter-spacing: -0.02em; white-space: nowrap; }
.logo-mark { color: var(--accent); font-size: 1.7rem; line-height: 1; }

.nav-menu { display: flex; align-items: center; gap: 2rem; }
.nav-item { position: relative; }
.nav-link {
  font-family: 'Manrope', sans-serif; font-weight: 600; font-size: 0.95rem; text-transform: uppercase;
  letter-spacing: 0.5px; color: var(--ink); text-decoration: none; padding: 8px 0; display: inline-block; position: relative;
}
.nav-link::after { content: ''; position: absolute; bottom: 0; left: 0; width: 0; height: 3px; background: var(--accent); transition: width .2s; }
.nav-link:hover { color: var(--accent); }
.nav-link:hover::after { width: 100%; }

/* dropdown */
.sub-nav {
  position: absolute; top: 100%; left: -12px; min-width: 170px; background: var(--surface);
  border: 3px solid var(--ink); box-shadow: var(--shadow-soft); padding: 6px 0;
  opacity: 0; visibility: hidden; transform: translateY(8px); transition: all .18s; z-index: 60;
}
.nav-item.has-children:hover .sub-nav { opacity: 1; visibility: visible; transform: translateY(0); }
.sub-nav a { display: block; padding: 10px 16px; color: var(--ink); text-decoration: none; font-size: 0.9rem; font-weight: 500; }
.sub-nav a:hover { background: var(--ink); color: var(--surface); }

.nav-cta {
  font-family: 'Space Mono', monospace; font-size: 0.85rem; font-weight: 700; text-transform: uppercase;
  background: var(--accent); color: var(--surface); border: 2px solid var(--ink); box-shadow: 3px 3px 0 var(--ink);
  padding: 9px 16px; text-decoration: none; transition: transform .1s, box-shadow .1s;
}
.nav-cta:hover { transform: translate(-2px, -2px); box-shadow: 5px 5px 0 var(--ink); }

.header-right { display: flex; align-items: center; gap: 1rem; }

.hamburger { display: none; flex-direction: column; justify-content: center; gap: 5px; width: 44px; height: 44px; border: 2px solid var(--ink); background: var(--surface); cursor: pointer; padding: 9px; }
.hamburger span { display: block; height: 3px; background: var(--ink); transition: transform .25s, opacity .25s; }
.hamburger.open span:nth-child(1) { transform: translateY(8px) rotate(45deg); }
.hamburger.open span:nth-child(2) { opacity: 0; }
.hamburger.open span:nth-child(3) { transform: translateY(-8px) rotate(-45deg); }

@media (max-width: 940px) {
  .header-socials { display: none; }
  .hamburger { display: flex; }
  .nav-menu {
    position: fixed; top: 76px; left: 0; right: 0; bottom: 0; background: var(--bg-page);
    flex-direction: column; align-items: stretch; gap: 0; padding: 1rem 2rem 2rem;
    transform: translateX(100%); transition: transform .25s ease; overflow-y: auto;
  }
  .nav-menu.open { transform: translateX(0); }
  .nav-item { border-bottom: 2px solid var(--border-light); }
  .nav-link { display: block; padding: 16px 0; font-size: 1.2rem; }
  .sub-nav { position: static; opacity: 1; visibility: visible; transform: none; border: none; box-shadow: none; padding: 0 0 8px 1rem; }
  .nav-cta { margin-top: 1.5rem; text-align: center; }
}
</style>
