<template>
  <!-- 吸顶后 header 脱离文档流,占位块顶上它原本的高度,避免整页往上跳一截 -->
  <div v-if="fixed" :style="{ height: headerH + 'px' }"></div>

  <header
    :class="['td-header', { 'is-transparent': transparent && !fixed, 'is-fixed': fixed, 'is-shown': shown }]"
    ref="headerEl"
  >
    <div class="td-container">
      <div class="header-top">
        <a class="logo" :href="homeHref">
          <img v-if="logo" :src="logo" :alt="siteName" />
          <span v-else class="logo-text fnt24">{{ siteName }}</span>
        </a>

        <div class="header-main">
          <!-- 顶栏次级导航 + 搜索 + 语言切换 -->
          <div class="secondary-nav fnt16">
            <a v-for="(m, i) in topItems" :key="i" class="sec-link" :href="m.url" :target="isExternal(m.url) ? '_blank' : undefined">{{ m.label }}</a>
            <button class="search-btn" type="button" :aria-label="t('search', locale)" @click="searchOpen = true">
              <i class="iconfont icon-search-o"></i>
            </button>
            <a class="lang-btn" :href="switchLocaleUrl(route.fullPath, locale === 'en' ? 'zh' : 'en')">
              <span :class="['item', { active: locale === 'zh' }]">中</span>
              <span :class="['item', { active: locale === 'en' }]">EN</span>
            </a>
          </div>

          <!-- 主导航 -->
          <nav class="header-nav fnt20">
            <div v-for="(m, i) in headerItems" :key="i" class="nav-item">
              <a :href="m.url" class="nav-link">{{ m.label }}</a>
              <div v-if="m.children && m.children.length" class="dropmenu">
                <div class="dropmenu-inner">
                  <a v-for="(c, j) in m.children" :key="j" class="sub-link fnt16"
                     :href="c.url" :target="isExternal(c.url) ? '_blank' : undefined">{{ c.label }}</a>
                </div>
              </div>
            </div>
          </nav>

          <button class="menu-toggle" type="button" aria-label="menu" @click="drawer = true">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    </div>
  </header>

  <!-- 移动端全屏抽屉 -->
  <div v-if="drawer" class="drawer" @click.self="drawer = false">
    <button class="drawer-close" type="button" aria-label="close" @click="drawer = false">
      <i class="iconfont icon-close"></i>
    </button>
    <div class="drawer-body">
      <a class="lang-line fnt18" :href="switchLocaleUrl(route.fullPath, locale === 'en' ? 'zh' : 'en')">
        {{ locale === 'en' ? '中文' : 'English' }}
      </a>
      <div v-for="(m, i) in allItems" :key="i" class="drawer-group">
        <a class="drawer-title fnt20" :href="m.url">{{ m.label }}</a>
        <div v-if="m.children && m.children.length" class="drawer-children">
          <a v-for="(c, j) in m.children" :key="j" class="fnt16" :href="c.url">{{ c.label }}</a>
        </div>
      </div>
    </div>
  </div>

  <!-- 搜索浮层 -->
  <div v-if="searchOpen" class="search-layer" @click.self="searchOpen = false">
    <button class="drawer-close" type="button" aria-label="close" @click="searchOpen = false">
      <i class="iconfont icon-close"></i>
    </button>
    <form class="search-form td-container" @submit.prevent="submitSearch">
      <input v-model="keyword" class="fnt18" :placeholder="t('searchPlaceholder', locale)" autofocus />
      <button type="submit" class="fnt16">{{ t('search', locale) }}<i class="iconfont icon-search-o"></i></button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { t, switchLocaleUrl, type Locale } from '../lib';

const props = defineProps<{ context: any; locale?: Locale; transparent?: boolean }>();
const locale = computed<Locale>(() => props.locale ?? 'zh');
const route = useRoute();
const router = useRouter();

