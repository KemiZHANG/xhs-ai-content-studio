# XHS AI Content Studio

## 中文说明

XHS AI Content Studio 是一个本地优先的小红书 AI 内容创作 Agent。它把小红书 MCP、真实笔记研究、爆款库 RAG、CreativeBrief、AI 文案、AI 生图、图文卡片、PostProject 状态、发布检查、人工确认和审计日志集中到一个 Next.js 网页里。

它不是简单的自动发帖脚本，而是围绕“一篇帖子项目”运行的内容工作台：先研究真实笔记和历史爆款规律，再生成统一 CreativeBrief，然后让文案、图片方向和最终发布稿都能追溯到证据。

### 核心能力

- **Post Studio**：主工作台。日常创作从这里开始，也回到这里完成发布确认。
- **PostProject**：统一保存主题、产品信息、人群、目标、证据包、CreativeBrief、文案版本、图片方向、生成图片、最终帖子、发布计划和当前阶段。
- **AI Agent**：读取当前 PostProject，理解“找笔记”“生成文案”“再生活化一点”“用第二张图”“今晚 8 点发”等上下文指令。
- **真实小红书研究**：通过 Xiaohongshu MCP 搜索笔记、读取详情、提取标题、正文、标签、图片、评论和互动数据。
- **爆款库 RAG**：把高质量样本沉淀为可复用规律，例如标题钩子、正文结构、标签组合、图片风格、人群痛点和情绪触发点。它不是保存原文给 AI 仿写。
- **CreativeBrief**：统一驱动文案和图片，避免标题、正文和视觉方向割裂。
- **图像与卡片**：支持 AI 生图、产品图场景化、参考图生成和 1080x1440 小红书图文卡片。
- **Quality Gate**：发布前检查标题夸张、广告感、标签堆砌、图文一致、虚假认证、虚假销量、功效夸大和产品外观改变等风险。
- **发布安全**：默认 `review_required`。真实发布前必须人工确认账号、可见范围、文案、图片、定时时间和时区。
- **审计记录**：记录发布预览、确认、发布、定时、失败等事件；正文只保留哈希和元数据。

### 快速开始

```powershell
git clone https://github.com/KemiZHANG/xhs-ai-content-studio.git
cd xhs-ai-content-studio
npm install
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-xhs.ps1
```

打开：

```text
http://localhost:3000
```

启动脚本会启动：

- Web app：`http://localhost:3000`
- Xiaohongshu MCP：`http://localhost:18060/mcp`

### 登录小红书

如果页面左侧账号卡显示未登录，运行：

```powershell
.\login-xhs.ps1
```

在弹出的浏览器里完成登录，然后回到网页点击账号检测或刷新页面。

### 配置 AI 模型

打开 **Settings / 模型设置**：

- 普通用户：选择 Gemini 或 OpenAI，填入 API Key。
- 高级用户：如果使用 OpenAI-compatible 服务，再填写 Base URL 和模型名称。
- 图片生成：配置图片模型 API Key，例如 Gemini 2.5 Flash Image / Nano Banana 或其他兼容模型。

API Key 默认保存到本地 `data/settings.json`，该目录已被 `.gitignore` 忽略，不会提交到 GitHub。

### 推荐工作流

1. 打开 `http://localhost:3000`。
2. 确认小红书 MCP 已连接、当前账号已登录。
   - 也可以通过 `http://localhost:3000/api/health/mcp` 检查 MCP 是否可达和是否已登录。
3. 进入 **Post Studio**。
4. 输入自然语言需求，例如：

```text
帮我找最近一周广州咖啡馆高收藏笔记，分析标题、正文、标签和图片风格，再给我生成一篇适合探店账号的图文笔记。
```

5. Agent 会搜索真实笔记，生成证据摘要和 CreativeBrief。
6. 你可以把高质量样本保存到爆款库，后续创作会同时参考实时证据和历史爆款规律。
7. 在 Post Canvas 检查并编辑标题、正文、标签、图片方向和图片。
8. 运行 Quality Gate。
9. 生成发布确认单。第一次真实发布建议选择“仅自己可见”。
10. 人工确认账号、可见范围、最终文案、图片版本、定时时间和时区后，再执行真实发布。

> 高级主题研究、旧版 AI 工作台、高级图片工具和备用发布装配页仍然保留，主要用于排查、批量处理或兼容旧流程。日常创作建议始终从 **Post Studio** 开始并回到 **Post Studio** 完成确认。

### Post Studio 常用指令

