# ContextWeave Public Demo

ContextWeave 是一个面向长期 AI 交互场景的上下文记忆编排系统原型，重点展示长期记忆、跨会话上下文衔接、Event 主动触发与可追踪召回。

## 当前公开版 / v0.4 staging

- 中文单页交互 Demo
- v0.3 staging：样板记忆 + 访客临时写入 + 清空 / 重置
- Moss-ready Recall Trace：T0/T1/T2 / role / recall_path / score / candidate_sources / same-turn expand
- 长期记忆、跨会话、Event 与 Trace 能力说明
- 完全脱敏，不连接真实私人记忆或真实对话

## 项目说明

产品概念、功能架构与核心交互逻辑由项目负责人从 0 到 1 独立完成，并在 AI 协助开发下推进实现、测试与持续迭代。

main 仍保持稳定公开版本；`v0.3-public-sandbox` 分支正在接入 Moss 0.9.3-rc.3.30.1.1 Public Sandbox。后端使用独立 SQLite / Qdrant 数据域，只处理 synthetic sample 与 visitor-session 临时记忆，并复用 T0/T1/T2、role、progressive expand 等召回语义。接口契约见 `docs/PUBLIC_SANDBOX_API.md`.

## Roadmap

- User Profile synthesis：Beta
- Public Memory Sandbox：In progress
- 向量小模型整理层：Planned
- 脱敏开源版本：Planned
