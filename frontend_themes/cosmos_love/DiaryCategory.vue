<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import DiaryEditor from './components/DiaryEditor.vue';
import DiaryGrid from './components/DiaryGrid.vue';
import * as api from "../../../api.ts";

const props = defineProps<{ context: any }>();
const { config, category, articles, breadcrumbs, user, categories } = props.context || {};
const router = useRouter();

// Resolve meetup names for articles
const meetupMap = ref<Record<string, any>>({});
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
        meetupMap.value[m.id] = m;
      }
    }
  } catch (e) {
    console.error('Failed to load meetups:', e);
  }
});

const openArticle = (article: any) => {
  router.push(`/a/${category?.slug}/${article.slug}`);
};

// Diary editor
const showDiaryEditor = ref(false);
const editingDiary = ref<any>(null);

const openNewDiary = () => {
  editingDiary.value = null;
  showDiaryEditor.value = true;
};

const onSaved = () => {
  window.location.reload();
};
</script>

<template>
  <main class="diary-category">
    <!-- Hero -->
    <header class="diary-hero">
      <h1 class="diary-title">{{ category?.name || '日记本' }}</h1>
      <p class="diary-subtitle" v-if="category?.data?.description">{{ category.data.description }}</p>
      <p class="diary-subtitle" v-else>记录每一个想念你的瞬间</p>
    </header>

    <!-- Diary Entries -->
    <DiaryGrid v-if="articles?.length" :diaries="articles" :meetup-map="meetupMap" @open="openArticle" />

    <!-- Empty -->
    <div v-else class="empty-diary">
      <div class="empty-notebook">
        <div class="empty-lines">
          <div class="empty-line" v-for="i in 5" :key="i"></div>
        </div>
      </div>
      <p>日记本还是空白的</p>
      <span>点击右下角，写下第一篇日记吧</span>
    </div>

    <!-- FAB: Write diary -->
    <button v-if="user" class="fab fab-diary" @click="openNewDiary" title="写日记">
      ✎
    </button>

    <!-- Editor Modal -->
    <DiaryEditor
      :visible="showDiaryEditor"
      :meetups="meetupArticles"
      :category-slug="category?.slug || 'diary'"
      :edit-article="editingDiary"
      @close="showDiaryEditor = false; editingDiary = null"
      @saved="onSaved"
    />
  </main>
</template>

<style scoped>
.diary-category {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
  width: 100%;
}

/* Hero */
.diary-hero {
  text-align: center;
  padding: 3rem 0;
  position: relative;
}
.diary-title {
  font-family: var(--font-display);
  font-size: 3rem;
  font-weight: 700;
  color: var(--ink);
  margin: 0;
  text-shadow: 0 0 40px rgba(179, 136, 255, 0.35);
}
.diary-subtitle {
  font-family: var(--font-body);
  font-size: 1rem;
  color: var(--ink-soft);
  margin: 0.5rem 0 0;
  font-style: italic;
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
.fab-diary {
  background: linear-gradient(135deg, var(--accent-lavender), var(--accent-rose));
  color: #fff;
}
.fab:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
}

/* Empty */
.empty-diary {
  text-align: center;
  padding: 4rem 2rem;
}
.empty-notebook {
  width: 200px;
  height: 160px;
  margin: 0 auto 2rem;
  background: rgba(255, 250, 245, 0.03);
  border: 1px solid var(--border-glow);
  border-radius: 4px 16px 16px 4px;
  position: relative;
  padding: 1.5rem 1.5rem 1.5rem 2.5rem;
}
.empty-notebook::before {
  content: '';
  position: absolute;
  left: 2rem;
  top: 1rem;
  bottom: 1rem;
  width: 1px;
  background: rgba(255, 107, 157, 0.15);
}
.empty-lines {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  padding-top: 0.5rem;
}
.empty-line {
  height: 1px;
  background: rgba(179, 136, 255, 0.08);
}
.empty-diary p {
  font-family: var(--font-display);
  font-size: 1.2rem;
  color: var(--ink-soft);
  margin-bottom: 0.5rem;
}
.empty-diary span {
  font-size: 0.85rem;
  color: var(--ink-muted);
}

/* Mobile */
@media (max-width: 700px) {
  .diary-category { padding: 1.5rem 1rem 5rem; }
  .diary-hero { padding: 2rem 0 1.5rem; }
  .diary-title { font-size: 2rem; }

  .fab {
    width: 56px;
    height: 56px;
    font-size: 1.5rem;
  }

  .empty-diary { padding: 2.5rem 1.5rem; }
  .empty-notebook { width: 160px; height: 120px; }
}
</style>
