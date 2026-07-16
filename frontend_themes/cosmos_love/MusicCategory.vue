<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import VinylPlayer from './components/VinylPlayer.vue';
import MusicUploader from './components/MusicUploader.vue';
import * as api from "../../../api.ts";

const props = defineProps<{ context: any }>();
const { config, category, articles, breadcrumbs, user } = props.context || {};
const router = useRouter();

const showMusicUploader = ref(false);

const onSaved = () => {
  window.location.reload();
};

const openArticle = (article: any) => {
  router.push(`/a/${category?.slug}/${article.slug}`);
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
</script>

<template>
  <main class="music-room">
    <!-- Room Header -->
    <header class="room-hero">
      <div class="room-glow"></div>
      <h1 class="room-title">{{ category?.name || '音乐盒' }}</h1>
      <p class="room-subtitle" v-if="category?.data?.description">{{ category.data.description }}</p>
      <p class="room-subtitle" v-else>每一首歌，都是写给你的情书</p>
    </header>

    <!-- Vinyl Shelf -->
    <div class="vinyl-shelf" v-if="articles?.length">
      <article
        v-for="(track, idx) in articles"
        :key="track.id"
        class="shelf-item animate-fade-in-up"
        :style="{ animationDelay: idx * 0.1 + 's' }"
        @click="openArticle(track)"
      >
        <div class="record-sleeve" @click.stop>
          <VinylPlayer
            :src="track.data?.audio_url || ''"
            :title="track.title"
          />
        </div>
        <div class="track-info">
          <h3>{{ track.title }}</h3>
          <p>{{ track.description || '' }}</p>
          <time>{{ formatDate(track.published_at) }}</time>
        </div>
      </article>
    </div>

    <!-- Empty -->
    <div v-else class="empty-shelf">
      <div class="empty-turntable">
        <div class="turntable-platter"></div>
        <div class="turntable-arm"></div>
      </div>
      <p>音乐盒还是空的</p>
      <span>上传第一首歌，让这里充满旋律</span>
    </div>

    <!-- FAB: Upload music -->
    <button v-if="user" class="fab fab-music" @click="showMusicUploader = true" title="上传音乐">
      ♪
    </button>

    <!-- Uploader Modal -->
    <MusicUploader
      :visible="showMusicUploader"
      :category-slug="category?.slug || 'music'"
      @close="showMusicUploader = false"
      @saved="onSaved"
    />
  </main>
</template>

<style scoped>
.music-room {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
  width: 100%;
}

/* Room Header */
.room-hero {
  text-align: center;
  padding: 3rem 0;
  position: relative;
}
.room-glow {
  position: absolute;
  top: -30%;
  left: 50%;
  transform: translateX(-50%);
  width: 400px;
  height: 300px;
  background: radial-gradient(circle, rgba(255, 171, 145, 0.1) 0%, rgba(255, 213, 79, 0.05) 40%, transparent 70%);
  pointer-events: none;
}
.room-title {
  font-family: var(--font-display);
  font-size: 2.8rem;
  font-weight: 700;
  color: var(--ink);
  margin: 0;
  position: relative;
}
.room-subtitle {
  font-family: var(--font-body);
  font-size: 1rem;
  color: var(--ink-soft);
  margin: 0.5rem 0 0;
  font-style: italic;
  position: relative;
}

/* Vinyl Shelf */
.vinyl-shelf {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2rem;
}

.shelf-item {
  cursor: pointer;
  transition: all 0.4s;
}
.shelf-item:hover { transform: translateY(-4px); }

.record-sleeve {
  background: var(--surface);
  border: 1px solid var(--border-glow);
  border-radius: 20px;
  padding: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  transition: all 0.4s;
  backdrop-filter: blur(8px);
  position: relative;
  overflow: hidden;
}
.record-sleeve::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 30% 40%, rgba(255, 171, 145, 0.05), transparent 60%);
  pointer-events: none;
}
.shelf-item:hover .record-sleeve {
  border-color: var(--accent-peach);
  box-shadow: 0 8px 32px rgba(255, 171, 145, 0.15);
}

.track-info {
  padding: 1rem 0.5rem 0;
}
.track-info h3 {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 4px;
}
.track-info p {
  font-size: 0.85rem;
  color: var(--ink-muted);
  margin: 0 0 4px;
}
.track-info time {
  font-size: 0.75rem;
  color: var(--ink-muted);
}

/* FAB */
.fab {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: none;
  font-size: 1.4rem;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.fab-music {
  background: linear-gradient(135deg, var(--accent-peach), var(--accent-gold));
  color: #fff;
}
.fab:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
}

/* Empty Shelf */
.empty-shelf {
  text-align: center;
  padding: 4rem 2rem;
}
.empty-turntable {
  position: relative;
  width: 120px;
  height: 100px;
  margin: 0 auto 2rem;
}
.turntable-platter {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 2px dashed var(--border-glow);
  position: absolute;
  left: 10px;
  top: 10px;
  animation: spin 20s linear infinite;
}
.turntable-arm {
  position: absolute;
  right: 10px;
  top: 0;
  width: 3px;
  height: 50px;
  background: var(--ink-muted);
  transform-origin: top center;
  transform: rotate(25deg);
  border-radius: 2px;
  opacity: 0.4;
}
.empty-shelf p {
  font-family: var(--font-display);
  font-size: 1.2rem;
  color: var(--ink-soft);
  margin-bottom: 0.5rem;
}
.empty-shelf span {
  font-size: 0.85rem;
  color: var(--ink-muted);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 700px) {
  .music-room { padding: 1.5rem 1rem 5rem; }
  .room-hero { padding: 2rem 0 1.5rem; }
  .vinyl-shelf { grid-template-columns: 1fr; }
  .room-title { font-size: 2rem; }
  .record-sleeve { min-height: 220px; padding: 1.5rem; }
}
</style>
