# 管理后台设计系统重构 — 待评审清单

审计范围:`frontend/src/views/admin` · `views/setup` · `components` · `ui/presets.ts`,共 **29 个文件**。
(不含 `views/front/templates` —— 那是主题软链,主题有自己的令牌体系,单独处理。)

---

## 0. 结论摘要

三层问题是**同一个根因**:抽象层欠定义,所以所有人各自即兴发挥。

- 第 3 层(最严重):**676 处**裸字面值。其中 **60 处是「已有 token 却写 hex」** —— 毫无借口的重复。
- 第 2 层:**29 处**原生表单元素。多数不是「懒」,而是 presets 里**没有对应的东西**(没有磁贴、tab、图标按钮、卡片、徽章)。
- 第 1 层:**6 处**重复硬写 preset 内容。它是前两层的副产物,规模最小。

`ui/presets.ts` 自己就在犯第 3 层的病:`FIELD_BASE` 里是 `text-[14px]`、`rounded-[8px]`、`rgba(0,0,0,0.15)`。**「唯一出处」自己都拿不到 token,因为 token 层根本没有这些东西。**

---

## 1. 现状实测

| 类别 | 处数 | 不同值 | 备注 |
|---|---|---|---|
| 裸 hex | 116 | 25 | **60 处已有 token**(`#f5f5f7`×45→`apple-gray`、`#1d1d1f`×12、`#0066cc`×6、`#0071e3`×5);56 处需新建(20 色) |
| `rgba()` | 234 | 22 | **22 个不同的黑色透明度**(0.03/0.04/0.05/0.06/0.08/0.1/0.12/0.15/0.2/0.3/0.35/0.4/0.45/0.48/0.5/0.55/0.6/0.7/0.8/0.9 + 2 个非黑) |
| `text-[Npx]` | 208 | 15 | 14px×98 · 13px×34 · 12px×32 · 17px×12 · 40px×12 · 21px×7 · 15px×7 · 其余 8 种共 17 处 |
| `rounded-[Npx]` | 89 | 8 | 8px×51 · 12px×23 · 6px×5 · 16px×4 · 980px×3 · 5/10/11px 各 2 |
| 其他 `[Npx]` 尺寸 | 29 | 18 | 多为一次性宽度(`w-[200px]` 等) |
| 原生 `<button>` | 21 | — | Dashboard 6 · Editor 3 · AclEditor 3 · SetupWizard 2 · Roles 2 · 其余 5 |
| 原生 `<input>` | 7 | — | **其中 2 处 `type="file"` 是合理的**(PrimeVue 无对应,且是隐藏 input);3 处 checkbox 应换 PrimeVue |
| 原生 `<textarea>` | 1 | — | `Settings.vue:334`,已用 `INPUT_CLASS` 但元素是原生 |
| 原生 `<select>` | **0** | — | 这一项本来就是干净的 |

`docs/frontend.md` 里**关于设计系统一个字都没有** —— presets 规则只写在 CLAUDE.md,前端开发者查文档查不到。

---

## 2. 自动化能力边界(已实证)

检测与替换交给 Tailwind 自己,不用正则。已落地工具:`frontend/scripts/audit-classes.mjs`。

- **`@tailwindcss/oxide` 的 `Scanner`** 抽取编译器能看到的全部 class 候选(含 `:class` 数组、模板串、`presets.ts` 里的字符串),不会漏。
- **`designSystem.canonicalizeCandidates()`**(语言服务与 Prettier 插件用的同一个 API)把候选改写成规范拼法,正好就是「字面值 → token」。
- **`designSystem.candidatesToCss()`** 用来**证明**改写安全:前后必须编译出逐字节相同的 CSS。若把 `rounded-[8px]` 错配成 `rounded-md`(6px),这一步会报出来。

### 实证得到的三条硬约束

