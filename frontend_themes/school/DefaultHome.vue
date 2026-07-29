<template>
  <div class="home-page">
    <!-- 焦点图轮播:置顶且带缩略图的文章 -->
    <section class="hero" v-if="slides.length" @mouseenter="stop" @mouseleave="start">
      <a v-for="(s, i) in slides" :key="s.id" class="hero-slide" :class="{ active: i === current }"
         :href="articleUrl(s)" :style="{ backgroundImage: `url(${s.thumbnail})` }">
        <div class="hero-overlay">
          <span class="hero-tag" v-if="s.category">{{ s.category.name }}</span>
          <h2 class="hero-title">{{ s.title }}</h2>
          <p class="hero-desc" v-if="s.description">{{ s.description }}</p>
        </div>
      </a>
      <button class="hero-arrow prev" @click.prevent="go(current - 1)" v-if="slides.length > 1" aria-label="上一张">‹</button>
      <button class="hero-arrow next" @click.prevent="go(current + 1)" v-if="slides.length > 1" aria-label="下一张">›</button>
      <div class="hero-dots" v-if="slides.length > 1">
        <button v-for="(s, i) in slides" :key="i" :class="{ active: Number(i) === current }" @click.prevent="go(Number(i))" :aria-label="`第${Number(i)+1}张`"></button>
      </div>
    </section>

    <!-- 要闻 + 通知公告 双栏(由前两个根栏目驱动) -->
    <div class="container main-grid" v-if="newsCat || noticeCat">
      <!-- 左:要闻(头条带图 + 列表) -->
      <section class="panel news-panel" v-if="newsCat">
        <div class="panel-head">
          <h2>{{ newsCat.name }}</h2>
          <a class="more" :href="catUrl(newsCat)">更多 +</a>
        </div>
        <a v-if="lead" class="news-lead" :href="articleUrl(lead)">
          <div class="lead-img" :style="lead.thumbnail ? { backgroundImage: `url(${lead.thumbnail})` } : {}" :class="{ 'no-img': !lead.thumbnail }"></div>
          <div class="lead-body">
            <h3>{{ lead.title }}</h3>
            <p v-if="lead.description">{{ lead.description }}</p>
            <span class="lead-date">{{ formatDate(lead.published_at) }}</span>
          </div>
        </a>
        <ul class="news-list">
          <li v-for="a in newsRest" :key="a.id">
            <a :href="articleUrl(a)" :title="a.title">{{ a.title }}</a>
            <span class="date">{{ formatDate(a.published_at) }}</span>
          </li>
        </ul>
        <div v-if="!newsArticles.length" class="empty">暂无内容</div>
      </section>

      <!-- 右:通知公告(日期块列表) -->
      <section class="panel notice-panel" v-if="noticeCat">
        <div class="panel-head">
          <h2>{{ noticeCat.name }}</h2>
          <a class="more" :href="catUrl(noticeCat)">更多 +</a>
        </div>
        <ul class="notice-list">
          <li v-for="a in noticeArticles" :key="a.id">
            <div class="date-box">
              <span class="day">{{ dayOf(a.published_at) }}</span>
              <span class="ym">{{ ymOf(a.published_at) }}</span>
            </div>
            <a :href="articleUrl(a)" :title="a.title">{{ a.title }}</a>
          </li>
        </ul>
        <div v-if="!noticeArticles.length" class="empty">暂无公告</div>
      </section>
    </div>

    <!-- 快速通道(menus[location=quicklinks]),无则不显示 -->
    <div class="container quick-row" v-if="quickLinks.length">
      <a v-for="(l, i) in quickLinks" :key="i" class="quick-card" :href="l.url"
         :target="isExternal(l.url) ? '_blank' : undefined" :rel="isExternal(l.url) ? 'noopener' : undefined">
        <span class="quick-label">{{ l.label }}</span>
        <span class="quick-arrow">→</span>
      </a>
    </div>

    <!-- 更多栏目(第 3 个起的根栏目,各自最新列表) -->
    <div class="container more-grid" v-if="moreSections.length">
      <section class="panel" v-for="sec in moreSections" :key="sec.cat.id">
        <div class="panel-head">
          <h2>{{ sec.cat.name }}</h2>
          <a class="more" :href="catUrl(sec.cat)">更多 +</a>
        </div>
        <ul class="news-list">
          <li v-for="a in sec.articles" :key="a.id">
            <a :href="articleUrl(a)" :title="a.title">{{ a.title }}</a>
            <span class="date">{{ formatDate(a.published_at) }}</span>
          </li>
        </ul>
        <div v-if="!sec.articles.length" class="empty">暂无内容</div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps<{ context: any }>();
const ctx = props.context || {};
const { categories, featured, articles, menus, api } = ctx;

