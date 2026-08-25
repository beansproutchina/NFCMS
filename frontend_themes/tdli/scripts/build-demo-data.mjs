/**
 * 生成 `tdli-demo-data.json` —— `/setup → 导入数据` 用的开箱即用演示数据。
 *
 *   node frontend_themes/tdli/scripts/build-demo-data.mjs
 *
 * 内容来自 `seed-source.json`(从 tdli.sjtu.edu.cn 公开页面/接口抓的真实标题、日期、
 * 图链、活动与人员信息 —— 已获授权的站点迁移),栏目树来自 `categories.mjs`。
 *
 * ## 导入机制的硬约束(错一条就导不进或关系错乱)
 *
 * - 导入**按数组顺序自增 id**,所以 `categories` 里父必须排在子前面,`article.category_id`
 *   与 `menu.items[].refId` 都要对上这个顺序产生的 id。
 * - 后端强制导入顺序,`articles` 永远最后 —— 生成时也按这个顺序排。
 * - `publish_at` 用**真 `null`**,不是字符串 `"null"`(后者会变成 Invalid Date,整篇失败)。
 * - `data` / `items` / `article_data_fields` 是**对象**,不要 JSON 字符串化。
 * - RBAC 四张表从已有导出原样复用(school 那份带可登录 admin)。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { TREE, FIELDS } from './categories.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const THEME = path.resolve(HERE, '..');
const REPO = path.resolve(THEME, '../..');

const src = JSON.parse(readFileSync(path.join(THEME, 'seed-source.json'), 'utf8'));
const rbacRef = JSON.parse(readFileSync(path.join(REPO, 'frontend_themes/school/demo-admin-admin123.json'), 'utf8'));

const S = 'https://tdli.sjtu.edu.cn';
/** 时间戳全部用固定值推导,不用 Date.now() —— 生成结果必须可复现。 */
const BASE = Date.parse('2026-08-25T00:00:00Z');
const daysAgo = (n) => new Date(BASE - n * 86400000).toISOString();
const IMG = (w, h) => `https://mockimg.dev/${w}x${h}/CCCCCC/66CCFF.png`;

// ────────────────────────────────────────────────────────── 分类
const categories = [];
const catId = {};              // slug → id
const catBySlug = {};

const pushCat = (c) => {
  const id = categories.length + 1;
  catId[c.slug] = id;
  catBySlug[c.slug] = c;
  categories.push({
    id, name: c.name, slug: c.slug,
    parent_id: c.parent_id ?? 0,
    list_template: c.list ?? 'DefaultCategory',
    content_template: c.content ?? 'DefaultArticle',
    weight: c.weight ?? 50,
    audience: 'public', teaser: 0,
    article_data_fields: c.fields ?? {},
    editor_hint: c.hint ?? '',
    data: {
      ...(c.nameEn ? { name_en: c.nameEn } : {}),
      ...(c.indexLabel ? { index_label: c.indexLabel } : {}),
      ...(c.divisions ? { divisions: c.divisions } : {}),
    },
  });
  return id;
};

/** 中英各建一棵。英文的 slug 加 `en-` 前缀,名字取 `en` 字段。 */
const buildTree = (lang) => {
  const pre = lang === 'en' ? 'en-' : '';
  const skip = lang === 'en' ? 'enSkip' : 'zhSkip';
  const nameOf = (n) => (lang === 'en' ? n.en : n.name);
  let w = 10;
  for (const top of TREE) {
    if (top[skip]) continue;
    const pid = pushCat({
      ...top, slug: pre + top.slug, name: nameOf(top), parent_id: 0, weight: w,
      nameEn: lang === 'en' ? '' : top.nameEn,
      indexLabel: lang === 'en' ? top.indexLabelEn : top.indexLabel,
      // 研究部清单要完整 —— 从本次 seed 的人员数据里归纳,而不是让前端按当前页去猜
      divisions: top.slug === 'people'
        ? [...new Set(src.people_cn.map(x => x.org).filter(Boolean))]
        : undefined,
    });
    let cw = 10;
    for (const ch of top.children ?? []) {
      if (ch[skip]) continue;
      pushCat({ ...ch, slug: pre + ch.slug, name: nameOf(ch), parent_id: pid, weight: cw, nameEn: '' });
      cw += 10;
    }
    w += 10;
  }
};
buildTree('zh');
buildTree('en');

