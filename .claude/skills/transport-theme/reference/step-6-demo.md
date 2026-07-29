# 第 6 步 · 生成初始化 demo json — 子 agent 执行说明

## 目标
产出一份**开箱即用**的初始化数据 `frontend_themes/<name>/<name>-demo-data.json`,让人 `/setup → 导入数据` 装上即见主题**所有页面/分区/配置都有内容**;并在全新库上**实测导入 + 抽查 + 还原**。

## 输入(编排器传入)
已开发完成的主题 + 设计文档里的分类约定 / `article.data` 字段 / `theme_<name>_*` 配置 / 菜单约定。

## 顶层 JSON 结构(与 NFCMS 导出一致)
```jsonc
{
  "_meta": { "version":"1.0", "exportedAt":"<固定 ISO>", "generator":"NFCMS" },   // generator 必须是 NFCMS
  "system_config": [ { "id","configkey","configvalue" } ],
  "categories":    [ { "id","name","slug","parent_id","list_template","content_template","weight","article_data_fields","data" } ],
  "menus":         [ { "id","name","location","items":[{ "label","url","type","refId","children":[] }] } ],
  "articles":      [ { "id","title","slug","author_id","description","thumbnail","content","content_template",
                       "status","publish_at","rev_version","is_top","category_id","published_at","created_at","updated_at","data" } ],
  "roles":[...], "role_permissions":[...], "user_roles":[...], "users":[...],   // ← 从已有 export 原样复用
  "attachments":[], "revisions":[], "resource_grants":[], "schemas":[]
}
```

## 导入机制铁律(错一条就导不进 / 关系错乱)
- 导入**剥掉 id**、按数组顺序自增 → **id 从 1 连续**,且引用(`article.category_id`、`menu refId`、`resource_grant.resource_id`)必须对上插入顺序产生的 id。
- **导入顺序**:system_config → categories → users → menus → … → **articles 最后**(分类先就位)。生成时按此排。
- **users/roles/role_permissions 从一份已有 export 原样复用**(带可登录 admin;密码 AES 封装、导入端解密,同实例 salt 才能登录)。本仓可复用 `frontend_themes/school/demo-admin-admin123.json`(admin/admin123)。
- `publish_at` 用**真 `null`**(非字符串 `"null"`,否则 `new Date("null")`=Invalid Date,整篇失败)。
- `category_id` 数字;`content` 是 Markdown 字符串;`data`/`article_data_fields`/`menu.items`/分类 `data` 是**对象/数组**(别 JSON 字符串化)。
- `system_config` 只放 `VALID_CONFIG_KEYS` ∪ `theme_<name>_*`;别塞非法键。
- **数据要覆盖到每个页面/分区**:每个约定分类文章数 **> 分页 limit**(演示翻页);`article.data` 字段填全;`theme_<name>_*` 全给值;菜单四类 location 按需给;自定义路由页依赖的 slug 文章(如 `about`)别漏。
- **首页焦点图等"需置顶才亮"的区**:demo 里就**给足 `is_top:1` 且 `thumbnail` 非空**的文章,让默认状态就好看(主题侧不做"抓最新顶上"的兜底,数据侧把该配的配上)。
- 图片占位 `https://mockimg.dev/600x400/CCCCCC/66CCFF.png`代表600x400、背景色cccccc、前景色66ccff的占位图片。文案"无意义但贴合场景"。

## 生成器骨架(bun/node —— 别手搓几十篇)
```js
import { readFileSync, writeFileSync } from 'node:fs';
const ref = JSON.parse(readFileSync(process.argv[2], 'utf8'));      // 复用 RBAC 的已有 export
const IMG = (w=800,h=600) => `https://mockimg.dev/${w}x${h}/CCCCCC/66CCFF.png`;
const D = (s) => new Date(s).toISOString();
const system_config = [ /* {configkey,configvalue} ... 每个 theme_<name>_* 给值 */ ].map((r,i)=>({id:i+1,...r}));
const catDefs = [ /* {name,slug,weight,list_template,content_template,data,(parentSlug?)} 顺序即 id 顺序 */ ];
const categories=[], catId={};
catDefs.forEach((c,i)=>{ const id=i+1; catId[c.slug]=id; categories.push({ id,name:c.name,slug:c.slug,
  parent_id: c.parent_id ?? (c.parentSlug?catId[c.parentSlug]:0), list_template:c.list_template,
  content_template:c.content_template, weight:c.weight, article_data_fields:c.article_data_fields||null, data:c.data||null }); });
const menus = [ /* {id,name,location,items:[{label,url,type,refId,children}]}  location: header/top/quicklinks/footer */ ];
const articles=[]; let aid=0;
const push=(o)=>{ aid++; articles.push({ id:aid,title:o.title,slug:o.slug,author_id:'1',description:o.description||'',
  thumbnail:o.thumbnail||'',content:o.content||'',content_template:'',status:'visible',publish_at:null,rev_version:0,
  is_top:o.is_top||0,category_id:o.category_id,published_at:D(o.date),created_at:D(o.date),updated_at:D(o.date),data:o.data||null }); };
// …为每个分类 push 足量文章;焦点图区的分类给几篇 is_top:1+thumbnail;各类 data 字段填全;自定义路由依赖的 slug 别漏
const out = { _meta:{version:'1.0',exportedAt:'<固定 ISO>',generator:'NFCMS'}, system_config,categories,menus,articles,
  roles:ref.roles,role_permissions:ref.role_permissions,user_roles:ref.user_roles,users:ref.users,
  attachments:[],revisions:[],resource_grants:[],schemas:[] };
writeFileSync(process.argv[3], JSON.stringify(out,null,2));
```
> 别用 `Date.now()`/`Math.random()` 当 id/时间;时间用固定 ISO 串。落盘到 `frontend_themes/<name>/<name>-demo-data.json`。

## 实测导入 + 验证 + 还原(务必,CLAUDE.md 坑 1/2)
```bash
cd backend
cp data/test.db{,.bak}
pkill -9 -f "index.ts"; lsof -ti tcp:3000 | xargs kill -9; sleep 1
rm -f data/test.db data/test.db-wal data/test.db-shm      # 全新未初始化库
~/.bun/bin/bun index.ts & sleep 4
# POST /api/system/setup  body={ importData: <demo json> }
#   断言返回 data 里每张表 imported>0 && failed==0
# 抽查:GET /api/content/home、/content/category?slug=…、/content/article?slug=…、
#      /content/articles?filter={"is_top":1}(焦点图有 thumbnail)、/system/config(theme_<name>_* 都在)
pkill -9 -f "index.ts"; sleep 1
rm -f data/test.db data/test.db-wal data/test.db-shm
cp data/test.db.bak data/test.db && rm data/test.db.bak   # 还原用户库
```
`articles failed>0` → 看后端日志 `Import failed [articles] id=…`,最常见是 `publish_at:"null"` 或日期非法。

## 产出与门禁
把 demo 文件路径 + 导入方式(`/setup → 导入数据`,仅未初始化实例可用)交回编排器告知用户。**主题代码 + 这份 demo = 从零可复现的完整主题**,至此流水线交付完成。
