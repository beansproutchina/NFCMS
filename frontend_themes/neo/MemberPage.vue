<template>
  <main class="member-main">
    <!-- ① Identity card: asymmetric portrait / name -->
    <header class="m-hero">
      <div class="portrait" :style="article?.thumbnail ? { backgroundImage: `url(${article.thumbnail})` } : {}"
           :class="{ 'no-img': !article?.thumbnail }">
        <span v-if="!article?.thumbnail">{{ (article?.title || '·').slice(0, 1) }}</span>
      </div>
      <div class="ident">
        <p class="tag">MEMBER / {{ article?.slug }}</p>
        <h1>{{ article?.title }}</h1>
        <p class="role" v-if="d.role">{{ d.role }}</p>
      </div>
    </header>

    <!-- ② Bio + skills (whole block gone when both are empty) -->
    <section class="m-about" v-if="bio || skills.length">
      <div class="prose neo-prose" v-if="bio" v-html="bio"></div>
      <div class="skills" v-if="skills.length">
        <span v-for="s in skills" :key="s" class="skill">{{ s }}</span>
      </div>
    </section>

    <!-- ③ Social matrix. Gated here too: Socials hides itself when empty, but the heading and the
         divider are ours, and a lone "FIND ME" over a rule is exactly the empty frame we avoid. -->
    <section class="m-social" v-if="hasSocial">
      <p class="sec-title">FIND ME</p>
      <Socials :context="context" :source="socialSource" size="lg" />
    </section>

    <!--
      ④ 参与作品:**由成员自己在正文的 `:::works` 块里声明**(顺序、贡献、站外条目都归他自己)。
      没写块 = 整块不出现(不是空框,也不回退到"署名反查"的列表)。
      `is`:有链接的渲染成 <a>,不可点的条目渲染成 <div> —— 同一套样式,少一个假链接。
    -->
    <section class="m-works" v-if="workRows.length">
      <p class="sec-title">WORKS · {{ workRows.length }}</p>
      <component :is="w.href ? 'a' : 'div'" v-for="(w, i) in workRows" :key="w.href || w.title || i"
                 class="work-row" :class="{ 'no-link': !w.href }" :href="w.href || undefined">
        <span class="wt" :style="w.image ? { backgroundImage: `url(${w.image})` } : {}"
              :class="{ 'no-img': !w.image }">
          <span v-if="!w.image">{{ (w.title || '·').slice(0, 1) }}</span>
        </span>
        <span class="wb">
          <span class="wtitle">{{ w.title }}</span>
          <span class="wmeta" v-if="w.meta">{{ w.meta }}</span>
        </span>
        <span class="warrow" v-if="w.href">{{ w.external ? '↗' : '→' }}</span>
      </component>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { renderMarkdown } from '@/lib/prose';
import Socials from './components/Socials.vue';
import { articleUrl, parseWorksBlock, scrollToTopOnEnter } from './lib';

const props = defineProps<{ context: any }>();
scrollToTopOnEnter();

const article = computed<any>(() => props.context?.article || null);
// `article.data` comes back as an object, `null`, or `''` (DYAPI JSON.parses it and swallows
// errors) — normalise once so every read below is a plain property access.
const d = computed<any>(() => {
  const x = article.value?.data;
  return x && typeof x === 'object' ? x : {};
});

/**
 * 正文里的 `:::works` 块由 lib 解析并**摘掉**,剩下的才是自我介绍。
 * 不摘掉的话,marked 不认识 `:::works`,它会以字面量出现在页面上。
 */
const parsed = computed(() => parseWorksBlock(article.value?.content || ''));
const bio = computed(() => (parsed.value.body ? (renderMarkdown(parsed.value.body)) : ''));
const skills = computed(() => String(d.value.skills || '').split(',').map((s) => s.trim()).filter(Boolean));

// Member-level links only — Socials ignores site config when `source` is given.
const socialSource = computed<Record<string, string>>(() => ({
  github: d.value.social_github,
  bilibili: d.value.social_bilibili,
  douyin: d.value.social_douyin,
  xiaohongshu: d.value.social_xiaohongshu,
  zhihu: d.value.social_zhihu,
  email: d.value.social_email,
  wechat_qr: d.value.social_wechat_qr,
}));

const hasSocial = computed(() => Object.values(socialSource.value).some((v) => String(v ?? '').trim()));

/**
 * 站内条目的补料来源,三级取数:
 *
 *  ① **prefetch 命中**(零请求,覆盖绝大多数):`theme.config.ts` 的 `memberWorks` 仍按作品的
 *     `data.members` 反查本成员参与的作品 —— 那次请求本来就要发,顺带把标题/封面/客户年份带回来。
 *     它是 LIKE 整个 `data` 列,所以这里仍要精确核对 slug(`member-1` 会被 `member-10` 命中)。
 *  ② **按 slug 补查**:块里写了、但没在 ① 里(比如作品没署名这位成员)的,收集起来批量查一次。
 *  ③ **查不到**(受限内容 / slug 写错 / 已删):只渲染作者写的那点信息,不报错、不消失。
 */
const fetched = ref<Record<string, any>>({});

const prefetchedBySlug = computed<Record<string, any>>(() => {
  const out: Record<string, any> = {};
  for (const w of props.context?.memberWorks || []) if (w?.slug) out[w.slug] = w;
  return out;
});

const resolve = (slug: string) => prefetchedBySlug.value[slug] || fetched.value[slug] || null;

