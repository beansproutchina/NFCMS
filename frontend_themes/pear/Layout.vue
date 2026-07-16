<template>
  <div class="min-h-screen bg-[#f5f5f7] flex flex-col font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text',sans-serif]">
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