1. **token 必须用自定义名。** `--text-sm: 14px` **不生效**(与 Tailwind 内置 `--text-sm: 0.875rem` 冲突),而 `--text-body: 14px` → `text-[14px]` **自动命中**。圆角、颜色、行高同理。
2. **一个值只能有一个 token。** 同值两个 token 会让规范化随机挑一个。所以命名不是审美问题,是自动化前提。
3. **只匹配精确值。** 定义 `--color-ink-subtle: rgba(0,0,0,0.5)` 不会捕获 `rgba(0,0,0,0.48)`。要归并近似值就得**改值**,那是真视觉变化(哪怕极小),必须你批准 —— 见 §5。

已验证可自动命中的写法:
`rounded-[8px]`→`rounded-field` · `text-[rgba(0,0,0,0.8)]`→`text-ink-strong` · `border-[rgba(0,0,0,0.15)]`→`border-line` · `bg-[#f5f5f7]`→`bg-apple-gray` · `text-[14px]`→`text-body` · `leading-[1.1]`→`leading-tight2`
`--spacing-x: 40px` 一条即可同时覆盖 `h-/w-/p-/gap-[40px]`。

---

## 3. Part A — token 清单(待评审)

### 设计原则:阶数少到能一眼分出轻重

**一套 token 如果替换完还剩一万种分级、分不清谁更重,那它比原来的色号更糟** —— 多了一层间接却没减少认知负担。所以定阶的判据不是「代码里出现过几个值」,而是:

1. **同一族内 ≤ 5 阶,且相邻两阶肉眼可辨。** 分不出来的两阶,合并。
2. **不同 CSS 属性之间不必互相拉开。** `bg-fill`(0.04)与 `border-separator-weak`(0.06)值很近但从不并列比较 —— 一个是底色一个是描边,没有歧义。歧义只发生在**同族之内**。
3. **语义命名,不按数值命名。** `label-3` 表示「第三级文字」,而 `ink-45` 只是把 `rgba(0,0,0,0.45)` 换了个写法。

参照 **Apple HIG** —— 这套 UI 本来就在仿 apple.com(SF Pro、`apple-blue`、`#f5f5f7` 即 Apple systemGray 系)。HIG 的要点正是**它很小**:整个 iOS 的文字只用 label / secondaryLabel / tertiaryLabel / quaternaryLabel **四级**,分隔线两级。

**结果:676 处字面值 → 22 个新 token(+5 个复用现有)。**

### A0 先统一命名规则:去掉 `apple-` 前缀,全部按角色命名

现有 5 个 token 按**品牌**命名(`apple-*`),新增的按**角色**命名(`label` / `separator` / `surface`)。**两套规则混用,同族 token 看不出关系** —— `apple-text-dark` 和 `label-3` 摆在一起没人能看出它们是一族的深浅两端,那这套 token 就白做了。

统一到角色命名。`apple-` 前缀不携带信息(这套 UI 里每个 token 都是 Apple 风格),去掉。

| 现名 | 新名 | 现用量 | 理由 |
|---|---|---|---|
| `apple-text-dark` | **`label`** | 4 | 文字族第一级,与 `label-2/3/4` 同族 |
| `apple-blue` | **`accent`** | **76** | HIG 的 accentColor |
| `apple-link` | **`link`** | 12(+pear 4) | — |
| `apple-gray` | **`canvas`** | 1 | 页面底色 |
| `apple-black` | **删除** | **0** | 死 token,从未被引用 |

顺带发现:`apple-gray` 定义了却**只有 1 处在用**,同时有 **45 处写死 `#f5f5f7`**;`apple-text-dark` 4 处在用、12 处写死 hex。**这些 token 存在但没人认它** —— 只有 `apple-blue` 被真正采纳(76 处)。这反过来印证命名本身就是障碍。

重命名总代价约 **97 处**机械替换(`frontend/src` 93 + pear 4)。`neo` / `school` 为 0;`cosmos_love` 那 1 处是 `-apple-system` 字体栈,与 token 无关。
另:pear 自己又重复定义了一遍 `--color-apple-link`,一并清掉。