const config = computed(() => props.context?.config ?? {});
const siteName = computed(() => String(config.value.site_name ?? ''));
const logo = computed(() => String(config.value.theme_tdli_logo_white ?? ''));
const homeHref = computed(() => (locale.value === 'en' ? '/en' : '/'));

/** 菜单按 location 取。中英各一套,英文的后缀 `_en`(菜单项没有多语言字段,只能分套)。 */
const menuAt = (loc: string) => {
    const suffix = locale.value === 'en' ? '_en' : '';
    const list = props.context?.menus ?? [];
    const hit = list.find((m: any) => m.location === loc + suffix);
    return Array.isArray(hit?.items) ? hit.items : [];
};
const topItems = computed(() => menuAt('top'));
const headerItems = computed(() => menuAt('header'));
const allItems = computed(() => [...topItems.value, ...headerItems.value]);

const isExternal = (url: string) => /^(https?:)?\/\//i.test(String(url || ''));

// ── 滚动吸顶 ──────────────────────────────────────────────
// 向下滚藏起来、向上滚滑出:长页面里既不挡内容,又能随时回到导航。
const headerEl = ref<HTMLElement | null>(null);
const headerH = ref(0);
const fixed = ref(false);
const shown = ref(false);
let lastY = 0;

const onScroll = () => {
    const y = window.scrollY || 0;
    if (!headerH.value && headerEl.value) headerH.value = headerEl.value.offsetHeight;
    if (y <= 0) { fixed.value = false; shown.value = false; }
    else if (y > headerH.value) { fixed.value = true; shown.value = y < lastY; }
    lastY = y;
};

onMounted(() => {
    headerH.value = headerEl.value?.offsetHeight ?? 0;
    window.addEventListener('scroll', onScroll, { passive: true });
});
onUnmounted(() => window.removeEventListener('scroll', onScroll));

// ── 搜索 / 抽屉 ───────────────────────────────────────────
const drawer = ref(false);
const searchOpen = ref(false);
const keyword = ref('');
const submitSearch = () => {
    const q = keyword.value.trim();
    if (!q) return;
    searchOpen.value = false;
    router.push(`${locale.value === 'en' ? '/en' : ''}/search?q=${encodeURIComponent(q)}`);
};
// 路由一变就收起浮层,否则点了导航项之后抽屉还盖在新页面上
watch(() => route.fullPath, () => { drawer.value = false; searchOpen.value = false; });
</script>

<style scoped>
.td-header {
  position: relative; z-index: 90; width: 100%;
  background: var(--color-primary) url('https://tdli.sjtu.edu.cn/assets/images/header_bg.png') center/cover no-repeat;
  color: #fff;
}
/* 首页:压在焦点图上,只留 logo 与导航 */
.td-header.is-transparent { position: absolute; inset: 0 0 auto; background: none; }
.td-header.is-fixed {
  position: fixed; inset: 0 0 auto; top: -100%; transition: top .6s;
  box-shadow: 0 0 10px rgba(0,0,0,.15);
}
.td-header.is-fixed.is-shown { top: 0; }

.header-top { display: flex; align-items: center; justify-content: space-between; gap: 2vw; }
.logo { display: flex; align-items: center; flex: none; }
.logo img { height: 4.28vw; min-height: 36px; width: auto; }
.logo-text { color: #fff; font-weight: 600; white-space: nowrap; }

.header-main { display: flex; flex-direction: column; align-items: flex-end; flex: 1; min-width: 0; }

.secondary-nav { display: flex; align-items: center; justify-content: flex-end; gap: var(--size-20); padding-top: var(--size-20); }
.sec-link { color: rgba(255,255,255,.92); position: relative; padding-bottom: 6px; white-space: nowrap; }
.sec-link::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: #fff;
  border-radius: 2px; transform: scaleX(0); transition: transform .3s ease-in-out;
}
.sec-link:hover::after { transform: scaleX(1); }

