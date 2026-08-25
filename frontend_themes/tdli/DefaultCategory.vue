<template>
  <div class="td-main-grey">
    <Breadcrumb :items="context.breadcrumbs" :locale="locale" />
    <div class="td-block td-block--big">
      <div class="td-container cat-row">
        <SideMenu :context="context" :locale="locale" />
        <div class="cat-body">
          <FilterTabs v-if="tabs.length" :items="tabs" :locale="locale" />
          <div v-if="items.length" class="news-list">
            <Reveal v-for="a in items" :key="a.id">
              <a class="news-item td-hover-card" :href="href(a)" :target="ext(href(a)) ? '_blank' : undefined">
                <div v-if="a.thumbnail" class="td-img-box news-img"><img :src="a.thumbnail" :alt="a.title" loading="lazy" /></div>
                <div class="text-box fnt18">
                  <div class="title fnt24">{{ a.title }}</div>
                  <div v-if="a.description" class="desc fnt16">{{ a.description }}</div>
                  <div class="date">{{ formatDate(a.published_at) }}</div>
                </div>
              </a>
            </Reveal>
          </div>
          <p v-else class="empty fnt18">{{ t('empty', locale) }}</p>
          <Pager :page="page" :total-pages="totalPages" :locale="locale" @go="goPage" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Breadcrumb from './components/Breadcrumb.vue';
import SideMenu from './components/SideMenu.vue';
import FilterTabs from './components/FilterTabs.vue';
import Pager from './components/Pager.vue';
import Reveal from './components/Reveal.vue';
import { useCategoryList, articleUrl, categoryUrl, formatDate, t, type Locale } from './lib';

const props = withDefaults(defineProps<{ context: any; locale?: Locale; pageSize?: number }>(), {
    locale: 'zh', pageSize: 12,
});
const locale = computed<Locale>(() => props.locale ?? 'zh');
const { items, page, totalPages, goPage } = useCategoryList(props.context, props.pageSize);

/** 有子栏目时,顶部给一排筛选 tab(「全部」+ 各子栏目),对应原站的 `?fl=` 过滤条。 */
const tabs = computed(() => {
    const children = props.context?.children ?? [];
    if (!children.length) return [];
    const self = props.context?.category;
    return [
        { label: t('all', locale.value), url: categoryUrl(self?.slug, locale.value) },
        ...children.map((c: any) => ({ label: c.name, url: categoryUrl(c.slug, locale.value) })),
    ];
});

const href = (a: any) => String(a?.data?.external_url || articleUrl(a, locale.value));
const ext = (url: string) => /^(https?:)?\/\//i.test(String(url || ''));
</script>

<style scoped>
.cat-row { display: flex; gap: 2.8vw; align-items: flex-start; }
.cat-row > :deep(.secondary-menu) { width: 25%; flex: none; }
.cat-body { flex: 1; min-width: 0; }

.news-list { display: flex; flex-direction: column; gap: var(--size-30); }
.news-item { display: flex; gap: var(--size-40); background: #fff; padding: var(--size-24); }
/* 特异性要压过 tokens.css 里的 `.tdli-scope .td-img-box{width:100%}`,否则图会撑满整行 */
.news-list .news-item .news-img {
  width: 16.979vw; min-width: 200px; max-width: 16.979vw; flex: none;
  height: 9.55vw; min-height: 112px; padding-bottom: 0;
}
.text-box { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; }
.news-item .title {
  color: var(--color-text-primary); line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.news-item:hover .title { color: var(--color-primary); }
.news-item .desc {
  color: var(--color-text-secondary); margin: var(--size-9) 0 var(--size-12);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.news-item .date { color: var(--color-text-secondary); }
.empty { color: var(--color-text-regular); padding: 60px 0; text-align: center; }

@media (max-width: 991px) {
  /**
   * 转成竖排后必须显式 `align-items: stretch` + 给内容列 `width:100%`。
   * `.cat-row` 的 `align-items: flex-start` 是为横排时让左侧菜单顶部对齐而设的,可 column
   * 方向下它管的是**横向**尺寸 —— 子项于是按内容宽度撑开而不是填满,内容列一宽,里面
   * `.filter-tabs` 的 `overflow-x:auto` 就失去了约束,整页横向溢出(实测 390 视口下文档宽 654)。
   */
  .cat-row { flex-direction: column; gap: 0; align-items: stretch; }
  .cat-row > :deep(.secondary-menu) { width: 100%; }
  .cat-body { width: 100%; min-width: 0; }
}
@media (max-width: 767px) {
  .news-item { display: block; padding: 0; }
  .news-list .news-item .news-img { width: 100%; min-width: 0; max-width: none; height: 0; padding-bottom: 56.25%; }
  .text-box { padding: 16px; }
}
</style>
