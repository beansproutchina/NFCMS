---
name: transport-theme
description: 从零建设或优化 NFCMS 前台主题(frontend_themes/<name>)的端到端工作流编排器。当用户要"做/优化/重做一个 NFCMS 主题"、把某主题改造成某类站点(博客/工作室作品集/学校学院官网/个人主页/文档站等)、或问"怎么建一个 NFCMS 主题"时使用。按 6 步路由(提问→调研→设计文档待审→反馈→开发→生成初始化 demo,含回环),每步派一个子 agent 执行对应 reference 文件。
---

# transport_theme — 工作流编排器

你是这条主题建设流水线的**编排器(router),不亲自干具体活**。你的职责只有三件:**决定当前在第几步 → 派一个子 agent 执行该步 → 收其产出、把关门禁、决定前进或回环**。每一步的完整做法写在对应 `reference/step-N-*.md` 里,由子 agent 读并执行。

## 执行模型

- 维护一个**工作台状态**(累积传递,别丢):`主题名 name`、6 轴定案、调研结论、设计文档、开发进度。每派子 agent 都把它作为输入喂进去。
- **每步派一个子 agent**(`Agent` 工具,`subagent_type: "claude"`,`run_in_background: false` 同步执行,以便与用户交互)。prompt 模板见下。
- 子 agent 返回后:**把关键产出转述给用户**(子 agent 的最终报告用户看不到),执行该步门禁,再前进/回环。
- **不要跳步,不要一口气跑完**;不要自己写模板/代码/demo —— 那是子 agent 的事。

### 派活 prompt 模板
```
你是 transport_theme 工作流「第 N 步」的执行 agent。
先读 .claude/skills/transport_theme/reference/step-N-*.md,严格按它执行。
项目背景读 CLAUDE.md;领域参考按 step 文件指示读 reference/theme-api.md、reference/patterns.md。
【工作台状态】<把累积的 name/6轴/调研/设计/进度贴进来>
【本步目标】<该步交付物>
完成后回报:产出摘要 + 待用户确认的事项 + 建议下一步(前进/回环)。
```

## 6 步路由表

| 步 | reference 文件 | 子 agent 交付 | 门禁(编排器把关) |
|---|---|---|---|
| 1 提问 | `reference/step-1-ask.md` | 6 轴定案(分两批问) | 拿到用户答复才进 2;query 已明确的轴跳过 |
| 2 调研 | `reference/step-2-research.md` | 现状问题清单 + 数据可行性结论 | 转述给用户,无异议进 3 |
| 3 设计文档 | `reference/step-3-design.md` | 完整设计文档(`ExitPlanMode` 待审) | **必须等用户批注/批准**;要改 → 回 2 或重跑 3 |
| 4 反馈 | `reference/step-4-feedback.md` | 6 个设计中新浮现的问题 | 用户拍板;若改需求 → **回 2/3** |
| 5 开发 | `reference/step-5-develop.md` | 主题代码(vue-tsc+build 过) | **必须拿到明确"开始开发"才启动**;不满 → 回 2/3 |
| 6 demo | `reference/step-6-demo.md` | `<name>-demo-data.json`(实测导入+还原) | 交付路径+导入方式给用户 |

## 门禁总则
- 交互步(1/4 问问题、3 出待审文档)的子 agent 直接用 `AskUserQuestion`/`ExitPlanMode` 与用户交互;你负责把答复并入工作台传给下一步。
- **第 3 步未获批准、第 5 步未获明确"开始开发",绝不推进。**
- 任一步用户不满 → 回到第 2 或第 3 步重做,别在原步硬改。
- 全程只有你(编排器)掌握"现在第几步";每轮对话先确认当前步,再派活。

## 共享领域参考(子 agent 按 step 文件指示自取,你不必读)
- `reference/theme-api.md` — 架构/数据模型/端点/模板选择/`theme.config.ts` 契约/`context`/类型。
- `reference/patterns.md` — 可抄的模式 + 坑位 checklist + 命令。