### A1 文字 4 级(166 处)

对齐 HIG 的 label 四级。相邻阶差 ≥0.15 不透明度,肉眼可辨。

| token | 值 | 归并自 | 处数 |
|---|---|---|---|
| `label` *(即现 `apple-text-dark`)* | `#1d1d1f` | `#1d1d1f`(12) · `0.9`(7) · **`0.8`(63)** | 82 |
| `label-2` | `rgba(0,0,0,0.6)` | `0.7`(7) · `0.6`(14) · `0.55`(1) | 22 |
| `label-3` | `rgba(0,0,0,0.4)` | `0.5`(22) · `0.48`(2) · `0.45`(10) · `0.4`(23) · `0.35`(1) | 58 |
| `label-4` | `rgba(0,0,0,0.25)` | `0.3`(2) · `0.2`(2) | 4 |

> 主文字色沿用现有那个色值(`#1d1d1f`),只改名 —— 现在 `0.8`(63 处)、`0.9`、`#1d1d1f` 三种写法在表达同一件事。
>
> **命名待你选**:`label-2/3/4`(短,顺序不会看错)还是 HIG 原词 `label-secondary/tertiary/quaternary`(自解释,但 `text-label-quaternary` 有点长)。我倾向前者,在 `style.css` 注释里标注 HIG 对应关系。

### A2 分隔线 2 级(72 处)

| token | 值 | 归并自 | 处数 |
|---|---|---|---|
| `separator` | `rgba(0,0,0,0.12)` | `0.15`(20) · `0.12`(5) · `0.1`(2) | 27 |
| `separator-weak` | `rgba(0,0,0,0.06)` | `0.08`(10) · `0.06`(9) · `0.05`(25) · `0.03`(1) | 45 |

`separator` = 看得见的分界(输入框描边、卡片外框);`separator-weak` = 卡片内部的发丝线。

### A3 填充 1 级(10 处)

| token | 值 | 归并自 | 处数 |
|---|---|---|---|
| `fill` | `rgba(0,0,0,0.04)` | `0.04`(10) | 10 |

hover 时的极淡底色。只有这一档 —— 后台里再没有第二种需求。

### A4 字号 5 级(202 处)

一个清晰的阶梯 **40 / 20 / 17 / 14 / 12**,相邻两阶差 ≥2px。

| token | 值 | 归并自 | 处数 | 用途 |
|---|---|---|---|---|
| `text-title-page` | `40px` | `40`(12) | 12 | 页面大标题 |
| `text-title-section` | `20px` | `21`(7) · `20`(3) · `19`(3) · `18`(3) | 16 | 弹窗/区块标题 |
| `text-title-item` | `17px` | `17`(12) | 12 | 卡片/列表项标题 |
| `text-body` | `14px` | **`14`(98)** · `15`(7) · `16`(1) | 106 | 正文与表单 |
| `text-small` | `12px` | `13`(34) · `12`(32) · `11`(2) | 68 | 说明、徽章、紧凑工具栏 |

一次性大字 `28`(2) · `32`(1) · `56`(2) 共 5 处(Setup 引导页与 Dashboard 数字)保留字面值,进 lint 白名单 —— 为 5 处建 token 不值得。

### A5 圆角 2 级 + 药丸(92 处)

| token | 值 | 归并自 | 处数 | 用途 |
|---|---|---|---|---|
| `radius-control` | `8px` | **`8`(51)** · `6`(5) · `5`(2) · `10`(2) | 60 | 输入框、按钮、徽章 |
| `radius-card` | `12px` | `12`(23) · `11`(2) · `16`(4) | 29 | 卡片、弹窗、面板 |
| `rounded-full` *(内置)* | — | `980`(3) | 3 | 药丸 / 圆形按钮 |

### A6 面 3 级(+ 白,76 处)

对齐 HIG 的 systemBackground 三级。