```text
新建项目：主题是广州咖啡馆，目标人群是周末探店女生，语气真实生活化。
帮我找最近一周广州咖啡馆高收藏笔记，分析标题、正文、标签和图片风格。
把高质量样本保存到爆款库，并基于实时证据和爆款库规律生成 CreativeBrief。
基于当前 CreativeBrief 生成一篇原创小红书图文笔记，不要重新搜索。
把标题再生活化一点，正文减少广告感。
确认当前图片方向，然后生成 3 张小红书封面图。
就用第二张图，把当前文案和图片组装成最终帖子并运行 Quality Gate。
今晚 8 点生成定时发布确认单，仅自己可见。
```

Agent 会读取当前 PostProject，所以“再生活化一点”“用第二张图”“今晚 8 点发”会作用在当前帖子项目上。真实发布仍需要在发布检查区人工确认。

### 多账号说明

项目支持保存多个小红书账号档案。每个账号档案对应一个 MCP 地址。

- 一个 MCP 服务通常对应一个小红书登录会话。
- 多账号建议启动多个独立 MCP 实例，例如 `18060`、`18061`、`18062`。
- 在 Settings 中添加这些 MCP 地址并切换当前账号。
- 搜索、记忆、发布检查和审计都以当前激活账号为准。
- 切换账号后，旧发布确认单必须失效并重新生成。

完整配置和验收见 [多账号验收指南](docs/multi-account-acceptance.md)。

### 发布安全

默认策略是 `review_required`：

- 研究、草稿和图片生成可以直接执行。
- 真实发布会先生成确认单。
- 确认前不会调用小红书发布。
- 发布前会检查标题、正文、标签、图片、账号登录、定时时间和 Quality Gate。
- 点击人工确认后才会调用小红书 MCP 的发布能力。

可选策略：

- `draft_only`：只允许研究、草稿和图片，不允许发布。
- `review_required`：默认安全模式，发布前必须确认。
- `auto_publish_allowed`：允许更高自动化，但仍会经过后端 guardrails。

### 验收清单

本地完整验收请看 [Post Studio 验收清单](docs/post-studio-acceptance.md)。它覆盖新建 PostProject、真实研究、爆款库 RAG、CreativeBrief、文案、图片、最终帖子、Quality Gate 和发布确认。

当前完成度和剩余人工闸门见 [目标完成矩阵](docs/goal-completion-matrix.md)。真实发布和定时发布需要你明确授权后再测试，并按 [真实发布验收指南](docs/real-publish-acceptance.md) 操作。多账号真实切换按 [多账号验收指南](docs/multi-account-acceptance.md) 操作。

### 安全 Smoke 和验收命令

只读安全检查：

```powershell
npm run smoke:safe
npm run smoke:local
npm run smoke:accounts
npm run smoke:studio-state
npm run smoke:chat-stream
npm run smoke:publish-dry-run
npm run smoke:acceptance-status
```

真实研究最小链路：

```powershell
npm run smoke:research
```

完整本地验证：

```powershell
npm run verify
npm run acceptance
npm test
npm run typecheck
npm run build
```

验收证据导出和记录：

```powershell
npm run acceptance:status
npm run acceptance:completion-matrix
npm run acceptance:evidence-package
npm run acceptance:validate-evidence
npm run acceptance:record-evidence
npm run acceptance:export-records
node scripts/import-acceptance-validation-records.mjs --dry-run
```

也可以访问只读接口：

```text
http://localhost:3000/api/acceptance/status
http://localhost:3000/api/acceptance/completion-matrix
http://localhost:3000/api/acceptance/evidence-package
```

`/api/acceptance/evidence-package` 会返回只读验收证据模板 `evidencePackage`，其中包含每个真实外部闸门的 `evidenceRecordTemplate`，默认导出到 `data/manual-acceptance-evidence-package.json`。`/api/acceptance/completion-matrix` 可导出 machine-readable JSON 到 `data/acceptance-completion-matrix.json`，也可以用 `XHS_ACCEPTANCE_MATRIX_PATH` 指定输出路径。这些接口和命令不会调用 MCP、模型、发布或定时任务。

`npm run acceptance:status` 用于读取 current completion and external manual gates。`npm run acceptance:evidence-package` 默认写入 `data/manual-acceptance-evidence-package.json`，也可以用 `XHS_ACCEPTANCE_EVIDENCE_PATH` 指定输出路径。`npm run acceptance:validate-evidence` 只校验本地 JSON（legacy anchor: 鍙牎楠屾湰鍦?JSON），默认写入 `data/manual-acceptance-validation-report.json`，也可以用 `XHS_ACCEPTANCE_REPORT_PATH` 指定报告路径。`npm run acceptance:record-evidence` 会提交到 `/api/acceptance/validation-records`，只写入本地验收记录（legacy anchor: 鍙啓鍏ユ湰鍦伴獙鏀惰褰?）。`npm run acceptance:export-records` 导出 validation records 到 `data/acceptance-validation-records-export.json`，也可以用 `XHS_ACCEPTANCE_RECORDS_PATH` 指定输出路径。

