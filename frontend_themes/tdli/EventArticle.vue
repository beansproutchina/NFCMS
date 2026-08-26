<template>
  <div class="td-main-grey">
    <Breadcrumb :items="crumbs" :locale="locale" />
    <div class="td-block" style="padding-top: 0;">
      <div class="td-container">
        <article v-if="article" class="article-container xshd-detail">
          <header class="article-title">
            <div v-if="tags.length" class="tag fnt14">
              <span v-for="(tg, i) in tags" :key="i">{{ tg }}</span>
            </div>
            <h3 class="fnt32">{{ article.title }}</h3>
          </header>

          <div class="bottom-other-info fnt18">
            <div class="other-info">
              <span v-if="timeText"><i class="iconfont icon-clock-o"></i>{{ timeText }}</span>
              <span v-if="d.person"><i class="iconfont icon-user-o"></i>{{ d.person }}</span>
              <span v-if="d.venue"><i class="iconfont icon-location-o"></i>{{ d.venue }}</span>
            </div>
          </div>

          <div class="detail-container">
            <div class="tdli-prose fnt18" v-html="rendered"></div>
            <p v-if="d.indico_url" class="indico fnt18">
              {{ t('indico', locale) }}：<a :href="d.indico_url" target="_blank" rel="noopener">{{ d.indico_url }}</a>
            </p>
          </div>
        </article>
        <p v-else class="empty fnt18">{{ t(locale === 'en' ? 'noEnglish' : 'notFound', locale) }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { renderMarkdown } from '@/lib/prose';
import Breadcrumb from './components/Breadcrumb.vue';
import { formatEventTime, t, type Locale } from './lib';

const props = withDefaults(defineProps<{ context: any; locale?: Locale }>(), { locale: 'zh' });
const locale = computed<Locale>(() => props.locale ?? 'zh');

const article = computed(() => props.context?.article ?? null);
const crumbs = computed(() => props.context?.breadcrumbs ?? article.value?.breadcrumbs ?? []);
const d = computed<any>(() => article.value?.data ?? {});

/** 两级标签:一级研究部 + 二级活动类型。缺哪个跳过哪个,不渲染空胶囊。 */
const tags = computed(() => [d.value.division, article.value?.category?.name].filter(Boolean));
const timeText = computed(() => (d.value.start_dt ? formatEventTime(d.value.start_dt, d.value.end_dt, locale.value) : ''));
const rendered = computed(() => renderMarkdown(article.value?.content));
</script>

<style scoped>
.article-container {
  margin: 0 auto; max-width: 66.67vw; background: #fff; position: relative;
  padding: 2.25vw 6.25vw 1.25vw;
}
.article-container::before {
  content: ""; position: absolute; top: 0; left: 0; right: 0; height: var(--size-4); background: var(--color-primary);
}
.article-title .tag {
  display: inline-block; border: 1px solid var(--color-primary); color: var(--color-primary);
  border-radius: 18px; margin-bottom: var(--size-9);
}
/* 两个标签挤在一个胶囊里,中间一道竖线分隔 —— 原站的写法 */
.article-title .tag span { padding: 0 var(--size-18); position: relative; display: inline-block; }
.article-title .tag span:not(:last-child)::after {
  content: ""; position: absolute; right: 0; top: 3px; bottom: 3px; width: 1px; background: var(--color-primary);
}
.article-title h3 { font-weight: 600; line-height: 1.4; margin-bottom: var(--size-24); }

.bottom-other-info { color: var(--color-text-secondary); }
.other-info { display: flex; flex-direction: column; gap: var(--size-6); }
.other-info .iconfont { margin-right: 5px; }

.detail-container { margin-top: var(--size-48); padding-top: var(--size-48); border-top: 1px solid rgba(0,0,0,.1); }
.indico { margin-top: var(--size-30); color: var(--color-text-secondary); }
.indico a { color: var(--color-primary); word-break: break-all; }
.empty { color: var(--color-text-regular); padding: 80px 0; text-align: center; }

@media (max-width: 1199px) { .article-container { max-width: 100%; padding: 28px 32px; } }
@media (max-width: 767px) { .article-container { padding: 20px 16px; } }
</style>