按**角色**排,不按明度排(白比 canvas 亮,但白是卡片、canvas 是页面底)。

| token | 值 | 角色 | 归并自 | 处数 |
|---|---|---|---|---|
| `white` *(内置)* | `#fff` | 卡片面 | `#ffffff`(1) · `#fff`(1) | 2 |
| `canvas` *(即现 `apple-gray`)* | `#f5f5f7` | 页面底 | **`#f5f5f7`(45)** · `#f3f4f6`(3) | 48 |
| `surface` | `#fafafc` | 卡片内的次级面 / ghost 按钮底 | `#fafafc`(6) · `#f9f9fb`(7) · `#fbfbfd`(2) · `#fafafa`(1) | 16 |
| `surface-hover` | `#e8e8ed` | 上者的 hover | `#e8e8ed`(4) · `#ededf2`(2) · `#ebebeb`(1) | 7 |
| `border-opaque` | `#e5e5e5` | 实色分隔(需盖住底色时) | `#e5e5e5`(4) · `#d2d2d7`(1) | 5 |

> `#f3f4f6` 与 `#f5f5f7` 差不可辨,直接并入 `canvas`。

### A7 品牌与语义色(35 处)

这一族是**分类**而非阶梯 —— warn / info / accent 之间不存在「谁更重」,所以数量不受 ≤5 约束。

| token | 值 | 角色 | 归并自 | 处数 |
|---|---|---|---|---|
| `accent` *(即现 `apple-blue`)* | `#0071e3` | 主色 / 主按钮 / 焦点环 | `#0071e3`(5) | 5 |
| `accent-hover` | `#0077ed` | 主按钮 hover(现在到处硬写) | `#0077ed`(5) | 5 |
| `link` *(即现 `apple-link`)* | `#0066cc` | 文字链接 | `#0066cc`(6) | 6 |
| `warn` | `#c2410c` | 危险动作文字 | `#c2410c`(4) | 4 |
| `warn-bg` | `#fff7ed` | 危险/待发布底 | `#fff7ed`(2) | 2 |
| `info-bg` | `#e0f2fe` | 已发布状态底 | `#e0f2fe`(4) · `#bae6fd`(1) · `#f0f7ff`(1) · `#b3d4fc`(1) | 7 |
| `indigo` | `#3730a3` | 角色徽章字 | `#3730a3`(3) | 3 |
| `indigo-bg` | `#eef2ff` | 角色徽章底 | `#eef2ff`(3) | 3 |

> 角色徽章那对原本我叫 `accent`/`accent-bg`,现改为 `indigo`/`indigo-bg` —— `accent` 已让给主色(HIG 的 accentColor),同名会撞。

### A8 汇总:每族的阶数

| 族 | 阶数 | 是阶梯吗 |
|---|---|---|
| 文字 label | **4** | 是,轻重可辨 |
| 分隔线 separator | **2** | 是 |
| 填充 fill | **1** | — |
| 字号 text | **5** | 是,40/20/17/14/12 |
| 圆角 radius | **2** + full | 是 |
| 面 surface | **4**(含白与 apple-gray) | 是 |
| 品牌/语义 | 8 | 否,分类 |

**新增 token 共 22 个。** 除「品牌/语义」这一分类族外,每族都 ≤5 阶。

---

## 4. Part B — 新增 preset 清单(待评审)

依据是实测的重复聚类,不是我拍脑袋。每条都注明重复次数与出处。

### B1 页面骨架 `PAGE`

| preset | 现有重复 | 出处 |
|---|---|---|
| `PAGE.container` | ×9 `max-w-7xl mx-auto py-10 w-full px-6` | Articles Categories Dashboard DynamicCrud Files Menus Roles Schemas Users |
| `PAGE.title` | ×10 `text-[40px] font-semibold leading-[1.1] tracking-tight mb-2` | 同上 + Settings |
| `PAGE.header` | ×8,**3 种拼法** | `flex justify-between items-end mb-8`×3 / `mb-8 flex justify-between items-end`×2 / 响应式版×3 |

