import type { App } from 'vue';
import type { ThemeInfo, ThemePages, ThemeConfigSchema } from '@/views/front/theme-runtime';

export const info: ThemeInfo = {
  name: "School Theme",
  version: "2.0.0",
  author: "NFCMS",
  description: "高校 / 学院官方网站主题:焦点图轮播、栏目化首页、搜索、可配置 Logo 与页脚"
};

export function init(app: App) {
  // Config Vue App
}

/**
 * Theme-owned settings, editable in 后台 → 设置 → 主题设置.
 * Keys follow theme_school_* (backend accepts any theme_<name>_* key). Empty = hidden,
 * never a fake default. See THEME_DEV.md for the config-key convention.
 */
export const configSchema: ThemeConfigSchema = [
  { key: 'theme_school_logo', label: '校徽 / Logo 图片链接', type: 'image', group: '品牌',
    hint: '留空则显示站点名称文字。建议 PNG,高度约 48px。', placeholder: 'https://.../logo.png' },
  { key: 'theme_school_qrcode', label: '官方公众号二维码', type: 'image', group: '品牌',
    hint: '显示在页脚。留空则不显示。', placeholder: 'https://.../qrcode.png' },
  { key: 'theme_school_footer_address', label: '地址', type: 'text', group: '页脚联系方式', placeholder: '上海市东川路800号' },
  { key: 'theme_school_footer_postcode', label: '邮编', type: 'text', group: '页脚联系方式', placeholder: '200240' },
  { key: 'theme_school_footer_phone', label: '联系电话', type: 'text', group: '页脚联系方式', placeholder: '021-00000000' },
  { key: 'theme_school_footer_email', label: '联系邮箱', type: 'text', group: '页脚联系方式', placeholder: 'contact@example.edu.cn' },
  { key: 'theme_school_police_record', label: '公安备案号', type: 'text', group: '页脚联系方式',
    hint: '如「沪公网安备 31000000000000 号」。留空则不显示。' },
];

/**
 * The two main home-page panels are addressed by category slug, not by position in the root-category
 * list. Position was fragile — a new category with a smaller `weight`, or a reorder in the admin,
 * quietly moved a different section into the 新闻 panel — and, more importantly, an id that can only
 * be found by SEARCHING a list cannot be used in a prefetch: `${data.x.y}` is a plain key path with no
 * predicate. Addressing them by slug lets both panels be prefetched, so the grid paints filled.
 *
 * Rename these if the site's categories are slugged differently; a slug that doesn't exist simply
 * leaves its panel unrendered (DefaultHome.vue's `panel()` re-checks `category_id`).
 */
const HOME_NEWS_SLUG = 'news';
const HOME_NOTICE_SLUG = 'notice';

export const pages: ThemePages = {
  DefaultHome: {
    layout: 'Layout',
    title: '${data.config.site_name}',
    // Two waves, all before first paint: the getCategory calls go out together, and the two
    // listArticles calls resolve as soon as their category lands (prefetch keys may depend on other
    // prefetch keys — see router/index.ts). `categories` stays for the "more" strip below the fold,
    // whose membership is data-dependent and so cannot be written out statically.
    prefetch: [
      { key: 'categories', api: 'crudAPI.getList', args: ['categories'] },
      // Featured (置顶) articles power the hero carousel; recent pool as fallback.
      { key: 'featured', api: 'contentAPI.listArticles', args: [{ filter: { is_top: 1 }, orderBy: 'published_at', orderDesc: true, limit: 6 }] },
      { key: 'articles', api: 'contentAPI.listArticles', args: [{ orderBy: 'published_at', orderDesc: true, limit: 12 }] },
      { key: 'newsCat', api: 'contentAPI.getCategory', args: [HOME_NEWS_SLUG] },
      { key: 'newsList', api: 'contentAPI.listArticles', args: [{ filter: { category_id: '${data.newsCat.id}' }, orderBy: 'published_at', orderDesc: true, limit: 7 }] },
      { key: 'noticeCat', api: 'contentAPI.getCategory', args: [HOME_NOTICE_SLUG] },
      { key: 'noticeList', api: 'contentAPI.listArticles', args: [{ filter: { category_id: '${data.noticeCat.id}' }, orderBy: 'published_at', orderDesc: true, limit: 8 }] }
    ]
  },
  // List templates: prefetch page 1 (+ total via $meta.articles), then paginate client-side.
  DefaultCategory: {
    layout: 'Layout',
    title: '${data.category.name} - ${data.config.site_name}',
    prefetch: [
      { key: 'articles', api: 'contentAPI.listArticles', args: [{ filter: { category_id: '${data.category.id}' }, orderBy: 'published_at', orderDesc: true, page: 0, limit: 15 }] }
    ]
  },
  CategoryGrid: {
    layout: 'Layout',
    title: '${data.category.name} - ${data.config.site_name}',
    prefetch: [
      { key: 'articles', api: 'contentAPI.listArticles', args: [{ filter: { category_id: '${data.category.id}' }, orderBy: 'published_at', orderDesc: true, page: 0, limit: 12 }] }
    ]
  },
  DefaultArticle: {
    layout: 'Layout',
    title: '${data.article.title} - ${data.config.site_name}',
    prefetch: []
  },
  ArticleNotice: {
    layout: 'Layout',
    title: '${data.article.title} - ${data.config.site_name}',
    prefetch: []
  },
  // Site search results page, mounted at /search?q=... (reads the query in-template).
  SearchResults: {
    layout: 'Layout',
    routes: ['/search'],
    title: '搜索 - ${data.config.site_name}',
    prefetch: []
  },
  Layout: {
    title: '${data.config.site_name}',
    prefetch: [
      { key: 'menus', api: 'crudAPI.getList', args: ['menus'] }
    ]
  }
};
