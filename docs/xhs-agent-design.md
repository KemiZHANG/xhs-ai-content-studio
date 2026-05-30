# XHS AI Content Studio Agent 设计说明

## 目标

XHS AI Content Studio 的核心不是“让模型凭空写一篇小红书”，而是做一个有证据链的内容运营 Agent：

1. 根据用户在 AI 对话或一键发帖中输入的主题，先搜索真实小红书笔记。
2. 提取标题、作者、点赞、收藏、评论、分享、图片、详情和评论片段。
3. 对样本进行排序，选出高互动样本。
4. 把样本证据展示给用户，让用户看见“AI 到底参考了什么”。
5. AI 基于证据总结可借鉴点，再生成原创草稿。
6. 用户可以继续让 AI 修改草稿，也可以一键发布或定时发布。
7. 所有对话和工作流结果保存在本地，后续可以继续追问和复盘。

## 为什么要这样设计

公开 Agent 框架的共同方向是：会话要有记忆，工具调用要可追溯，关键动作要有人确认。

- OpenAI Agents SDK 的 Sessions 机制会在每轮运行前读取历史，并在运行后保存用户输入和助手输出，适合做 ChatGPT 式多轮对话。
- LangGraph 的 human-in-the-loop 思路强调：发布、提交、写入这类关键动作前要能暂停，让用户查看依据后再确认。
- OpenHands 这类开源 Agent 项目强调透明的任务过程和 artifact 展示，用户要能看到 Agent 做了什么、产出了什么。

因此本项目采用“证据样本 -> 分析报告 -> 草稿 -> 人工确认发布”的流程。

## 当前数据流

1. `app/api/chat/route.ts`
   接收 AI 对话消息，保持旧响应兼容，但核心逻辑交给 `lib/agent/orchestrator.ts`。

2. `lib/agent/orchestrator.ts`
   读取当前 WorkspaceState 和 PostProject，调用 planner 判断用户意图，再决定是否做实时研究、爆款库 RAG、CreativeBrief、文案生成、图片方向、发布装配或 Quality Gate。

3. `lib/storage/chat.ts`
   保存 ChatGPT 式对话历史到 `data/chat-history.json`。

4. `lib/post-project/store.ts`
   保存当前帖子项目到 `data/post-project.json`，包含主题、产品信息、证据包、CreativeBrief、文案版本、图片方向、最终帖子、发布计划和审计状态。

5. `lib/workflows/one-click.ts`
   保留旧的一键发帖宏流程，包括搜索、排序、拉详情、构建证据、生成分析报告和草稿。新 Agent 会把它当作工具复用，而不是推翻。

6. `SampleEvidence`
   每条证据包括真实标题、作者、互动数、链接、图片、详情摘要、评论片段、AI 借鉴原因。

7. `lib/storage/evidence-images.ts`
   尝试把样本图缓存到 `generated-assets/evidence`，结果页优先展示本地缓存图。

8. `app/page.tsx` 和 `app/components/*`
   展示 Post Studio、AI 对话、成果画布、研究证据、爆款库证据、图片创作台、发布装配台和任务状态。

## 爆款库 RAG

爆款库不是“原文合集”，而是长期沉淀可复用的创作知识。每条 `ViralCase` 会保存：

- 标题钩子、正文结构、标签组合、图片风格。
- 目标人群、痛点、情绪触发点、评论关注点。
- 互动数据和来源链接。
- 本地 embedding 和 `extractedInsights`。

实时研究拿到好样本后，用户可以保存到爆款库。入库时系统会优先调用模型提取结构化规律；如果没有模型，会退回本地启发式提取，并明确提示。

检索流程：

1. Agent 根据用户主题、产品、目标人群和上下文判断是否需要 RAG。
2. Planner 从自然语言里提取时间、点赞、收藏、评论、分享、综合分、标签和排序条件。
3. `lib/rag/viral.ts` 使用 query rewrite / RAG-Fusion / 多样性选择，检索历史爆款规律。
4. RAG 结果与实时小红书证据合并进 `evidencePack`，并用 `sourceType: "viral_library"` 标记来源。
5. CreativeBrief、文案草稿和图片方向都必须记录 `basedOnEvidenceIds`，方便追溯。
6. Post Studio 的“爆款库证据”tab 默认只展示 3-5 条关键规律，完整证据保留在 evidencePack 中。

## 可替换 Agent/RAG 接口

当前本地实现使用 JSON 文件和轻量级检索，但接口已经预留：

- `AgentRuntime`
- `Retriever`
- `VectorStore`
- `Reranker`
- `Evaluator`
- `ToolRegistry`
- `WorkflowRunner`
- `MemoryProvider`
- `TraceProvider`

`lib/rag/retrievers.ts` 把本地爆款库包装成 Retriever adapter。后续如果升级到 SQLite + sqlite-vec、Postgres + pgvector 或 Qdrant，应优先替换这些 adapter，而不是把向量库逻辑写进 UI 组件。

## Quality Gate

发布前检查由 `lib/post-project/quality.ts` 执行。它关注：

- 标题、正文、标签、图片是否齐全。
- 文案和图片方向是否引用了有效 evidencePack。
- 是否过度仿写实时样本或爆款库样本。
- 是否存在虚假销量、虚假认证、功效夸大、极限词、夸张 before/after。
- 图片方向和文案是否基于同一组证据，避免图文不一致。
- 最终帖子是否仍匹配当前草稿和选中图片，防止审批后被修改。

真实发布和定时发布必须经过后端 guardrails。默认策略为 `review_required`，Agent 不能因为一句模糊指令绕过人工确认。

## 当前边界

1. 能否拿到完整正文、评论和图片，取决于小红书 MCP 当前接口返回的数据。
2. 旧历史记录不会自动补全详情和本地缓存图，但会尽量从旧 raw 数据中恢复标题、作者、互动数和图片。
3. 发布和定时发布属于外部真实动作，必须经过发布意图、Quality Gate、账号状态和人工确认。
4. 爆款库使用的是本地轻量检索，适合个人工作台；团队级或大规模样本建议升级到专业向量数据库。
5. 爆款库只允许学习规律，不允许复制原文、盗用图片或伪造数据。

## 后续建议

1. 把本地 JSON 存储升级为 SQLite，并引入 sqlite-vec 或 pgvector。
2. 增加模型级 Reranker，让爆款库证据排序更接近“可创作性”而不是只看关键词。
3. 增加账号数据分析，接入自己账号的曝光、点击、收藏、评论等数据。
4. 增加素材匹配器，把生成的草稿自动匹配本地产品图、参考图和图文卡片。
5. 增加团队审批队列，把待发布稿集中管理，支持多人审核和账号分配。