> `PAGE.header` 的 3 种拼法建议统一到响应式那版(`flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 gap-4`),窄屏体验更好。

### B2 表单 `LABEL` / `FIELD`

**同一个「表单标签」有 5 种拼法共 33 处** —— 这是最大的单一重复:

| 拼法 | 次数 | 出处 |
|---|---|---|
| `block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-1` | 14 | CategoryEditor MenuEditor UserEditor |
| `text-[14px] text-[rgba(0,0,0,0.8)] font-medium` | 12 | EditorPanel Settings |
| `text-[14px] text-[rgba(0,0,0,0.8)] px-1 font-medium` | 3 | SetupWizard |
| `block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-2` | 2 | EditorPanel |
| `block text-[14px] font-medium text-[rgba(0,0,0,0.8)]` | 2 | EditorPanel MenuEditor |

→ `LABEL`(带 `mb-1`)+ `LABEL_BARE`(不带间距,给自定义布局用)。
→ `FIELD_GROUP` = `flex flex-col gap-2`(×16,其中 8 处附带 `max-w-lg`)。

### B3 其余 preset

| preset | 依据 | 出处 |
|---|---|---|
| `CARD` | ×3 `bg-white rounded-[12px] shadow-[...] border p-8 mb-6` | Settings(+Editor 侧栏近似) |
| `TILE` | ×4 Dashboard 快捷磁贴 | Dashboard |
| `TOGGLE` | ×2 `px-2.5 h-8 rounded-[8px] text-[13px] border cursor-pointer transition-colors` | AclEditor Roles |
| `BTN.pager` | ×2 分页按钮 | FilePicker UserPicker |
| `BTN.icon` | Files 的圆形图标按钮 ×2 | Files |
| `LINK.action` | ×3 `text-apple-link hover:underline text-[14px] flex items-center cursor-pointer` | Articles Menus Users |
| `LINK.danger` | ×3 同上红色版 | Articles Menus Users |
| `SEARCH` | ×4 图标 + ×4 `[INPUT_CLASS,'pl-9']` | Articles Files FilePicker UserPicker |
| `NAV_ITEM` | ×2 侧边导航项 | admin/Layout |
| `BADGE` | ×2 角色徽章 + Editor 三态 + Articles 状态 | Roles Editor Articles |
| `EMPTY` | ×6,**3 种拼法** | Categories FilePicker UserPicker |
| `TEXT.muted / subtle / caption` | 次级文字 ×20+,多种拼法 | 全域 |

### B4 该用现成东西却手写的

| 位置 | 问题 |
|---|---|
| `Categories.vue` `Users.vue` | 手写了一整串主按钮样式 ×2 —— **`BTN.primary` 就在那儿** |
| `FilePicker.vue` `UserPicker.vue` | 手写整套弹窗(overlay/header/title/close 共 6 串重复)—— **`AdminModal.vue` 已存在**,且已被 CategoryEditor/UserEditor/MenuEditor 使用 |
| `components/HelloWorld.vue` | 脚手架残留,**全仓无人引用** → 删 |

> `AdminModal` 自身也有硬编码(`rounded-[12px]`、`rgba(0,0,0,0.4)`、`#0077ED`、内联的 cancel/save 按钮样式而非用 `BTN`),会在 Part A/B 里一并清掉。两个 picker 是否改用 `AdminModal` 需你定 —— 它自带 footer 的 取消/保存,而 picker 是「点即选」没有保存动作,可能需要给 `AdminModal` 加一个 `:footer="false"`。

### B5 第 2 层原生元素的处置(按你已定的「补 preset」路线)

