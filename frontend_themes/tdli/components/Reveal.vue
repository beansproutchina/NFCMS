<template>
  <component :is="tag" ref="el" :class="['td-reveal', `is-${from}`, { 'is-in': shown }]">
    <slot></slot>
  </component>
</template>

<script setup lang="ts">
/**
 * 滚动进场包装 —— 复刻原站的 scrollReveal(`data-scroll-reveal="enter left over .6s"`)。
 *
 * 用 IntersectionObserver 而不是引库:只需要"进过视口一次就定住"这一种行为。
 * **默认可见**:观察器还没跑(SSG 快照、无 JS、旧浏览器)时元素必须是看得见的 ——
 * 动画是锦上添花,不能成为内容显示的前置条件。
 */
import { ref, onMounted, onUnmounted } from 'vue';

const props = withDefaults(defineProps<{ from?: 'bottom' | 'left' | 'right'; tag?: string; delay?: number }>(), {
    from: 'bottom', tag: 'div', delay: 0,
});

const el = ref<any>(null);
const shown = ref(true);
let io: IntersectionObserver | null = null;

onMounted(() => {
    const node: HTMLElement | null = el.value?.$el ?? el.value;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    shown.value = false;                                  // 交给观察器之后才允许它先隐藏
    io = new IntersectionObserver((entries) => {
        for (const e of entries) {
            if (!e.isIntersecting) continue;
            setTimeout(() => { shown.value = true; }, props.delay);
            io?.disconnect(); io = null;                  // 一次性:进过就定住,不来回抖
        }
    }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });
    io.observe(node);
});
onUnmounted(() => io?.disconnect());
</script>

<style scoped>
.td-reveal { transition: opacity .6s ease, transform .6s ease; }
.td-reveal.is-bottom:not(.is-in) { opacity: 0; transform: translateY(36px); }
.td-reveal.is-left:not(.is-in)   { opacity: 0; transform: translateX(-36px); }
.td-reveal.is-right:not(.is-in)  { opacity: 0; transform: translateX(36px); }
.td-reveal.is-in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .td-reveal, .td-reveal:not(.is-in) { opacity: 1; transform: none; transition: none; }
}
</style>
