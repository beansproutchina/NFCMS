import { createI18n } from 'vue-i18n';

const messages = {
  en: {
    system: { title: "NFCMS", dashboard: "Overview", content: "Content", systemProps: "System", articles: "Articles", schemas: "Schemas", settings: "Settings" },
    action: { new: "New", edit: "Edit", delete: "Delete", save: "Save", saveDraft: "Save Draft", publish: "Publish", confirmDelete: "Are you sure you want to delete this?", search: "Search..." },
    form: { title: "Title", slug: "Slug", status: "Status", date: "Date", actions: "Actions", urlSlug: "URL Slug", excerpt: "Excerpt" },
    dashboard: { welcome: "Welcome", overviewPrefix: "Here's an overview of your setup.", totalArticles: "Total Articles", schemasActive: "Schemas Active" },
    auth: { logout: "Logout" },
    front: { home: "Home", readMore: "Read More", back: "Back to Home", publishedOn: "Published on", by: "By" }
  },
  zh: {
    system: { title: "NFCMS", dashboard: "主页概览", content: "内容管理", systemProps: "系统设置", articles: "文章", schemas: "模型字典", settings: "站点配置" },
    action: { new: "新建", edit: "编辑", delete: "删除", save: "保存", saveDraft: "存为草稿", publish: "发布", confirmDelete: "您确定要删除此项吗？", search: "搜索..." },
    form: { title: "标题", slug: "固定链接", status: "状态", date: "日期", actions: "操作", urlSlug: "URL 固定链接", excerpt: "摘要" },
    dashboard: { welcome: "欢迎回来", overviewPrefix: "这里是您当前站点的鸟瞰视图。", totalArticles: "文章总数", schemasActive: "激活的模型数" },
    auth: { logout: "退出登录" },
    front: { home: "首页", readMore: "阅读全文", back: "返回首页", publishedOn: "发布于", by: "作者：" }
  }
};

const i18n = createI18n({
  legacy: false,
  locale: navigator.language.startsWith('zh') ? 'zh' : 'en',
  fallbackLocale: 'en',
  messages,
});

export default i18n;
