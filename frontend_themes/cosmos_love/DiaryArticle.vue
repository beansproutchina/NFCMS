<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { renderMarkdown } from '@/lib/prose';
import DiaryEditor from './components/DiaryEditor.vue';
import * as api from "../../../api.ts";

const props = defineProps<{ context: any }>();
const { config, article, breadcrumbs, categories, user } = props.context || {};
const router = useRouter();

const renderedContent = computed(() => {
  if (!article?.content) return '';
  return renderMarkdown(article.content);
});

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

// Meetup resolution
const meetupInfo = ref<any>(null);
const meetupArticles = ref<any[]>([]);

onMounted(async () => {
  try {
    const meetupCat = categories?.find((c: any) => c.slug === 'meetup' || c.slug === 'jianmian');
    if (meetupCat) {
      const res: any = await api.crudAPI.getList('articles', {
        filter: { category_id: meetupCat.id, visible: 1 },
        orderBy: 'published_at',
        orderDesc: true,
      });
      meetupArticles.value = res?.data || [];
      for (const m of meetupArticles.value) {
        if(m.id == article.data?.meetup_id){
          meetupInfo.value = m;
        }
      }
    }
  } catch (e) {
    console.error('Failed to load meetups:', e);
  }
});



// Editor
const showDiaryEditor = ref(false);
const editingDiary = ref<any>(null);

const openEditDiary = () => {
  editingDiary.value = article;
  showDiaryEditor.value = true;
};


const onSaved = () => {
  window.location.reload();
};
</script>

<template>
  <main class="diary-article">
    <!-- Back -->
    <div class="back-link">
      <button @click="router.push(article?.category ? `/a/${article.category.slug}` : '/')">
        ← 返回日记本
      </button>
    </div>

    <!-- Paper Article -->
    <article class="diary-paper">
      <!-- Spine -->
      <div class="paper-spine">
        <div class="spine-ring" v-for="i in 3" :key="i"></div>
      </div>

      <!-- Content area -->
      <div class="paper-body">
        <header class="paper-header">
          <div class="paper-date-badge">
            <div class="date-weekday">{{ new Date(article?.published_at).toLocaleDateString('zh-CN', { weekday: 'short' }) }}</div>
            <div class="date-num">{{ new Date(article?.published_at).getDate() }}</div>
            <div class="date-month">{{ new Date(article?.published_at).getMonth() + 1 }}月</div>
          </div>
          <div class="paper-title-area">
            <h1>{{ article?.title }}</h1>
            <div class="paper-meta">
              <span>{{ article?.author?.nickname || article?.author?.username }}</span>
              <span v-if="meetupInfo" class="meetup-ref" @click.stop="router.push(`/a/${meetupInfo.category?.slug || 'meetup'}/${meetupInfo.slug}`)">
                ✈ {{ meetupInfo.title }} {{ meetupInfo.data?.date }}
              </span>
            </div>
          </div>
          <button v-if="user" class="edit-btn" @click="openEditDiary" title="编辑日记">✎</button>
        </header>

        <div v-if="article?.thumbnail" class="featured-image">
          <img :src="article.thumbnail" alt="">
        </div>

        <div class="paper-lines">
          <div class="lined-content" v-html="renderedContent"></div>
        </div>
      </div>
    </article>


    <!-- Diary Editor -->
    <DiaryEditor
      :visible="showDiaryEditor"
      :meetups="meetupArticles"
      :category-slug="article?.category?.slug || 'diary'"
      :edit-article="editingDiary"
      @close="showDiaryEditor = false; editingDiary = null"
      @saved="onSaved"
    />
  </main>
</template>

<style scoped>
.diary-article {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
  width: 100%;
}

.paper-crumbs {
  font-family: var(--font-body);
  font-size: 0.85rem;
  color: var(--ink-muted);
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.paper-crumbs span { cursor: pointer; transition: color 0.3s; }
.paper-crumbs span:hover { color: var(--accent-lavender); }
.crumb-sep { color: var(--accent-lavender); opacity: 0.4; }
.crumb-current { color: var(--accent-lavender); cursor: default; }

/* Paper Layout */
.diary-paper {
  display: flex;
  background: rgba(255, 250, 245, 0.03);
  border: 1px solid rgba(179, 136, 255, 0.15);
  border-radius: 4px 20px 20px 4px;
  overflow: hidden;
  backdrop-filter: blur(6px);
}

.paper-spine {
  width: 36px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  padding: 2rem 0;
  background: rgba(179, 136, 255, 0.06);
  border-right: 1px solid rgba(179, 136, 255, 0.12);
}
.spine-ring {
  width: 18px;
  height: 10px;
  border: 2px solid var(--accent-lavender);
  border-radius: 4px;
  opacity: 0.4;
}

.paper-body {
  flex: 1;
  padding: 0.8rem 1.5rem;
  min-width: 0;
  position: relative;
}

/* Header */
.paper-header {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 2.5rem;
  align-items: flex-start;
  position: relative;
}
.paper-date-badge {
  width: 64px;
  flex-shrink: 0;
  text-align: center;
  background: linear-gradient(135deg, var(--accent-lavender), var(--accent-rose));
  border-radius: 12px;
  padding: 0.6rem 0.5rem;
  box-shadow: 0 4px 16px rgba(179, 136, 255, 0.25);
}
.date-weekday {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
}
.date-num {
  font-family: var(--font-display);
  font-size: 1.8rem;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}
.date-month {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.8);
}