| 位置 | 现状 | 处置 |
|---|---|---|
| Dashboard ×6 | 导航磁贴与文字链接 | 语义上是链接 → `router-link` + `TILE` / `LINK.action`,**不套 Button** |
| Roles ×2 | 角色列表项、权限位切换 | `TOGGLE` preset,保留 `<button>`(语义正确) |
| AclEditor ×3 | 权限位切换 | 同上 |
| Editor ×3 | 真表单动作 | → PrimeVue `Button` + `BTN.*` |
| SetupWizard ×2 | 文件选择触发 + 真按钮 | → `Button` + `BTN.*` |
| UserEditor/CategoryEditor/UserPicker/FilePicker ×4 | 真按钮 | → `Button` + `BTN.*` |
| `Settings.vue:334` `<textarea>` | 原生 | → PrimeVue `Textarea` |
| checkbox ×3 | 原生 | → PrimeVue `Checkbox` / `ToggleSwitch` |
| `<input type="file">` ×2 | 隐藏 file input | **保留**,PrimeVue 无对应物,`FileUploader` 内部自持 |

---

## 5. Part C — 需你批准的归并

**先说清代价**:要「阶数少到能分辨轻重」,就不可能同时保住原来那 22 档黑色。归并意味着**这是一次真实的重新调色,不是纯重构**。

工具只自动改写**精确匹配**(零视觉变化);下表是**改值**,必须你点头。不批准的项就保留字面值并进 lint 白名单。

按影响面从大到小:

| # | 归并 | 处数 | 视觉影响 | 建议 |
|---|---|---|---|---|
| 1 | 文字 `0.8` → `#1d1d1f` | **63** | 主文字略变深(0.80 → 约 0.886 黑)。统一后全站主文字只有一个来源 | 批准 |
| 2 | 文字 `0.5` `0.48` `0.45` → `0.4` | **34** | 三级文字略变浅。原本 0.4/0.45/0.5 混用本就分不出 | 批准 |
| 3 | 字号 `13px` → `12px` | **34** | 紧凑区文字小 1px。12/13 并存本就无意义 | 批准 |
| 4 | 分隔线 `0.05` → `0.06` | 25 | 几乎不可见 | 批准 |
| 5 | 分隔线 `0.15` → `0.12` | 20 | 输入框描边略淡 | 批准 |
| 6 | 字号 `21` `19` `18` → `20px` | 13 | 区块/弹窗标题统一到 20px,**差 1px 的三种标题本就是笔误级差异** | 批准 |
| 7 | 面 `#f9f9fb` `#fbfbfd` `#fafafa` → `#fafafc` | 10 | 不可辨 | 批准 |
| 8 | 分隔线 `0.08` → `0.06` | 10 | 略淡 | 批准 |
| 9 | 文字 `0.7` → `0.6` | 7 | 二级文字略浅 | 批准 |
| 10 | 字号 `15px` → `14px` | 7 | 主按钮文字小 1px | 批准 |
| 11 | 圆角 `6px` → `8px` | 5 | 徽章略圆 | 批准 |
| 12 | 圆角 `16px` → `12px` | 4 | 大面板略方 | **需你看** —— 唯一「变方」的一项,大面板观感会有变化 |
| 13 | 面 `#f3f4f6` → `#f5f5f7` | 3 | 不可辨 | 批准 |
| 14 | info 系 `#bae6fd` `#f0f7ff` `#b3d4fc` → `#e0f2fe` | 3 | 状态徽章底色统一 | 批准 |
| 15 | 文字 `0.3` `0.2` → `0.25` | 4 | 四级文字 | 批准 |
| 16 | 圆角 `5px` `10px` → `8px` · `11px` → `12px` | 6 | 不可辨 | 批准 |
| 17 | 分隔线 `0.1` → `0.12` · `0.03` → `0.06` | 3 | 不可辨 | 批准 |
| 18 | 文字 `0.9` → `#1d1d1f` · `0.55` → `0.6` · `0.35` → `0.4` | 9 | 不可辨 | 批准 |
| 19 | 圆角 `980px` → `rounded-full` | 3 | 等效 | 批准 |
| 20 | 灰 `#d2d2d7` `#ebebeb` → 最近 token | 2 | 不可辨 | 批准 |

