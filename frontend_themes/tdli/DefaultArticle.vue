<template>
  <div class="td-main-grey">
    <Breadcrumb :items="crumbs" :locale="locale" />
    <div class="td-block" style="padding-top: 0;">
      <div class="td-container">
        <article v-if="article" class="article-container">
          <header class="article-title">
            <h3 class="fnt32">{{ article.title }}</h3>
            <div class="article-other fnt16">
              <div class="meta">
                <span><i class="iconfont icon-clock-o"></i>{{ formatDate(article.published_at) }}</span>
                <span v-if="article.data?.department">{{ t('department', locale) }}：{{ article.data.department }}</span>
                <span v-if="article.data?.doc_number">{{ t('docNumber', locale) }}：{{ article.data.doc_number }}</span>
              </div>
              <div class="share-btn fnt18">
                <a :href="weiboUrl" target="_blank" rel="noopener" aria-label="weibo"><i class="iconfont icon-weibo"></i></a>
              </div>
            </div>
          </header>
          <div class="tdli-prose fnt18" v-html="rendered"></div>
          <hr />
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
import { formatDate, t, type Locale } from './lib';

const props = withDefaults(defineProps<{ context: any; locale?: Locale }>(), { locale: 'zh' });
const locale = computed<Locale>(() => props.locale ?? 'zh');

const article = computed(() => props.context?.article ?? null);
/** 自定义路由的英文页拿不到框架注入的 breadcrumbs,退回文章自带的那一份。 */
const crumbs = computed(() => props.context?.breadcrumbs ?? article.value?.breadcrumbs ?? []);

/** `content` 是 Markdown 源码,不渲染的话页面上会直接显示井号和星号。 */
const rendered = computed(() => renderMarkdown(article.value?.content));

const weiboUrl = computed(() => {
    if (typeof window === 'undefined') return '#';
    const u = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(String(article.value?.title ?? ''));
    return `https://service.weibo.com/share/share.php?url=${u}&title=${title}`;
});
</script>

<style scoped>
/* 居中的白卡片,顶部一道主色条 —— 原站详情页的固定形态 */
.article-container {
  margin: 0 auto; max-width: 66.67vw; background: #fff; position: relative;
  padding: 2.25vw 6.25vw 1.25vw;
}
.article-container::before {
  content: ""; position: absolute; top: 0; left: 0; right: 0; height: var(--size-4);
  background: var(--color-primary);
}
.article-title h3 { font-weight: 600; line-height: 1.4; margin-bottom: var(--size-24); }
.article-other {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  color: var(--color-text-secondary);
  padding-bottom: var(--size-20); margin-bottom: var(--size-20);
  border-bottom: 1px solid var(--border-color);
}
.meta { display: flex; flex-wrap: wrap; gap: var(--size-24); }
.meta .iconfont { margin-right: 5px; }
.share-btn a {
  display: flex; align-items: center; justify-content: center; color: var(--color-text-secondary);
  width: var(--size-36); height: var(--size-36); min-width: 32px; min-height: 32px;
  border: 1px solid var(--border-color); border-radius: 50%;
}
.share-btn a:hover { color: var(--color-primary); border-color: var(--color-primary); }
hr { border: 0; border-top: 1px solid var(--border-color); margin: var(--size-45) 0 0; }
.empty { color: var(--color-text-regular); padding: 80px 0; text-align: center; }

@media (max-width: 1199px) { .article-container { max-width: 100%; padding: 28px 32px; } }
@media (max-width: 767px) { .article-container { padding: 20px 16px; } }
</style>
