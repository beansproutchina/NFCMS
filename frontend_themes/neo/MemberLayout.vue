<template>
  <div class="member-layout neo-scope">
    <a class="back" :href="backHref">← {{ backLabel }}</a>
    <slot></slot>
    <div class="sig">© {{ year }} {{ siteName }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
// Same token file Layout.vue uses — one source, Vite emits it once.
import './tokens.css';

/**
 * Bare page shell for member profiles. Its whole reason to exist is that it is NOT Layout.vue:
 * no AHeader, no AFooter, no nav, no socials, no CTA, no ICP line, no `menus` prefetch — and no
 * data fetching of any kind. It provides tokens, page skeleton, a way back, and one credit line.
 *
 * Registered in theme.config.ts as an intentionally empty `pages` entry. Never give that entry
 * `layout: 'Layout'` — that would wrap the generic shell back around and defeat the whole page.
 *
 * Layouts receive the same `context` as the page (DynamicView mounts them with
 * `h(Comp, { context }, { default })`), which is why the back link can be derived instead of
 * hardcoding `/a/team`.
 */
const props = defineProps<{ context?: any }>();

const article = computed<any>(() => props.context?.article || null);
const category = computed<any>(() => article.value?.category || null);
// The only fallback in this file: "back" must always work, even on an article with no category.
const backHref = computed(() => (category.value?.slug ? `/a/${category.value.slug}` : '/'));
const backLabel = computed(() => (category.value?.name ? `返回${category.value.name}` : '返回首页'));

const siteName = computed(() => props.context?.config?.site_name || '');
const year = new Date().getFullYear();
</script>

<style scoped>
.member-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.back {
  align-self: flex-start;
  margin: 1.5rem 0 0 1.5rem;
  font-family: 'Space Mono', monospace;
  font-size: 0.85rem;
  color: var(--ink);
  text-decoration: none;
  border: 2px solid var(--ink);
  background: var(--surface);
  padding: 7px 12px;
  transition: background .15s, color .15s;
}
.back:hover { background: var(--ink); color: var(--surface); }

.sig {
  margin-top: auto;
  padding: 2.5rem 1.5rem 1.5rem;
  font-family: 'Space Mono', monospace;
  font-size: 0.7rem;
  color: var(--border-light);
}

@media (max-width: 768px) {
  .back { margin: 1rem 0 0 1.25rem; }
  .sig { padding: 2rem 1.25rem 1.25rem; }
}
</style>
