# 模式与坑位(可直接抄)

## Markdown 正文
内容是 Markdown,**必须渲染**,否则页面显示源码。
```ts
import { marked } from 'marked';
const rendered = computed(() => (article?.content ? (marked.parse(article.content) as string) : ''));
// 模板:<div class="prose" v-html="rendered"></div>
```
⚠ 全站 `v-html` **未消毒**(已知存储型 XSS 面)。上线前接 DOMPurify 或后端消毒。

## 链接:真 `<a href>` + 全局 SPA 委托
一律用 `<a :href="url">`,**不要**用 `@click="router.push"` 配 button/div(那样丢 SEO、右键新标签、无障碍)。前台根容器 `DynamicView` 有全局委托:内部链接左键 → SPA 导航(不整页刷新);外链 / `mailto:` / `tel:` / `target=_blank` / 带修饰键(⌘/Ctrl/中键)→ 交给浏览器。文章链接:
```ts
const articleUrl = (a:any) => (a?.category?.slug ? `/a/${a.category.slug}/${a.slug}` : `/a/${a?.slug}`);
```

## 分页 composable(`lib.ts`)
prefetch 出首屏(page 0)+ `$meta` 拿总数,翻页再客户端拉。`PAGE_SIZE` **必须等于** theme.config 里该 prefetch 的 `limit`。
```ts
import { ref, computed } from 'vue';
export const formatDate = (s:string) => { if(!s) return ''; const d=new Date(s); const p=(n:number)=>String(n).padStart(2,'0'); return `${d.getFullYear()}.${p(d.getMonth()+1)}.${p(d.getDate())}`; };
export function useArticleList(context:any, pageSize:number){
  const categoryId = context?.category?.id, api = context?.api;
  const items = ref<any[]>(context?.articles || []);
  const total = ref<number>(context?.$meta?.articles?.total ?? items.value.length);
  const page = ref(0), loading = ref(false);
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));
  const load = async (p:number) => {
    if(!categoryId || !api?.contentAPI) return;
    loading.value = true;
    try {
      const res = await api.contentAPI.listArticles({ filter:{category_id:categoryId}, orderBy:'published_at', orderDesc:true, page:p, limit:pageSize });
      items.value = res.data || []; total.value = res.total ?? items.value.length; page.value = p;
    } catch { items.value = []; } finally { loading.value = false; }
  };
  const goPage = (p:number) => { load(p); if(typeof window!=='undefined') window.scrollTo({top:0,behavior:'smooth'}); };
  return { items, total, page, loading, totalPages, goPage };
}
```

## 首页分区自动发现(零配置)
按模板名找到约定分类,无则该区不渲染;精选取 `is_top` 且回退最新:
```ts
const worksCat = computed(() => (categories||[]).find((c:any)=>c.list_template==='WorkGrid'));
// onMounted: 先 filter {category_id, is_top:1};若空再退 {category_id} 最新
```
"最新动态"可用首页已 prefetch 的 `articles`(全站最新)剔除 works/services/team 分类后取前 N,免二次请求。

## theme_<name>_* 配置
`configSchema` 声明 → 后端放行 `theme_<name>_*` → 后台"设置 → 主题设置"动态渲染表单。模板读 `config.theme_<name>_x`;**空则隐藏该元素,绝不显示假数据**(如页脚地址、Logo、二维码、社交图标)。自定义路由页所需 slug 也走配置(如 `theme_<name>_about_slug`,默认 `about`),模板 `onMounted` 用 `context.api.contentAPI.getArticle(slug)` 取正文。

## 字体
展示字体在 `init()` 里加载(判重后插 `<link rel=stylesheet>`),否则 CSS 引用的字体全靠系统兜底,粗野/编辑风塌陷。参考 `neo`/`cosmos_love` 的 `init`。

## 社交图标
做一个 `components/Socials.vue`,从 `config.theme_<name>_social_*` 读出各平台链接,渲染内嵌 SVG 图标(`currentColor`),header/footer/about/contact 复用。空的不渲染。

## mailto 联系表单(无后端提交接口)
```ts
const send = () => {
  if(!email.value) return;
  const subject = `来自 ${form.name||'访客'} 的咨询`;
  const body = `姓名: ${form.name}\n邮箱: ${form.email}\n\n${form.message}`;
  window.location.href = `mailto:${email.value}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};
```
收件地址取 `config.theme_<name>_contact_email`;未配置则禁用提交并提示去后台填。

## v-for 索引类型
对 `any` 数组 `v-for="(x,i) in arr"`,`i` 是 `string|number`;做比较/算术要 `Number(i)`(如面包屑 `Number(i) < breadcrumbs.length-1`、轮播 `go(Number(i))`),否则 `vue-tsc --noCheck false` 报 TS2365/TS2345。

## 面包屑
```html
<a href="/">首页</a>
<template v-for="(c,i) in breadcrumbs" :key="c.id">
  <span class="sep">/</span>
  <a v-if="Number(i) < breadcrumbs.length-1 && !c.disabled" :href="`/a/${c.slug}`">{{ c.name }}</a>
  <span v-else class="current">{{ c.name }}</span>