/* ---------- links & dates ---------- */
const articleUrl = (a: any) => (a?.category?.slug ? `/a/${a.category.slug}/${a.slug}` : `/a/${a?.slug}`);
const catUrl = (c: any) => `/a/${c.slug}`;
const isExternal = (url: string) => /^https?:\/\//i.test(url || '');
const pad = (n: number) => String(n).padStart(2, '0');
const formatDate = (s: string) => { if (!s) return ''; const d = new Date(s); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const dayOf = (s: string) => (s ? pad(new Date(s).getDate()) : '--');
const ymOf = (s: string) => { if (!s) return ''; const d = new Date(s); return `${d.getFullYear()}.${pad(d.getMonth() + 1)}`; };

/* ---------- hero carousel ---------- */
const slides = computed(() => {
  const feat = (featured || []).filter((a: any) => a.thumbnail);
  if (feat.length) return feat.slice(0, 6);
  return (articles || []).filter((a: any) => a.thumbnail).slice(0, 5);
});
const current = ref(0);
let timer: any = null;
const go = (i: number) => { const n = slides.value.length; if (n) current.value = (i + n) % n; };
const start = () => { stop(); if (slides.value.length > 1) timer = setInterval(() => go(current.value + 1), 5000); };
const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
onMounted(start);
onUnmounted(stop);

/* ---------- the two main panels: fixed slugs, prefetched ---------- */
/**
 * 新闻 and 通知 are addressed by slug (`HOME_NEWS_SLUG` / `HOME_NOTICE_SLUG` in theme.config.ts),
 * not by position in the root-category list. Position was silently wrong in an obvious way: adding
 * a category with a smaller `weight`, or reordering in the admin, would move a different section
 * into the 新闻 panel. Slugs also let both panels be PREFETCHED, so the main grid paints filled
 * instead of empty-then-populated.
 */
const newsCat = computed(() => ctx.newsCat || null);
const noticeCat = computed(() => ctx.noticeCat || null);

/**
 * Rows for a prefetched panel, re-checked against the category id.
 *
 * Not paranoia: if the slug doesn't exist, `getCategory` fails, `$data.<key>.id` never resolves and
 * `JSON.stringify` drops the undefined key — leaving a filter with no `category_id`, i.e. every
 * article on the site. This makes that degrade to an empty panel instead.
 */
const panel = (cat: any, rows: any): any[] =>
  cat?.id ? (rows || []).filter((a: any) => a.category_id === cat.id) : [];

const newsArticles = computed(() => panel(newsCat.value, ctx.newsList));
const lead = computed(() => newsArticles.value[0] || null);
const newsRest = computed(() => newsArticles.value.slice(1, 6));
const noticeArticles = computed(() => panel(noticeCat.value, ctx.noticeList));

/* ---------- the "more" strip: whatever other root categories exist ---------- */
// Deliberately still client-side. How many of these there are, and which, is a property of the
// site's data rather than of the theme, and a prefetch list has to be written out statically —
// so pinning them down would mean hardcoding four more slugs. They sit below the fold.
const moreCats = computed(() => {
  const skip = new Set([newsCat.value?.slug, noticeCat.value?.slug].filter(Boolean));
  return (categories || [])
    .filter((c: any) => !c.parent_id && !skip.has(c.slug))
    .sort((a: any, b: any) => (a.weight ?? 50) - (b.weight ?? 50))
    .slice(0, 4);
});

const byCat = ref<Record<number, any[]>>({});
const fetchCat = async (cat: any, limit: number) => {
  if (!cat || !api?.contentAPI) return;
  try {
    const res = await api.contentAPI.listArticles({ filter: { category_id: cat.id }, orderBy: 'published_at', orderDesc: true, limit });
    byCat.value = { ...byCat.value, [cat.id]: res.data || [] };
  } catch { byCat.value = { ...byCat.value, [cat.id]: [] }; }
};

const moreSections = computed(() => moreCats.value.map((c: any) => ({ cat: c, articles: byCat.value[c.id] || [] })));

const quickLinks = computed(() => {
  const m = (menus || []).find((x: any) => x.location === 'quicklinks');
  return m ? m.items : [];
});

onMounted(() => {
  moreCats.value.forEach((c: any) => fetchCat(c, 6));
});
</script>

<style scoped>
.home-page { background: var(--uni-bg-page); padding-bottom: 40px; }

/* ---------- Hero ---------- */
.hero { position: relative; height: 460px; overflow: hidden; background: #2a0000; }
.hero-slide {
  position: absolute; inset: 0; display: block; background-size: cover; background-position: center;
  opacity: 0; transition: opacity .7s ease; pointer-events: none;
}
.hero-slide.active { opacity: 1; pointer-events: auto; }
.hero-overlay {
  position: absolute; left: 0; right: 0; bottom: 0; padding: 60px 8% 44px; color: #fff;
  background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 100%);
}
.hero-tag {
  display: inline-block; background: var(--uni-primary); color: #fff; font-size: 13px;
  padding: 3px 12px; border-radius: 3px; margin-bottom: 14px;
}
.hero-title { font-size: 30px; font-weight: 600; margin: 0 0 10px; max-width: 900px; line-height: 1.35; }
.hero-desc {
  font-size: 15px; color: rgba(255,255,255,0.82); margin: 0; max-width: 720px;
  display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.hero-arrow {
  position: absolute; top: 50%; transform: translateY(-50%); z-index: 3;
  width: 46px; height: 46px; border: none; background: rgba(0,0,0,0.3); color: #fff;
  font-size: 28px; cursor: pointer; transition: background .2s; line-height: 1;
}
.hero-arrow:hover { background: var(--uni-primary); }
.hero-arrow.prev { left: 20px; } .hero-arrow.next { right: 20px; }
.hero-dots { position: absolute; bottom: 20px; left: 8%; z-index: 3; display: flex; gap: 8px; }
.hero-dots button {
  width: 10px; height: 10px; border-radius: 50%; border: none; cursor: pointer;
  background: rgba(255,255,255,0.5); transition: background .2s, width .2s;
}
.hero-dots button.active { background: #fff; width: 26px; border-radius: 5px; }

/* ---------- layout ---------- */
.container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
.panel { background: #fff; border: 1px solid var(--uni-border-light); border-radius: 4px; padding: 24px; }
.panel-head {
  display: flex; justify-content: space-between; align-items: center;
  border-bottom: 2px solid var(--uni-primary); padding-bottom: 12px; margin-bottom: 16px;
}
.panel-head h2 { font-size: 22px; color: var(--uni-primary); font-weight: 600; margin: 0; }
.panel-head .more { font-size: 13px; color: #999; text-decoration: none; }
.panel-head .more:hover { color: var(--uni-primary); }
.empty { text-align: center; color: #aaa; padding: 30px 0; font-size: 14px; }

.main-grid { display: grid; grid-template-columns: 1.7fr 1fr; gap: 30px; margin-top: 36px; }

/* 要闻头条 */
.news-lead { display: flex; gap: 18px; text-decoration: none; padding-bottom: 18px; margin-bottom: 12px; border-bottom: 1px dashed var(--uni-border-light); }
.lead-img { width: 200px; height: 124px; flex-shrink: 0; border-radius: 4px; background: #f0e8e8 center/cover no-repeat; }
.lead-img.no-img { background: linear-gradient(135deg, var(--uni-primary-light), var(--uni-primary)); }
.lead-body { min-width: 0; }
.lead-body h3 { margin: 0 0 8px; font-size: 18px; color: var(--uni-text-title); line-height: 1.4; }
.news-lead:hover .lead-body h3 { color: var(--uni-primary); }
.lead-body p {
  margin: 0 0 10px; font-size: 13px; color: #888; line-height: 1.6;
  display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.lead-date { font-size: 12px; color: #aaa; }

.news-list { list-style: none; padding: 0; margin: 0; }
.news-list li { display: flex; align-items: center; padding: 12px 0; border-bottom: 1px dashed var(--uni-border-light); }
.news-list li::before { content: ''; width: 5px; height: 5px; background: var(--uni-primary); margin-right: 12px; flex-shrink: 0; }
.news-list li a {
  flex: 1; color: var(--uni-text-title); text-decoration: none; font-size: 15px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-right: 16px;
}
.news-list li a:hover { color: var(--uni-primary); }
.news-list li .date { color: #aaa; font-size: 13px; flex-shrink: 0; }

/* 通知公告 */
.notice-list { list-style: none; padding: 0; margin: 0; }
.notice-list li { display: flex; align-items: center; gap: 14px; padding: 11px 0; border-bottom: 1px solid #f2f2f2; }
.date-box {
  width: 54px; flex-shrink: 0; text-align: center; border: 1px solid var(--uni-border-light);
  border-radius: 3px; overflow: hidden;
}
.date-box .day { display: block; font-size: 20px; font-weight: bold; color: var(--uni-primary); padding: 2px 0; }
.date-box .ym { display: block; font-size: 11px; color: #fff; background: var(--uni-primary); padding: 2px 0; }
.notice-list li a {
  flex: 1; color: var(--uni-text-title); text-decoration: none; font-size: 14px; line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.notice-list li a:hover { color: var(--uni-primary); }

/* 快速通道 */
.quick-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 36px; }
.quick-card {
  display: flex; justify-content: space-between; align-items: center; padding: 26px 24px;
  background: linear-gradient(135deg, var(--uni-primary), var(--uni-primary-dark)); color: #fff;
  text-decoration: none; border-radius: 6px; transition: transform .25s, box-shadow .25s;
}
.quick-card:hover { transform: translateY(-4px); box-shadow: 0 10px 22px rgba(139,0,0,0.25); }
.quick-label { font-size: 17px; font-weight: 500; }
.quick-arrow { font-size: 18px; opacity: .8; }

/* 更多栏目 */
.more-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 30px; margin-top: 36px; }

@media (max-width: 900px) {
  .main-grid, .more-grid { grid-template-columns: 1fr; gap: 24px; }
  .quick-row { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 768px) {
  .hero { height: 300px; }
  .hero-title { font-size: 21px; }
  .hero-overlay { padding: 40px 6% 30px; }
  .lead-img { width: 130px; height: 90px; }
}
@media (max-width: 480px) {
  .quick-row { grid-template-columns: 1fr; }
  .news-lead { flex-direction: column; }
  .lead-img { width: 100%; height: 160px; }
}
</style>
