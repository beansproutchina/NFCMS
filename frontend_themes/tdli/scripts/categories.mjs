/**
 * tdli 的栏目树 —— 与 tdli.sjtu.edu.cn 的导航一一对应。
 *
 * 数组顺序**就是导入后的 id 顺序**(导入按数组下标自增),所以父栏目必须排在子栏目前面。
 * 英文树由 `enTree()` 从这里派生:slug 统一加 `en-` 前缀(slug 全局唯一,中英必须区分),
 * 并按原站的差异裁剪 —— 英文站没有「党建工作」和「招生信息」,多一个 Study at TDLI。
 */

/** 各类内容的自定义字段。`section` 不在此列:它是派生值,由后端钩子维护。 */
export const FIELDS = {
  post: {
    tag: { title: '列表标签(如「李所新闻」)', type: 'text' },
    external_url: { title: '外部链接(填了则列表直接跳转,不进详情页)', type: 'text' },
  },
  announcement: {
    department: { title: '发文单位', type: 'text' },
    doc_number: { title: '发文字号', type: 'text' },
  },
  event: {
    start_dt: { title: '开始时间(ISO,如 2026-08-26T14:00:00Z)', type: 'text' },
    end_dt: { title: '结束时间', type: 'text' },
    venue: { title: '地点', type: 'text' },
    person: { title: '主讲人(含单位)', type: 'text' },
    event_type: { title: '活动类型 seminars|workshops|schools', type: 'text' },
    division: { title: '研究部缩写 AA|CM|PN', type: 'text' },
    indico_url: { title: 'Indico 链接', type: 'text' },
  },
  person: {
    name_en: { title: '英文姓名', type: 'text' },
    job: { title: '职称', type: 'text' },
    organize_desc: { title: '所属研究部', type: 'text' },
    email: { title: '邮箱', type: 'text' },
    office_phone: { title: '电话', type: 'text' },
    postal_address: { title: '办公室', type: 'text' },
    web_site: { title: '个人主页', type: 'text' },
    avatar: { title: '照片', type: 'text' },
    education: { title: '教育背景(Markdown 列表)', type: 'textarea' },
    experience: { title: '工作经历', type: 'textarea' },
    research: { title: '研究方向', type: 'textarea' },
    honors: { title: '荣誉信息', type: 'textarea' },
    publications: { title: '代表性论文专著', type: 'textarea' },
  },
  guide: { url: { title: '目标地址', type: 'text' } },
};

const T = (list, content, fields) => ({ list, content, fields });
const NEWS   = T('NewsList', 'DefaultArticle', FIELDS.post);
const ANN    = T('AnnouncementList', 'DefaultArticle', FIELDS.announcement);
const EVENT  = T('EventList', 'EventArticle', FIELDS.event);
const PEOPLE = T('PeopleGrid', 'PersonPage', FIELDS.person);
const PAGE   = T('PageArticle', 'DefaultArticle', null);
const GUIDE  = T('DefaultCategory', 'DefaultArticle', FIELDS.guide);

/**
 * 中文栏目树。`en` 是英文树里对应的名字,`enSkip` 表示英文站没有这一项。
 * `nav` 决定它进哪个菜单:header 主导航 / top 顶栏 / 不进导航(留空)。
 */
