<template>
  <div class="td-main-grey">
    <Breadcrumb :items="context.breadcrumbs" :locale="locale" />
    <div class="td-block td-block--big">
      <div class="td-container cat-row">
        <SideMenu :context="context" :locale="locale" />
        <div class="cat-body">
          <Reveal v-if="page">
            <h1 v-if="showTitle" class="page-title fnt36">{{ page.title }}</h1>
            <div class="tdli-prose fnt18" v-html="rendered"></div>
          </Reveal>
          <p v-else class="empty fnt18">{{ t('empty', locale) }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 单页栏目(研究所简介、规章制度…):左菜单 + 右富文本。
 *
 * 取该栏目下**最新的一篇**当正文 —— 这类栏目在 CMS 里就是"一个栏目一篇文章",这样运营
 * 改内容只需编辑那篇文章,不必碰主题。栏目下一篇都没有时给空态,不去抓别处的内容顶上。
 */
import { computed } from 'vue';
import { renderMarkdown } from '@/lib/prose';
import Breadcrumb from './components/Breadcrumb.vue';
import SideMenu from './components/SideMenu.vue';
import Reveal from './components/Reveal.vue';
import { t, type Locale } from './lib';

const props = withDefaults(defineProps<{ context: any; locale?: Locale }>(), { locale: 'zh' });
const locale = computed<Locale>(() => props.locale ?? 'zh');

const list = computed<any[]>(() => {
    const own = props.context?.articles ?? [];
    return own.length ? own : (props.context?.sectionArticles ?? []);
});
const page = computed(() => list.value[0] ?? null);
/** 标题与栏目名重复时不再显示一遍 */
const showTitle = computed(() => page.value && page.value.title !== props.context?.category?.name);
const rendered = computed(() => renderMarkdown(page.value?.content));
</script>

<style scoped>
.cat-row { display: flex; gap: 2.8vw; align-items: flex-start; }
.cat-row > :deep(.secondary-menu) { width: 25%; flex: none; }
.cat-body { flex: 1; min-width: 0; }
.page-title { color: var(--color-primary); font-weight: 600; margin-bottom: var(--size-30); }
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
