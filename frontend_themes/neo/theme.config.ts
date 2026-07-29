import type { App } from 'vue';
import type { ThemeInfo, ThemePages, ThemeConfigSchema } from '@/views/front/theme-runtime';

export const info: ThemeInfo = {
  name: "Neo Studio",
  version: "2.0.0",
  author: "NFCMS",
  description: "Neo-Brutalist 工作室 / 个人主页主题:作品集、服务、团队、关于、联系,开箱即用"
};

export function init(_app: App) {
  // Load the display + mono fonts the brutalist look depends on (falls back to system otherwise).
  const id = 'neo-fonts';
  if (typeof document !== 'undefined' && !document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Space+Mono:wght@400;700&family=Manrope:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }
}

/**
 * Theme settings, editable in 后台 → 设置 → 主题设置. Keys use the theme_neo_* convention.
 * Empty = hidden (never a fake default). See THEME_DEV.md.
 */
export const configSchema: ThemeConfigSchema = [
  { key: 'theme_neo_tagline', label: '首页副标语', type: 'text', group: '首页', placeholder: 'We design & build digital things.' },
  { key: 'theme_neo_hero_cta_text', label: '首页 CTA 文案', type: 'text', group: '首页', placeholder: '查看作品' },
  { key: 'theme_neo_hero_cta_link', label: '首页 CTA 链接', type: 'text', group: '首页', placeholder: '/a/works' },
  { key: 'theme_neo_nav_cta_text', label: '导航 CTA 文案', type: 'text', group: '导航', hint: '留空则不显示导航按钮。', placeholder: '合作咨询' },
  { key: 'theme_neo_nav_cta_link', label: '导航 CTA 链接', type: 'text', group: '导航', placeholder: '/contact' },
  { key: 'theme_neo_avatar', label: '头像 / 品牌图', type: 'image', group: '关于', hint: '用于关于页。留空则不显示。' },
  { key: 'theme_neo_about_slug', label: '关于页文章 slug', type: 'text', group: '关于', hint: '关于页正文取自该 slug 的文章。', placeholder: 'about' },
  { key: 'theme_neo_contact_email', label: '联系邮箱', type: 'text', group: '联系', hint: '联系页表单的收件地址(mailto)。', placeholder: 'hello@studio.com' },
  { key: 'theme_neo_contact_phone', label: '联系电话', type: 'text', group: '联系' },
  { key: 'theme_neo_contact_location', label: '所在地', type: 'text', group: '联系', placeholder: '上海' },
  { key: 'theme_neo_social_github', label: 'GitHub', type: 'text', group: '社交', placeholder: 'https://github.com/...' },
  { key: 'theme_neo_social_x', label: 'X / Twitter', type: 'text', group: '社交' },
  { key: 'theme_neo_social_dribbble', label: 'Dribbble', type: 'text', group: '社交' },
  { key: 'theme_neo_social_linkedin', label: 'LinkedIn', type: 'text', group: '社交' },
  { key: 'theme_neo_social_instagram', label: 'Instagram', type: 'text', group: '社交' },
  { key: 'theme_neo_footer_note', label: '页脚附言', type: 'text', group: '页脚', placeholder: 'Made with care.' },
];

// Prefetch used by list-style pages; page 1 (+ total via $meta) then paginate client-side.
const listPrefetch = [
  { key: 'articles', api: 'contentAPI.listArticles', args: [{ filter: { category_id: '$data.category.id' }, orderBy: 'published_at', orderDesc: true, page: 0, limit: 12 }] },
];

export const pages: ThemePages = {
  DefaultHome: {
    layout: 'Layout',
    title: '$data.config.site_name',
    prefetch: [
      { key: 'categories', api: 'crudAPI.getList', args: ['categories'] },
      { key: 'articles', api: 'contentAPI.listArticles', args: [{ orderBy: 'published_at', orderDesc: true, limit: 12 }] },
    ],
  },
  // Blog / journal
  DefaultCategory: { layout: 'Layout', title: '$data.category.name - $data.config.site_name', prefetch: listPrefetch },
  DefaultArticle: { layout: 'Layout', title: '$data.article.title - $data.config.site_name', prefetch: [] },
  // Portfolio
  WorkGrid: { layout: 'Layout', title: '$data.category.name - $data.config.site_name', prefetch: listPrefetch },
  ProjectArticle: { layout: 'Layout', title: '$data.article.title - $data.config.site_name', prefetch: [] },
  // Services & team
  ServiceList: { layout: 'Layout', title: '$data.category.name - $data.config.site_name', prefetch: listPrefetch },
  TeamGrid: { layout: 'Layout', title: '$data.category.name - $data.config.site_name', prefetch: listPrefetch },
  // Standalone marketing pages (custom routes)
  AboutPage: { layout: 'Layout', routes: ['/about'], title: '关于 - $data.config.site_name', prefetch: [] },
  ContactPage: { layout: 'Layout', routes: ['/contact'], title: '联系 - $data.config.site_name', prefetch: [] },
  Layout: {
    title: '$data.config.site_name',
    prefetch: [{ key: 'menus', api: 'crudAPI.getList', args: ['menus'] }],
  },
};