.paper-title-area { flex: 1; min-width: 0; }
.paper-title-area h1 {
  font-family: var(--font-display);
  font-size: 2.2rem;
  font-weight: 700;
  color: var(--ink);
  margin: 0 0 0.8rem;
  line-height: 1.25;
}
.paper-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.85rem;
  color: var(--ink-muted);
  flex-wrap: wrap;
}
.meetup-ref {
  color: var(--accent-peach);
  background: rgba(255, 171, 145, 0.1);
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}
.meetup-ref:hover {
  background: rgba(255, 171, 145, 0.2);
}

/* Edit button */
.edit-btn {
  background: rgba(179, 136, 255, 0.12);
  border: 1px solid rgba(179, 136, 255, 0.2);
  color: var(--accent-lavender);
  font-size: 1rem;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.edit-btn:hover {
  background: rgba(179, 136, 255, 0.25);
  border-color: var(--accent-lavender);
}

.featured-image {
  margin: 0 0 2rem;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border-glow);
}
.featured-image img { width: 100%; display: block; }

/* Lined content */
.paper-lines {
  position: relative;
  padding-left: 1.6rem;
}
.paper-lines::before {
  content: '';
  position: absolute;
  left: 1rem;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(255, 107, 157, 0.15);
}
.lined-content {
  font-family: var(--font-body);
  font-size: 1.25rem;
  line-height: 1.9;
  color: var(--ink-soft);
  background-image: repeating-linear-gradient(
    transparent,
    transparent 1.35em,
    rgba(179, 136, 255, 0.06) 1.35em,
    rgba(179, 136, 255, 0.06) 1.4em
  );
  background-size: 100% 1.9em;
  background-attachment: local;
}
.lined-content :deep(h2) {
  font-family: var(--font-display);
  font-size: 1.5rem;
  color: var(--ink);
  margin-top: 2.5rem;
  margin-bottom: 1rem;
  background: none;
}
.lined-content :deep(p) { margin: 1em 0; }
.lined-content :deep(blockquote) {
  border-left: 3px solid var(--accent-lavender);
  background: rgba(179, 136, 255, 0.06);
  padding: 1rem 1.5rem;
  margin: 1.5rem 0;
  border-radius: 0 12px 12px 0;
  font-style: italic;
}
.lined-content :deep(img) {
  border-radius: 12px;
  max-width: 100%;
}


/* Mobile */
@media (max-width: 700px) {
  .diary-article { padding: 1rem 0.75rem 4rem; }
  .paper-crumbs { font-size: 0.75rem; margin-bottom: 1.2rem; gap: 4px; }

  .diary-paper {
    border-radius: 16px;
  }
  .paper-spine {
    display: none;
  }
  .spine-ring { width: 12px; height: 6px; }

  .paper-body { padding: 1rem 1.6rem; }

  .paper-header {
    flex-direction: column;
    gap: 0.8rem;
  }
  .paper-date-badge {
    width: auto;
    display: inline-flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    padding: 0.4rem 0.8rem;
    border-radius: 10px;
    align-self: flex-start;
  }
  .date-weekday { font-size: 0.8rem; }
  .date-num { font-size: 1.5rem; }
  .date-month { font-size: 0.8rem; }

  .paper-title-area h1 { font-size: 2rem; }
  .paper-meta { gap: 0.6rem; font-size: 1rem; }

  .edit-btn {
    position: absolute;
    top: 0;
    right: 0;
    width: 32px;
    height: 32px;
    font-size: 0.9rem;
  }

  .featured-image { margin: 0 0 1.5rem; border-radius: 10px; }

  .paper-lines { padding-left: 0.5rem; }
  .paper-lines::before { left: 0rem; }
  .lined-content { line-height: 1.9; }

}
</style>
