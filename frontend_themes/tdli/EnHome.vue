<template><DefaultHome :context="context" locale="en" /></template>
<script setup lang="ts">
/** 英文首页 = 同一套分区组件 + `locale="en"`。分区标题与"更多"文案由 DefaultHome 内部按 locale 取。 */
import DefaultHome from './DefaultHome.vue';
defineProps<{ context: any }>();
</script>
