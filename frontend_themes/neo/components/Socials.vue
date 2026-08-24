<template>
  <div class="socials" v-if="items.length" :class="`size-${size || 'md'}`">
    <template v-for="s in items" :key="s.key">
      <a v-if="s.kind === 'link'" :href="s.url" :target="s.mailto ? undefined : '_blank'"
         :rel="s.mailto ? undefined : 'noopener'" :title="s.label" :aria-label="s.label" class="social">
        <span v-html="s.svg"></span>
      </a>
      <span v-else class="social-wrap">
        <button type="button" class="social" :title="s.label" :aria-label="s.label"
                :aria-expanded="openKey === s.key" @click.stop="toggle(s.key)">
          <span v-html="s.svg"></span>
        </button>
        <span class="qr-pop" v-if="openKey === s.key" @click.stop>
          <img :src="s.img" :alt="s.label">
          <span class="qr-cap">{{ s.label }}</span>
        </span>
      </span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps<{
  context: any;
  /** Override the data source (member pages pass `article.data.social_*`). Omit = read site config. */
  source?: Record<string, string>;
  /** Cell size: sm 34px / md 40px (default, unchanged) / lg 48px. */
  size?: 'sm' | 'md' | 'lg';
}>();

type SocialItem = {
  key: string; label: string; svg: string;
  kind: 'link' | 'popover';
  url?: string;      // kind === 'link'
  mailto?: boolean;  // affects target/rel
  img?: string;      // kind === 'popover'
};

/** Solid badge with a knocked-out CJK glyph — for platforms whose logo *is* a character.
 *  A <mask> (not a coloured <text>) so the glyph stays a real hole and inverts with the cell on hover. */
const cjkBadge = (id: string, ch: string) =>
  `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">`
  + `<mask id="${id}"><rect x="0" y="0" width="24" height="24" fill="#fff"/>`
  + `<text x="12" y="17.6" text-anchor="middle" font-size="15" font-weight="700"`
  + ` font-family="PingFang SC, Microsoft YaHei, sans-serif" fill="#000">${ch}</text></mask>`
  + `<rect x="1" y="1" width="22" height="22" rx="4" mask="url(#${id})"/></svg>`;

// Compact monochrome glyphs (currentColor, no CDN). Sized by CSS so `size` can scale them.
const ICONS: Record<string, string> = {
  github: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.75.4-1.27.73-1.56-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.66.41.36.78 1.05.78 2.12v3.15c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z"/></svg>',
  // TV set + two antennas + two knocked-out eyes — bilibili's strongest silhouette.
  bilibili: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
    + '<path d="M6.1 1.5 4.9 2.7l3.2 3.2 1.2-1.2L6.1 1.5Zm11.8 0-3.2 3.2 1.2 1.2 3.2-3.2-1.2-1.2Z"/>'
    + '<path fill-rule="evenodd" d="M4.4 6h15.2a2.9 2.9 0 0 1 2.9 2.9v9.3a2.9 2.9 0 0 1-2.9 2.9H4.4a2.9 2.9 0 0 1-2.9-2.9V8.9A2.9 2.9 0 0 1 4.4 6Zm4.5 5.3a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Zm6.2 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z"/></svg>',
  // Music note: stem + top-right flag + solid head. Separate elements, so no winding surprises.
  douyin: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
    + '<path d="M12.3 2.6h2.3v11.8h-2.3z"/>'
    + '<path d="M14.6 2.6c1 2.6 3.1 4.1 5.6 4.4v3.3c-2.2-.2-4.1-1.1-5.6-2.5V2.6Z"/>'
    + '<circle cx="9.2" cy="16.6" r="4.6"/></svg>',
  xiaohongshu: cjkBadge('neo-badge-xhs', '书'),
  zhihu: cjkBadge('neo-badge-zhihu', '知'),
  email: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2 4h20a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm10 7.5L3.2 6h17.6L12 11.5Zm0 2.2L3 8v10h18V8l-9 5.7Z"/></svg>',
  // Two overlapping speech bubbles, each with knocked-out dots.
  wechat_qr: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
    + '<path fill-rule="evenodd" d="M9.2 2C4.7 2 1 5.1 1 8.9c0 2.2 1.3 4.1 3.2 5.4l-.8 2.6 2.9-1.5c.9.2 1.8.4 2.7.4h.4a6.4 6.4 0 0 1-.1-1.1c0-3.8 3.6-6.9 8.1-6.9h.3C17.1 4.3 13.5 2 9.2 2ZM6.3 6a1.15 1.15 0 1 0 0 2.3 1.15 1.15 0 0 0 0-2.3Zm5.8 0a1.15 1.15 0 1 0 0 2.3 1.15 1.15 0 0 0 0-2.3Z"/>'
    + '<path fill-rule="evenodd" d="M17.4 9.3c-3.4 0-6.2 2.4-6.2 5.3s2.8 5.3 6.2 5.3c.8 0 1.5-.1 2.2-.3l2.2 1.2-.6-2c1.4-1 2.3-2.5 2.3-4.2 0-2.9-2.7-5.3-6.1-5.3Zm-2.2 3.4a.95.95 0 1 0 0 1.9.95.95 0 0 0 0-1.9Zm4.5 0a.95.95 0 1 0 0 1.9.95.95 0 0 0 0-1.9Z"/></svg>',
  // Never render an empty box when a key is unknown (the old ICONS[key] had no fallback).
  fallback: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="5"/></svg>',
};