**保留字面值**(不建 token,进白名单):字号 `28`(2) `32`(1) `56`(2);一次性宽度 29 处;非黑 rgba 2 处。

> 只有 **#12(16px 圆角 → 12px,4 处)** 我拿不准 —— 它是唯一会让元素变「方」的归并。其余归并要么不可辨,要么是把本就该统一的东西统一了。你若想保住 16px,单独留一个 `radius-panel` 也行,代价是圆角族从 2 阶变 3 阶。

---

## 6. Part D — 执行与验证

| 阶段 | 内容 | commit |
|---|---|---|
| 0 | `style.css` 的 `@theme` 加 token(A2-A5);`audit-classes.mjs` 已就位 | 1 |
| 1 | 跑工具自动改写 A1 的 60 处 + 全部精确匹配项,**逐项用 `candidatesToCss` 证明 CSS 等价** | 1 |
| 2 | `presets.ts` 自身去字面值 + 新增 B1-B3 的 preset;删 `HelloWorld.vue` | 1 |
| 3 | 逐文件接入 preset + 处理 B4/B5,按硬编码量排序:Dashboard(73) → Roles(58) → SetupWizard(50) → Settings(48) → Editor(36) → … | 若干 |
| 4 | 规则写进 `docs/frontend.md`;`npm run lint:classes` = `audit-classes.mjs --check` 接进 CI | 1 |

**验证手段(每阶段都做)**
1. `npx vue-tsc --noEmit -p tsconfig.app.json --noCheck false` 必须零错。
2. **CSS 等价证明**:改写前后 `candidatesToCss` 逐字节比对 —— 这比截图更精确,能抓住「换错值」。
3. **headless Chrome 真渲染**管理后台各页,DOM/截图前后对比 —— 抓结构性回归。
   ⚠ 后台需登录,`--dump-dom` 无会话。方案:临时在 `frontend/public/` 放一个把 token 写进 localStorage 再跳转的辅助页,验证完删除。**这一条需你同意**,因为它会临时往 public 里放东西。
4. `npm run build` 出包。

---

## 7. Part E — 明确不做

- **主题目录**(`frontend_themes/*`)不在本次范围。它们有自己的令牌体系(neo 的 `tokens.css`),硬编码情况类似但要分开治。`audit-classes.mjs` 已经能扫到它们,数据留着备用。
- `leading-[1.1]` 等**行高**:只有零星几处,先不建 token(除非你要)。
- 一次性宽度(`w-[200px]` `max-w-[280px]` 等 29 处):属布局个例而非设计令牌,保留字面值并进 lint 白名单。
- 非黑 rgba 2 处(`rgba(210,210,215,0.64)` `rgba(255,255,255,0.1)`)保留。

---

## 待你回答

1. **§A0 统一命名**:`apple-*` 前缀全部去掉,改角色名(`label` / `accent` / `link` / `canvas`),删死 token `apple-black`。约 97 处机械替换 —— 同意?
2. **label 各级的写法**:`label-2/3/4` 还是 HIG 原词 `label-secondary/tertiary/quaternary`?
3. **§3 的分阶方案**(文字 4 · 分隔线 2 · 填充 1 · 字号 5 · 圆角 2 · 面 4)—— 认可,还是某一族还想再砍/再拆?
4. **§5 #12**:`16px` 圆角(4 处)归并到 `12px`,还是单独保留 `radius-panel`(圆角族变 3 阶)?
3. **两个 picker 是否改用 `AdminModal`**(需给它加 `:footer="false"`)?还是各自保留弹窗结构、只把样式换成 preset?
4. **§6 验证手段 3** 的临时辅助页,是否同意?若不同意,后台页面就只能靠 CSS 等价证明 + 类型检查,没有真渲染回归。
