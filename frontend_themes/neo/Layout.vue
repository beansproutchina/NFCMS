<template>
  <div class="neo-layout">
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
.neo-layout {
  --bg-page: #F4F1EA;
  --surface: #FFFFFF;
  --ink: #1C1C1C;
  --accent: #D64933;
  --border-light: #D1CCC5;
  --shadow-hard: 8px 8px 0 #1C1C1C;
  --shadow-soft: 4px 4px 0 #1C1C1C;

  background: var(--bg-page);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: 'Manrope', sans-serif;
  color: var(--ink);
}
</style>