export const TREE = [
  // `indexLabel`:该栏目「总入口」在左侧菜单里的名字(原站 people 叫「人员名录」、events 叫「全部」)。
  // 它指向父栏目自己 —— 父栏目页按 `data.section` 聚合整棵子树,本来就是"全部"。
  { slug: 'posts', name: '新闻动态', en: 'News', nameEn: 'news information', indexLabel: '全部', indexLabelEn: 'All', ...NEWS, nav: '', children: [
    { slug: 'posts-research', name: '科学探索', en: 'Research Highlights', ...NEWS },
    { slug: 'posts-outreach', name: '科普公益', en: 'Outreach', ...NEWS },
    { slug: 'posts-institute', name: '李所新闻', en: 'Institute News', ...NEWS },
    { slug: 'posts-party', name: '党群工作', en: 'Party Affairs', enSkip: true, ...NEWS },
    { slug: 'posts-newsletter', name: '季度简报', en: 'Newsletter', ...NEWS },
    { slug: 'posts-media', name: '媒体聚焦', en: 'Media Coverage', ...NEWS },
  ] },
  { slug: 'announcements', name: '通知公告', en: 'Notice', nameEn: 'announcements', ...ANN, nav: '', children: [] },

  { slug: 'about', name: '关于李所', en: 'About', nameEn: 'about', ...PAGE, nav: 'header', children: [
    { slug: 'about-overview', name: '研究所简介', en: 'Overview', ...PAGE },
    { slug: 'about-directors', name: '所长专栏', en: 'Directors', ...PAGE },
    { slug: 'about-organization', name: '组织架构', en: 'Organization', ...PAGE },
    { slug: 'about-reports', name: '年报&简报', en: 'Annual Reports & Newsletters', ...PAGE },
    { slug: 'about-gallery', name: '视觉李所', en: 'Gallery', ...PAGE },
  ] },
  { slug: 'people', name: '人才队伍', en: 'People', nameEn: 'people', indexLabel: '人员名录', indexLabelEn: 'Directory', ...PEOPLE, nav: 'header', children: [
    { slug: 'people-fellows', name: '学者系列', en: 'Fellows & Professors', ...PEOPLE },
    { slug: 'people-scientists', name: '研究员系列', en: 'Scientists', ...PEOPLE },
    { slug: 'people-engineers', name: '工程师系列', en: 'Engineers', ...PEOPLE },
    { slug: 'people-postdocs', name: '博士后', en: 'Postdocs', ...PEOPLE },
    { slug: 'people-platform', name: '平台学者', en: 'Platform Fellows', ...PEOPLE },
    { slug: 'people-visiting', name: '访问学者', en: 'Visiting Scholars', ...PEOPLE },
  ] },
  { slug: 'research', name: '科学研究', en: 'Research', nameEn: 'research', ...PAGE, nav: 'header', children: [
    { slug: 'research-aa', name: '天文与天体物理研究部', en: 'Astronomy and Astrophysics Division', ...PAGE },
    { slug: 'research-cm', name: '凝聚态物理研究部', en: 'Condensed Matter Division', ...PAGE },
    { slug: 'research-pn', name: '粒子与核物理研究部', en: 'Particle and Nuclear Physics Division', ...PAGE },
    { slug: 'research-tech', name: '工程技术部', en: 'Technical Division', ...PAGE },
    { slug: 'research-platforms', name: '研究平台和前进基地', en: 'Research Platforms and Detection Bases', ...PAGE },
  ] },
  { slug: 'events', name: '学术活动', en: 'Events', nameEn: 'events', indexLabel: '全部', indexLabelEn: 'All', ...EVENT, nav: 'header', children: [
    { slug: 'events-seminars', name: '学术报告', en: 'Seminars & Colloquia', ...EVENT },
    { slug: 'events-workshops', name: '学术会议', en: 'Workshops, Forums & Conferences', ...EVENT },
    { slug: 'events-schools', name: '夏季/冬季学校', en: 'Schools & Programs', ...EVENT },
  ] },
  { slug: 'grad-students', name: '人才培养', en: 'Grad Students', nameEn: 'grad students', ...PAGE, nav: 'header', children: [
    { slug: 'grad-notice', name: '通知公告', en: 'Notice', ...ANN },
    { slug: 'grad-enrollment', name: '招生信息', en: 'Enrollment', enSkip: true, ...PAGE },
    { slug: 'grad-program', name: '培养工作', en: 'Program', ...PAGE },
    { slug: 'grad-supervisors', name: '导师名单', en: 'Supervisor Directory', ...PAGE },
    { slug: 'grad-activities', name: '学生活动', en: 'Activities', ...NEWS },
  ] },
  { slug: 'outreach', name: '科普公益', en: 'Outreach', nameEn: 'outreach', ...NEWS, nav: 'header', children: [
    { slug: 'outreach-lecture', name: '公众报告', en: 'Public Lecture', ...NEWS },
    { slug: 'outreach-column', name: '科普专栏', en: 'Science Column', ...NEWS },
    { slug: 'outreach-news', name: '活动新闻', en: 'News', ...NEWS },
    { slug: 'outreach-signup', name: '活动报名', en: 'Announcements', ...ANN },
  ] },
  { slug: 'dangjian', name: '党建工作', en: '', enSkip: true, nameEn: 'party affairs', ...PAGE, nav: 'header', children: [
    { slug: 'dangjian-org', name: '党组织概况', en: '', enSkip: true, ...PAGE },
    { slug: 'dangjian-study', name: '理论学习', en: '', enSkip: true, ...PAGE },
    { slug: 'dangjian-guide', name: '党务指南', en: '', enSkip: true, ...PAGE },
    { slug: 'dangjian-news', name: '党建动态', en: '', enSkip: true, ...NEWS },
  ] },
  { slug: 'service-guide', name: '服务指南', en: 'Guide', nameEn: 'service guide', ...PAGE, nav: 'header', children: [
    { slug: 'service-rules', name: '规章制度', en: 'Rules', ...PAGE },
    { slug: 'service-benefits', name: '工会动态', en: 'Employee Benefits', ...NEWS },
    { slug: 'service-work', name: '工作指南', en: 'Work Guide', ...PAGE },
    { slug: 'service-visiting', name: '访问学者指南', en: 'For Visiting Scholars', ...PAGE },
    { slug: 'service-downloads', name: '下载中心', en: 'Downloads', ...PAGE },
  ] },

  { slug: 'join-us', name: '加入我们', en: 'Join Us', nameEn: 'join us', ...PAGE, nav: 'top', children: [] },
  { slug: 'support-us', name: '支持我们', en: 'Support Us', nameEn: 'support us', ...PAGE, nav: 'top', children: [] },

  // 首页「快速指南」的数据源。不进导航,只被首页按 section 取。
  { slug: 'quick-guide', name: '快速指南', en: 'Guide', nameEn: 'quick guide', ...GUIDE, nav: '', children: [] },

  // 英文站独有(中文站没有这一栏)
  { slug: 'study', name: '', en: 'Study at TDLI', nameEn: 'study', zhSkip: true, ...PAGE, nav: 'header', children: [
    { slug: 'study-degree', name: '', en: 'Degree Students', zhSkip: true, ...PAGE },
    { slug: 'study-visiting', name: '', en: 'Visiting Students', zhSkip: true, ...PAGE },
    { slug: 'study-resources', name: '', en: 'Shared Resources', zhSkip: true, ...PAGE },
    { slug: 'study-policies', name: '', en: 'Policies & Regulations', zhSkip: true, ...PAGE },
  ] },
];
