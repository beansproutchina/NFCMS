<template><DefaultCategory :context="context" :locale="locale" :page-size="7" /></template>
<script setup lang="ts">
/** 新闻列表。版式与通用目录页一致(图左文右),只是每页条数按原站设为 7。 */
import DefaultCategory from './DefaultCategory.vue';
import type { Locale } from './lib';
withDefaults(defineProps<{ context: any; locale?: Locale }>(), { locale: 'zh' });
</script>
