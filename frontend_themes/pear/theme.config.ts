import type { App } from 'vue';

export const info = {
  name: "Pear Theme",
  version: "1.0.0",
  author: "NFCMS",
  description: "Apple-inspired minimal theme"
};

export function init(app: App) {
  // Config Vue App
}

export const pages: Record<string, { layout?: string; prefetch?: { key: string; api: string; args: any[] }[] }> = {
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
  Layout: {
    prefetch: [
      { key: 'menus', api: 'crudAPI.getList', args: ['menus'] }
    ]
  }
};