// ────────────────────────────────────────────────────────── 菜单
const catUrl = (slug, lang) => (lang === 'en' ? `/en/a/${slug.replace(/^en-/, '')}` : `/a/${slug}`);
const navItem = (slug, label, lang, children = []) => ({
  label, url: catUrl(slug, lang), type: 'category', refId: catId[slug] ?? 0, children,
});

const menus = [];
const pushMenu = (name, location, items) => menus.push({ id: menus.length + 1, name, location, items });

const buildMenus = (lang) => {
  const pre = lang === 'en' ? 'en-' : '';
  const suf = lang === 'en' ? '_en' : '';
  const skip = lang === 'en' ? 'enSkip' : 'zhSkip';
  const nameOf = (n) => (lang === 'en' ? n.en : n.name);
  const pick = (nav) => TREE.filter(t => t.nav === nav && !t[skip]).map(t =>
    navItem(pre + t.slug, nameOf(t), lang,
      [
        // 栏目的「总入口」指向父栏目自己(它按 section 聚合整棵子树),与左侧菜单首项一致
        ...(t.indexLabel ? [navItem(pre + t.slug, lang === 'en' ? t.indexLabelEn : t.indexLabel, lang)] : []),
        ...(t.children ?? []).filter(c => !c[skip]).map(c => navItem(pre + c.slug, nameOf(c), lang)),
      ]));

  pushMenu(lang === 'en' ? 'Main Nav' : '主导航', 'header' + suf, pick('header'));

  const top = pick('top');
  top.push({ label: lang === 'en' ? "Honor TD's 100th Birthday" : '李政道百岁诞辰纪念专题',
             url: `${S}/st/tdlee`, type: 'custom', refId: 0, children: [] });
  if (lang === 'zh') top.push({ label: '暗物质物理全国重点实验室', url: `${S}/dark-matter/overview/about`,
                                type: 'custom', refId: 0, children: [] });
  pushMenu(lang === 'en' ? 'Top Bar' : '顶栏导航', 'top' + suf, top);

  const ext = (label, url) => ({ label, url, type: 'custom', refId: 0, children: [] });
  pushMenu(lang === 'en' ? 'Quick Links' : '快捷链接', 'quicklinks' + suf, [
    ext('Indico', 'https://indico-tdli.sjtu.edu.cn/'),
    ext('PandaX', 'https://pandax.sjtu.edu.cn/'),
    ext(lang === 'en' ? 'Trident' : '海铃计划', 'https://trident.sjtu.edu.cn/cn'),
    ext('JUST', 'https://just.sjtu.edu.cn/CN/'),
  ]);
  pushMenu(lang === 'en' ? 'Footer Links' : '友情链接', 'footer' + suf, [
    ext(lang === 'en' ? 'Shanghai Jiao Tong University' : '上海交通大学', 'https://www.sjtu.edu.cn/'),
    ext(lang === 'en' ? 'T. D. Lee Library' : '李政道图书馆', 'https://tdllib.sjtu.edu.cn'),
    ext(lang === 'en' ? 'School of Physics and Astronomy' : '物理与天文学院', 'https://www.physics.sjtu.edu.cn/'),
  ]);
};
buildMenus('zh');
buildMenus('en');

// ────────────────────────────────────────────────────────── 文章
const articles = [];
const usedSlugs = new Set();
/**
 * URL slug。英文标题直接转写;**中文标题转出来只会剩下标题里的阿拉伯数字**
 * (`2026年…暑期学术营通知` → `2026`),那样的 URL 既不可读也几乎必然重名 —— 这种情况
 * 退回 `<栏目>-<序号>` 形式的 fallback。判据是"转写结果里有没有字母",不是长度:
 * 纯数字的 slug 无论多长都没有信息量。
 */
const slugify = (s, fallback, prefix = '') => {
  const t = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const base = /[a-z]/.test(t) ? t.slice(0, 48).replace(/-$/, '') : fallback;
  /**
   * 去重必须在**带前缀的完整 slug** 上做。在裸名字上去重会让英文侧凭空背上数字后缀 ——
   * 中文的 `frank-wilczek` 占了名额,英文就成了 `en-frank-wilczek-2`,而 `en-frank-wilczek`
   * 明明空着。slug 是 URL 的一部分,这种后缀会一直留在链接里。
   */
  let slug = prefix + base, i = 2;
  while (usedSlugs.has(slug)) slug = `${prefix}${base}-${i++}`;
  usedSlugs.add(slug);
  return slug;
};

