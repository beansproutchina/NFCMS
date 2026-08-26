/**
 * 富文本渲染与消毒 —— **主题无关的通用层**。
 *
 * 各主题(以及后台分类提示)此前各自 `marked.parse(x)` 后直接 `v-html`,而 `marked` 默认
 * **原样透传** `<script>` / `on*` 事件属性 / `javascript:` 链接 —— 低权限作者即可在文章正文里
 * 注入存储型 XSS,经 SSG 预渲染还会固化成对全体匿名访客可执行的静态页(详见安全审计)。
 *
 * 统一收敛到这里一处:主题只调 `renderMarkdown` / `sanitizeHtml`,消毒策略单一出处。
 * 因为 SSG 用 chromium 跑同一套前端再抓 DOM,前端消毒后**实时 SPA 与静态页两条路径同时干净**。
 *
 * 用 js-xss(纯 JS,浏览器/SSR 皆可,已随依赖树存在):
 *  - 白名单沿用 js-xss 默认(marked 产出的排版标签:标题/段落/列表/表格/代码/链接/图片…);
 *  - 额外放行 `class` / `id`(否则 prose 样式与代码高亮类名会被误删);
 *  - 剥离一切非白名单属性(含 `on*` 事件)、`<script>`/`<style>` 连同其内容;
 *  - 允许内联 `style`,但交给 js-xss 的 CSS 过滤器:安全声明(color/font/border…)保留,
 *    `expression()`、`url(javascript:)` 等危险 CSS 一律剔除;
 *  - `href` / `src` 的 `javascript:` / `vbscript:` 等危险协议由 js-xss 的 safeAttrValue 中和。
 */
import { marked } from 'marked';
import { FilterXSS, getDefaultWhiteList, escapeAttrValue } from 'xss';

// 在默认白名单基础上,给每个标签放行 `style`(值会经 js-xss 的 CSS 过滤器消毒),并保留 class/id。
const whiteList = getDefaultWhiteList();
for (const tag in whiteList) {
  const attrs = whiteList[tag];
  if (Array.isArray(attrs) && !attrs.includes('style')) attrs.push('style');
}

const filter = new FilterXSS({
  whiteList,
  // 非白名单标签转义显示而非静默丢弃;但 script/style 连同其内容整体删除。
  stripIgnoreTag: false,
  stripIgnoreTagBody: ['script', 'style'],
  // css 过滤器默认开启:保留安全 CSS 声明,剔除 expression()/url(javascript:) 等危险写法。
  onIgnoreTagAttr(_tag: string, name: string, value: string) {
    // 保留排版需要的 class/id;其余不在白名单里的属性(含 on* 事件处理器)一律丢弃。
    if (name === 'class' || name === 'id') {
      return `${name}="${escapeAttrValue(value)}"`;
    }
    return undefined;
  },
});

/** 消毒任意 HTML 字符串,供 `v-html` 安全使用。 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  return filter.process(String(html));
}

/** 把 Markdown 源码渲染成**已消毒**的 HTML,供 `v-html` 安全使用。 */
export function renderMarkdown(md: string | null | undefined): string {
  if (!md) return '';
  return sanitizeHtml(marked.parse(String(md)) as string);
}
