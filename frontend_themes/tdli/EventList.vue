<template>
  <div class="td-main-grey">
    <Breadcrumb :items="context.breadcrumbs" :locale="locale" />
    <div class="td-block td-block--big">
      <div class="td-container cat-row">
        <SideMenu :context="context" :locale="locale" />
        <div class="cat-body">
          <FilterTabs v-if="tabs.length" :items="tabs" :locale="locale" />
          <div v-if="items.length" class="academic-list">
            <Reveal v-for="a in items" :key="a.id">
              <a class="acamemic-item td-hover-card" :href="href(a)">
                <div class="top-info">
                  <div class="calendary fnt20">
                    <i class="iconfont icon-calendar fnt22"></i>
                    <span class="day">{{ eventDay(a) }}</span>
                  </div>
                  <div v-if="a.category?.name" class="tag fnt14"><span>{{ a.category.name }}</span></div>
                </div>
                <div class="title fnt24">{{ a.title }}</div>
                <div class="bottom-info fnt18">
                  <span v-if="a.data?.person"><i class="iconfont icon-user-o"></i>{{ a.data.person }}</span>
                  <div class="bottom">
                    <span v-if="timeRange(a)"><i class="iconfont icon-clock-o"></i>{{ timeRange(a) }}</span>
                    <span v-if="a.data?.venue"><i class="iconfont icon-location-o"></i>{{ a.data.venue }}</span>
                  </div>
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
import { useCategoryList, articleUrl, categoryUrl, formatEventTime, formatDate, t, type Locale } from './lib';

const props = withDefaults(defineProps<{ context: any; locale?: Locale }>(), { locale: 'zh' });
const locale = computed<Locale>(() => props.locale ?? 'zh');
const { items, page, totalPages, goPage } = useCategoryList(props.context, 10);

const tabs = computed(() => {
    const children = props.context?.children ?? [];
    if (!children.length) return [];
    const self = props.context?.category;
    return [
        { label: t('all', locale.value), url: categoryUrl(self?.slug, locale.value) },
        ...children.map((c: any) => ({ label: c.name, url: categoryUrl(c.slug, locale.value) })),
    ];
});

/** 活动日期取 `data.start_dt`,没有就退回发布时间 —— 列表上宁可显示发布日,也不留空。 */
const eventDay = (a: any) => formatDate(a?.data?.start_dt || a?.published_at);
const timeRange = (a: any) => (a?.data?.start_dt ? formatEventTime(a.data.start_dt, a.data.end_dt, locale.value) : '');
const href = (a: any) => articleUrl(a, locale.value);
</script>

<style scoped>
.cat-row { display: flex; gap: 2.8vw; align-items: flex-start; }
.cat-row > :deep(.secondary-menu) { width: 25%; flex: none; }
.cat-body { flex: 1; min-width: 0; }

.acamemic-item {
  display: flex; flex-direction: column; padding: var(--size-30) var(--size-24);
  border-bottom: 1px solid rgba(0,0,0,.1);
}
.acamemic-item:first-child { border-top: 1px solid rgba(0,0,0,.1); }
.top-info { display: flex; align-items: center; gap: var(--size-30); padding-bottom: var(--size-24); }
.calendary { color: var(--calendar-icon); display: flex; align-items: center; gap: var(--size-16); }
.top-info .tag { border: 1px solid var(--color-primary); color: var(--color-primary); border-radius: 18px; }
.top-info .tag span { padding: 0 var(--size-18); }
.acamemic-item .title {
  line-height: 1.4; margin-bottom: var(--size-20); color: var(--color-text-primary);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.acamemic-item:hover .title { color: var(--color-primary); }
.bottom-info { color: var(--color-text-secondary); display: flex; flex-direction: column; gap: var(--size-6); }
.bottom { display: flex; flex-wrap: wrap; gap: var(--size-24); }
.bottom-info .iconfont { margin-right: 5px; }
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
</style>
