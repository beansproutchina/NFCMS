<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { marked } from 'marked';
import VinylPlayer from './components/VinylPlayer.vue';

const props = defineProps<{ context: any }>();
const { config, article, breadcrumbs } = props.context || {};
const router = useRouter();

const renderedContent = computed(() => {
  if (!article?.content) return '';
  return marked.parse(article.content);
});

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
</script>

<template>
  <main class="music-article">
    <!-- Back -->
    <div class="back-link">
      <button @click="router.push(article?.category ? `/a/${article.category.slug}` : '/')">
        ← 返回音乐盒
      </button>
    </div>
    <!-- Now Playing Card -->
    <div class="now-playing">
      <div class="np-glow"></div>
      <div class="np-vinyl">
        <VinylPlayer
          :src="article?.data?.audio_url || ''"
          :title="article?.title"
        />
      </div>
      <div class="np-info">
        <div class="np-label">♪ 正在播放</div>
        <h1>{{ article?.title }}</h1>
        <div class="np-meta">
          <span>By {{ article?.author?.nickname || article?.author?.username }}</span>
          <span class="np-dot">✧</span>
          <time>{{ article?.published_at ? formatDate(article.published_at) : '' }}</time>
        </div>
        <p class="np-desc" v-if="article?.description">{{ article.description }}</p>
      </div>
    </div>


  </main>
</template>

<style scoped>
.music-article {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
  width: 100%;
}

.vinyl-crumbs {
  font-family: var(--font-body);
  font-size: 0.85rem;
  color: var(--ink-muted);
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.vinyl-crumbs span { cursor: pointer; transition: color 0.3s; }
.vinyl-crumbs span:hover { color: var(--accent-peach); }
.crumb-sep { color: var(--accent-peach); opacity: 0.5; }
.crumb-current { color: var(--accent-peach); cursor: default; }

/* Now Playing */
.now-playing {
  display: flex;
  gap: 2.5rem;
  align-items: center;
  background: var(--surface);
  border: 1px solid var(--border-glow);
  border-radius: 24px;
  padding: 2.5rem;
  margin-bottom: 3rem;
  backdrop-filter: blur(10px);
  position: relative;
  overflow: hidden;
}
.np-glow {
  position: absolute;
  top: -30%;
  left: -10%;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(255, 171, 145, 0.1) 0%, rgba(255, 213, 79, 0.05) 40%, transparent 70%);
  pointer-events: none;
}
.np-vinyl {
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}
.np-info {
  flex: 1;
  min-width: 0;
  position: relative;
  z-index: 1;
}
.np-label {
  font-family: var(--font-body);
  font-size: 0.8rem;
  color: var(--accent-peach);
  font-weight: 600;
  margin-bottom: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.np-info h1 {
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 700;
  color: var(--ink);
  margin: 0 0 0.8rem;
  line-height: 1.2;
}
.np-meta {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  font-size: 0.85rem;
  color: var(--ink-muted);
  margin-bottom: 1rem;
}
.np-dot { color: var(--accent-gold); }
.np-desc {
  font-size: 0.95rem;
  color: var(--ink-soft);
  line-height: 1.6;
  font-style: italic;
  margin: 0;
}

/* Lyrics */
.lyrics-sheet {
  background: var(--surface);
  border: 1px solid var(--border-glow);
  border-radius: 20px;
  padding: 2rem;
  margin-bottom: 3rem;
  backdrop-filter: blur(8px);
}
.lyrics-label {
  font-family: var(--font-body);
  font-size: 0.8rem;
  color: var(--accent-peach);
  font-weight: 600;
  margin-bottom: 1.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.lyrics-content {
  font-family: var(--font-body);
  font-size: 1rem;
  line-height: 2;
  color: var(--ink-soft);
  text-align: center;
  max-width: 500px;
  margin: 0 auto;
}
.lyrics-content :deep(p) {
  margin: 0.8rem 0;
}
.lyrics-content :deep(blockquote) {
  border-left: 3px solid var(--accent-peach);
  background: rgba(255, 171, 145, 0.06);
  padding: 1rem 1.5rem;
  margin: 1.5rem 0;
  border-radius: 0 12px 12px 0;
  text-align: left;
}



@media (max-width: 700px) {
  .music-article { padding: 1.5rem 1rem 4rem; }
  .now-playing {
    flex-direction: column;
    text-align: center;
    padding: 1.5rem;
    gap: 1.5rem;
  }
  .np-info h1 { font-size: 1.5rem; }
  .np-meta { justify-content: center; }
  .lyrics-content { font-size: 0.9rem; }
}
</style>
