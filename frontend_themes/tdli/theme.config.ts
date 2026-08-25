import type { App } from 'vue';
import type { ThemeInfo, ThemePages, ThemeConfigSchema, PrefetchItem } from '@/views/front/theme-runtime';

export const info: ThemeInfo = {
  name: 'TDLI',
  version: '1.0.0',
  author: 'NFCMS',
  description: '科研机构官网主题:全屏焦点图、栏目化首页、学术活动日历、人员名录,中英双站',
  home: 'DefaultHome',
};

/**
 * 图标字体走原站的 iconfont(与页面上的字形一一对应)。判重后动态插 —— 不判重的话
 * 每次热更新都会再插一份。
 *
 * 只加载这一个外部样式表:展示字体不加载,因为原站声明的 Harding 在上游就是 404,
 * 线上实际渲染的就是系统字体栈,跟着它反而更保真。
 */
export function init(_app: App) {
  const id = 'tdli-iconfont';
  if (typeof document !== 'undefined' && !document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://tdli.sjtu.edu.cn/assets/css/iconfont/iconfont.css';
    document.head.appendChild(link);
  }
}

/**
 * 列表页的取数。**两个 key 并行发**,模板再挑一个用:
 *
 * - `articles`        —— 按 `category_id`,子栏目页(文章直接挂在它下面)用这个
 * - `sectionArticles` —— 按 `data.section`,父栏目的「全部」页用这个,把整棵子树汇起来
 *
 * 为什么不能只发一个:prefetch 参数是**静态字面量**,没法在配置里判断"当前分类有没有
 * 子栏目"。而两条都发是并行的,多出的那次请求不增加首屏时延,换来的是父页也能完全
 * prefetch —— 首帧就是满的,SSG 也能出快照。`data.section` 由后端钩子自动维护
 * (backend/app/hooks/sectionTag.ts)。
 */
const listPrefetch = (limit: number): PrefetchItem[] => [
  /**
   * 左侧栏目菜单要的是「当前一级栏目下的全部子栏目」。面包屑第一段**就是**那个一级栏目
   * (根栏目页上它是自己),所以按它的 slug 再取一次分类即可 —— 一次针对性请求,拿回来的
   * `children` 正好是菜单项。
   *
   * 不要改成拉全量分类树:公开站每页多传几十上百条分类,只为了从里面挑出一个分支。
   */
  { key: 'rootCat', api: 'contentAPI.getCategory', args: ['${data.breadcrumbs.0.slug}'] },
  { key: 'articles', api: 'contentAPI.listArticles',
    args: [{ filter: { category_id: '${data.category.id}' }, orderBy: 'published_at', orderDesc: true, page: 0, limit }] },
  { key: 'sectionArticles', api: 'contentAPI.listArticles',
    args: [{ filter: { 'data.section': '${data.category.slug}' }, orderBy: 'published_at', orderDesc: true, page: 0, limit }] },
];

/** 英文侧同上,但分类要按 `en-` 前缀去查(前缀只活在数据层,URL 里没有)。 */
const enListPrefetch = (limit: number): PrefetchItem[] => [
  { key: 'category', api: 'contentAPI.getCategory', args: ['en-${params.category_slug}'] },
  { key: 'rootCat', api: 'contentAPI.getCategory', args: ['${data.category.breadcrumbs.0.slug}'] },
  { key: 'articles', api: 'contentAPI.listArticles',
    args: [{ filter: { category_id: '${data.category.id}' }, orderBy: 'published_at', orderDesc: true, page: 0, limit }] },
  { key: 'sectionArticles', api: 'contentAPI.listArticles',
    args: [{ filter: { 'data.section': '${data.category.slug}' }, orderBy: 'published_at', orderDesc: true, page: 0, limit }] },
];

/** 首页各分区。按 `data.section` 取,所以「综合新闻」能把 posts 下所有子栏目的文章汇进来。 */
const homePrefetch = (sectionPrefix: string): PrefetchItem[] => [
  /**
   * 焦点图必须**连语言一起过滤**:只按 `is_top` 取,英文首页会拿到中文站的置顶文章
   * (两棵内容树共用一张表)。限定在新闻 section 里也符合原站 —— 焦点图放的就是新闻与专题。
   */
  { key: 'hero', api: 'contentAPI.listArticles',
    args: [{ filter: { is_top: 1, 'data.section': `${sectionPrefix}posts` }, orderBy: 'published_at', orderDesc: true, limit: 10 }] },
  { key: 'news', api: 'contentAPI.listArticles',
    args: [{ filter: { 'data.section': `${sectionPrefix}posts` }, orderBy: 'published_at', orderDesc: true, limit: 6 }] },
  { key: 'notices', api: 'contentAPI.listArticles',
    args: [{ filter: { 'data.section': `${sectionPrefix}announcements` }, orderBy: 'published_at', orderDesc: true, limit: 6 }] },
  { key: 'events', api: 'contentAPI.listArticles',
    args: [{ filter: { 'data.section': `${sectionPrefix}events` }, orderBy: 'published_at', orderDesc: true, limit: 12 }] },
  { key: 'quicklinks', api: 'contentAPI.listArticles',
    args: [{ filter: { 'data.section': `${sectionPrefix}quick-guide` }, orderBy: 'published_at', orderDesc: false, limit: 12 }] },
];

