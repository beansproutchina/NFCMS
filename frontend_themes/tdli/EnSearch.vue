<template><SearchResults :context="context" locale="en" /></template>
<script setup lang="ts">
/** 英文搜索页 = 同一个组件 + `locale="en"`。 */
import SearchResults from './SearchResults.vue';
defineProps<{ context: any }>();
</script>
