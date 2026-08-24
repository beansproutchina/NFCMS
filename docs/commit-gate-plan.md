# 提交门槛 — 待确认计划

目标:让「项目变成屎山」这件事**在提交时就被拦住**,而不是靠某个人某一次记得检查。

本文件是计划,待你确认后实施。

---

## 0. 为什么要有它 —— 本次重构的实证

这一轮我自己就把同一个错误犯了**三次**,每次都是「扫描范围不完整,却按扫描结果报了数」:

| # | 错误 | 后果 |
|---|---|---|
| 1 | 用**已知字符串**精确匹配找重复 | 词序变体全漏(同一个表单标签 5 种拼法),清理永不收敛 |
| 2 | 只扫 `views/admin` 等**四个目录** | `views/auth/Login.vue` 整个漏掉 |
| 3 | 只扫 `</template>` **之前**的部分 | template 在前的文件(Categories/Menus/Users)script 整段漏掉,"62 处"实际 82 处 |

结论:**检测不能依赖人当时想到扫哪儿。** 门槛的价值不在于「更严格」,而在于把「扫全」这件事变成机器的责任。三条教训直接编码为下面的实施约束(§4)。

---

## 1. 挂在哪

**git `pre-commit`,通过 `core.hooksPath` 纳入版本控制。**

- 钩子脚本放 `scripts/git-hooks/pre-commit`(仓库根),而不是 `.git/hooks/`—— 后者不进 git,等于每台机器各自为政。
- 安装:`git config core.hooksPath scripts/git-hooks`。为免「忘了装等于没有」,在 `frontend/package.json` 加 `prepare` 脚本自动执行 —— `npm install` 时就装好了。
- **不引入 husky / lint-staged**。它们要加依赖,而我们需要的东西 15 行 shell 就够。

**耗时实测**(决定了它能否放在 pre-commit):

| 检查 | 耗时 |
|---|---|
| 令牌规范性(加载 Tailwind designSystem + oxide 扫描) | 2s |
| 其余规则(纯文本扫描) | <1s |
| `vue-tsc --noEmit --noCheck false` | 2s |
| `vite build` | 2s |

pre-commit 跑 **规则 + vue-tsc ≈ 4s**。`vite build` 不重复放进来 —— `npm run build` 的第一步 `vue-tsc -b` 就是同一个类型检查,单独跑一次已覆盖。

---

## 2. 十条规则

每条都注明**依据**(本次实际发现的问题)和**豁免方式**。

### R1 有令牌却写字面值
`text-[14px]` · `bg-[#f5f5f7]` · `rounded-[8px]`
- **怎么查**:`scripts/audit-classes.mjs --check`。检测委托给 Tailwind 自己(`canonicalizeCandidates`,语言服务与 prettier 插件用的同一个 API),不用正则,漏不掉。
- **依据**:676 处。其中 60 处是「令牌明明存在却写 hex」。

### R2 内置调色板旁路
`text-gray-500` · `bg-slate-100` · `text-red-500` · `text-black`
- **怎么查**:项目自有规则。**Tailwind 认为它们已经规范**(它们确实是合法 utility),只是绕过了本项目的令牌层 —— 所以 R1 查不出来,必须单列。
- **依据**:44 处。这一类是我整轮审计**唯一完全没覆盖**的,直到你指出来。
- **豁免**:装饰性分类色(Dashboard 统计图标、角色徽章底色)—— 那是数据身份不是设计语义,`--color-cat-1..5` 会比 `text-blue-500` 更难读。走 baseline(§3),不做单独的注释豁免语法。

### R3 内置阶旁路
`text-xs/sm/base/lg` · 光秃 `rounded` · `rounded-lg/2xl`
- **依据**:14 处。项目有自己的 5 级字阶与 3 级圆角,内置阶是第二套体系。

### R4 死类(生成不出任何 CSS)
- **怎么查**:`candidatesToCss(cls) == null`,只取真实出现在 `class` / `:class` 位置的 token(oxide 的 Scanner 故意贪婪,会把 `const`/`import` 也当候选,必须过滤)。
- **依据**:`font-display` 在 **6 个文件**的弹窗标题与页头上用了很久,而 `@theme` 里从来没有 `--font-display`。**它一直生成不出 CSS,却没人发现** —— 因为周围有一堆字面值样式掩盖着。

### R5 空操作 hover/focus(与基态同值)
`class="text-danger hover:text-danger"`
- **依据**:4 处。这是**值归并的固有副作用**(`red-500` 与 `red-600` 都并进 `danger`),我当时完全没想到要查 —— 正是这种「改动引入的新问题」最需要机器盯。

### R6 原生表单元素
`<button>` `<select>` `<input>` `<textarea>`
- **依据**:CLAUDE.md 要求走 unstyled PrimeVue + preset。
- **豁免**:两类**语义必需**的走 baseline —— 隐藏的 `<input type="file">`(PrimeVue 无对应物)、隐藏的 `<button type="submit">`(让表单响应回车)。

### R7 原生 confirm / alert / prompt
- **依据**:CLAUDE.md 明文禁止,而实际有 **7 处 confirm + 4 处 alert**。我在评审时列出了却问了句「要不要单开一批」就搁下了 —— **规范已经写死的事不该拿去问**,这正是需要门槛而不是需要商量的地方。

