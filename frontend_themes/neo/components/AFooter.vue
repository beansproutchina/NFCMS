<template>
  <footer class="site-footer">
    <div class="footer-top">
      <div class="footer-brand">
        <div class="brand-line"><span class="mark">◆</span> {{ config?.site_name || 'NEO STUDIO' }}</div>
        <p v-if="note" class="brand-note">{{ note }}</p>
        <Socials :context="context" class="footer-socials" />
      </div>

      <nav class="footer-nav" v-if="footerItems.length">
        <a v-for="(l, i) in footerItems" :key="i" :href="l.url"
           :target="isExternal(l.url) ? '_blank' : undefined" :rel="isExternal(l.url) ? 'noopener' : undefined">{{ l.label }}</a>
      </nav>
    </div>

    <div class="footer-bottom">
      <span>© {{ year }} {{ config?.site_name || 'NEO STUDIO' }}</span>
      <span class="powered">Built with <a href="https://github.com/dyas-dev/NFCMS" target="_blank" rel="noopener">NFCMS</a><template v-if="config?.icp_record"> · <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">{{ config.icp_record }}</a></template></span>
    </div>
    <div class="footer-decoration">⏤ ⏤ ⏤</div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Socials from './Socials.vue';

const props = defineProps<{ context: any }>();
// Kept reactive rather than destructured — see the note in AHeader.vue.
const config = computed<any>(() => props.context?.config || {});
const menus = computed<any[]>(() => props.context?.menus || []);

// Footer menu: flatten one level (group children or top items) into a link row.
const footerItems = computed(() => {
  const m = menus.value.find((x: any) => x.location === 'footer');
  if (!m) return [];
  const items = m.items || [];
  const flat = items.flatMap((it: any) => (it.children && it.children.length ? it.children : [it]));
  return flat;
});
const note = computed(() => config.value.theme_neo_footer_note || '');
const isExternal = (url: string) => /^https?:\/\//i.test(url || '');
const year = new Date().getFullYear();
</script>

<style scoped>
.site-footer { margin-top: auto; border-top: 3px solid var(--ink); background: var(--surface); padding: 3rem 2rem 1.5rem; font-family: 'Space Mono', monospace; color: var(--ink); }
.footer-top { max-width: 1440px; margin: 0 auto; display: flex; justify-content: space-between; gap: 2rem; flex-wrap: wrap; padding-bottom: 2rem; }

.footer-brand { max-width: 420px; }
.brand-line { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 700; font-size: 1.5rem; }
.brand-line .mark { color: var(--accent); }
.brand-note { margin: 0.75rem 0 1.25rem; font-size: 0.85rem; color: rgba(28, 28, 28, 0.7); line-height: 1.5; }

.footer-nav { display: flex; flex-direction: column; gap: 0.6rem; align-items: flex-end; }
.footer-nav a { color: var(--ink); text-decoration: none; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px; }
.footer-nav a:hover { color: var(--accent); text-decoration: underline wavy var(--accent) 1px; }

.footer-bottom { max-width: 1440px; margin: 0 auto; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 1rem; border-top: 2px solid var(--border-light); padding-top: 1.5rem; font-size: 0.78rem; color: rgba(28, 28, 28, 0.7); }
.footer-bottom a { color: var(--ink); text-decoration: underline wavy var(--accent) 1px; text-underline-offset: 3px; }
.footer-bottom a:hover { color: var(--accent); }

.footer-decoration { text-align: center; margin-top: 2rem; letter-spacing: 8px; color: var(--border-light); font-size: 1.1rem; }

@media (max-width: 640px) {
  .footer-top { flex-direction: column; }
  .footer-nav { align-items: flex-start; }
  .footer-bottom { flex-direction: column; }
}
</style>
