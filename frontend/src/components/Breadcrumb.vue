<template>
  <nav class="flex items-center gap-2 text-body text-label-3">
    <router-link to="/" class="hover:text-link transition-colors">{{ $t('front.home') }}</router-link>
    <template v-for="crumb in items" :key="crumb.id || crumb.slug">
      <span class="text-label-4">/</span>
      <span v-if="crumb.disabled" class="text-black">{{ crumb.name }}</span>
      <router-link v-else :to="crumb.url || `/a/${crumb.slug}`" class="hover:text-link transition-colors">{{ crumb.name }}</router-link>
    </template>
    <template v-if="current">
      <span class="text-label-4">/</span>
      <span class="text-black truncate max-w-[300px]">{{ current }}</span>
    </template>
  </nav>
</template>

<script setup lang="ts">

defineProps<{
  items: any[];
  current?: string;
}>();

// const { t } = useI18n();
</script>