onMounted(async () => {
  const missing = parsed.value.entries
    .filter((e) => e.slug && !prefetchedBySlug.value[e.slug])
    .map((e) => e.slug);
  if (!missing.length) return;
  const api = props.context?.api?.contentAPI;
  if (!api?.listArticles) return;
  try {
    const res = await api.listArticles({ filter: { slug: { $in: [...new Set(missing)] } }, limit: missing.length });
    const map: Record<string, any> = {};
    for (const a of res?.data || []) if (a?.slug) map[a.slug] = a;
    fetched.value = map;
  } catch { /* 取不到就走 ③:作者写的信息照样显示 */ }
});

/** 渲染用的行:块的顺序就是展示顺序,标题/封面能补则补,贡献文案一律来自块。 */
const workRows = computed(() =>
  parsed.value.entries.map((e) => {
    const hit = e.slug ? resolve(e.slug) : null;
    const external = /^https?:\/\//i.test(e.url);
    return {
      href: hit ? articleUrl(hit) : (e.url || ''),
      external,
      title: hit?.title || e.title || e.slug || e.url,
      image: hit?.thumbnail || e.image || '',
      // 贡献是这次改动的重点:同一个作品在不同成员页上写的不一样,所以只能来自各自的正文。
      meta: [e.contribution, e.date || hit?.data?.year, hit?.data?.client].filter(Boolean).join(' · '),
    };
  }));
</script>

<style scoped>
/* 外观全在 prose.css 的 .neo-prose 里;这里只定尺度。 */
.prose {
  --prose-measure: 680px;
  --prose-size: 1.1rem;
}
.member-main { max-width: 1000px; margin: 0 auto; padding: 4rem 2rem 6rem; width: 100%; }

/* ① identity */
.m-hero { display: grid; grid-template-columns: 320px 1fr; gap: 3rem; align-items: start; }
.portrait {
  aspect-ratio: 1; background: var(--bg-page) center/cover no-repeat;
  border: 3px solid var(--ink); box-shadow: var(--shadow-hard);
  display: flex; align-items: center; justify-content: center;
}
.portrait.no-img { background: repeating-linear-gradient(45deg, var(--bg-page), var(--bg-page) 12px, #eae5db 12px, #eae5db 24px); }
.portrait span { font-family: 'Bricolage Grotesque', sans-serif; font-size: 3.5rem; font-weight: 800; opacity: .2; }

.ident .tag { font-family: 'Space Mono', monospace; font-size: 0.7rem; color: var(--border-light); letter-spacing: 1px; text-transform: uppercase; }
.ident h1 {
  font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800;
  font-size: clamp(2.6rem, 7vw, 4.5rem); line-height: .95; text-transform: uppercase;
  border-left: 16px solid var(--accent); padding-left: 1.25rem; margin-top: .75rem;
}
.role { font-family: 'Space Mono', monospace; font-size: .9rem; color: var(--accent); margin: 1rem 0 0 calc(16px + 1.25rem); }

/* ② bio + skills */
.m-about { margin-top: 4rem; }
.skills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 2rem; }
.skill { font-family: 'Space Mono', monospace; font-size: .7rem; border: 2px solid var(--ink); padding: 3px 8px; }

/* ③ + ④ shared section heading */
.m-social, .m-works { margin-top: 4rem; border-top: 3px solid var(--ink); padding-top: 1.5rem; }
.sec-title { font-family: 'Space Mono', monospace; font-size: .8rem; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 1.25rem; }

/* ④ works — deliberately rows, not a grid, so this never looks like a second WorkGrid */
.work-row {
  display: flex; align-items: center; gap: 1.25rem; padding: 1rem 0;
  border-bottom: 2px solid var(--border-light); text-decoration: none; color: var(--ink);
  transition: background .12s, color .12s, padding .12s;
}
.work-row:hover { background: var(--ink); color: var(--surface); padding-left: .75rem; padding-right: .75rem; }
/* 不可点的条目(块里 url 留空):同一套版式,但不做 hover 反色 —— 悬停变色等于假装能点。 */
.work-row.no-link { cursor: default; }
.work-row.no-link:hover { background: none; color: var(--ink); padding-left: 0; padding-right: 0; }
.wt {
  flex: none; width: 64px; height: 64px; background: var(--bg-page) center/cover no-repeat;
  border: 2px solid var(--ink); display: flex; align-items: center; justify-content: center;
}
.wt.no-img { background: repeating-linear-gradient(45deg, var(--bg-page), var(--bg-page) 8px, #eae5db 8px, #eae5db 16px); }
.wt span { font-family: 'Bricolage Grotesque', sans-serif; font-size: 1.5rem; font-weight: 800; opacity: .35; color: var(--ink); }
.wb { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
.wtitle { font-family: 'Bricolage Grotesque', sans-serif; font-size: 1.2rem; }
.wmeta { font-family: 'Space Mono', monospace; font-size: .75rem; opacity: .7; }
.warrow { flex: none; font-size: 1.2rem; }

@media (max-width: 1023px) {
  .m-hero { grid-template-columns: 240px 1fr; gap: 2rem; }
}
@media (max-width: 767px) {
  .member-main { padding: 2.5rem 1.25rem 4rem; }
  .m-hero { grid-template-columns: 1fr; }
  .portrait { max-width: 200px; }
  .portrait span { font-size: 2.5rem; }
  .ident h1 { border-left-width: 8px; padding-left: 1rem; }
  .role { margin-left: calc(8px + 1rem); }
  .m-about, .m-social, .m-works { margin-top: 3rem; }
}
@media (max-width: 560px) {
  .wt { width: 48px; height: 48px; }
  .warrow { display: none; }
}
</style>
