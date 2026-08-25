<template>
  <div class="td-main-grey">
    <Breadcrumb :items="context.breadcrumbs" :locale="locale" />
    <div class="td-block td-block--big">
      <div class="td-container">
        <div class="index-title"><h2 class="fnt45"><span>{{ context.category?.name }}</span></h2></div>
        <div v-if="items.length" class="announcement-list">
          <Reveal v-for="a in items" :key="a.id">
            <a class="announcement-item td-hover-card" :href="href(a)" :target="ext(href(a)) ? '_blank' : undefined">
              <div class="item-box fnt18">
                <div class="day fnt18">{{ formatDate(a.published_at) }}</div>
                <div class="title fnt22">{{ a.title }}</div>
              </div>
            </a>
          </Reveal>
        </div>
        <p v-else class="empty fnt18">{{ t('empty', locale) }}</p>
        <Pager :page="page" :total-pages="totalPages" :locale="locale" @go="goPage" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/** 通知公告:满宽单栏,没有左侧菜单 —— 它是一个根级栏目,没有兄弟可列。 */
import { computed } from 'vue';
import Breadcrumb from './components/Breadcrumb.vue';
import Pager from './components/Pager.vue';
import Reveal from './components/Reveal.vue';
import { useCategoryList, articleUrl, formatDate, t, type Locale } from './lib';

const props = withDefaults(defineProps<{ context: any; locale?: Locale }>(), { locale: 'zh' });
const locale = computed<Locale>(() => props.locale ?? 'zh');
const { items, page, totalPages, goPage } = useCategoryList(props.context, 10);

const href = (a: any) => String(a?.data?.external_url || articleUrl(a, locale.value));
const ext = (url: string) => /^(https?:)?\/\//i.test(String(url || ''));
</script>

<style scoped>
.index-title { margin-bottom: 2.34275vw; }
.index-title h2 { color: var(--color-primary); font-weight: 600; display: inline-block; }
.index-title h2 span { position: relative; display: inline-block; }
.index-title h2 span::before {
  content: ""; position: absolute; left: 0; bottom: -10px; width: 100%; height: var(--size-4);
  background: var(--color-primary);
}
.announcement-item { display: block; padding: var(--size-24); border-bottom: 1px solid rgba(0,0,0,.1); }
.announcement-item:first-child { border-top: 1px solid rgba(0,0,0,.1); }
.item-box .day { color: var(--color-text-regular); padding-bottom: var(--size-9); }
.item-box .title { color: var(--color-text-primary); }
.announcement-item:hover .title { color: var(--color-primary); }
.empty { color: var(--color-text-regular); padding: 60px 0; text-align: center; }
</style>
