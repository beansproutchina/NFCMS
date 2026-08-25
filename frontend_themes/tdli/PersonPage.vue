<template>
  <div class="td-main-grey">
    <Breadcrumb :items="crumbs" :locale="locale" />
    <div class="td-block" style="padding-top: 0;">
      <div class="td-container">
        <template v-if="article">
          <Reveal class="teacher-detail">
            <div class="img-box"><img :src="avatar" :alt="article.title" /></div>
            <div class="text-box">
              <div class="top">
                <div class="name fnt36">
                  {{ article.title }}<em v-if="d.job" class="fnt16">/ {{ d.job }}</em>
                </div>
                <div v-if="showNameEn" class="name-en fnt18">{{ d.name_en }}</div>
                <div v-if="d.organize_desc" class="title fnt18">{{ d.organize_desc }}</div>
              </div>
              <div class="info fnt18">
                <span v-if="d.postal_address"><i class="iconfont icon-location-o"></i>{{ d.postal_address }}</span>
                <span v-if="d.email"><i class="iconfont icon-mail-o"></i><a :href="`mailto:${d.email}`">{{ d.email }}</a></span>
                <span v-if="d.office_phone"><i class="iconfont icon-mobile-o"></i>{{ d.office_phone }}</span>
                <span v-if="d.web_site"><i class="iconfont icon-internet"></i><a :href="d.web_site" target="_blank" rel="noopener">{{ d.web_site }}</a></span>
              </div>
              <div v-if="rendered" class="desc tdli-prose fnt18" v-html="rendered"></div>
            </div>
          </Reveal>

          <div v-if="sections.length" class="detail-section">
            <Reveal v-for="s in sections" :key="s.key" class="slide-door">
              <button type="button" class="accordion-title fnt18" @click="toggle(s.key)">
                <strong>{{ s.label }}</strong>
                <i :class="['iconfont', open[s.key] ? 'icon-up' : 'icon-left']"></i>
              </button>
              <div v-show="open[s.key]" class="accordion-content tdli-prose fnt16" v-html="s.html"></div>
            </Reveal>
          </div>
        </template>
        <p v-else class="empty fnt18">{{ t(locale === 'en' ? 'noEnglish' : 'notFound', locale) }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 人员详情。五个分区(教育背景 / 工作经历 / 研究方向 / 荣誉信息 / 代表性论著)各存在
 * `article.data` 的一个字段里,**有内容才渲染** —— 一个人没有获奖记录时,不该看到一个
 * 点开是空的手风琴。默认全部展开,与原站一致。
 */
import { ref, computed } from 'vue';
import { marked } from 'marked';
import Breadcrumb from './components/Breadcrumb.vue';
import Reveal from './components/Reveal.vue';
import { t, type Locale, type TextKey } from './lib';

const props = withDefaults(defineProps<{ context: any; locale?: Locale }>(), { locale: 'zh' });
const locale = computed<Locale>(() => props.locale ?? 'zh');

const article = computed(() => props.context?.article ?? null);
const crumbs = computed(() => props.context?.breadcrumbs ?? article.value?.breadcrumbs ?? []);
const d = computed<any>(() => article.value?.data ?? {});
/** 外籍学者的中文名就是英文名 —— 一样时别把同一个名字印两遍。 */
const showNameEn = computed(() =>
    locale.value === 'zh' && !!d.value.name_en && d.value.name_en !== article.value?.title);

const PLACEHOLDER = 'https://mockimg.dev/268x341/CCCCCC/66CCFF.png';
const avatar = computed(() => String(d.value.avatar || article.value?.thumbnail || PLACEHOLDER));
const rendered = computed(() => (article.value?.content ? (marked.parse(article.value.content) as string) : ''));

const KEYS: Array<{ key: string; label: TextKey }> = [
    { key: 'education', label: 'education' },
    { key: 'experience', label: 'experience' },
    { key: 'research', label: 'research' },
    { key: 'honors', label: 'honors' },
    { key: 'publications', label: 'publications' },
];

const sections = computed(() =>
    KEYS.filter(k => String(d.value[k.key] ?? '').trim())
        .map(k => ({ key: k.key, label: t(k.label, locale.value), html: marked.parse(String(d.value[k.key])) as string })));

const open = ref<Record<string, boolean>>(Object.fromEntries(KEYS.map(k => [k.key, true])));
const toggle = (k: string) => { open.value[k] = !open.value[k]; };
</script>

<style scoped>
.teacher-detail { display: flex; gap: var(--size-30); padding: var(--size-36); background: #fff; }
.img-box { width: 13.958vw; min-width: 150px; height: 17.741vw; min-height: 190px; flex: none; overflow: hidden; }
.img-box img { width: 100%; height: 100%; object-fit: cover; }
.text-box { flex: 1; min-width: 0; }
.text-box .name { font-weight: 600; color: var(--color-primary); }
.text-box .name em { font-style: normal; padding-left: var(--size-18); color: var(--color-text-primary); font-weight: normal; }
.text-box .name-en { color: var(--color-text-secondary); margin-top: 4px; }
.text-box .title { margin-top: var(--size-6); color: var(--color-text-regular); }
.text-box .info { margin-top: var(--size-40); color: var(--color-text-secondary); }
.text-box .info span { display: block; margin-top: var(--size-6); overflow: hidden; text-overflow: ellipsis; }
.text-box .info a { color: var(--color-text-secondary); }
.text-box .info a:hover { color: var(--color-primary); }
.text-box .info .iconfont { margin-right: var(--size-9); }
/* 简介上方那道渐变分隔线 */
.text-box .desc {
  margin-top: var(--size-30); padding-top: var(--size-30);
  border-top: var(--size-2) solid transparent;
  border-image: var(--border-bg) 1;
}

.detail-section { margin-top: var(--size-30); display: flex; flex-direction: column; gap: var(--size-20); }
.slide-door { background: #fff; overflow: hidden; }
.accordion-title {
  width: 100%; display: flex; align-items: center; justify-content: space-between;
  padding: var(--size-24) var(--size-36); cursor: pointer; border: 0; text-align: left;
  background: #fff; color: var(--color-primary); font-size: inherit; transition: all .3s ease-in-out;
}
.slide-door:has(.accordion-content:not([style*="display: none"])) .accordion-title {
  background: var(--menu-active); color: #fff;
}
.accordion-content { padding: 1.40625vw var(--size-36); }
.empty { color: var(--color-text-regular); padding: 80px 0; text-align: center; }

@media (max-width: 767px) {
  .teacher-detail { flex-direction: column; padding: 20px; }
  .img-box { width: 140px; height: 178px; }
  .accordion-title { padding: 16px 20px; }
  .accordion-content { padding: 16px 20px; }
}
</style>