### R8 硬编码文案
模板与 script 里的中文字面量,不在 `$t(` / `t(` 上下文中
- **依据**:82 处。CLAUDE.md:「新文案一律加进 i18n.ts 的 en+zh,别硬编码中文」。
- **豁免**:i18n.ts 自身;示例性质的中文(如 ICP 备案号占位符)走 baseline。

### R9 公开站铁律(主题目录)
- 主题里出现 `crudAPI.getList('articles'` 或 `/api/articles` → **匿名访客 403**
- 出现已废弃的 `visible` 字段过滤
- **依据**:CLAUDE.md 坑 5。`cosmos_love` 有 **5 处**同时犯了这两条,导致相关功能对访客**完全是哑的**,且被 `catch` 静默吞掉。`articles` 表早就没有 `visible` 列了。
- 这条最便宜也最值 —— 它拦的是**功能性 bug**,不是风格问题。

### R10 preset 自身不得旁路
`ui/presets.ts` 里不得出现字面值
- **依据**:重构前 `FIELD_BASE` 自己就是 `text-[14px]` + `rgba(0,0,0,0.15)` + `rounded-[8px]`。**「唯一出处」自己都拿不到令牌**,因为令牌层根本没有那些东西。

### 附:R11 重复外观组合(**建议只警告不拦**)
按集合归一化聚类,≥4 次未提 preset 的组合。
- 阈值有主观性(2 次重复不一定值得抽象),拦下来会制造无谓摩擦。建议**打印提示**,由人判断。

---

## 3. baseline 棘轮 —— 为什么必须有

现在 R1–R8 在 `frontend/src` 内都是 0,但:
- **主题目录不是 0**(§7 明确不在本次范围),R9 一开就会亮红
- 装饰色、隐藏 file input 等**合法豁免**需要一个落地方式
- backend 完全没审计过

如果门槛一上就让所有提交失败,唯一的结果是所有人 `--no-verify`,门槛作废。

所以:**`scripts/lint-baseline.json` 记录当前已知且被接受的违规指纹**(规则 + 文件 + 具体 token)。
- 只对**新增**指纹失败 → 增量不再变差。
- 数量减少时脚本提示「可以收紧 baseline 了」,并提供 `--update` 一键收紧。
- baseline 是**版本控制下的文件**:往里加一行是一次**可见的、要过 review 的行为**,而不是偷偷绕过。这比注释式豁免语法更难滥用。

用一个概念同时承担「棘轮」和「豁免」,不引入第二套机制。

---

## 4. 三条教训如何编码

| 教训 | 实施约束 |
|---|---|
| 精确字符串会漏词序变体 | 所有涉及 class 的规则**按集合归一化**比较,不做字符串匹配 |
| 目录列表会漏文件 | **递归遍历**给定根目录,不写目录清单;新目录自动纳入 |
| 只扫 template 会漏 script | **全文扫描**,不按 SFC 区块切分 |

并且:门槛脚本自己有一条自检 —— 打印它**实际扫过多少文件**,与 `git ls-files` 的应扫数对比,不一致就报错。避免「扫了 3 个文件、报告全绿」。

---

## 5. 范围

| 规则 | 范围 |
|---|---|
| R1–R8, R10 | `frontend/src/**`,排除 `views/front`(它是指向当前主题的**软链**,穿过它写入会静默改掉 `frontend_themes/<name>`) |
| R9 | `frontend_themes/**` |
| vue-tsc | 全量(无法按文件裁剪) |

只检查**已暂存**的文件还是全量?建议**全量** —— 实测 4s,而按暂存文件裁剪会漏掉「A 文件的改动让 B 文件失效」这类问题(比如删掉一个令牌)。

---

## 6. 逃生门

- `git commit --no-verify` 是 git 原生能力,拦不住也不该拦。门槛的作用是**让绕过成为一个显式选择**。
- 正途是往 baseline 加一行并在 review 里解释。
- 钩子输出必须**指明文件:行号和怎么改**,而不是只说「失败」。修不动的门槛等于没门槛。

---

## 7. 交付物

```
scripts/git-hooks/pre-commit          钩子(shell,~15 行)
frontend/scripts/lint-admin.mjs       R1–R8 + R10 + R11
frontend/scripts/lint-themes.mjs      R9
frontend/scripts/lint-baseline.json   棘轮
frontend/package.json                 +lint / +lint:fix / +prepare(自动装钩子)
docs/frontend.md                      补「设计系统」一节 —— 现在那份文档里
                                      关于 preset 一个字都没有,规则只写在
                                      CLAUDE.md,前端开发者查文档查不到
CLAUDE.md                             补一句门槛的存在与绕过方式
```

---

## 待你确认

1. **R11(重复组合)只警告不拦** —— 同意?还是也要拦(设阈值)?
2. **R9 主题铁律现在就开** —— 它会立刻亮红(cosmos_love 5 处),按计划先进 baseline;还是等主题那轮重构再开?
3. **全量检查 vs 只查暂存文件** —— 我倾向全量(4s,且能抓跨文件失效)。
4. **`prepare` 自动装钩子** —— 同意在 `npm install` 时静默改 `core.hooksPath` 吗?不同意就只能靠文档提醒手动 `git config`。
5. **backend 要不要一并纳入** —— 目前完全没审计过。若要,得先定后端的规则清单(另一个话题)。
