<template>
  <div>
    <HeroSwiper :items="context.hero" :locale="locale" />

    <!-- 综合新闻:三列图文卡片 -->
    <section v-if="news.length" class="td-block">
      <div class="td-container">
        <SectionTitle :title="L.news" :more="catHref('posts')" :more-label="t('more', locale)" />
        <div class="news-grid">
          <Reveal v-for="(a, i) in news" :key="a.id" :delay="Number(i) * 60">
            <a class="news-card td-hover-card" :href="href(a)" :target="ext(href(a)) ? '_blank' : undefined">
              <div class="td-img-box news-img"><img :src="a.thumbnail" :alt="a.title" loading="lazy" /></div>
              <div class="news-text">
                <div class="date-box fnt18">
                  <span v-if="a.data?.tag" class="tag">{{ a.data.tag }}</span>
                  <span class="time">{{ formatDate(a.published_at) }}</span>
                </div>
                <div class="title fnt24">{{ a.title }}</div>
              </div>
            </a>
          </Reveal>
        </div>
      </div>
    </section>

    <!-- 通知公告:日期 + 标题的网格 -->
    <section v-if="notices.length" class="td-block td-main-grey">
      <div class="td-container">
        <SectionTitle :title="L.notice" :more="catHref('announcements')" :more-label="t('more', locale)" />
        <div class="notice-grid">
          <Reveal v-for="(a, i) in notices" :key="a.id" :delay="Number(i) * 50">
            <a class="notice-item" :href="href(a)">
              <div class="time fnt16">{{ formatDate(a.published_at) }}</div>
              <div class="title fnt20">{{ a.title }}</div>
            </a>
          </Reveal>
        </div>
      </div>
    </section>

    <!-- 学术活动:类型 tab + 日历块列表 -->
    <section v-if="events.length" class="td-block events-block">
      <div class="td-container">
        <SectionTitle :title="L.events" :more="catHref('events')" :more-label="t('more', locale)" />
        <div v-if="eventTabs.length > 1" class="event-tabs fnt24">
          <button v-for="tab in eventTabs" :key="tab.slug" type="button"
                  :class="['tab', { active: tab.slug === activeTab }]" @click="activeTab = tab.slug">
            {{ tab.label }}
          </button>
        </div>
        <div class="event-list">
          <Reveal v-for="a in shownEvents" :key="a.id">
            <a class="event-item td-hover-card" :href="href(a)">
              <div class="calendar">
                <div class="day">{{ dayMonth(a.data?.start_dt || a.published_at).day }}</div>
                <div class="line"></div>
                <div class="month">{{ dayMonth(a.data?.start_dt || a.published_at).month }}</div>
              </div>
              <div class="event-body">
                <div v-if="a.category?.name" class="tag fnt16"><span>{{ a.category.name }}</span></div>
                <div class="desc fnt24">{{ a.title }}</div>
                <div class="info fnt16">
                  <span v-if="a.data?.person"><i class="iconfont icon-user-o"></i>{{ a.data.person }}</span>
                  <span v-if="a.data?.venue"><i class="iconfont icon-location-o"></i>{{ a.data.venue }}</span>
                </div>
              </div>
            </a>
          </Reveal>
        </div>
      </div>
    </section>

    <!-- 快速指南:图标入口 -->
    <section v-if="quicklinks.length" class="td-block">
      <div class="td-container">
        <SectionTitle :title="L.guide" />
        <div class="entry-grid">
          <Reveal v-for="(a, i) in quicklinks" :key="a.id" :delay="Number(i) * 50">
            <a class="entry-item" :href="a.data?.url || href(a)"
               :target="ext(a.data?.url || '') ? '_blank' : undefined">
              <div class="icon"><img v-if="a.thumbnail" :src="a.thumbnail" :alt="a.title" loading="lazy" /></div>
              <div class="text fnt24">{{ a.title }}</div>
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import HeroSwiper from './components/HeroSwiper.vue';
import SectionTitle from './components/SectionTitle.vue';
import Reveal from './components/Reveal.vue';
import { articleUrl, categoryUrl, formatDate, dayMonth, t, type Locale } from './lib';

const props = withDefaults(defineProps<{ context: any; locale?: Locale }>(), { locale: 'zh' });
const locale = computed<Locale>(() => props.locale ?? 'zh');

const news = computed<any[]>(() => props.context?.news ?? []);
const notices = computed<any[]>(() => props.context?.notices ?? []);
const events = computed<any[]>(() => props.context?.events ?? []);
const quicklinks = computed<any[]>(() => props.context?.quicklinks ?? []);

/** 分区标题。中英对照抄原站(综合新闻 / Institute News …)。 */
const L = computed(() => locale.value === 'en'
    ? { news: 'Institute News', notice: 'Notice', events: 'Events', guide: 'Guide' }
    : { news: '综合新闻', notice: '通知公告', events: '学术活动', guide: '快速指南' });

const href = (a: any) => String(a?.data?.external_url || articleUrl(a, locale.value));
const ext = (url: string) => /^(https?:)?\/\//i.test(String(url || ''));
const catHref = (slug: string) => categoryUrl(locale.value === 'en' ? `en-${slug}` : slug, locale.value);

