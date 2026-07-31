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

    <div class="team-grid" v-if="sorted.length">
      <article v-for="a in sorted" :key="a.id" class="member">
        <!-- Stretched link: covers the card instead of wrapping it, so no <a> nesting. The card has
             no other interactive element (the socials live on the member's own page), so this needs
             no z-index layering. A real href keeps ⌘/middle-click and SEO working. -->
        <a class="card-link" :href="articleUrl(a)" :aria-label="`${a.title} 的个人主页`"></a>
        <div class="avatar" :style="a.thumbnail ? { backgroundImage: `url(${a.thumbnail})` } : {}" :class="{ 'no-img': !a.thumbnail }">
          <span v-if="!a.thumbnail">{{ (a.title || '·').slice(0, 1) }}</span>
        </div>
        <div class="m-body">
          <h2>{{ a.title }}<span v-if="a.locked" class="lock" :title="$t('front.lockedHint')">🔒</span></h2>
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
import { computed } from 'vue';
import { LISTED_TEAM_FILTER, articleUrl, memberSortKey, useArticleList } from './lib';
const props = defineProps<{ context: any }>();
const { category, breadcrumbs } = props.context || {};
// 只列置顶成员 —— 过滤条件与 theme.config.ts 的 prefetch 共用同一个常量,否则第 1 页与第 2 页
// 会按两套规则筛(lib.ts 里为这个漂移写过警告)。
const { items, page, loading, totalPages, goPage } = useArticleList(props.context, 12, LISTED_TEAM_FILTER);

/**
 * 按分类自定义字段 `data.sort` 升序,没填的排最后。
 *
 * **只排当前页**:自定义字段都存在 `articles.data` 这个 JSON 列里,而 DYAPI 的排序是
 * ``ORDER BY `列名` ``,给不了 JSON 路径,所以交不到数据库手上。团队人数通常一页装得下,
 * 跨页顺序会乱这一点是明确接受的取舍。`sort` 相同时保持接口返回的原顺序(稳定排序)。
 */
const sorted = computed(() => items.value
  .map((a: any, i: number) => ({ a, i }))
  .sort((x, y) => (memberSortKey(x.a) - memberSortKey(y.a)) || (x.i - y.i))
  .map((w) => w.a));
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

/* 受众轴:摘要墙内容的锁标记(正文已在后端剥离)。 */
.lock { margin-left: .4em; font-size: .85em; opacity: .65; }
</style>
