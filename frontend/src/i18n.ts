import { createI18n } from 'vue-i18n';

const messages = {
  en: {
    system: { title: "NFCMS",visitSite: "Visit Site",  dashboard: "Overview", content: "Content", systemProps: "System", menus: "Menus", categories: "Categories", articles: "Articles", schemas: "Schemas", settings: "Settings", users: "Users", files: "Files Library", loading: "Loading...", noEntries: "No entries found." },
    action: { cancel: "Cancel", new: "New", edit: "Edit", delete: "Delete", save: "Save", saveDraft: "Save Draft", publish: "Publish", confirmDelete: "Are you sure you want to delete this?", search: "Search...", generate: "Generate", addRootItem: "Add Root Item", addSub: "Sub", restart: "Restart Backend", upload: "Upload" },
    form: { name: "Name", parent_id: "Parent Category", none: "None", list_template: "List Template", extraData: "Metadata (JSON)", title: "Title", slug: "Slug", status: "Status", date: "Date", actions: "Actions", urlSlug: "URL Slug", excerpt: "Excerpt", description: "Description", category_id: "Category", content_template: "Template", visible: "Visible", is_top: "Top", weight: "Weight", published: "Published", draft: "Draft", selectCategory: "Select Category", locationKey: "Location Key", generateRecursively: "Generate from Category", generateDesc: "Automatically fetch subcategories to build nested menu.", menuItems: "Menu Items (Tree)", customUrl: "Custom URL", category: "Category", article: "Article", selectArticle: "Select Article", label: "Label", url: "URL (e.g. /about)", username: "Username", password: "Password", role: "Role", leaveBlankToKeep: "Leave blank to keep unchanged", admin: "Admin", superadmin: "Super Admin", site_name: "Site Name", subtitle: "Subtitle", icp_record: "ICP Record", mourning_mode: "Mourning Mode" },
    dashboard: { welcome: "Welcome", overviewPrefix: "This is your system dashboard. Keep track of your site data at a glance.", totalArticles: "Total Articles", schemasActive: "Active Schemas", totalCategories: "Total Categories", totalFiles: "Media Files", totalUsers: "Admins", recentArticles: "Recent Content", quickActions: "Quick Actions", systemStatus: "System Status" },
    auth: { logout: "Logout", signIn: "Sign In", useId: "Use your NFCMS ID.", username: "Username", password: "Password", loginFailed: "Login failed", loginSuccess: "Login Successful", fieldsRequired: "All fields are required." },
    front: { home: "Home", readMore: "Read More", back: "Back to Home", publishedOn: "Published on", by: "By" },
    article: { properties: "Properties" },
    menu: { },
    user: { new: "New User" }
  },
  zh: {
    system: { title: "NFCMS", visitSite: "访问站点", dashboard: "仪表盘", content: "内容管理", systemProps: "系统设置", menus: "菜单管理", categories: "分类管理", articles: "文章管理", schemas: "模型字典", settings: "站点配置", users: "用户管理", files: "文件库", loading: "加载中...", noEntries: "未找到任何条目。" },
    action: { cancel: "取消", new: "新建", edit: "编辑", delete: "删除", save: "保存", saveDraft: "存为草稿", publish: "发布", confirmDelete: "您确定要删除此项 吗？", search: "搜索...", generate: "生成", addRootItem: "添加根节点", addSub: "添加子项", restart: "重启后端", upload: "上传文件" },
    form: { name: "名称", parent_id: "上级分类", none: "无 (根节点)", list_template: "列表模板", extraData: "元数据 (JSON)", title: "标题", slug: "固定链接", status: "状态", date: "日期", actions: "操作", urlSlug: "URL 固定链接", excerpt: "摘要", description: "概述/描述", category_id: "分类目录", content_template: "渲 染模板", visible: "可见状态", is_top: "置顶", weight: "排序权重", published: "已发布", draft: "草稿", selectCategory: "请选择分类", locationKey: "挂载位置(如header)", generateRecursively: "从分类递归生成", generateDesc: "自动提取选定分类及 其子分类构建结构", menuItems: "菜单项 (树形结构)", customUrl: "自定义链接", category: "分类目录", article: "文章内容", selectArticle: "选择文章", label: "标签名", url: "链接地址", username: "用户名", password: "密码", role: "权限角色", leaveBlankToKeep: "在此留空则不修改密码", admin: "文章管理员", superadmin: "超级管理员", site_name: "网站名称", subtitle: "副标题", icp_record: "备案号", mourning_mode: "哀悼模式" },
    dashboard: { welcome: "欢迎回来", overviewPrefix: "这是您的系统仪表盘，快速掌控站点的各项数据动态。", totalArticles: "内容文章数", schemasActive: "注册模型数", totalCategories: "分类库区总计", totalFiles: "媒体附件规模", totalUsers: "站务管理员数", recentArticles: "最新发布记录", quickActions: "工作台入口", systemStatus: "关键服务运行" },
    auth: { logout: "退出登录", signIn: "登录", useId: "使用您的 NFCMS ID登录。", username: "用户名", password: "密码", loginFailed: "登录失败", loginSuccess: "登录成功", fieldsRequired: "所有字段都是必填的。" },
    front: { home: "首页", readMore: "阅读全文", back: "返回首页", publishedOn: "发布于", by: "作者：" },
    menu: {},
    article: { properties: "文章属性" },
    user: {  new: "新建管理员" }
  }
};

const i18n = createI18n({
  legacy: false,
  locale: navigator.language.startsWith('zh') ? 'zh' : 'en',
  fallbackLocale: 'en',
  messages,
});

export default i18n;
