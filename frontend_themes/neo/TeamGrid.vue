<template>
  <main class="team-main">
    <nav class="crumbs">
      <a href="/">首页</a>
      <template v-for="c in breadcrumbs" :key="c.id"><span class="sep">/</span><a :href="`/a/${c.slug}`">{{ c.name }}</a></template>
    </nav>

    <header class="team-head">
      <h1>{{ category?.name || 'Team' }}</h1>
      <p v-if="category?.data?.description">{{ category.data.description }}</p>
    </header>

    <div class="team-grid" v-if="items.length">
      <article v-for="a in items" :key="a.id" class="member">
        <!-- Stretched link: covers the card instead of wrapping it, so no <a> nesting. The card has
             no other interactive element (the socials live on the member's own page), so this needs
             no z-index layering. A real href keeps ⌘/middle-click and SEO working. -->
        <a class="card-link" :href="articleUrl(a)" :aria-label="`${a.title} 的个人主页`"></a>
        <div class="avatar" :style="a.thumbnail ? { backgroundImage: `url(${a.thumbnail})` } : {}" :class="{ 'no-img': !a.thumbnail }">
          <span v-if="!a.thumbnail">{{ (a.title || '·').slice(0, 1) }}</span>
        </div>
        <div class="m-body">
          <h2>{{ a.title }}</h2>
          <p class="role" v-if="a.data?.role">{{ a.data.role }}</p>
          <p class="bio" v-if="a.description">{{ a.description }}</p>
          <div class="skills" v-if="skillsOf(a).length">
            <span v-for="s in skillsOf(a)" :key="s" class="skill">{{ s }}</span>
          </div>
          <span class="card-more">查看主页 →</span>
        </div>
      </article>
    </div>
    <div v-else-if="!loading" class="empty">暂无成员</div>
    <div v-else class="empty">加载中…</div>

    <nav class="pager" v-if="totalPages > 1">
      <button :disabled="page <= 0" @click="goPage(page - 1)">← 上一页</button>
      <span>{{ page + 1 }} / {{ totalPages }}</span>
      <button :disabled="page >= totalPages - 1" @click="goPage(page + 1)">下一页 →</button>
    </nav>
  </main>
</template>

<script setup lang="ts">
import { articleUrl, useArticleList } from './lib';
const props = defineProps<{ context: any }>();
const { category, breadcrumbs } = props.context || {};
const { items, page, loading, totalPages, goPage } = useArticleList(props.context, 12);
const skillsOf = (a: any) => String(a?.data?.skills || '').split(',').map((s: string) => s.trim()).filter(Boolean);
</script>

<style scoped>
.team-main { max-width: 1280px; margin: 0 auto; padding: 3rem 2rem 5rem; width: 100%; }
.crumbs { font-family: 'Space Mono', monospace; font-size: 0.85rem; margin-bottom: 2.5rem; }
.crumbs a { color: var(--ink); text-decoration: underline wavy var(--accent) 1px; text-underline-offset: 3px; }
.crumbs a:hover { color: var(--accent); }
.crumbs .sep { margin: 0 8px; color: var(--border-light); }

.team-head { border-bottom: 3px solid var(--ink); padding-bottom: 1.5rem; margin-bottom: 2.5rem; }
.team-head h1 { font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(3rem, 8vw, 5.5rem); text-transform: uppercase; line-height: 0.95; }
.team-head p { font-family: 'Space Mono', monospace; margin-top: 1rem; max-width: 620px; color: rgba(28,28,28,.75); }

.team-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; }
.member { position: relative; border: 3px solid var(--ink); background: var(--surface); box-shadow: var(--shadow-hard); transition: transform .12s, box-shadow .12s; }
.member:hover { transform: translate(-3px,-3px); box-shadow: 12px 12px 0 var(--ink); }
.card-link { position: absolute; inset: 0; z-index: 1; }
.avatar { aspect-ratio: 1; background: var(--bg-page) center/cover no-repeat; border-bottom: 3px solid var(--ink); display: flex; align-items: center; justify-content: center; }
.avatar.no-img { background: repeating-linear-gradient(45deg, var(--bg-page), var(--bg-page) 12px, #eae5db 12px, #eae5db 24px); }
.avatar span { font-family: 'Bricolage Grotesque', sans-serif; font-size: 3.5rem; font-weight: 800; opacity: .2; }
.m-body { padding: 1.5rem; }
.m-body h2 { font-family: 'Bricolage Grotesque', sans-serif; font-size: 1.5rem; }
.role { font-family: 'Space Mono', monospace; color: var(--accent); font-size: 0.85rem; margin-top: 0.25rem; }
.bio { margin: 0.9rem 0; font-size: 0.9rem; line-height: 1.5; color: rgba(28,28,28,.8); }
.skills { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 1rem; }
.skill { font-family: 'Space Mono', monospace; font-size: 0.7rem; border: 2px solid var(--ink); padding: 2px 7px; }
/* Visual promise that the whole card is clickable. */
.card-more { font-family: 'Space Mono', monospace; font-size: 0.75rem; color: var(--accent); }
.member:hover .card-more { text-decoration: underline wavy var(--accent) 1px; text-underline-offset: 3px; }

.empty { text-align: center; padding: 5rem; border: 3px dashed var(--border-light); font-size: 1.2rem; }
.pager { display: flex; align-items: center; justify-content: center; gap: 2rem; margin-top: 3rem; font-family: 'Space Mono', monospace; }
.pager button { background: var(--surface); border: 2px solid var(--ink); padding: 10px 20px; cursor: pointer; font-family: inherit; box-shadow: 3px 3px 0 var(--ink); }
.pager button:hover:not(:disabled) { color: var(--accent); }
.pager button:disabled { opacity: .4; cursor: not-allowed; box-shadow: none; }

@media (max-width: 900px) { .team-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px) { .team-grid { grid-template-columns: 1fr; } }
</style>
