<template>
  <header class="site-header">
    <div class="header-inner">
      <a class="logo" href="/">
        <span class="logo-mark">◆</span>
        <span class="logo-text">{{ config?.site_name || 'NEO STUDIO' }}</span>
      </a>

      <nav id="neo-nav" class="nav-menu" :class="{ open: mobileOpen }">
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
        <button class="hamburger" :class="{ open: mobileOpen }" @click="mobileOpen = !mobileOpen"
          :aria-expanded="mobileOpen" aria-controls="neo-nav" aria-label="菜单">
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
// Layout only rebuilds when the layout chain changes (DynamicView keys it by `layouts.join('>')`),
// so a plain destructure would freeze these at the first mount's snapshot — computed keeps them live.
const config = computed<any>(() => props.context?.config || {});
const menus = computed<any[]>(() => props.context?.menus || []);

const navItems = computed(() => {
  const m = menus.value.find((x: any) => x.location === 'header');
  return (m ? m.items : menus.value[0]?.items) || [];
});
const ctaText = computed(() => config.value.theme_neo_nav_cta_text || '');
const ctaLink = computed(() => config.value.theme_neo_nav_cta_link || '/contact');

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

.logo { flex: none; display: flex; align-items: baseline; gap: 8px; text-decoration: none; color: var(--ink); font-family: 'Bricolage Grotesque', sans-serif; font-weight: 700; font-size: 1.6rem; letter-spacing: -0.02em; white-space: nowrap; }
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

/* flex: none —— tokens.css 的全局 `min-width: 0` 让弹性项可以收缩,而标志与这一组图标
   被压扁只会重叠,不会变好看。 */
.header-right { flex: none; display: flex; align-items: center; gap: 1rem; }

.hamburger { display: none; flex-direction: column; justify-content: center; gap: 5px; width: 44px; height: 44px; border: 2px solid var(--ink); background: var(--surface); cursor: pointer; padding: 9px; }
.hamburger span { display: block; height: 3px; background: var(--ink); transition: transform .25s, opacity .25s; }
.hamburger.open span:nth-child(1) { transform: translateY(8px) rotate(45deg); }
.hamburger.open span:nth-child(2) { opacity: 0; }
.hamburger.open span:nth-child(3) { transform: translateY(-8px) rotate(-45deg); }

@media (max-width: 940px) {
  .header-socials { display: none; }
  .hamburger { display: flex; }
  /**
   * 抽屉改成"从表头下方落下"的绝对定位面板。原来是 `position: fixed` + `translateX(100%)`,
   * 三个症状同一个根因:`.site-header` 有 `backdrop-filter`,而 backdrop-filter 会让自己成为
   * 后代 fixed 元素的**包含块** —— 于是
   *   · `top:76px; bottom:0` 相对的是 76px 高的表头,算出来高度 ≈ 0,菜单等于被"遮挡"看不见;
   *   · `translateX(100%)` 把面板停在表头右侧之外,未展开时照样占据布局溢出,横向把页面撑宽。
   * 用 absolute 就不再依赖"谁是包含块"这件容易被 filter/transform 悄悄改掉的事:表头本身是
   * sticky(已定位),面板直接贴着它的 padding box 排。
   */
  .nav-menu {
    position: absolute;
    top: 100%;
    /* 绝对定位相对的是表头的 padding box,而它本身就是整屏宽,所以 0 就已铺满;
       面板自己的左右 padding(下面 2rem)接上表头的视觉边距。 */
    left: 0;
    right: 0;
    z-index: 70;                       /* 高于 Socials 下拉(70)之外的一切页面内容 */
    background: var(--bg-page);
    border-bottom: 3px solid var(--ink);
    box-shadow: var(--shadow-soft);
    flex-direction: column; align-items: stretch; gap: 0; padding: 1rem 2rem 2rem;
    max-height: calc(100vh - 76px);
    max-height: calc(100dvh - 76px);   /* 移动端浏览器地址栏收起/展开时更准 */
    overflow-y: auto;
    /* 收起态:不可见、不可点、不吃事件。用的是本文件里 .sub-nav 同一套写法,
       且**不做横向位移** —— 位移出屏才是把页面撑宽的元凶。 */
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transform: translateY(-8px);
    transition: opacity .2s ease, transform .2s ease, visibility .2s;
  }
  .nav-menu.open {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transform: translateY(0);
  }
  .nav-item { border-bottom: 2px solid var(--border-light); }
  .nav-link { display: block; padding: 16px 0; font-size: 1.2rem; }
  .sub-nav { position: static; opacity: 1; visibility: visible; transform: none; border: none; box-shadow: none; padding: 0 0 8px 1rem; }
  .nav-cta { margin-top: 1.5rem; text-align: center; }
}
</style>