/**
 * 活动的类型 tab 直接从**取回来的活动**里归纳,不写死栏目名单:
 * 栏目改了名、加了一类,这里跟着变,不会出现一个点开是空的 tab。
 */
const eventTabs = computed(() => {
    const seen = new Map<string, string>();
    for (const a of events.value) {
        const slug = a?.category?.slug, name = a?.category?.name;
        if (slug && !seen.has(slug)) seen.set(slug, name || slug);
    }
    const list = [...seen].map(([slug, label]) => ({ slug, label }));
    return list.length > 1 ? [{ slug: '', label: t('all', locale.value) }, ...list] : list;
});

const activeTab = ref('');
const shownEvents = computed(() =>
    (activeTab.value ? events.value.filter((a: any) => a?.category?.slug === activeTab.value) : events.value).slice(0, 5));
</script>

<style scoped>
/* ── 综合新闻 ── */
.news-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2vw; }
.news-card { display: block; background: #fff; height: 100%; }
/* 右上切角:原站焦点卡片的形状语言,与左侧栏目菜单呼应 */
.news-img { padding-bottom: 56.27%; clip-path: polygon(92% 0%, 100% 12%, 100% 100%, 0% 100%, 0% 0); }
.news-text { padding: var(--size-24); }
.date-box { display: flex; align-items: center; gap: var(--size-15); color: var(--color-text-regular); }
.date-box .tag { color: var(--color-primary); border: 1px solid var(--color-primary); padding: 0 var(--size-12); border-radius: 18px; white-space: nowrap; }
.news-card .title {
  margin-top: var(--size-15); color: var(--color-text-primary); line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.news-card:hover .title { color: var(--color-primary); }

/* ── 通知公告 ── */
.notice-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2vw 2.5vw; }
.notice-item { display: block; padding: var(--size-24) 0; border-bottom: 1px solid #D3DBDA; height: 100%; }
.notice-item .time { color: var(--color-text-regular); }
.notice-item .title {
  margin-top: var(--size-12); color: var(--color-text-primary); line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.notice-item:hover .title { color: var(--color-primary); }

/* ── 学术活动 ── */
.events-block { background: var(--bg-grey) url('https://tdli.sjtu.edu.cn/assets/images/xshg_bg.png') center/cover no-repeat; }
.event-tabs { display: flex; flex-wrap: wrap; gap: var(--size-36); margin-bottom: var(--size-30); }
.tab { background: none; border: 0; cursor: pointer; padding: 0 0 var(--size-12); color: var(--color-text-regular); font-size: inherit; position: relative; }
.tab.active { color: var(--color-primary); font-weight: bold; }
.tab.active::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: var(--color-primary); }

.event-list { display: flex; flex-direction: column; }
.event-item { display: flex; gap: var(--size-30); padding: var(--size-30) var(--size-24); border-bottom: 1px solid rgba(0,0,0,.1); align-items: flex-start; }
.calendar { flex: none; text-align: center; color: var(--calendar-icon); min-width: 84px; }
.calendar .day { font-size: 2.08vw; line-height: 1; font-weight: 600; }
.calendar .line { height: 1px; background: currentColor; opacity: .35; margin: 8px auto; width: 70%; }
.calendar .month { font-size: .83vw; }
.event-body { flex: 1; min-width: 0; }
.event-body .tag { display: inline-block; border: 1px solid var(--color-primary); color: var(--color-primary); border-radius: 18px; }
.event-body .tag span { padding: 0 var(--size-18); }
.event-body .desc {
  margin: var(--size-12) 0; color: var(--color-text-primary); line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.event-item:hover .desc { color: var(--color-primary); }
.event-body .info { display: flex; flex-wrap: wrap; gap: var(--size-24); color: var(--color-text-secondary); }
.event-body .info .iconfont { margin-right: 5px; }

/* ── 快速指南 ── */
.entry-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 2vw; }
.entry-item { display: block; text-align: center; }
.entry-item .icon { height: 4.5vw; min-height: 56px; display: flex; align-items: center; justify-content: center; }
.entry-item .icon img { max-height: 100%; width: auto; transition: transform .3s; }
.entry-item:hover .icon img { transform: translateY(-6px); }
.entry-item .text { margin-top: var(--size-24); color: var(--color-text-primary); }
.entry-item:hover .text { color: var(--color-primary); }

@media (max-width: 1199px) {
  .calendar .day { font-size: 30px; } .calendar .month { font-size: 13px; }
  .entry-grid { grid-template-columns: repeat(4, 1fr); }
  .news-grid, .notice-grid { gap: 20px; }
}
@media (max-width: 767px) {
  .news-grid { grid-template-columns: 1fr; }
  .notice-grid { grid-template-columns: 1fr; gap: 0; }
  .entry-grid { grid-template-columns: repeat(3, 1fr); }
  .event-item { flex-direction: column; gap: 12px; padding: 20px 0; }
  .calendar { display: flex; align-items: baseline; gap: 8px; text-align: left; }
  .calendar .line { display: none; }
}
</style>
