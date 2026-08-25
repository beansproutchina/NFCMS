<template>
  <nav v-if="items.length" class="filter-tabs fnt18">
    <a v-for="(it, i) in items" :key="i" :class="['tab', { active: isActive(it.url) }]" :href="it.url">
      <span>{{ it.label }}</span>
    </a>
  </nav>
</template>

<script setup lang="ts">
/** 列表页顶部的子栏目筛选条 —— 对应原站 `?fl=` 那一排。用真 `<a>`,每个筛选都是可分享的 URL。 */
import { useRoute } from 'vue-router';
import type { Locale } from '../lib';

defineProps<{ items: Array<{ label: string; url: string }>; locale?: Locale }>();
const route = useRoute();
const isActive = (url: string) => route.path.replace(/\/$/, '') === String(url || '').replace(/\/$/, '');
</script>

<style scoped>
.filter-tabs { display: flex; flex-wrap: wrap; gap: 0; margin-bottom: var(--size-36); }
/* 标签不参与收缩 —— flex 子项默认 `flex-shrink:1`,放不下时会被压扁,几个标签的文字叠在一起 */
.tab { flex: 0 0 auto; }
.tab > span {
  display: flex; align-items: center; justify-content: center; height: 100%;
  padding: var(--size-18) var(--size-30); background: var(--bg-grey);
  border: 1px solid rgba(0,0,0,.1); border-left: none; color: var(--color-primary);
  transition: all .3s ease-in-out;
}
.tab:first-child > span { border-left: 1px solid rgba(0,0,0,.1); }
.tab:hover > span, .tab.active > span { background: var(--menu-active); color: #fff; }
@media (max-width: 767px) {
  /**
   * 窄屏改成横向滚动条。`flex: none` 是必须的 —— flex 子项默认 `flex-shrink: 1`,在放不下
   * 时会被压扁,几个标签的文字于是叠在一起;不收缩才会真正溢出,进而触发这里的横向滚动。
   */
  .filter-tabs { overflow-x: auto; flex-wrap: nowrap; -webkit-overflow-scrolling: touch; }
  .filter-tabs::-webkit-scrollbar { height: 0; }
  .tab > span { white-space: nowrap; padding: 10px 16px; }
}
</style>
