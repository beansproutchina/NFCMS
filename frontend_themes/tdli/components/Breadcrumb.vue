<template>
  <div class="breadcrumb">
    <div class="td-container">
      <span class="crumbs fnt20">
        <a :href="homeHref"><i class="iconfont icon-home-o"></i> {{ t('home', locale) }}</a>
        <template v-for="(c, i) in items" :key="c.id ?? i">
          <span class="sep">&gt;</span>
          <!-- 末级不可点;list_template 为空的栏目没有列表页,同样只做文字 -->
          <a v-if="Number(i) < items.length - 1 && !c.disabled" :href="categoryUrl(c.slug, locale)">{{ c.name }}</a>
          <span v-else class="current">{{ c.name }}</span>
        </template>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { t, categoryUrl, type Locale } from '../lib';

const props = withDefaults(defineProps<{ items?: any[]; locale?: Locale }>(), { locale: 'zh' });
const items = computed(() => props.items ?? []);
const homeHref = computed(() => (props.locale === 'en' ? '/en' : '/'));
</script>

<style scoped>
.breadcrumb { padding: 24px 0; text-align: right; color: var(--color-text-secondary); }
.crumbs { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.crumbs a { color: var(--color-text-secondary); }
.crumbs a:hover { color: var(--color-primary); }
.sep { color: var(--color-text-regular); }
.current { color: var(--color-text-primary); }
@media (max-width: 767px) { .breadcrumb { padding: 14px 0; text-align: left; } }
</style>
