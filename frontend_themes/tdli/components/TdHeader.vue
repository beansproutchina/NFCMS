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

          <button :class="['menu-toggle', { open: drawer }]" type="button" aria-label="menu"
                  :aria-expanded="drawer" @click="drawer = !drawer">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    </div>
  </header>

  <!-- 移动端全屏抽屉:白底、顶部搜索、分组标题 + 两列子项(照原站) -->
  <Transition name="drawer">
  <div v-if="drawer" class="drawer">
    <div class="drawer-head">
      <button class="drawer-close" type="button" aria-label="close" @click="drawer = false">
        <i class="iconfont icon-close"></i>
      </button>
      <form class="drawer-search" @submit.prevent="submitSearch">
        <input v-model="keyword" class="fnt16" :placeholder="t('searchPlaceholder', locale)" />
        <button type="submit" :aria-label="t('search', locale)"><i class="iconfont icon-search-o"></i></button>
      </form>
    </div>

    <nav class="drawer-body">
      <section v-for="(g, i) in drawerGroups" :key="i" class="drawer-group">
        <h3 class="group-title fnt18">{{ g.label }}</h3>
        <div class="group-items fnt16">
          <a v-for="(c, j) in g.children" :key="j" :class="['group-item', { active: isCurrent(c.url) }]"
             :href="c.url" :target="isExternal(c.url) ? '_blank' : undefined">{{ c.label }}</a>
        </div>
      </section>
      <a class="drawer-lang fnt16" :href="switchLocaleUrl(route.fullPath, locale === 'en' ? 'zh' : 'en')">
        {{ locale === 'en' ? '中文' : 'English' }}
      </a>
    </nav>
  </div>
  </Transition>

  <!-- 搜索浮层 -->
  <Transition name="fade">
  <div v-if="searchOpen" class="search-layer" @click.self="searchOpen = false">
    <button class="drawer-close" type="button" aria-label="close" @click="searchOpen = false">
      <i class="iconfont icon-close"></i>
    </button>
    <form class="search-form td-container" @submit.prevent="submitSearch">
      <input v-model="keyword" class="fnt18" :placeholder="t('searchPlaceholder', locale)" autofocus />
      <button type="submit" class="fnt16">{{ t('search', locale) }}<i class="iconfont icon-search-o"></i></button>
    </form>
  </div>
  </Transition>
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
/**
 * 抽屉里的分组:第一组是顶栏那几条(原站就叫「顶部导航」),之后每个一级栏目一组。
 * 只有带子项的才成组 —— 一个空的组标题点不动,反而像坏了。
 */
const drawerGroups = computed(() => {
    const groups: Array<{ label: string; children: any[] }> = [];
    if (topItems.value.length) {
        groups.push({ label: locale.value === 'en' ? 'Top Links' : '顶部导航', children: topItems.value });
    }
    for (const m of headerItems.value) {
        const kids = m.children?.length ? m.children : [m];
        groups.push({ label: m.label, children: kids });
    }
    return groups;
});

const isCurrent = (url: string) => {
    const u = String(url || '').replace(/\/$/, '');
    return !!u && route.path.replace(/\/$/, '') === u;
};

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
/**
 * 首页:压在焦点图上,自身**完全透明**。
 *
 * 保证白色 logo 与导航可读的那层暗化渐变,原站是画在**幻灯片**上的
 * (`.slide-inner`,由上到下 rgba(0,0,0,.75) → 0),不在页头上 —— 见 HeroSwiper。
 * 画在页头上会随页头一起吸顶、一起消失,那不是原站的行为。
 */
.td-header.is-transparent { position: absolute; inset: 0 0 auto; background: none; }
/**
 * 吸顶态默认停在视口外。**过渡只写在 `.is-shown` 上**:写在 `.is-fixed` 上的话,进入吸顶
 * 的那一刻 top 会从 0 滑到 -100%,那 0.6 秒里蓝色页头正好横穿屏幕 —— 就是"向下滚闪一下
 * 蓝色"。加上 class 时必须是瞬时的,只有向上滚滑出来时才需要动画。
 */
.td-header.is-fixed {
  position: fixed; inset: 0 0 auto; top: -100%;
  box-shadow: 0 0 10px rgba(0,0,0,.15);
}
.td-header.is-fixed.is-shown { top: 0; transition: top .6s; }

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

.header-nav { display: flex; align-items: center; justify-content: flex-end; padding: var(--size-12) 0 var(--size-15); }
/* 间距做在 `.nav-link` 的内边距上而不是 flex gap:gap 撑出来的是**死区**,鼠标移到那里
   既没有指针也点不动,而视觉上它属于导航条。 */
