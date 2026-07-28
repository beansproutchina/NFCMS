import type { App } from 'vue';
import type { ThemeInfo, ThemePages, ThemeConfigSchema } from '@/views/front/theme-runtime';

export const info: ThemeInfo = {
  name: "Pear Theme",
  version: "1.0.0",
  author: "NFCMS",
  description: "Apple-inspired minimal theme"
};

export function init(app: App) {
  // Config Vue App
}

export const pages: ThemePages = {
  DefaultHome: {
    layout: 'Layout',
    title: '$data.config.site_name',
    prefetch: [
      { key: 'categories', api: 'crudAPI.getList', args: ['categories'] },
      { key: 'articles', api: 'contentAPI.listArticles', args: [{ orderBy: 'published_at', orderDesc: true }] }
    ]
  },
  DefaultCategory: {
    layout: 'Layout',
    title: '$data.category.name - $data.config.site_name',
    prefetch: [
      { key: 'articles', api: 'contentAPI.listArticles', args: [{ filter: { category_id: '$data.category.id' }, orderBy: 'published_at', orderDesc: true }] }
    ]
  },
  DefaultArticle: {
    layout: 'Layout',
    title: '$data.article.title - $data.config.site_name',
    prefetch: []
  },
  Layout: {
    // Fallback title for any page whose template doesn't set its own.
    title: '$data.config.site_name',
    prefetch: [
      { key: 'menus', api: 'crudAPI.getList', args: ['menus'] }
    ]
  }
};

// This theme exposes no custom settings.
export const configSchema: ThemeConfigSchema = [];
