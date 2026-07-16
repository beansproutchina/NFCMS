import type { App } from 'vue';

export const info = {
  name: "Neo Theme",
  version: "1.0.0",
  author: "NFCMS",
  description: "Neo Brutalist editorial theme"
};

export function init(app: App) {
  // Config Vue App
}

export const pages: Record<string, { layout?: string; prefetch?: { key: string; api: string; args: any[] }[] }> = {
  DefaultHome: {
    layout: 'Layout',
    prefetch: [
      { key: 'categories', api: 'crudAPI.getList', args: ['categories'] },
      { key: 'articles', api: 'contentAPI.listArticles', args: [{ orderBy: 'published_at', orderDesc: true }] }
    ]
  },
  DefaultCategory: {
    prefetch: [
      { key: 'articles', api: 'contentAPI.listArticles', args: [{ filter: { category_id: '$data.category.id' }, orderBy: 'published_at', orderDesc: true }] }
    ]
  },
  DefaultArticle: {
    prefetch: []
  },
  Layout: {
    prefetch: [
      { key: 'menus', api: 'crudAPI.getList', args: ['menus'] }
    ]
  }
};
