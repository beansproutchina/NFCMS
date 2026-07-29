<template>
  <main class="home">
    <!-- HERO -->
    <section class="hero">
      <h1 class="hero-title">{{ siteName }}</h1>
      <p class="hero-sub" v-if="tagline">{{ tagline }}</p>
      <div class="hero-actions">
        <a v-if="ctaText" class="btn primary" :href="ctaLink">{{ ctaText }} →</a>
        <a class="btn" href="/contact">联系我们</a>
      </div>
      <div class="hero-rule">⸺</div>
    </section>

    <!-- FEATURED WORKS -->
    <section class="block" v-if="works.length">
      <div class="block-head">
        <h2>精选作品</h2>
        <a v-if="worksCat" class="more" :href="`/a/${worksCat.slug}`">全部作品 →</a>
      </div>
      <div class="works">
        <a v-for="w in works" :key="w.id" class="work" :href="articleUrl(w)">
          <div class="w-thumb" :style="w.thumbnail ? { backgroundImage: `url(${w.thumbnail})` } : {}" :class="{ 'no-img': !w.thumbnail }">
            <span v-if="!w.thumbnail">{{ (w.title || '·').slice(0, 1) }}</span>
          </div>
          <div class="w-info">
            <h3>{{ w.title }}</h3>
            <span class="w-sub" v-if="w.data?.client || w.data?.year">{{ [w.data?.client, w.data?.year].filter(Boolean).join(' · ') }}</span>
          </div>
        </a>
      </div>
    </section>

    <!-- SERVICES -->
    <section class="block" v-if="services.length">
      <div class="block-head">
        <h2>我们提供</h2>
        <a v-if="servicesCat" class="more" :href="`/a/${servicesCat.slug}`">全部服务 →</a>
      </div>
      <div class="svcs">
        <a v-for="(s, i) in services" :key="s.id" class="svc" :href="articleUrl(s)">
          <span class="svc-icon">{{ s.data?.icon || '✦' }}</span>
          <h3>{{ s.title }}</h3>
          <p v-if="s.description">{{ s.description }}</p>
          <span class="svc-no">{{ String(i + 1).padStart(2, '0') }}</span>
        </a>
      </div>
    </section>

    <!-- LATEST JOURNAL -->
    <section class="block" v-if="latest.length">
      <div class="block-head">
        <h2>最新动态</h2>
      </div>
      <ul class="posts">
        <li v-for="p in latest" :key="p.id">
          <a :href="articleUrl(p)">
            <span class="p-cat" v-if="p.category">{{ p.category.name }}</span>
            <span class="p-title">{{ p.title }}</span>
            <time>{{ formatDate(p.published_at) }}</time>
          </a>
        </li>
      </ul>
    </section>

    <!-- CONTACT CTA -->
    <section class="cta">
      <h2>有项目想聊聊?</h2>
      <a class="btn primary big" href="/contact">开始合作 →</a>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { articleUrl, formatDate } from './lib';

const props = defineProps<{ context: any }>();
const { config, categories, articles, api } = props.context || {};

const siteName = computed(() => config?.site_name || 'NEO STUDIO');
const tagline = computed(() => config?.theme_neo_tagline || config?.subtitle || '');
const ctaText = computed(() => config?.theme_neo_hero_cta_text || '查看作品');
const worksCat = computed(() => (categories || []).find((c: any) => c.list_template === 'WorkGrid'));
const servicesCat = computed(() => (categories || []).find((c: any) => c.list_template === 'ServiceList'));
const ctaLink = computed(() => config?.theme_neo_hero_cta_link || (worksCat.value ? `/a/${worksCat.value.slug}` : '/a/works'));

const works = ref<any[]>([]);
const services = ref<any[]>([]);
// "Latest" = newest articles overall (prefetched), minus works/services/team entries.
const latest = computed(() => {
  const skip = new Set((categories || []).filter((c: any) => ['WorkGrid', 'ServiceList', 'TeamGrid'].includes(c.list_template)).map((c: any) => c.id));
  return (articles || []).filter((a: any) => !skip.has(a.category_id)).slice(0, 5);
});

const fetchCat = async (cat: any, limit: number, top = false) => {
  if (!cat || !api?.contentAPI) return [];
  try {
    const filter: any = { category_id: cat.id };
    if (top) filter.is_top = 1;
    let res = await api.contentAPI.listArticles({ filter, orderBy: 'published_at', orderDesc: true, limit });
    let data = res.data || [];
    if (top && !data.length) { // fall back to latest when nothing is pinned
      res = await api.contentAPI.listArticles({ filter: { category_id: cat.id }, orderBy: 'published_at', orderDesc: true, limit });
      data = res.data || [];
    }
    return data;
  } catch { return []; }
};

onMounted(async () => {
  works.value = await fetchCat(worksCat.value, 4, true);
  services.value = await fetchCat(servicesCat.value, 6);
});
</script>

<style scoped>
.home { max-width: 1440px; margin: 0 auto; padding: 0 2rem 5rem; width: 100%; }

