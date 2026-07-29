<template>
  <div class="member-layout neo-scope">
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
 * data fetching of any kind. All it contributes is the design tokens, the page skeleton, and one
 * credit line; a member profile is meant to read as a standalone card, so there is no navigation
 * back into the site either.
 *
 * Registered in theme.config.ts as an intentionally empty `pages` entry. Never give that entry
 * `layout: 'Layout'` — that would wrap the generic shell back around and defeat the whole page.
 */
const props = defineProps<{ context?: any }>();

const siteName = computed(() => props.context?.config?.site_name || '');
const year = new Date().getFullYear();
</script>

<style scoped>
.member-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.sig {
  margin-top: auto;
  padding: 2.5rem 1.5rem 1.5rem;
  font-family: 'Space Mono', monospace;
  font-size: 0.7rem;
  color: var(--border-light);
}

@media (max-width: 768px) {
  .sig { padding: 2rem 1.25rem 1.25rem; }
}
</style>
