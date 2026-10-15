# ContextWeave Public Demo

ContextWeave 是一个面向长期 AI 交互场景的上下文记忆编排系统原型，重点展示长期记忆、跨会话上下文衔接、Event 主动触发与可追踪召回。

## 当前公开版 / v0.3 staging

- 中文单页交互 Demo
- v0.3 staging：样板记忆 + 访客临时写入 + 清空 / 重置
- API-ready Recall Trace：route / used_memory / trace_id / score / match_reason / candidate_sources
- 长期记忆、跨会话、Event 与 Trace 能力说明
- 完全脱敏，不连接真实私人记忆或真实对话

## 项目说明

产品概念、功能架构与核心交互逻辑由项目负责人从 0 到 1 独立完成，并在 AI 协助开发下推进实现、测试与持续迭代。

main 仍保持稳定公开版本；`v0.3-public-sandbox` 分支已进入 Public Sandbox 接线阶段。目标是运行与私人产品相同的 Moss Recall Core，但使用独立 SQLite / Qdrant 数据域，只处理 synthetic sample 与 visitor-session 临时记忆。接口契约见 `docs/PUBLIC_SANDBOX_API.md`.

## Roadmap

- User Profile synthesis：Beta
- Public Memory Sandbox：In progress
- 向量小模型整理层：Planned
- 脱敏开源版本：Planned
