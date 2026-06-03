# 目标完成矩阵

这份矩阵用于判断 XHS AI Content Studio 是否已经接近“围绕一个帖子项目运行的 AI 小红书帖子创作 Agent”。它只记录可验证证据，不把未真实验收的外部动作算作完成。

## 已由代码和自动化验收覆盖

| 目标项 | 当前状态 | 主要证据 |
| --- | --- | --- |
| 统一 PostProject | 已完成 | `lib/post-project/types.ts`、`lib/post-project/store.ts`、`tests/post-project.test.ts` |
| PostStage 和 allowedActions | 已完成 | `lib/post-project/stage-machine.ts`、`tests/post-project.test.ts`、`tests/agent-stage-guidance.test.ts` |
| Post Studio 三栏创作台 | 已完成 | `app/components/post-studio-panel.tsx`、`tests/post-studio-*.test.ts`、`tests/post-canvas-panel.test.ts` |
| Agent 读取当前项目并按阶段决策 | 已完成 | `lib/agent/orchestrator.ts`、`lib/agent/planner.ts`、`tests/agent-orchestrator.test.ts`、`tests/agent-planner.test.ts` |
| Agent 响应 cards / quickActions / toolTrace | 已完成 | `lib/agent/types.ts`、`tests/agent-card-generation.test.ts`、`tests/agent-card-visibility.test.ts`、`tests/agent-trace-summary.test.ts` |
| Agent SSE 流式接口 | 已完成 | `/api/chat/stream`、`tests/chat-stream-route.test.ts` |
| Agent SSE 安全 smoke | 已完成 | `scripts/chat-stream-smoke.mjs`、`npm run smoke:chat-stream` |
| CreativeBrief 统一驱动文案和图片 | 已完成 | `lib/post-project/brief.ts`、`tests/post-brief.test.ts`、`tests/creative-briefs.test.ts` |
| 证据引用和 basedOnEvidenceIds | 已完成 | `lib/post-project/citations.ts`、`tests/evidence-citations.test.ts`、`tests/evidence-citation-display.test.ts` |
| 信息降噪和右侧摘要面板 | 已完成 | `tests/post-side-digest.test.ts`、`tests/studio-tab-summary.test.ts`、`tests/post-studio-evidence-tabs.test.ts` |
| 文案 / 图片 Prompt / 最终帖版本状态 | 已完成 | `lib/post-project/versioning.ts`、`tests/post-versioning.test.ts`、`tests/post-version-display.test.ts`、`tests/route-contracts.test.ts` |
| Quality Gate | 已完成 | `lib/post-project/quality.ts`、`tests/post-studio-quality-panel.test.tsx`、`tests/quality-originality.test.ts`、`tests/quality-viral-coverage.test.ts` |
| 发布确认与确认单失效机制 | 已完成 | `lib/agent/guardrails.ts`、`lib/agent/publishing.ts`、`tests/agent-guardrails.test.ts`、`tests/agent-publishing.test.ts`、`tests/publish-confirmation.test.ts` |
| 发布审计 | 已完成 | `lib/storage/publish-audit.ts`、`tests/publish-audit.test.ts`、`tests/publish-audit-summary.test.ts` |
| Viral Knowledge Base / 爆款库 | 已完成 | `lib/viral-knowledge/store.ts`、`tests/viral-knowledge.test.ts`、`tests/viral-save-candidates.test.ts` |
| Viral RAG 检索和证据合并 | 已完成 | `lib/rag/viral.ts`、`lib/agent/evidence-builder.ts`、`tests/viral-rag.test.ts`、`tests/rag-viral.test.ts`、`tests/viral-application.test.ts` |
| 真实 MCP 健康检查 | 已完成 | `/api/health/mcp`、`scripts/local-smoke.mjs`、`npm run smoke:local` |
| 真实研究链路 smoke | 已完成 | `scripts/research-smoke.mjs`、`npm run smoke:research` |
| 发布 dry-run 安全 smoke | 已完成 | `scripts/publish-dry-run-smoke.mjs`、`npm run smoke:publish-dry-run` |
| 账号配置安全 smoke | 已完成 | `scripts/account-smoke.mjs`、`npm run smoke:accounts` |
| 多账号验收指南 | 已完成 | `docs/multi-account-acceptance.md`、`tests/multi-account-acceptance-doc.test.ts` |
| Post Studio 状态 smoke | 已完成 | `scripts/studio-state-smoke.mjs`、`npm run smoke:studio-state` |
| 一键安全 smoke | 已完成 | `npm run smoke:safe` |
| 完整本地回归 | 已完成 | `npm run verify` |

## 当前必须人工授权后才能验收

| 项目 | 原因 | 推荐验收方式 |
| --- | --- | --- |
| 真实发布到小红书 | 会对真实外部账号产生写入动作 | 按 `docs/real-publish-acceptance.md`，第一次使用“仅自己可见” |
| 真实定时发布到小红书 | 会创建真实定时发布任务 | 按 `docs/real-publish-acceptance.md`，确认时区和发布时间 |
| 多账号真实切换 | 需要多个独立 MCP 实例和多个真实登录会话 | 按 `docs/multi-account-acceptance.md`，为每个账号启动独立 MCP 端口，例如 `18060`、`18061`、`18062` |
| 大量真实模型生图 | 可能产生费用 | 先小批量测试，再提高每日图片调用上限 |

## 当前完成度判断

从代码、测试、文档和 smoke 证据看，项目主体已经完成到可以公开使用的本地 Agent 工作台形态。剩余缺口主要是外部真实动作验收，而不是核心功能缺失。

当前估计完成度：**98%**。

不能标记为 100% 的原因：

- 尚未在真实小红书账号上点击最终确认发布。
- 尚未在真实小红书账号上点击最终确认定时发布。
- 尚未用多个真实 MCP 实例完成多账号切换发布验收。

## 推荐最终验收顺序

1. `npm run verify`
2. 启动网页和 MCP：`powershell -NoProfile -ExecutionPolicy Bypass -File .\start-xhs.ps1`
3. `npm run smoke:safe`
4. `npm run smoke:research`
5. 在 Post Studio 完成一篇真实项目：研究、CreativeBrief、文案、图片、Quality Gate。
6. 按 `docs/real-publish-acceptance.md` 生成“仅自己可见”发布确认单。
7. 人工确认真实发布。
8. 人工确认真实定时发布。
9. 如需多账号，再启动多个 MCP 端口并逐一验收账号切换。