.nav-item { position: relative; cursor: pointer; }
.nav-link { color: #fff; position: relative; display: block; padding: var(--size-12) 1.04vw; white-space: nowrap; cursor: pointer; }
.nav-link::after {
  content: ""; position: absolute; left: 1.04vw; right: 1.04vw; bottom: 2px; height: 2px; background: #fff;
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
.sub-link { cursor: pointer; }
.sub-link:hover { color: var(--color-primary); }

.menu-toggle { display: none; background: none; border: 0; cursor: pointer; padding: 8px 0; }
.menu-toggle span {
  display: block; width: 24px; height: 2px; background: #fff; margin: 5px 0;
  transition: transform .3s ease, opacity .2s ease;
}
/* 三道杠合成叉:抽屉开着时按钮本身就是关闭键,不用再找一个 */
.menu-toggle.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.menu-toggle.open span:nth-child(2) { opacity: 0; }
.menu-toggle.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

/* ── 移动端抽屉:白底,与原站一致(不是蓝色遮罩) ── */
.drawer {
  position: fixed; inset: 0; z-index: 999; background: #fff; color: var(--color-text-primary);
  overflow-y: auto; display: flex; flex-direction: column;
}
.drawer-head { padding: 16px 20px 0; }
.drawer-close {
  display: block; margin-left: auto; background: none; border: 0; cursor: pointer;
  color: var(--color-text-primary); font-size: 24px; line-height: 1; padding: 4px;
}
.drawer-search { display: flex; margin-top: 8px; }
.drawer-search input {
  flex: 1; min-width: 0; height: 48px; padding: 0 14px; border: 0;
  background: var(--bg-primary); color: var(--color-text-primary);
}
.drawer-search input::placeholder { color: var(--color-text-placeholder); }
.drawer-search button {
  width: 56px; height: 48px; border: 0; background: var(--color-primary); color: #fff;
  cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px;
}

.drawer-body { padding: 8px 20px 40px; }
/* 组间虚线 —— 原站用它区隔栏目,比实线轻,不会把列表切碎 */
.drawer-group + .drawer-group { border-top: 1px dashed var(--border-color); }
.drawer-group { padding: 18px 0; }
.group-title { font-weight: 700; color: var(--color-text-primary); margin-bottom: 12px; }
/* 两列。子项名字长短不一,`start` 让它们顶部对齐而不是各自居中 */
.group-items { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; align-items: start; }
.group-item { color: var(--color-text-regular); line-height: 1.5; }
.group-item.active, .group-item:hover { color: var(--color-primary); }

.drawer-lang {
  display: inline-block; margin-top: 8px; padding: 8px 18px;
  border: 1px solid var(--border-color); color: var(--color-text-secondary);
}

/* ── 搜索浮层(桌面端) ── */
.search-layer { position: fixed; inset: 0; z-index: 999; background: rgba(19,77,163,.97); display: flex; align-items: center; }
.search-layer .drawer-close { position: absolute; top: 20px; right: 20px; color: #fff; margin: 0; }

.search-form { display: flex; align-items: center; gap: 12px; width: 100%; }
.search-form input { flex: 1; height: 52px; padding: 0 16px; border: 0; background: #fff; color: var(--color-text-primary); }
.search-form button {
  height: 52px; padding: 0 28px; border: 0; background: var(--color-primary); color: #fff;
  cursor: pointer; display: flex; align-items: center; gap: 8px; border: 1px solid #fff;
}

/**
 * 浮层的进出场。抽屉整体淡入,内容再从右侧推进来 —— 两段错开一点,读起来像"拉开",
 * 而不是整块凭空出现。关闭走同一条路反过来,时长略短(离开不需要被看清)。
 */
.drawer-enter-active, .drawer-leave-active { transition: opacity .28s ease; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
.drawer-enter-active .drawer-body, .drawer-enter-active .drawer-head {
  transition: transform .34s cubic-bezier(.22,.61,.36,1), opacity .34s ease;
}
.drawer-leave-active .drawer-body, .drawer-leave-active .drawer-head { transition: transform .2s ease, opacity .2s ease; }
.drawer-enter-from .drawer-body, .drawer-leave-to .drawer-body,
.drawer-enter-from .drawer-head, .drawer-leave-to .drawer-head { transform: translateY(-16px); opacity: 0; }

.fade-enter-active, .fade-leave-active { transition: opacity .24s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.fade-enter-active .search-form { transition: transform .3s cubic-bezier(.22,.61,.36,1), opacity .3s ease; }
.fade-enter-from .search-form { transform: translateY(-14px); opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .drawer-enter-active, .drawer-leave-active, .fade-enter-active, .fade-leave-active,
  .drawer-enter-active .drawer-body, .drawer-leave-active .drawer-body,
  .drawer-enter-active .drawer-head, .drawer-leave-active .drawer-head,
  .fade-enter-active .search-form, .menu-toggle span { transition: none; }
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
