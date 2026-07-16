<template>
  <div class="theme-uni-layout">
    <AHeader :context="context" />
    <slot></slot>
    <AFooter :context="context" />
  </div>
</template>

<script setup lang="ts">
import AHeader from './components/AHeader.vue';
import AFooter from './components/AFooter.vue';

defineProps<{
  context?: any;
}>();
</script>

<style>
.theme-uni-layout {
  --uni-primary: #8B0000;
  --uni-primary-light: #B22222;
  --uni-primary-dark: #5C0000;
  --uni-bg-page: #F5F5F5;
  --uni-text-title: #222222;
  --uni-text-body: #444444;
  --uni-border-light: #E8E8E8;
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
  background-color: var(--uni-bg-page);
  min-height: 100vh;
}
</style>