const push = (o) => {
  const id = articles.length + 1;
  const iso = o.date ? new Date(o.date).toISOString() : daysAgo(30 + id);
  articles.push({
    id, title: o.title, slug: o.slug, author_id: '1',
    description: o.description ?? '', thumbnail: o.thumbnail ?? '',
    content: o.content ?? '', content_template: '',
    status: 'visible', publish_at: null, rev_version: 0,
    is_top: o.is_top ?? 0,
    audience: '', teaser: -1, access_eff: 'public',
    category_id: o.category_id,
    published_at: iso, created_at: iso, updated_at: iso,
    /** `section` 生成时就写死:导入走 restore,不触发 `content.saved` 钩子。 */
    data: { section: o.section, ...(o.data ?? {}) },
  });
};

const rootOf = (slug) => {
  const c = catBySlug[slug];
  const top = TREE.find(t => t.slug === slug.replace(/^en-/, '') || (t.children ?? []).some(x => x.slug === slug.replace(/^en-/, '')));
  return (slug.startsWith('en-') ? 'en-' : '') + (top?.slug ?? slug.replace(/^en-/, ''));
};

const P = (...paras) => paras.join('\n\n');

// ── 新闻 ──
const NEWS_KIDS = ['posts-research', 'posts-outreach', 'posts-institute', 'posts-party', 'posts-newsletter', 'posts-media'];
const NEWS_TAGS = { 'posts-research': '科学探索', 'posts-outreach': '科普公益', 'posts-institute': '李所新闻',
                    'posts-party': '党群工作', 'posts-newsletter': '季度简报', 'posts-media': '媒体聚焦' };
const NEWS_TAGS_EN = { 'posts-research': 'Research', 'posts-outreach': 'Outreach', 'posts-institute': 'Institute News',
                       'posts-newsletter': 'Newsletter', 'posts-media': 'Media' };

const addNews = (lang) => {
  const pre = lang === 'en' ? 'en-' : '';
  const list = lang === 'en' ? src.posts_en : src.posts_cn;
  const kids = NEWS_KIDS.filter(k => !(lang === 'en' && k === 'posts-party'));
  list.forEach((p, i) => {
    const kid = kids[i % kids.length];
    const tags = lang === 'en' ? NEWS_TAGS_EN : NEWS_TAGS;
    push({
      title: p.title, slug: slugify(p.title, `news-${i + 1}`, pre),
      description: p.desc || '', thumbnail: p.thumb || IMG(800, 450),
      date: p.date, category_id: catId[pre + kid], section: pre + 'posts',
      is_top: i < 8 && p.thumb ? 1 : 0,
      data: { tag: tags[kid] ?? '', external_url: '' },
      content: P(
        lang === 'en'
          ? `The Tsung-Dao Lee Institute released this update on ${p.date}.`
          : `李政道研究所于 ${p.date} 发布本条动态。`,
        lang === 'en'
          ? 'This demo entry keeps the original headline and cover image so the layout can be reviewed against the live site; the body text is placeholder copy.'
          : '本条为演示数据:保留了原站的标题与封面图以便比对版式,正文为占位文案。',
      ),
    });
  });
};

// ── 通知公告 ──
const addAnn = (lang) => {
  const pre = lang === 'en' ? 'en-' : '';
  const list = lang === 'en' ? src.ann_en : src.ann_cn;
  const depts = lang === 'en' ? ['Academic Office', 'Graduate Office', 'General Affairs'] : ['科研办公室', '研究生办公室', '综合办公室'];
  list.forEach((a, i) => {
    push({
      title: a.title, slug: slugify(a.title, `notice-${i + 1}`, pre),
      date: a.date, category_id: catId[pre + 'announcements'], section: pre + 'announcements',
      data: { department: depts[i % depts.length], doc_number: `${lang === 'en' ? 'TDLI' : '李所'}〔2026〕${String(i + 1).padStart(3, '0')}号` },
      content: P(lang === 'en' ? 'Please refer to the notice below.' : '现将有关事项通知如下。',
                 lang === 'en' ? 'Placeholder body for the demo dataset.' : '本条为演示数据,正文为占位文案。'),
    });
  });
};

// ── 学术活动 ──
const addEvents = (lang) => {
  const pre = lang === 'en' ? 'en-' : '';
  src.events.forEach((e, i) => {
    push({
      title: e.title, slug: slugify(e.title, `event-${i + 1}`, pre),
      date: e.start || daysAgo(i), category_id: catId[pre + `events-${e.kind}`], section: pre + 'events',
      data: { start_dt: e.start, end_dt: e.end, venue: e.venue, person: e.person,
              event_type: e.kind, division: e.division, indico_url: e.indico },
      content: P(
        `**Abstract:** ${lang === 'en' ? 'Placeholder abstract for the demo dataset.' : '本条为演示数据,摘要为占位文案。'}`,
        e.person ? `**Speaker:** ${e.person}` : '',
        e.division_name ? `**${lang === 'en' ? 'Division' : '研究部'}:** ${e.division_name}` : '',
      ).replace(/\n{3,}/g, '\n\n'),
    });
  });
};

