<template>
  <main class="proj-main">
    <nav class="crumbs">
      <a href="/">首页</a>
      <template v-for="c in breadcrumbs" :key="c.id"><span class="sep">/</span><a :href="`/a/${c.slug}`">{{ c.name }}</a></template>
      <span class="sep">/</span><span class="current">{{ article?.title }}</span>
    </nav>

    <header class="proj-head">
      <h1>{{ article?.title || 'Project' }}</h1>
      <p v-if="article?.description" class="lead">{{ article.description }}</p>
    </header>

    <div class="proj-body">
      <aside class="proj-meta">
        <dl>
          <template v-if="d.client"><dt>客户</dt><dd>{{ d.client }}</dd></template>
          <template v-if="d.year"><dt>年份</dt><dd>{{ d.year }}</dd></template>
          <template v-if="d.role"><dt>角色</dt><dd>{{ d.role }}</dd></template>
          <template v-if="tech.length"><dt>技术</dt><dd class="tags"><span v-for="t in tech" :key="t" class="tag">{{ t }}</span></dd></template>
        </dl>
        <div class="proj-links" v-if="d.link_live || d.link_source">
          <a v-if="d.link_live" :href="d.link_live" target="_blank" rel="noopener" class="btn primary">在线预览 ↗</a>
          <a v-if="d.link_source" :href="d.link_source" target="_blank" rel="noopener" class="btn">源码 ↗</a>
        </div>
      </aside>

      <div class="proj-content">
        <div v-if="article?.thumbnail" class="cover"><img :src="article.thumbnail" alt=""></div>
        <div class="prose neo-prose" v-html="rendered"></div>
        <div class="gallery" v-if="gallery.length">
          <img v-for="(g, i) in gallery" :key="i" :src="g" alt="">
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';
import { scrollToTopOnEnter } from './lib';

const props = defineProps<{ context: any }>();
scrollToTopOnEnter();
const { article, breadcrumbs } = props.context || {};

const d = computed<any>(() => article?.data || {});
const tech = computed(() => String(d.value.tech || '').split(',').map((s: string) => s.trim()).filter(Boolean));
const gallery = computed(() => String(d.value.gallery || '').split(',').map((s: string) => s.trim()).filter(Boolean));
const rendered = computed(() => (article?.content ? (marked.parse(article.content) as string) : ''));
</script>

<style scoped>
/* 外观全在 prose.css 的 .neo-prose 里;这里只定尺度。 */
.prose {
  --prose-measure: 720px;
  --prose-size: 1.15rem;
}
.proj-main { max-width: 1280px; margin: 0 auto; padding: 3rem 2rem 5rem; width: 100%; }
.crumbs { font-family: 'Space Mono', monospace; font-size: 0.85rem; margin-bottom: 2.5rem; }
.crumbs a { color: var(--ink); text-decoration: underline wavy var(--accent) 1px; text-underline-offset: 3px; }
.crumbs a:hover { color: var(--accent); }
.crumbs .sep { margin: 0 8px; color: var(--border-light); }
.crumbs .current { color: rgba(28,28,28,.6); }

.proj-head { border-bottom: 3px solid var(--ink); padding-bottom: 2rem; margin-bottom: 2.5rem; }
.proj-head h1 { font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(2.8rem, 7vw, 5rem); line-height: 0.98; border-left: 16px solid var(--accent); padding-left: 1.5rem; }
.proj-head .lead { font-family: 'Space Mono', monospace; margin-top: 1.5rem; font-size: 1.1rem; max-width: 720px; color: rgba(28,28,28,.8); }

.proj-body { display: grid; grid-template-columns: 260px 1fr; gap: 3rem; align-items: start; }
.proj-meta { position: sticky; top: 100px; border: 3px solid var(--ink); background: var(--surface); box-shadow: var(--shadow-soft); padding: 1.5rem; }
.proj-meta dl { margin: 0; }
.proj-meta dt { font-family: 'Space Mono', monospace; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1px; color: var(--accent); margin-top: 1rem; }
.proj-meta dt:first-child { margin-top: 0; }
.proj-meta dd { margin: 0.25rem 0 0; font-weight: 600; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag { font-family: 'Space Mono', monospace; font-size: 0.72rem; font-weight: 400; border: 2px solid var(--ink); padding: 2px 8px; }
.proj-links { margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; }
.btn { display: block; text-align: center; text-decoration: none; border: 2px solid var(--ink); padding: 10px; font-family: 'Space Mono', monospace; font-weight: 700; color: var(--ink); background: var(--surface); box-shadow: 3px 3px 0 var(--ink); transition: transform .1s, box-shadow .1s; }
.btn:hover { transform: translate(-2px,-2px); box-shadow: 5px 5px 0 var(--ink); }
.btn.primary { background: var(--accent); color: var(--surface); }

.cover { border: 3px solid var(--ink); margin-bottom: 2rem; }
.cover img { width: 100%; display: block; }
.gallery { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-top: 2rem; }
.gallery img { width: 100%; border: 3px solid var(--ink); display: block; }

@media (max-width: 860px) {
  .proj-body { grid-template-columns: 1fr; }
  .proj-meta { position: static; }
  .gallery { grid-template-columns: 1fr; }
}
</style>
