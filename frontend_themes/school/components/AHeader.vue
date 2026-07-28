<template>
  <header class="uni-header">
    <!-- 顶栏:次级链接(menus[location=top]),无则不显示 -->
    <div class="top-bar" v-if="topLinks.length">
      <div class="container">
        <div class="top-spacer"></div>
        <nav class="top-links">
          <a v-for="(l, i) in topLinks" :key="i" :href="l.url" :target="isExternal(l.url) ? '_blank' : undefined" :rel="isExternal(l.url) ? 'noopener' : undefined">{{ l.label }}</a>
        </nav>
      </div>
    </div>

    <!-- 主标识:校徽 + 校名 + 搜索 -->
    <div class="masthead">
      <div class="container">
        <a class="brand" href="/">
          <img v-if="logo" :src="logo" :alt="siteName" class="brand-logo" />
          <div class="brand-text" :class="{ 'no-logo': !logo }">
            <span class="brand-name">{{ siteName }}</span>
            <span class="brand-sub" v-if="subtitle">{{ subtitle }}</span>
          </div>
        </a>

        <form class="search-box" @submit.prevent="doSearch">
          <input v-model="q" type="text" placeholder="搜索新闻、通知…" aria-label="站内搜索" />
          <button type="submit" aria-label="搜索">搜索</button>
        </form>

        <button class="hamburger" :class="{ open: mobileOpen }" @click="mobileOpen = !mobileOpen" aria-label="菜单">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>

    <!-- 主导航(menus[location=header]) -->
    <nav class="main-nav" :class="{ 'mobile-open': mobileOpen }">
      <div class="container">
        <ul class="nav-list">
          <li v-for="(item, index) in navItems" :key="index" class="nav-item">
            <a :href="item.url" @click="mobileOpen = false">{{ item.label }}</a>
            <ul class="sub-nav" v-if="item.children && item.children.length">
              <li v-for="(child, ci) in item.children" :key="ci">
                <a :href="child.url" @click="mobileOpen = false">{{ child.label }}</a>
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps<{ context: any }>();
const { config, menus } = props.context || {};
const router = useRouter();

const siteName = computed(() => config?.site_name || '学院官网');
const subtitle = computed(() => config?.subtitle || '');
const logo = computed(() => config?.theme_school_logo || '');

const menuItems = (location: string) => {
  if (!menus) return [];
  const m = menus.find((x: any) => x.location === location);
  return m ? m.items : [];
};
// Main nav falls back to the whole first menu when no header-located menu is defined.
const navItems = computed(() => {
  const header = menuItems('header');
  if (header.length) return header;
  return menus?.[0]?.items || [];
});
const topLinks = computed(() => menuItems('top'));

const isExternal = (url: string) => /^https?:\/\//i.test(url || '');

const q = ref('');
const doSearch = () => {
  const term = q.value.trim();
  if (!term) return;
  router.push(`/search?q=${encodeURIComponent(term)}`);
  mobileOpen.value = false;
};

const mobileOpen = ref(false);
</script>

<style scoped>
.uni-header { background: #fff; box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06); }
.container {
  max-width: 1200px; margin: 0 auto; padding: 0 20px;
  display: flex; align-items: center; justify-content: space-between;
}

/* 顶栏 */
.top-bar { background: var(--uni-primary-dark); color: #fff; font-size: 13px; }
.top-links { display: flex; gap: 4px; }
.top-links a {
  color: rgba(255, 255, 255, 0.85); text-decoration: none; padding: 7px 10px; transition: color .2s;
}
.top-links a:hover { color: #fff; }

/* 主标识 */
.masthead { padding: 22px 0; background: linear-gradient(180deg, #fff 0%, #fdf7f7 100%); }
.brand { display: flex; align-items: center; gap: 16px; text-decoration: none; min-width: 0; }
.brand-logo { height: 52px; width: auto; display: block; }
.brand-text { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
.brand-name {
  font-size: 28px; font-weight: 700; color: var(--uni-primary);
  letter-spacing: 2px; font-family: "STZhongsong", "Microsoft YaHei", "PingFang SC", serif;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.brand-sub { font-size: 13px; color: #888; letter-spacing: 3px; margin-top: 3px; }

/* 搜索 */
.search-box { display: flex; align-items: center; flex-shrink: 0; }
.search-box input {
  padding: 8px 14px; border: 1px solid #d8d8d8; border-right: none; outline: none;
  border-radius: 4px 0 0 4px; font-size: 14px; width: 200px; transition: border-color .2s;
}
.search-box input:focus { border-color: var(--uni-primary); }
.search-box button {
  padding: 8px 18px; border: none; background: var(--uni-primary); color: #fff;
  cursor: pointer; border-radius: 0 4px 4px 0; font-size: 14px; transition: background .2s;
}
.search-box button:hover { background: var(--uni-primary-dark); }

/* 汉堡(移动端) */
.hamburger {
  display: none; flex-direction: column; justify-content: center; gap: 5px;
  width: 40px; height: 40px; background: none; border: none; cursor: pointer; padding: 8px;
}
.hamburger span { display: block; height: 2px; background: var(--uni-primary); border-radius: 2px; transition: transform .3s, opacity .3s; }
.hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.hamburger.open span:nth-child(2) { opacity: 0; }
.hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

/* 主导航 */
.main-nav { background: var(--uni-primary); }
.main-nav .container { justify-content: center; padding: 0 20px; }
.nav-list { display: flex; list-style: none; margin: 0; padding: 0; flex-wrap: wrap; }
.nav-item { position: relative; }
.nav-list > li > a {
  display: block; padding: 15px 26px; color: #fff; text-decoration: none;
  font-size: 16px; transition: background .25s; white-space: nowrap;
}
.nav-list > li > a:hover { background: var(--uni-primary-dark); }

/* 二级下拉 */
.sub-nav {
  visibility: hidden; opacity: 0; position: absolute; top: 100%; left: 0; min-width: 160px;
  background: var(--uni-primary-dark); box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  list-style: none; padding: 0; margin: 0; z-index: 200; transform: translateY(8px); transition: all .25s;
}
.nav-item:hover .sub-nav { visibility: visible; opacity: 1; transform: translateY(0); }
.sub-nav li a {
  display: block; padding: 12px 20px; font-size: 14px; color: rgba(255, 255, 255, 0.9);
  text-decoration: none; border-bottom: 1px solid rgba(255, 255, 255, 0.08); white-space: nowrap;
}
.sub-nav li:last-child a { border-bottom: none; }
.sub-nav li a:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }

/* 响应式 */
@media (max-width: 860px) {
  .search-box input { width: 130px; }
  .brand-name { font-size: 22px; }
  .brand-logo { height: 42px; }
  .hamburger { display: flex; }
  .main-nav .container { justify-content: flex-start; padding: 0; }
  .main-nav { max-height: 0; overflow: hidden; transition: max-height .3s ease; }
  .main-nav.mobile-open { max-height: 80vh; overflow-y: auto; }
  .nav-list { flex-direction: column; width: 100%; }
  .nav-item { width: 100%; }
  .nav-list > li > a { padding: 14px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.12); }
  /* 移动端下拉常驻展开 */
  .sub-nav {
    position: static; visibility: visible; opacity: 1; transform: none; box-shadow: none;
    background: rgba(0, 0, 0, 0.15); min-width: 0;
  }
  .sub-nav li a { padding-left: 44px; }
}
@media (max-width: 560px) {
  .top-bar { display: none; }
  .search-box { display: none; }
}
</style>
