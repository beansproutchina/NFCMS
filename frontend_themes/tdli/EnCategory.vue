<template>
  <component :is="tpl" :context="scoped" locale="en" />
</template>

<script setup lang="ts">
/**
 * 英文目录页的**模板分发器**。
 *
 * 中文侧由框架按 `category.list_template` 选模板;英文侧走的是自定义路由,`viewType` 是
 * `custom`,框架只会渲染这一个组件。所以这里把那套选择逻辑照做一遍 —— 读同一个字段,
 * 渲染同一批展示组件,只是多传一个 `locale="en"`。中英因此共用一套版式,不会各自漂移。
 *
 * 顺带把 context 摊平:`getCategory` 把 `children` / `breadcrumbs` 放在 `category` 里面,
 * 而原生分类页是把它们摊在 context 顶层的 —— 展示组件按后者写,这里补齐差异。
 */
import { computed } from 'vue';
import DefaultCategory from './DefaultCategory.vue';
import NewsList from './NewsList.vue';
import AnnouncementList from './AnnouncementList.vue';
import EventList from './EventList.vue';
import PeopleGrid from './PeopleGrid.vue';
import PageArticle from './PageArticle.vue';

const props = defineProps<{ context: any }>();

const TEMPLATES: Record<string, any> = {
    DefaultCategory, NewsList, AnnouncementList, EventList, PeopleGrid, PageArticle,
};

const category = computed(() => props.context?.category ?? null);
const tpl = computed(() => TEMPLATES[String(category.value?.list_template ?? '')] ?? DefaultCategory);

const scoped = computed(() => ({
    ...props.context,
    category: category.value,
    children: category.value?.children ?? [],
    breadcrumbs: category.value?.breadcrumbs ?? [],
}));
</script>
