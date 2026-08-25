<template>
  <component :is="tpl" :context="scoped" locale="en" />
</template>

<script setup lang="ts">
/**
 * 英文详情页的**模板分发器**。见 EnCategory.vue 的说明。
 *
 * 模板名用后端富化时算好的 `article.template`(它已经处理了 `content_template` 覆盖分类
 * 默认值的优先级),不在前端重算一遍。
 */
import { computed } from 'vue';
import DefaultArticle from './DefaultArticle.vue';
import EventArticle from './EventArticle.vue';
import PersonPage from './PersonPage.vue';

const props = defineProps<{ context: any }>();

const TEMPLATES: Record<string, any> = { DefaultArticle, EventArticle, PersonPage };

const article = computed(() => props.context?.article ?? null);
const tpl = computed(() => TEMPLATES[String(article.value?.template ?? '')] ?? DefaultArticle);

const scoped = computed(() => ({
    ...props.context,
    category: article.value?.category ?? null,
    breadcrumbs: article.value?.breadcrumbs ?? [],
}));
</script>