### 本地数据与隐私

以下内容会在本地生成，默认不提交：

- `data/`：设置、任务、草稿、聊天历史、审计日志、模型调用统计。
- `generated-assets/`：上传图片、生成图片、图文卡片。
- `tools/**/cookies.json`：小红书登录状态。
- `.next/`：Next.js 构建缓存。
- `*.log`：运行日志。

不要把 API Key、cookies、登录状态、私有素材或生成内容提交到公开仓库。

### 常见排障

- 如果脚本直接调用 `/api/chat` 返回 `403`，说明本地 action token 保护正在工作。网页会自动刷新并携带 `X-XHS-Action-Token`，普通使用不需要手动处理。

---

## English Guide

XHS AI Content Studio is a local-first AI Agent workspace for Xiaohongshu content creation. It combines Xiaohongshu MCP, real note research, Viral Knowledge RAG, CreativeBrief, AI copywriting, AI image generation, image-text card rendering, PostProject state, publishing checks, human confirmation, and audit logs in one Next.js app.

It is not a simple auto-posting script. It is an evidence-based content workspace centered on one post project: research real notes and reusable viral patterns, generate a shared CreativeBrief, then use the same evidence to drive copy, visuals, and final publishing review.

### Core Features

- **Post Studio**: The main workspace. Daily creation starts here and returns here for publishing confirmation.
- **PostProject**: Stores topic, product info, audience, goal, evidencePack, CreativeBrief, copy versions, visual direction, generated images, final post, publish plan, and current stage.
- **AI Agent**: Reads the active PostProject and understands contextual commands like "make it more natural", "use the second image", and "post tonight at 8".
- **Real Xiaohongshu Research**: Uses Xiaohongshu MCP to search notes, read details, and extract title, body, tags, images, comments, and engagement data.
- **Viral Knowledge RAG**: Saves strong samples as reusable creative patterns instead of copyable source text.
- **CreativeBrief**: Drives both copy and visual direction.
- **Images And Cards**: Supports AI images, product-scene images, reference-image generation, and 1080x1440 Xiaohongshu cards.
- **Quality Gate**: Checks exaggeration, ad tone, tag stuffing, visual consistency, false claims, fake data, and product appearance risks.
- **Publishing Safety**: Defaults to `review_required`. Real publishing requires human confirmation of account, visibility, copy, images, schedule time, and timezone.
- **Audit Logs**: Records publish preview, confirmation, published, scheduled, and failed events. Body text is stored as hashes and metadata.

### Quick Start

```powershell
git clone https://github.com/KemiZHANG/xhs-ai-content-studio.git
cd xhs-ai-content-studio
npm install
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-xhs.ps1
```

Open:

```text
http://localhost:3000
```

The start script launches:

- Web app: `http://localhost:3000`
- Xiaohongshu MCP: `http://localhost:18060/mcp`

### Log In To Xiaohongshu

If the sidebar account card shows that Xiaohongshu is not logged in, run:

```powershell
.\login-xhs.ps1
```

Complete login in the popup browser, return to the app, and refresh account status.

### Configure Models

Open **Settings / Model Settings**:

- Most users: choose Gemini or OpenAI and enter an API key.
- Advanced users: fill Base URL and model name for OpenAI-compatible services.
- Image generation: configure an image model API key such as Gemini 2.5 Flash Image / Nano Banana or another compatible model.

API keys are stored locally in `data/settings.json`, which is ignored by Git.

### Recommended Workflow

1. Open `http://localhost:3000`.
2. Confirm Xiaohongshu MCP and login status.
   - You can also check `http://localhost:3000/api/health/mcp`.
3. Go to **Post Studio**.
4. Type a request:

```text
Find high-save Guangzhou coffee shop posts from the last week, analyze titles, body copy, tags, and image style, then generate a Xiaohongshu note for a cafe-review account.
```

5. The agent searches real notes, creates evidence summaries, and builds a CreativeBrief.
6. Save strong samples into the Viral Knowledge Base when useful.
7. Review and edit title, body, tags, visual direction, and images in Post Canvas.
8. Run Quality Gate.
9. Create a publish confirmation. Use private visibility for the first real publishing test.
10. Manually confirm account, visibility, final copy, image versions, schedule time, and timezone before real publishing.

### Useful Post Studio Prompts

```text
Start a new project: topic is Guangzhou coffee shops, audience is weekend cafe visitors, tone is honest and lifestyle-driven.
Find high-save Guangzhou coffee shop notes from the last week and analyze titles, copy, tags, and image style.
Save strong samples to the Viral Knowledge Base, then create a CreativeBrief from realtime evidence and viral patterns.
Generate an original Xiaohongshu note from the current CreativeBrief without searching again.
Make the title more natural and reduce the advertising tone in the body copy.
Confirm the current visual direction, then generate 3 Xiaohongshu cover images.
Use the second image, assemble the current copy and image into the final post, and run Quality Gate.
Create a private scheduled publish confirmation for 8 PM tonight.
```

