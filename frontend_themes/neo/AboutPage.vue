<template>
  <main class="about">
    <section class="about-hero">
      <div class="about-intro">
        <span class="eyebrow">关于</span>
        <h1>{{ heading }}</h1>
        <p v-if="tagline" class="tagline">{{ tagline }}</p>
      </div>
      <div class="about-portrait" v-if="avatar">
        <img :src="avatar" alt="">
      </div>
    </section>

    <section class="about-body">
      <div class="prose" v-if="rendered" v-html="rendered"></div>
      <div class="prose placeholder" v-else>
        <p>还没有「关于」内容。在后台发布一篇 slug 为 <code>{{ slug }}</code> 的文章即可显示在这里。</p>
      </div>
    </section>

    <section class="about-connect">
      <h2>联系我们</h2>
      <Socials :context="context" />
      <a class="btn primary" href="/contact">发送消息 →</a>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { marked } from 'marked';
import Socials from './components/Socials.vue';

const props = defineProps<{ context: any }>();
const cfg = computed(() => props.context?.config || {});
const api = props.context?.api;

const slug = computed(() => cfg.value.theme_neo_about_slug || 'about');
const avatar = computed(() => cfg.value.theme_neo_avatar || '');
const tagline = computed(() => cfg.value.theme_neo_tagline || cfg.value.subtitle || '');

const article = ref<any>(null);
const heading = computed(() => article.value?.title || cfg.value.site_name || 'About');
const rendered = computed(() => (article.value?.content ? (marked.parse(article.value.content) as string) : ''));

onMounted(async () => {
  if (!api?.contentAPI) return;
  try {
    const res = await api.contentAPI.getArticle(slug.value);
    if (res.code === 200) article.value = res.data;
  } catch { /* no about article yet */ }
});
</script>

<style scoped>
.about { max-width: 1100px; margin: 0 auto; padding: 3rem 2rem 5rem; width: 100%; }

.about-hero { display: grid; grid-template-columns: 1fr auto; gap: 3rem; align-items: center; border-bottom: 3px solid var(--ink); padding-bottom: 3rem; }
.eyebrow { font-family: 'Space Mono', monospace; text-transform: uppercase; letter-spacing: 2px; color: var(--accent); }
.about-intro h1 { font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(2.8rem, 8vw, 6rem); line-height: 0.95; text-transform: uppercase; margin: 0.75rem 0; }
.tagline { font-family: 'Space Mono', monospace; font-size: 1.15rem; max-width: 560px; color: rgba(28,28,28,.8); }
.about-portrait { width: 220px; height: 220px; border: 3px solid var(--ink); box-shadow: var(--shadow-hard); flex-shrink: 0; }
.about-portrait img { width: 100%; height: 100%; object-fit: cover; display: block; }

.about-body { margin: 3rem 0; }
.prose { font-size: 1.2rem; line-height: 1.75; max-width: 760px; }
.prose :deep(h2) { font-family: 'Bricolage Grotesque', sans-serif; margin: 2.5rem 0 1rem; }
.prose :deep(p) { margin-bottom: 1.3em; }
.prose :deep(blockquote) { border-left: 12px solid var(--accent); background: var(--surface); padding: 1.25rem; box-shadow: 6px 6px 0 var(--ink); margin: 2rem 0; }
.prose :deep(a) { color: var(--accent); }
.prose.placeholder { font-family: 'Space Mono', monospace; color: rgba(28,28,28,.6); }
.prose code { background: var(--surface); border: 2px solid var(--ink); padding: 1px 6px; }

.about-connect { border-top: 3px solid var(--ink); padding-top: 2.5rem; display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; }
.about-connect h2 { font-family: 'Bricolage Grotesque', sans-serif; font-size: 1.8rem; margin-right: auto; }
.btn { font-family: 'Space Mono', monospace; font-weight: 700; text-transform: uppercase; text-decoration: none; color: var(--ink); background: var(--surface); border: 3px solid var(--ink); box-shadow: var(--shadow-soft); padding: 12px 22px; transition: transform .1s, box-shadow .1s; }
.btn:hover { transform: translate(-2px,-2px); box-shadow: 7px 7px 0 var(--ink); }
.btn.primary { background: var(--accent); color: var(--surface); }

@media (max-width: 720px) {
  .about-hero { grid-template-columns: 1fr; }
  .about-portrait { width: 160px; height: 160px; }
}
</style>
