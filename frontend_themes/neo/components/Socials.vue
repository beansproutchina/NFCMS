<template>
  <div class="socials" v-if="items.length">
    <a v-for="s in items" :key="s.key" :href="s.url" :target="s.mailto ? undefined : '_blank'"
       :rel="s.mailto ? undefined : 'noopener'" :title="s.label" :aria-label="s.label" class="social">
      <span v-html="s.svg"></span>
    </a>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ context: any }>();
const cfg = computed(() => props.context?.config || {});

// Compact monochrome glyphs (currentColor).
const ICONS: Record<string, string> = {
  github: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.75.4-1.27.73-1.56-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.66.41.36.78 1.05.78 2.12v3.15c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25h6.83l4.713 6.231 5.447-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg>',
  dribbble: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm7.94 5.53a10.16 10.16 0 0 1 2.3 6.36c-.34-.07-3.7-.75-7.1-.32-.07-.17-.14-.35-.22-.53-.2-.5-.44-1-.68-1.48 3.76-1.53 5.47-3.74 5.7-4.03ZM12 1.78c2.6 0 4.96.98 6.76 2.58-.2.27-1.72 2.34-5.35 3.7A47.5 47.5 0 0 0 9.9 2.2 10.2 10.2 0 0 1 12 1.78Zm-4.06 1.1a56 56 0 0 1 3.5 5.8C6.9 9.98 2.9 9.93 2.47 9.92A10.26 10.26 0 0 1 7.94 2.88ZM1.76 12v-.32c.42.01 5.11.07 10.05-1.41.28.55.55 1.11.8 1.68l-.4.12c-5.1 1.65-7.8 6.15-8.03 6.53A10.2 10.2 0 0 1 1.76 12Zm10.24 10.24c-2.32 0-4.45-.78-6.16-2.08.17-.36 2.14-4.15 7.74-6.1l.06-.02a42.6 42.6 0 0 1 2.2 7.8 10.2 10.2 0 0 1-3.84.4Zm5.56-1.35a44.3 44.3 0 0 0-2-7.42c3.2-.51 6 .33 6.35.44a10.24 10.24 0 0 1-4.35 6.98Z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.03-1.85-3.03-1.85 0-2.13 1.44-2.13 2.93v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.8 0 0 .78 0 1.74v20.52C0 23.22.8 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.74V1.74C24 .78 23.2 0 22.22 0Z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 3.68a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32Zm0 10.16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm7.84-10.4a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0Z"/></svg>',
  email: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2 4h20a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm10 7.5L3.2 6h17.6L12 11.5Zm0 2.2L3 8v10h18V8l-9 5.7Z"/></svg>',
};

const items = computed(() => {
  const c = cfg.value;
  const out: { key: string; url: string; label: string; svg: string; mailto?: boolean }[] = [];
  const add = (key: string, url: string, label: string, mailto = false) => { if (url) out.push({ key, url, label, svg: ICONS[key], mailto }); };
  add('github', c.theme_neo_social_github, 'GitHub');
  add('x', c.theme_neo_social_x, 'X');
  add('dribbble', c.theme_neo_social_dribbble, 'Dribbble');
  add('linkedin', c.theme_neo_social_linkedin, 'LinkedIn');
  add('instagram', c.theme_neo_social_instagram, 'Instagram');
  if (c.theme_neo_contact_email) add('email', `mailto:${c.theme_neo_contact_email}`, 'Email', true);
  return out;
});
</script>

<style scoped>
.socials { display: flex; gap: 0; }
.social {
  width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center;
  border: 2px solid var(--ink); margin-left: -2px; color: var(--ink); background: var(--surface);
  transition: background .15s, color .15s;
}
.social:hover { background: var(--ink); color: var(--surface); }
.social :deep(svg) { display: block; }
</style>