The agent reads the active PostProject, so contextual commands apply to the current post project. Real publishing still requires manual confirmation.

### Multi-Account Notes

The app can store multiple Xiaohongshu account profiles. Each profile points to one MCP endpoint.

- One MCP service usually maps to one Xiaohongshu login session.
- To manage multiple accounts, run separate MCP instances on different ports such as `18060`, `18061`, and `18062`.
- Add each MCP endpoint in Settings.
- Search, memory, publishing checks, and audit logs use the active account.
- After switching accounts, regenerate the publishing confirmation before any real external action.

See the [multi-account acceptance guide](docs/multi-account-acceptance.md).

### Publishing Safety

The default policy is `review_required`:

- Research, drafting, and image generation can run directly.
- Real publishing creates a confirmation request first.
- Publishing is not called before confirmation.
- Publishing checks title, body, tags, images, active account login, schedule time, and Quality Gate.
- Only the final manual confirmation triggers the Xiaohongshu MCP publishing action.

Policies:

- `draft_only`: Research, draft, and image generation only.
- `review_required`: Default safety mode. Publishing requires confirmation.
- `auto_publish_allowed`: Allows more automation while still passing backend guardrails.

### Acceptance Checklist

To verify the local workspace end to end, follow the [Post Studio acceptance checklist](docs/post-studio-acceptance.md). It covers a clean PostProject, real research, Viral Knowledge RAG, CreativeBrief, copy, images, final post assembly, Quality Gate, and publishing confirmation.

Current completion status and manual gates are listed in the [goal completion matrix](docs/goal-completion-matrix.md). Real publishing and scheduled publishing should only be tested after explicit user authorization with the [real publishing acceptance guide](docs/real-publish-acceptance.md). Multi-account switching should be validated with the [multi-account acceptance guide](docs/multi-account-acceptance.md).

### Smoke And Acceptance Commands

Safe read-only checks:

```powershell
npm run smoke:safe
npm run smoke:local
npm run smoke:accounts
npm run smoke:studio-state
npm run smoke:chat-stream
npm run smoke:publish-dry-run
npm run smoke:acceptance-status
```

Real research smoke:

```powershell
npm run smoke:research
```

Full local verification:

```powershell
npm run verify
npm run acceptance
npm test
npm run typecheck
npm run build
```

Acceptance evidence export and recording:

```powershell
npm run acceptance:status
npm run acceptance:completion-matrix
npm run acceptance:evidence-package
npm run acceptance:validate-evidence
npm run acceptance:record-evidence
npm run acceptance:export-records
node scripts/import-acceptance-validation-records.mjs --dry-run
```

Read-only endpoints:

```text
http://localhost:3000/api/acceptance/status
http://localhost:3000/api/acceptance/completion-matrix
http://localhost:3000/api/acceptance/evidence-package
```

`/api/acceptance/evidence-package` exports a read-only validation evidence template, usually to `data/manual-acceptance-evidence-package.json`. `/api/acceptance/completion-matrix` can export machine-readable JSON to `data/acceptance-completion-matrix.json`; set `XHS_ACCEPTANCE_MATRIX_PATH` to choose another output path. These commands and endpoints do not call MCP, models, publishing, or scheduled publishing.

`npm run acceptance:status` reads the current completion and external manual gates. `npm run acceptance:evidence-package` writes `data/manual-acceptance-evidence-package.json` by default; set `XHS_ACCEPTANCE_EVIDENCE_PATH` to choose another output path. `npm run acceptance:validate-evidence` only validates the local JSON file and writes `data/manual-acceptance-validation-report.json` by default; set `XHS_ACCEPTANCE_REPORT_PATH` to choose another report path. `npm run acceptance:record-evidence` posts to `/api/acceptance/validation-records` and only writes local acceptance records. `npm run acceptance:export-records` exports validation records to `data/acceptance-validation-records-export.json`; set `XHS_ACCEPTANCE_RECORDS_PATH` to choose another output path.

### Local Data And Privacy

Local generated files are ignored by Git:

- `data/`: settings, jobs, drafts, chat history, audit logs, model usage.
- `generated-assets/`: uploaded images, generated images, rendered cards.
- `tools/**/cookies.json`: Xiaohongshu login session.
- `.next/`: Next.js build cache.
- `*.log`: runtime logs.

Never commit API keys, cookies, login sessions, private assets, or generated personal content to a public repository.

### Troubleshooting

- If direct script calls to `/api/chat` return `403`, the local action-token guard is working. The web client refreshes and sends `X-XHS-Action-Token` automatically.