const ORDER = ['github', 'bilibili', 'douyin', 'xiaohongshu', 'zhihu', 'email', 'wechat_qr'] as const;
const LABELS: Record<string, string> = {
  github: 'GitHub', bilibili: '哔哩哔哩', douyin: '抖音',
  xiaohongshu: '小红书', zhihu: '知乎', email: 'Email', wechat_qr: '微信',
};

/** Site-level source: theme_neo_social_* plus the shared contact email. */
const siteSource = computed<Record<string, string>>(() => {
  const c = props.context?.config || {};
  return {
    github: c.theme_neo_social_github,
    bilibili: c.theme_neo_social_bilibili,
    douyin: c.theme_neo_social_douyin,
    xiaohongshu: c.theme_neo_social_xiaohongshu,
    zhihu: c.theme_neo_social_zhihu,
    email: c.theme_neo_contact_email,
    wechat_qr: c.theme_neo_social_wechat_qr,
  };
});
// `source` given → use only that (a member's links must not be mixed with the site's).
const src = computed<Record<string, string>>(() => props.source || siteSource.value);

const items = computed<SocialItem[]>(() => ORDER.flatMap((key): SocialItem[] => {
  const v = String(src.value?.[key] ?? '').trim();
  if (!v) return [];                                  // empty = not rendered
  const base = { key, label: LABELS[key] || key, svg: ICONS[key] || ICONS.fallback };
  if (key === 'wechat_qr') return [{ ...base, kind: 'popover' as const, img: v }];
  if (key === 'email') return [{ ...base, kind: 'link' as const, url: `mailto:${v}`, mailto: true }];
  return [{ ...base, kind: 'link' as const, url: v }];
}));

// One popover at a time; closes on re-click, outside click or Esc.
const openKey = ref('');
const toggle = (k: string) => { openKey.value = openKey.value === k ? '' : k; };
const closeAll = () => { openKey.value = ''; };
const onKeydown = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAll(); };
onMounted(() => { document.addEventListener('click', closeAll); document.addEventListener('keydown', onKeydown); });
onBeforeUnmount(() => { document.removeEventListener('click', closeAll); document.removeEventListener('keydown', onKeydown); });
</script>

<style scoped>
.socials { display: flex; gap: 0; flex-wrap: wrap; }
.social {
  width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center;
  border: 2px solid var(--ink); margin-left: -2px; color: var(--ink); background: var(--surface);
  transition: background .15s, color .15s;
  padding: 0; cursor: pointer; font: inherit;
}
.social:hover { background: var(--ink); color: var(--surface); }
.social :deep(svg) { display: block; width: 18px; height: 18px; }
.social-wrap { position: relative; display: inline-flex; }

.size-sm .social { width: 34px; height: 34px; }
.size-sm .social :deep(svg) { width: 15px; height: 15px; }
/* Member-page matrix: bigger cells that may wrap — pull rows together so borders stay shared. */
.size-lg .social { width: 48px; height: 48px; margin: -2px 0 0 -2px; }
.size-lg .social :deep(svg) { width: 22px; height: 22px; }

/* z-index must beat .site-header (sticky, z-index 50). */
.qr-pop {
  position: absolute; top: calc(100% + 8px); right: 0; z-index: 70;
  background: var(--surface); border: 3px solid var(--ink); box-shadow: var(--shadow-hard);
  padding: 10px; display: flex; flex-direction: column; align-items: center; gap: 6px;
}
.qr-pop img { width: 160px; height: 160px; object-fit: contain; display: block; }
.qr-cap { font-family: 'Space Mono', monospace; font-size: 0.72rem; color: rgba(28, 28, 28, .7); }

@media (max-width: 560px) {
  /* Anchor left on narrow screens so the card cannot overflow the right edge. */
  .qr-pop { left: 0; right: auto; }
  /* Keep the large matrix tappable without pushing 7 cells past a 375px viewport. */
  .size-lg .social { width: 44px; height: 44px; }
  .size-lg .social :deep(svg) { width: 20px; height: 20px; }
}
</style>
