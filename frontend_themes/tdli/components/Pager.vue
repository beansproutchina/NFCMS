<template>
  <div v-if="totalPages > 1" class="pages">
    <button class="pg" :disabled="page <= 0" :aria-label="t('prev', locale)" @click="go(page - 1)">
      <i class="iconfont icon-left"></i>
    </button>
    <button v-for="p in windowed" :key="p" :class="['pg', { curr: p - 1 === page }]" @click="go(p - 1)">{{ p }}</button>
    <button class="pg" :disabled="page >= totalPages - 1" :aria-label="t('next', locale)" @click="go(page + 1)">
      <i class="iconfont icon-right"></i>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { t, type Locale } from '../lib';

const props = withDefaults(defineProps<{ page: number; totalPages: number; locale?: Locale }>(), { locale: 'zh' });
const emit = defineEmits<{ (e: 'go', page: number): void }>();

/** 原站 laypage 的 `groups: 3` —— 当前页两侧各留一个,不铺满整行。 */
const windowed = computed(() => {
    const tp = props.totalPages, cur = props.page + 1;
    let start = Math.max(1, cur - 1), end = Math.min(tp, start + 2);
    start = Math.max(1, end - 2);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
});

const go = (p: number) => { if (p >= 0 && p < props.totalPages && p !== props.page) emit('go', p); };
</script>

<style scoped>
.pages { display: flex; align-items: center; justify-content: center; margin-top: 3.25vw; gap: .625vw; }
.pg {
  height: 2.5vw; width: 2.5vw; min-height: 36px; min-width: 36px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--border-color); background: none; cursor: pointer;
  color: var(--color-text-secondary); font-size: inherit;
}
.pg:hover:not(:disabled) { color: var(--color-primary); }
.pg:disabled { opacity: .4; cursor: default; }
/* 当前页用分页器自己的主题色 —— 原站这里刻意与站点主色不同 */
.pg.curr { background: var(--pager-theme); border-color: var(--pager-theme); color: #fff; }
@media (max-width: 1199px) { .pages { margin-top: 30px; gap: 4px; } }
</style>
