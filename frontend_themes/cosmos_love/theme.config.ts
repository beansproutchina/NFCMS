import type { App } from 'vue';
import type { ThemeInfo, ThemePages, ThemeConfigSchema } from '@/views/front/theme-runtime';

export const info: ThemeInfo = {
  name: "Starlit Love",
  version: "2.0.0",
  author: "NFCMS",
  description: "A romantic starlit love nest theme for long-distance couples — with galaxy meetups, paper diaries, and vinyl music"
};

export function init(app: App) {
  // Load fonts: Cormorant Garamond (romantic serif) + Quicksand (soft rounded sans)
  const link = document.createElement('link');
  link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Quicksand:wght@400;500;600;700&display=swap';
  link.rel = 'stylesheet';
  document.head.appendChild(link);
  console.log("Starlit Love Theme v2.0 loaded");
}

export const pages: ThemePages = {
  DefaultHome: {
    layout: 'Layout',
    title: '${data.config.site_name}',
    prefetch: [
      { key: 'categories', api: 'crudAPI.getList', args: ['categories'] },
      { key: 'articles', api: 'contentAPI.listArticles', args: [{ orderBy: 'published_at', orderDesc: true }] }
    ]
  },
  DefaultCategory: {
    layout: 'Layout',
    title: '${data.category.name} - ${data.config.site_name}',
    prefetch: [
      { key: 'articles', api: 'contentAPI.listArticles', args: [{ filter: { category_id: '${data.category.id}' }, orderBy: 'published_at', orderDesc: true }] }
    ]
  },
  DefaultArticle: {
    layout: 'Layout',
    title: '${data.article.title} - ${data.config.site_name}',
    prefetch: []
  },
  // === Meetup (Galaxy) Templates ===
  MeetupCategory: {
    layout: 'Layout',
    title: '${data.category.name} - ${data.config.site_name}',
    prefetch: [
      { key: 'categories', api: 'crudAPI.getList', args: ['categories'] },
      { key: 'articles', api: 'contentAPI.listArticles', args: [{ filter: { category_id: '${data.category.id}' }, orderBy: 'published_at', orderDesc: true }] }
    ]
  },
  MeetupArticle: {
    layout: 'Layout',
    title: '${data.article.title} - ${data.config.site_name}',
    prefetch: [
            { key: 'categories', api: 'crudAPI.getList', args: ['categories'] },
    ]
  },
  // === Diary (Paper) Templates ===
  DiaryCategory: {
    layout: 'Layout',
    title: '${data.category.name} - ${data.config.site_name}',
    prefetch: [
      { key: 'categories', api: 'crudAPI.getList', args: ['categories'] },
      { key: 'articles', api: 'contentAPI.listArticles', args: [{ filter: { category_id: '${data.category.id}' }, orderBy: 'published_at', orderDesc: true }] }
    ]
  },
  DiaryArticle: {
    layout: 'Layout',
    title: '${data.article.title} - ${data.config.site_name}',
    prefetch: [
      { key: 'categories', api: 'crudAPI.getList', args: ['categories'] },
    ]
  },
  // === Music (Vinyl) Templates ===
  MusicCategory: {
    layout: 'Layout',
    title: '${data.category.name} - ${data.config.site_name}',
    prefetch: [
      { key: 'articles', api: 'contentAPI.listArticles', args: [{ filter: { category_id: '${data.category.id}' }, orderBy: 'published_at', orderDesc: true }] }
    ]
  },
  MusicArticle: {
    layout: 'Layout',
    title: '${data.article.title} - ${data.config.site_name}',
    prefetch: []
  },
  // === Layout ===
  Layout: {
    title: '${data.config.site_name}',
    prefetch: [
      { key: 'menus', api: 'crudAPI.getList', args: ['menus'] }
    ]
  }
};

// This theme exposes no custom settings.
export const configSchema: ThemeConfigSchema = [];