// ── 人员 ──
/**
 * 系列归属在抓取阶段就按原站的 `category` 字段定好了(比从职称文本猜准确),这里直接用。
 * 英文姓名/职称按 `key`(工号)配对;配不上的退回中文那份 —— 名录里缺一个人比显示一个
 * 空条目糟糕得多。
 */
const addPeople = (lang) => {
  const pre = lang === 'en' ? 'en-' : '';
  src.people_cn.forEach((p, i) => {
    const en = src.people_en[p.key] ?? {};
    const name = lang === 'en' ? (en.name_en || p.name_en || p.name) : (p.name || p.name_en);
    if (!name) return;
    const job = lang === 'en' ? (en.job || p.job) : p.job;
    const org = lang === 'en' ? (en.org || p.org) : p.org;
    const intro = (lang === 'en' ? (en.intro || '') : p.intro) || '';
    push({
      title: name, slug: slugify(p.name_en || name, `person-${i + 1}`, pre),
      thumbnail: p.avatar || IMG(268, 341),
      category_id: catId[pre + (p.series || 'people-fellows')], section: pre + 'people',
      data: {
        name_en: p.name_en, job, organize_desc: org, email: p.email, office_phone: p.phone,
        postal_address: p.office, web_site: p.site, avatar: p.avatar || IMG(268, 341),
        education: lang === 'en' ? '- Ph.D., Physics\n- B.S., Physics' : '- 博士,物理学\n- 学士,物理学',
        experience: lang === 'en' ? `- Present, Tsung-Dao Lee Institute, ${job}` : `- 至今,李政道研究所,${job}`,
        research: intro ? '' : (lang === 'en' ? '- Experimental and theoretical physics' : '- 实验与理论物理'),
        honors: '', publications: '',
      },
      content: intro,
    });
  });
};

// ── 快速指南 ──
const NAV = `${S}/storage/tdli/web/webcn/navigation/2024/12`;
const GUIDES = [
  { zh: '会议室预定', en: 'Room Booking', url: 'https://mrrm.sjtu.edu.cn', icon: `${NAV}/0e1db48c552c2799f381dd7259eb0547.png` },
  { zh: '交我办', en: 'My SJTU', url: 'https://my.sjtu.edu.cn', icon: `${NAV}/c54cbd8620996db561436992939efb38.png` },
  { zh: '院系管理系统', en: 'Department System', url: 'https://sa.sjtu.edu.cn', icon: `${NAV}/f8b10cbee17a51d328ad7f9d71a32036.png` },
  { zh: '教职工页面修改', en: 'Faculty Page', url: `${S}/people`, icon: `${NAV}/7dd0f4268b04274b4ab09cbbb1c6f673.png` },
  { zh: '下载中心', en: 'Downloads', url: '/a/service-downloads', icon: `${NAV}/28439c64311b2162fc63e2315ea2e415.png` },
  { zh: '视觉李所', en: 'Gallery', url: '/a/about-gallery', icon: `${NAV}/685a262d362d99f42e0f777919e8eddc.png` },
];
const addGuides = (lang) => {
  const pre = lang === 'en' ? 'en-' : '';
  GUIDES.forEach((g, i) => push({
    title: lang === 'en' ? g.en : g.zh, slug: slugify(g.en, `guide-${i + 1}`, pre),
    thumbnail: g.icon, category_id: catId[pre + 'quick-guide'], section: pre + 'quick-guide',
    date: daysAgo(200 - i),
    data: { url: g.url.startsWith('/a/') && lang === 'en' ? `/en${g.url}` : g.url },
  }));
};

