<template>
  <nav class="flex items-center gap-2" :class="TEXT.hint">
    <router-link to="/" class="hover:text-link transition-colors">{{ $t('front.home') }}</router-link>
    <template v-for="crumb in items" :key="crumb.id || crumb.slug">
      <span class="text-label-4">/</span>
      <span v-if="crumb.disabled" class="text-label">{{ crumb.name }}</span>
      <router-link v-else :to="crumb.url || `/a/${crumb.slug}`" class="hover:text-link transition-colors">{{ crumb.name }}</router-link>
    </template>
    <template v-if="current">
      <span class="text-label-4">/</span>
      <span class="text-label truncate max-w-[300px]">{{ current }}</span>
    </template>
  </nav>
</template>

<script setup lang="ts">
import { TEXT } from '../ui/presets';

defineProps<{
  items: any[];
  current?: string;
}>();

// const { t } = useI18n();
</script>
