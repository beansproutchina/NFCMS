import type { App } from 'vue';

export const info = {
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

export const pages: Record<string, { layout?: string; routes?: string[]; prefetch?: { key: string; api: string; args: any[] }[] }> = {
  DefaultHome: {
    layout: 'Layout',
    prefetch: [
      { key: 'categories', api: 'crudAPI.getList', args: ['categories'] },
      { key: 'articles', api: 'crudAPI.getList', args: ['articles', { filter: { visible: 1 }, orderBy: 'published_at', orderDesc: true }] }
    ]
  },
  DefaultCategory: {
    layout: 'Layout',
    prefetch: [
      { key: 'articles', api: 'crudAPI.getList', args: ['articles', { filter: { category_id: '$data.category.id', visible: 1 }, orderBy: 'published_at', orderDesc: true }] }
    ]
  },
  DefaultArticle: {
    layout: 'Layout',
    prefetch: []
  },
  // === Meetup (Galaxy) Templates ===
  MeetupCategory: {
    layout: 'Layout',
    prefetch: [
      { key: 'categories', api: 'crudAPI.getList', args: ['categories'] },
      { key: 'articles', api: 'crudAPI.getList', args: ['articles', { filter: { category_id: '$data.category.id', visible: 1 }, orderBy: 'published_at', orderDesc: true }] }
    ]
  },
  MeetupArticle: {
    layout: 'Layout',
    prefetch: [
            { key: 'categories', api: 'crudAPI.getList', args: ['categories'] },
    ]
  },
  // === Diary (Paper) Templates ===
  DiaryCategory: {
    layout: 'Layout',
    prefetch: [
      { key: 'categories', api: 'crudAPI.getList', args: ['categories'] },
      { key: 'articles', api: 'crudAPI.getList', args: ['articles', { filter: { category_id: '$data.category.id', visible: 1 }, orderBy: 'published_at', orderDesc: true }] }
    ]
  },
  DiaryArticle: {
    layout: 'Layout',
    prefetch: [
      { key: 'categories', api: 'crudAPI.getList', args: ['categories'] },
    ]
  },
  // === Music (Vinyl) Templates ===
  MusicCategory: {
    layout: 'Layout',
    prefetch: [
      { key: 'articles', api: 'crudAPI.getList', args: ['articles', { filter: { category_id: '$data.category.id', visible: 1 }, orderBy: 'published_at', orderDesc: true }] }
    ]
  },
  MusicArticle: {
    layout: 'Layout',
    prefetch: []
  },
  // === Layout ===
  Layout: {
    prefetch: [
      { key: 'menus', api: 'crudAPI.getList', args: ['menus'] }
    ]
  }
};
