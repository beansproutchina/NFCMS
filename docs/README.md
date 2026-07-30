# NFCMS 文档

给开发者/AI 的项目文档。入口速览在仓库根的 [`CLAUDE.md`](../CLAUDE.md)。

- [architecture.md](architecture.md) — 总体架构、分层、请求生命周期、CMS 核心层、SSG。
- [dyapi.md](dyapi.md) — 自研框架 DYAPI 的心智模型、权限/查询能力、**必知的坑**。
- [backend.md](backend.md) — 后端启动流程、CMS 核心层、数据模型、RBAC、内容生命周期、端点速查、安全。
- [frontend.md](frontend.md) — 前端结构、api 约定、管理台惯例、i18n、主题/展示站、构建。
- [development.md](development.md) — 本地运行、环境变量、**测试纪律(备份 DB / 杀进程)**、Docker 部署、陷阱清单。
- [assessment.md](assessment.md) — 项目现状评估(五维度强项 / 待还的债 / 优先级建议)。
- [public-access.md](public-access.md) — 公开站页面权限(**受众轴**)设计:audience 三级 + 摘要墙、`access_eff` 物化、判定纯函数、一期任务清单。**已定稿未实现**。

其它既有文档:
- [../README.md](../README.md) / [../README.zh-CN.md](../README.zh-CN.md) — 面向使用者的项目说明。
- [../DESIGN.md](../DESIGN.md) — 前端 Apple 风格设计系统规范。
- [../DESIGN_SCHOOL.md](../DESIGN_SCHOOL.md) — school 主题设计规范。
- [../Structure.md](../Structure.md) — 最初的架构规划(部分已演进,以本 docs 为准)。
- [../frontend/src/views/front/THEME_DEV.md](../frontend/src/views/front/THEME_DEV.md) — 主题开发指南。