const SITE = '${data.config.site_name}';
const CAT_TITLE = `\${data.category.name} - ${SITE}`;
const ART_TITLE = `\${data.article.title} - ${SITE}`;

export const pages: ThemePages = {
  // ── 中文侧:走框架原生的 home / category / article 三个 viewType ──
  DefaultHome:      { layout: 'Layout', title: SITE, prefetch: homePrefetch('') },
  DefaultCategory:  { layout: 'Layout', title: CAT_TITLE, prefetch: listPrefetch(12) },
  NewsList:         { layout: 'Layout', title: CAT_TITLE, prefetch: listPrefetch(7) },
  AnnouncementList: { layout: 'Layout', title: CAT_TITLE, prefetch: listPrefetch(10) },
  EventList:        { layout: 'Layout', title: CAT_TITLE, prefetch: listPrefetch(10) },
  PeopleGrid:       { layout: 'Layout', title: CAT_TITLE, prefetch: listPrefetch(12) },
  PageArticle:      { layout: 'Layout', title: CAT_TITLE, prefetch: listPrefetch(1) },

  DefaultArticle:   { layout: 'Layout', title: ART_TITLE, prefetch: [] },
  EventArticle:     { layout: 'Layout', title: ART_TITLE, prefetch: [] },
  PersonPage:       { layout: 'Layout', title: ART_TITLE, prefetch: [] },

  SearchResults:    { layout: 'Layout', routes: ['/search'], title: `搜索 - ${SITE}`, prefetch: [] },

  /**
   * ── 英文侧:三条自定义路由 ──
   *
   * 框架的 category / article 只挂在 `/a/...` 上,`/en/...` 只能靠自定义路由。代价是
   * `viewType` 变成 `custom`,拿不到框架按分类/文章选模板的能力 —— 所以 `EnCategory`
   * / `EnArticle` 是**薄分发器**,读 `list_template` / `template` 再渲染同一批展示组件。
   */
  EnHome:     { layout: 'LayoutEn', routes: ['/en'], title: SITE, prefetch: homePrefetch('en-') },
  EnCategory: { layout: 'LayoutEn', routes: ['/en/a/:category_slug'], title: CAT_TITLE, prefetch: enListPrefetch(12) },
  EnArticle:  { layout: 'LayoutEn', routes: ['/en/a/:category_slug/:article_slug'], title: ART_TITLE,
                prefetch: [{ key: 'article', api: 'contentAPI.getArticle', args: ['en-${params.article_slug}'] }] },
  EnSearch:   { layout: 'LayoutEn', routes: ['/en/search'], title: `Search - ${SITE}`, prefetch: [] },

  Layout:   { title: SITE, prefetch: [{ key: 'menus', api: 'crudAPI.getList', args: ['menus'] }] },
  LayoutEn: { title: SITE, prefetch: [{ key: 'menus', api: 'crudAPI.getList', args: ['menus'] }] },
};

/**
 * 后台「设置 → 主题设置」里可编辑的项。空值一律**隐藏对应元素**,绝不显示假地址/假二维码。
 */
export const configSchema: ThemeConfigSchema = [
  { key: 'theme_tdli_logo_white', label: '白色 Logo(页头 / 页脚)', type: 'image', group: '品牌',
    placeholder: 'https://.../logo_white.png', hint: '留空则显示站点名称文字。' },
  { key: 'theme_tdli_logo_dark', label: '深色 Logo', type: 'image', group: '品牌',
    placeholder: 'https://.../logo.png', hint: '浅色底上使用。' },
  { key: 'theme_tdli_header_bg', label: '页头背景图', type: 'image', group: '品牌',
    hint: '内页页头的蓝色底图,同时用于左侧栏目菜单头部。' },
  { key: 'theme_tdli_footer_bg', label: '页脚背景图', type: 'image', group: '品牌' },

  { key: 'theme_tdli_footer_address', label: '地址', type: 'text', group: '页脚联系方式' },
  { key: 'theme_tdli_footer_address_en', label: '地址(英文)', type: 'text', group: '页脚联系方式' },
  { key: 'theme_tdli_footer_phone', label: '联系电话', type: 'text', group: '页脚联系方式' },
  { key: 'theme_tdli_footer_email', label: '联系邮箱', type: 'text', group: '页脚联系方式' },
  { key: 'theme_tdli_icp', label: '备案 / 版权信息', type: 'text', group: '页脚联系方式',
    hint: '如「沪交ICP备20170129 Copyright © 2019 TDLI」。留空则不显示。' },

  { key: 'theme_tdli_qrcode_wechat', label: '公众号二维码', type: 'image', group: '二维码' },
  { key: 'theme_tdli_qrcode_wechat_label', label: '公众号二维码说明', type: 'text', group: '二维码' },
  { key: 'theme_tdli_qrcode_video', label: '视频号二维码', type: 'image', group: '二维码' },
  { key: 'theme_tdli_qrcode_video_label', label: '视频号二维码说明', type: 'text', group: '二维码' },
];