.search-btn { background: none; border: 0; color: #fff; cursor: pointer; padding: 0; line-height: 1; }

.lang-btn { position: relative; width: 34px; height: 26px; flex: none; }
.lang-btn .item {
  position: absolute; left: 0; top: -4px; font-size: 10px; color: #fff; z-index: 2; line-height: 1;
}
.lang-btn .item.active {
  left: auto; right: 0; top: auto; bottom: 0; z-index: 1;
  width: 19px; height: 19px; line-height: 19px; text-align: center;
  background: #fff; color: #7f7f7f; border-radius: 2px; font-size: 12px;
}

.header-nav { display: flex; align-items: center; justify-content: flex-end; gap: 2.08vw; padding: var(--size-12) 0 var(--size-15); }
.nav-item { position: relative; }
.nav-link { color: #fff; position: relative; display: block; padding: var(--size-12) 0; white-space: nowrap; }
.nav-link::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: 2px; height: 2px; background: #fff;
  border-radius: 2px; transform: scaleX(0); transition: transform .3s ease-in-out;
}
.nav-item:hover .nav-link::after { transform: scaleX(1); }

.dropmenu {
  position: absolute; top: 100%; left: 50%; min-width: 190px; z-index: 99;
  transform: translate3d(-50%, 15px, 0); opacity: 0; pointer-events: none;
  transition: opacity .3s, transform .3s;
  border-top: 2px solid var(--color-primary);
}
.nav-item:hover .dropmenu { opacity: 1; transform: translate3d(-50%, 0, 0); pointer-events: auto; }
.dropmenu-inner { background: rgba(255,255,255,.96); padding: 20px 15px; text-align: center; }
.sub-link {
  display: block; color: var(--color-text-primary); white-space: nowrap;
  padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px dashed var(--border-color-lighter);
}
.sub-link:last-child { padding-bottom: 0; margin-bottom: 0; border-bottom: 0; }
.sub-link:hover { color: var(--color-primary); }

.menu-toggle { display: none; background: none; border: 0; cursor: pointer; padding: 8px 0; }
.menu-toggle span { display: block; width: 24px; height: 2px; background: #fff; margin: 5px 0; }

/* ── 浮层 ── */
.drawer, .search-layer { position: fixed; inset: 0; z-index: 999; background: rgba(19,77,163,.97); color: #fff; overflow-y: auto; }
.search-layer { background: rgba(19,77,163,.97); display: flex; align-items: center; }
.drawer-close { position: absolute; top: 20px; right: 20px; background: none; border: 0; color: #fff; font-size: 22px; cursor: pointer; }
.drawer-body { padding: 72px 24px 40px; }
.lang-line { display: inline-block; margin-bottom: 24px; color: #fff; border: 1px solid rgba(255,255,255,.5); padding: 6px 16px; }
.drawer-group { border-bottom: 1px solid rgba(255,255,255,.15); padding: 14px 0; }
.drawer-title { color: #fff; display: block; font-weight: 600; }
.drawer-children { display: flex; flex-wrap: wrap; gap: 10px 18px; margin-top: 10px; }
.drawer-children a { color: rgba(255,255,255,.8); }

.search-form { display: flex; align-items: center; gap: 12px; width: 100%; }
.search-form input { flex: 1; height: 52px; padding: 0 16px; border: 0; background: #fff; color: var(--color-text-primary); }
.search-form button {
  height: 52px; padding: 0 28px; border: 0; background: var(--color-primary); color: #fff;
  cursor: pointer; display: flex; align-items: center; gap: 8px; border: 1px solid #fff;
}

@media (max-width: 1199px) {
  .secondary-nav .sec-link { display: none; }
  .header-nav { display: none; }
  .menu-toggle { display: block; }
  .header-main { flex-direction: row; align-items: center; justify-content: flex-end; gap: 16px; }
  .secondary-nav { padding-top: 0; }
  .header-top { padding: 12px 0; }
}
</style>
