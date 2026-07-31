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

    <!-- ④ Credited works. Zero works is normal, not an error: the whole block is dropped. -->
    <section class="m-works" v-if="works.length">
      <p class="sec-title">WORKS · {{ works.length }}</p>
      <a v-for="w in works" :key="w.id" class="work-row" :href="articleUrl(w)">
        <span class="wt" :style="w.thumbnail ? { backgroundImage: `url(${w.thumbnail})` } : {}"
              :class="{ 'no-img': !w.thumbnail }">
          <span v-if="!w.thumbnail">{{ (w.title || '·').slice(0, 1) }}</span>
        </span>
        <span class="wb">
          <span class="wtitle">{{ w.title }}</span>
          <span class="wmeta" v-if="metaOf(w)">{{ metaOf(w) }}</span>
        </span>
        <span class="warrow">↗</span>
      </a>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';
import Socials from './components/Socials.vue';
import { articleUrl, scrollToTopOnEnter } from './lib';

const props = defineProps<{ context: any }>();
scrollToTopOnEnter();

const article = computed<any>(() => props.context?.article || null);
// `article.data` comes back as an object, `null`, or `''` (DYAPI JSON.parses it and swallows
// errors) — normalise once so every read below is a plain property access.
const d = computed<any>(() => {
  const x = article.value?.data;
  return x && typeof x === 'object' ? x : {};
});

const bio = computed(() => (article.value?.content ? (marked.parse(article.value.content) as string) : ''));
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
 * Works this member is credited on. The prefetch (theme.config.ts) is a LIKE over the whole `data`
 * column, so two client-side passes are mandatory:
 *   ① exact slug match — LIKE 'member-1' also matches 'member-10';
 *   ② keep only works — some other category's article could mention the same slug in its data.
 *      Judged by `list_template` because config-derived values cannot reach prefetch args.
 */
const works = computed<any[]>(() => (props.context?.memberWorks || []).filter((w: any) => {
  if (w?.category?.list_template !== 'WorkGrid') return false;
  const credited = String(w?.data?.members || '').split(',').map((s) => s.trim()).filter(Boolean);
  return !!article.value?.slug && credited.includes(article.value.slug);
}));

const metaOf = (w: any) => [w?.data?.client, w?.data?.year].filter(Boolean).join(' · ');
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