</template>
```

---

## 坑位 —— 按根因分类(记住"心法"才能触类旁通)

### A. 数据形态:后端给的 ≠ 你以为的 —— 用前先核对真实返回
心法:**渲染不对 / 出现 `[object Object]` / 数字对不上 / 分页丢了,先去核后端真实结构,别猜、别用一堆 `??` 兜。**
- `article.content` 是 **Markdown 源码**(非 HTML)→ 必须 `marked.parse` 再 `v-html`。
- `article.author` 是**对象**(nickname/username),不是字符串;`views/source/department` 等**不存在** → 要就放进 `article.data` 并在分类 `article_data_fields` 声明。
- prefetch 只把 `res.data` 存进 `context[key]`;分页 `total/pages` 在 `context.$meta[key]`。`PAGE_SIZE` 必须 == prefetch 的 `limit`。

### B. 空数据处理:约定 + 隐藏 > 兜底塞内容
心法:**每个展示位都问"没有数据时长什么样";答案应是"隐藏 / 明确空态",不是"抓点别的顶上"。**
- 配置/字段为空 → **隐藏该元素**,不显示假地址、假图、占位文案。
- 分区/栏目按分类**自动发现**,缺了就不渲染;别写死"新闻/通知"这种假设。
- ⚠ **反面教材**:"焦点图没有置顶文章,就回退拿最新文章顶上"。这是把**配置缺失伪装成正常**,反而把不相关内容推上 banner —— 比空着更像事故。正确做法是**约定优于兜底**:需要置顶才亮的位,交付时直接告诉客户"必须设置置顶,否则此区留空",无置顶就**干净地隐藏**。空态可预期、可排查;错内容不可预期、像 bug。兜底只用于"少了也语义正确"的场景(如无副标题就不显示),不用于"拿 A 冒充 B"。

### C. 导航:SPA 内一切走路由,别触发整页/越权行为
心法:**"点了闪一下 / 滚动位置怪 / 匿名 403",先想是不是绕开了 SPA 或权限边界。**
- 内部链接用真 `<a href>`,靠 `DynamicView` 全局委托走 SPA;**别** `@click=router.push`+button(丢 SEO/新标签),也别让它整页跳转。
- 路由需配 `scrollBehavior`(前进置顶 / 后退恢复);模板内翻页自己 `window.scrollTo`。
- 公开站只打 `/api/content/*`;直接打 `/api/articles` 会被 RBAC 匿名 403。

### D. 工程 / 工具:改对地方、检查到位
心法:**"改了没效果 / build 过了却出问题",先确认改对文件、用对检查命令。**
- 改 `frontend_themes/<name>/` **真源**,不是 dev 槽位(软链下同一份;别手写槽位)。
- 类型检查必须 `npx vue-tsc --noEmit -p tsconfig.app.json --noCheck false` —— `npm run build` 的 `vue-tsc` 带 `noCheck:true`,**不检查主题类型**,过了不代表没类型错。
- `v-for="(x,i) in 任意any数组"` 的 `i` 是 `string|number`,比较/算术要 `Number(i)`。
- 展示字体在 `init()` 里加载,否则 CSS 引用的字体全塌回系统字体。

### E. 演示数据 / 导入:按插入序自增,失败多因数据形态
心法:**`import failed [articles] id=…` 先看后端日志的报错原因,十有八九是日期或类型不对。**
- `publish_at` 用**真 `null`**(非字符串 `"null"`);`category_id` 数字;`content` 字符串;`data`/`items`/`article_data_fields` 是对象数组(**别** JSON 字符串化)。
- id 从 1 连续、引用(category_id/refId/resource_id)对齐插入序、**articles 最后导入**、RBAC 表原样复用(见 demo-data 章)。
- 测导入用**一次性库**并**还原**:`cp data/test.db{,.bak}` → `rm data/test.db*` → 导入 → 冒烟 → 还原。重启后端前先 `pkill -9 -f "index.ts"; lsof -ti tcp:3000 | xargs kill -9`(否则 SQLite 双开 → 假 403/IO 错等幻象,见 CLAUDE.md 坑 1/2)。

## 命令速查
```bash
cd frontend
npm run theme:use <name>     # 软链激活目标主题(改的就是 frontend_themes/<name>/)
npm run dev                  # vite,已代理 /api /static 到 :3000
npx vue-tsc --noEmit -p tsconfig.app.json --noCheck false   # 真·类型检查(务必)
npm run build                # vue-tsc -b(noCheck) && vite build
# 后端测导入(先备份/杀端口):
cd ../backend && cp data/test.db{,.bak}; pkill -9 -f "index.ts"; lsof -ti tcp:3000 | xargs kill -9; ~/.bun/bin/bun index.ts
```
