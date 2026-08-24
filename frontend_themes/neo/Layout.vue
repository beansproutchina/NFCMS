<template>
  <div class="neo-layout neo-scope">
    <AHeader :context="context" />
    <slot></slot>
    <AFooter :context="context" />
  </div>
</template>

<script setup lang="ts">
import AHeader from './components/AHeader.vue';
import AFooter from './components/AFooter.vue';
// Design tokens + base typography live in one file shared with MemberLayout.vue (see tokens.css).
import './tokens.css';
// 正文(v-html 出来的 Markdown)样式的唯一一份来源,见 prose.css 顶部注释。
import './prose.css';

defineProps<{
  context?: any;
}>();
</script>

<style scoped>
/* Shell geometry only — colours/typography come from `.neo-scope` in tokens.css. */
.neo-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
