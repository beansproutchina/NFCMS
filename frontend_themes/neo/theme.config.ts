import type { App } from 'vue';
import type { ThemeInfo, ThemePages, ThemeConfigSchema } from '@/views/front/theme-runtime';
import { LISTED_WORK_FILTER } from './lib';

export const info: ThemeInfo = {
  name: "Neo Studio",
  version: "2.0.0",
  author: "NFCMS",
  description: "Neo-Brutalist 工作室 / 个人主页主题:作品集、服务、团队、关于、联系,开箱即用"
};

export function init(_app: App) {
  // Load the display + mono fonts the brutalist look depends on (falls back to system otherwise).
  // Host is Google Fonts' official China mirror (fonts.googleapis.cn): same CSS byte-for-byte as
  // the .com host, woff2 URLs rewritten to fonts.gstatic.cn. Reachable from the mainland, which
  // .com is not. If it ever goes away the only symptom is a fallback to system fonts.
  const id = 'neo-fonts';
  if (typeof document !== 'undefined' && !document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.cn/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Space+Mono:wght@400;700&family=Manrope:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }
}

/**
 * Theme settings, editable in 后台 → 设置 → 主题设置. Keys use the theme_neo_* convention.
 * Empty = hidden (never a fake default). See THEME_DEV.md.
 *
 * The homepage/about tagline is deliberately NOT here: it is the generic `subtitle` config key
 * (后台 → 站点配置 → 副标题), so it survives a theme change. Do not reintroduce a theme_neo_tagline.
 */
export const configSchema: ThemeConfigSchema = [
  { key: 'theme_neo_hero_cta_text', label: '首页 CTA 文案', type: 'text', group: '首页', placeholder: '查看作品' },
  { key: 'theme_neo_hero_cta_link', label: '首页 CTA 链接', type: 'text', group: '首页', placeholder: '/a/works' },
  { key: 'theme_neo_nav_cta_text', label: '导航 CTA 文案', type: 'text', group: '导航', hint: '留空则不显示导航按钮。', placeholder: '合作咨询' },
  { key: 'theme_neo_nav_cta_link', label: '导航 CTA 链接', type: 'text', group: '导航', placeholder: '/contact' },
  { key: 'theme_neo_avatar', label: '头像 / 品牌图', type: 'image', group: '关于', hint: '用于关于页。留空则不显示。' },
  { key: 'theme_neo_about_slug', label: '关于页文章 slug', type: 'text', group: '关于', hint: '关于页正文取自该 slug 的文章。', placeholder: 'about' },
  { key: 'theme_neo_contact_email', label: '联系邮箱', type: 'text', group: '联系', hint: '联系页表单的收件地址(mailto),也是页眉页脚邮件图标的地址。', placeholder: 'hello@studio.com' },
  { key: 'theme_neo_contact_phone', label: '联系电话', type: 'text', group: '联系' },
  { key: 'theme_neo_contact_location', label: '所在地', type: 'text', group: '联系', placeholder: '上海' },
  { key: 'theme_neo_social_github', label: 'GitHub', type: 'text', group: '社交', placeholder: 'https://github.com/...' },
  { key: 'theme_neo_social_bilibili', label: '哔哩哔哩', type: 'text', group: '社交', placeholder: 'https://space.bilibili.com/...' },
  { key: 'theme_neo_social_douyin', label: '抖音', type: 'text', group: '社交', placeholder: 'https://www.douyin.com/user/...' },
  { key: 'theme_neo_social_xiaohongshu', label: '小红书', type: 'text', group: '社交', placeholder: 'https://www.xiaohongshu.com/user/profile/...' },
  { key: 'theme_neo_social_zhihu', label: '知乎', type: 'text', group: '社交', placeholder: 'https://www.zhihu.com/people/...' },
  { key: 'theme_neo_social_wechat_qr', label: '微信公众号 / 个人二维码', type: 'image', group: '社交', hint: '站点级二维码,访客点击图标弹出。留空则不显示微信图标。' },
  { key: 'theme_neo_footer_note', label: '页脚附言', type: 'text', group: '页脚', placeholder: 'Made with care.' },
];

// Prefetch used by list-style pages; page 1 (+ total via $meta) then paginate client-side.
const listPrefetch = [
  { key: 'articles', api: 'contentAPI.listArticles', args: [{ filter: { category_id: '$data.category.id' }, orderBy: 'published_at', orderDesc: true, page: 0, limit: 12 }] },
];

// Same, but only the pinned projects — the studio's works page is a curated list, not an archive.
// Filter comes from lib.ts so this and useArticleList (pages 2+) can never drift apart.
const worksPrefetch = [
  { key: 'articles', api: 'contentAPI.listArticles', args: [{ filter: { category_id: '$data.category.id', ...LISTED_WORK_FILTER }, orderBy: 'published_at', orderDesc: true, page: 0, limit: 12 }] },
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
  WorkGrid: { layout: 'Layout', title: '$data.category.name - $data.config.site_name', prefetch: worksPrefetch },
  ProjectArticle: { layout: 'Layout', title: '$data.article.title - $data.config.site_name', prefetch: [] },
  // Services & team
  ServiceList: { layout: 'Layout', title: '$data.category.name - $data.config.site_name', prefetch: listPrefetch },
  TeamGrid: { layout: 'Layout', title: '$data.category.name - $data.config.site_name', prefetch: listPrefetch },
  // Member profile: bare shell + the works this member is credited on.
  MemberPage: {
    layout: 'MemberLayout',
    title: '$data.article.title - $data.config.site_name',
    prefetch: [
      // ⚠ LIKE over the WHOLE `data` column on purpose — never `data.members` (a dotted path makes
      // SQLite json_extract throw "malformed JSON" on any row where data='', which fails the entire
      // query; prefetch catches that and silently renders an empty section). The client then
      // re-filters exactly, since LIKE 'member-1' also matches 'member-10'. See MemberPage.vue.
      {
        key: 'memberWorks', api: 'contentAPI.listArticles',
        args: [{
          filter: { data: { $contains: '$data.article.slug' } },
          orderBy: 'published_at', orderDesc: true, page: 0, limit: 24,
        }],
      },
    ],
  },
  // Registered on purpose even though it is empty: `pages` is the only index of this theme's
  // layout chain, and a layout that appears in the chain but not in the index reads like an
  // oversight. Nothing to declare — MemberLayout needs no prefetch (its back link is derived from
  // context.article.category) and no title (MemberPage's wins, child before parent).
  // ⚠ Never add `layout: 'Layout'` here: that wraps AHeader/AFooter back around the bare page.
  MemberLayout: {},
  // Standalone marketing pages (custom routes)
  AboutPage: { layout: 'Layout', routes: ['/about'], title: '关于 - $data.config.site_name', prefetch: [] },
  ContactPage: { layout: 'Layout', routes: ['/contact'], title: '联系 - $data.config.site_name', prefetch: [] },
  Layout: {
    title: '$data.config.site_name',
    prefetch: [{ key: 'menus', api: 'crudAPI.getList', args: ['menus'] }],
  },
};