/* HERO */
.hero { padding: 5rem 0 4rem; border-bottom: 3px solid var(--ink); }
.hero-title { font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(3.5rem, 14vw, 10rem); font-weight: 800; line-height: 0.88; letter-spacing: -0.03em; text-transform: uppercase; }
.hero-sub { font-family: 'Space Mono', monospace; font-size: clamp(1rem, 2.5vw, 1.4rem); margin-top: 1.75rem; max-width: 640px; border-left: 12px solid var(--accent); padding-left: 1.5rem; }
.hero-actions { display: flex; gap: 1rem; margin-top: 2.5rem; flex-wrap: wrap; }
.hero-rule { margin-top: 2.5rem; font-size: 3rem; color: var(--border-light); }

.btn { font-family: 'Space Mono', monospace; font-weight: 700; text-transform: uppercase; font-size: 0.9rem; text-decoration: none; color: var(--ink); background: var(--surface); border: 3px solid var(--ink); box-shadow: var(--shadow-soft); padding: 12px 22px; transition: transform .1s, box-shadow .1s; }
.btn:hover { transform: translate(-2px,-2px); box-shadow: 7px 7px 0 var(--ink); }
.btn.primary { background: var(--accent); color: var(--surface); }
.btn.big { font-size: 1.1rem; padding: 16px 32px; }

/* BLOCKS */
.block { margin-top: 5rem; }
.block-head { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 3px solid var(--ink); padding-bottom: 1rem; margin-bottom: 2.5rem; }
.block-head h2 { font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(2rem, 5vw, 3rem); text-transform: uppercase; }
.block-head .more { font-family: 'Space Mono', monospace; text-decoration: none; color: var(--ink); }
.block-head .more:hover { color: var(--accent); }

/* works */
.works { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2.5rem; }
.work { text-decoration: none; color: var(--ink); border: 3px solid var(--ink); background: var(--surface); box-shadow: var(--shadow-hard); transition: transform .12s, box-shadow .12s; }
.work:hover { transform: translate(-3px,-3px); box-shadow: 12px 12px 0 var(--ink); }
.w-thumb { aspect-ratio: 16/10; background: var(--bg-page) center/cover no-repeat; border-bottom: 3px solid var(--ink); display: flex; align-items: center; justify-content: center; }
.w-thumb.no-img { background: repeating-linear-gradient(45deg, var(--bg-page), var(--bg-page) 12px, #eae5db 12px, #eae5db 24px); }
.w-thumb span { font-family: 'Bricolage Grotesque'; font-size: 4rem; font-weight: 800; opacity: .18; }
.w-info { padding: 1.5rem; }
.w-info h3 { font-family: 'Bricolage Grotesque', sans-serif; font-size: 1.8rem; }
.work:hover .w-info h3 { color: var(--accent); }
.w-sub { font-family: 'Space Mono', monospace; font-size: 0.85rem; color: rgba(28,28,28,.7); }

/* services */
.svcs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; }
.svc { position: relative; text-decoration: none; color: var(--ink); border: 3px solid var(--ink); background: var(--surface); box-shadow: var(--shadow-soft); padding: 2rem; transition: transform .12s, box-shadow .12s; }
.svc:hover { transform: translate(-2px,-2px); box-shadow: 8px 8px 0 var(--ink); }
.svc-icon { font-size: 2.5rem; }
.svc h3 { font-family: 'Bricolage Grotesque', sans-serif; font-size: 1.5rem; margin: 1rem 0 0.75rem; }
.svc p { font-size: 0.9rem; line-height: 1.5; color: rgba(28,28,28,.8); }
.svc-no { position: absolute; top: 1rem; right: 1.25rem; font-family: 'Space Mono', monospace; color: var(--accent); font-weight: 700; }

/* posts */
.posts { list-style: none; padding: 0; margin: 0; border-top: 2px solid var(--ink); }
.posts li { border-bottom: 2px solid var(--border-light); }
.posts a { display: grid; grid-template-columns: 160px 1fr auto; align-items: center; gap: 1.5rem; padding: 1.25rem 0.5rem; text-decoration: none; color: var(--ink); transition: background .12s, padding .12s; }
.posts a:hover { background: var(--ink); color: var(--surface); padding-left: 1.25rem; }
.p-cat { font-family: 'Space Mono', monospace; font-size: 0.78rem; color: var(--accent); text-transform: uppercase; }
.p-title { font-family: 'Bricolage Grotesque', sans-serif; font-size: 1.35rem; }
.posts time { font-family: 'Space Mono', monospace; font-size: 0.8rem; opacity: 0.7; }

/* cta */
.cta { margin-top: 5rem; border: 3px solid var(--ink); background: var(--accent); color: var(--surface); box-shadow: var(--shadow-hard); padding: 4rem 2rem; text-align: center; }
.cta h2 { font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(2rem, 6vw, 4rem); text-transform: uppercase; margin-bottom: 2rem; }
.cta .btn { background: var(--surface); }

@media (max-width: 800px) {
  .works, .svcs { grid-template-columns: 1fr; }
  .posts a { grid-template-columns: 1fr; gap: 0.35rem; }
  .posts time { justify-self: start; }
}
</style>