/** 其余栏目:每个给几条示意内容,导航点进去不会是空页。 */
const addFiller = (lang) => {
  const pre = lang === 'en' ? 'en-' : '';
  const skip = lang === 'en' ? 'enSkip' : 'zhSkip';
  const done = new Set(['posts', 'announcements', 'events', 'people', 'quick-guide']);
  let n = 0;
  for (const top of TREE) {
    if (top[skip] || done.has(top.slug)) continue;
    const targets = (top.children ?? []).filter(c => !c[skip] && !c.aliasParent);
    const list = targets.length ? targets : [top];
    for (const c of list) {
      const isPage = (c.list ?? top.list) === 'PageArticle';
      const count = isPage ? 1 : 3;
      for (let k = 0; k < count; k++) {
        const title = lang === 'en'
          ? (isPage ? c.en : `${c.en} update ${k + 1}`)
          : (isPage ? c.name : `${c.name}动态 ${k + 1}`);
        push({
          title, slug: slugify(`${c.slug}-${k + 1}`, `page-${++n}`, pre),
          thumbnail: isPage ? '' : IMG(800, 450),
          date: daysAgo(20 + n * 3 + k),
          category_id: catId[pre + c.slug], section: pre + top.slug,
          content: P(
            lang === 'en' ? `## ${c.en}` : `## ${c.name}`,
            lang === 'en' ? 'Placeholder content for the demo dataset. Replace it in the admin.'
                          : '本页为演示数据,请在后台替换为真实内容。',
            lang === 'en' ? '- Item one\n- Item two\n- Item three' : '- 要点一\n- 要点二\n- 要点三',
          ),
        });
      }
    }
  }
};

for (const lang of ['zh', 'en']) {
  addNews(lang); addAnn(lang); addEvents(lang); addPeople(lang); addGuides(lang); addFiller(lang);
}

// ────────────────────────────────────────────────────────── 配置
const cfg = (configkey, configvalue) => ({ configkey, configvalue });
const system_config = [
  cfg('site_name', '李政道研究所'),
  cfg('subtitle', 'Tsung-Dao Lee Institute'),
  cfg('icp_record', '沪交ICP备20170129 Copyright © 2019 TDLI'),
  cfg('mourning_mode', 'false'),
  cfg('theme_tdli_logo_white', `${S}/assets/images/logo_white.png`),
  cfg('theme_tdli_logo_dark', `${S}/assets/images/logo.png`),
  cfg('theme_tdli_header_bg', `${S}/assets/images/header_bg.png`),
  cfg('theme_tdli_footer_bg', `${S}/assets/images/footer-bg.png`),
  cfg('theme_tdli_footer_address', '上海市浦东新区李所路1号李政道研究所（201210）'),
  cfg('theme_tdli_footer_address_en', 'Tsung-Dao Lee Institute, 1 Lisuo Road, Pudong New Area, Shanghai, 201210'),
  cfg('theme_tdli_footer_phone', '+86-21-68693100'),
  cfg('theme_tdli_footer_email', 'tdli@sjtu.edu.cn'),
  cfg('theme_tdli_qrcode_wechat', `${S}/assets/images/gzh.png`),
  cfg('theme_tdli_qrcode_wechat_label', '关注李所公众号'),
  cfg('theme_tdli_qrcode_wechat_label_en', 'WeChat'),
  cfg('theme_tdli_qrcode_video', `${S}/assets/images/sph.png`),
  cfg('theme_tdli_qrcode_video_label', '关注李所视频号'),
  cfg('theme_tdli_qrcode_video_label_en', 'Video Account'),
].map((r, i) => ({ id: i + 1, ...r }));

const out = {
  _meta: { version: '1.0', exportedAt: '2026-08-25T00:00:00.000Z', generator: 'NFCMS',
           saltFingerprint: rbacRef._meta?.saltFingerprint ?? 'demo-data-placeholder-hashes-not-usable' },
  system_config, categories,
  users: rbacRef.users, menus, attachments: [], schemas: [],
  roles: rbacRef.roles, role_permissions: rbacRef.role_permissions,
  user_roles: rbacRef.user_roles, resource_grants: [], revisions: [],
  articles,
};

const dest = path.join(THEME, 'tdli-demo-data.json');
writeFileSync(dest, JSON.stringify(out, null, 1));

const byCat = {};
for (const a of articles) byCat[a.category_id] = (byCat[a.category_id] ?? 0) + 1;
console.log(`分类 ${categories.length} · 菜单 ${menus.length} · 文章 ${articles.length} · 配置 ${system_config.length}`);
console.log(`焦点图(is_top 且有封面) ${articles.filter(a => a.is_top && a.thumbnail).length}`);
console.log(`空栏目 ${categories.filter(c => !byCat[c.id]).map(c => c.slug).join(', ') || '无'}`);
console.log(`→ ${dest}  (${(JSON.stringify(out).length / 1024 / 1024).toFixed(2)} MB)`);
