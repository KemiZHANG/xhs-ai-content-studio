# XHS AI Content Studio

## 中文说明

XHS AI Content Studio 是一个本地优先的小红书 AI 内容创作 Agent。它把小红书 MCP、AI 文案、AI 生图、图文卡片、帖子项目状态、发布装配、安全确认和审计日志放在同一个 Next.js 网页里，目标是让创作者围绕“一篇帖子项目”完成从研究到发布前确认的完整流程。

它不是简单的自动发帖脚本，而是一个面向小红书运营的内容工作台：

- 搜索真实小红书笔记，提取标题、正文、标签、图片和互动数据。
- 总结爆款笔记的可学习结论，而不是复制原帖。
- 基于证据生成 CreativeBrief，再统一驱动文案和图片方向。
- 生成原创标题、正文、标签、图片 Prompt 和图文卡片。
- 上传产品图，生成产品场景图或参考风格图。
- 把文案和图片装配成最终待发布帖子。
- 发布前经过 Quality Gate、人工确认、账号检查和审计记录。

### 核心功能

- **Post Studio**：主工作台。围绕一个帖子项目展示 AI 对话、Post Canvas、研究证据、CreativeBrief、图片素材和发布检查。
- **AI Agent 调度层**：根据用户自然语言判断意图，例如研究、总结、生成文案、改写、生成图片、选图、发布检查、定时发布。
- **PostProject 状态**：保存当前主题、证据包、样本、CreativeBrief、文案版本、图片方向、生成图片、最终帖子、发布计划和阶段。
- **真实证据研究**：通过 Xiaohongshu MCP 搜索和读取真实笔记，再提炼标题、正文、标签、图片、评论和用户痛点。
- **爆款库 RAG**：把高质量样本沉淀为标题钩子、正文结构、标签组合、图片风格、痛点和情绪触发点，后续创作可同时参考实时证据和历史规律。
- **原创重写**：根据研究结论和用户需求生成新内容，避免直接复制或拼接竞品内容。
- **图片创作台**：支持 AI 生图、产品图场景化、参考图生成和图文卡片渲染。
- **图文卡片引擎**：本地生成小红书常用尺寸卡片，适合干货、清单、教程、避坑类内容。
- **发布装配台**：统一确认标题、正文、标签、图片、可见范围、账号、立即发布或定时发布。
- **发布安全**：默认 `review_required`，真实发布前必须确认；后端会检查内容、图片、账号登录、重复发布和 Quality Gate。
- **发布审计**：记录发布预览、待确认、发布中、已发布、已定时、失败等事件；正文只保存哈希，不保存完整正文。
- **本地隐私**：API Key、cookies、草稿、素材和历史默认保存在本机，不提交到 Git。

### 运行要求

- Windows 10/11
- Node.js 20 或更高版本
- npm
- 一个可登录的小红书账号
- 文本模型 API Key，例如 Gemini、OpenAI 或兼容 OpenAI API 的服务
- 图片模型 API Key，例如 Gemini 2.5 Flash Image / Nano Banana、OpenAI 或兼容接口

### 快速开始

#### 1. 克隆项目

```powershell
git clone https://github.com/KemiZHANG/xhs-ai-content-studio.git
cd xhs-ai-content-studio
```

#### 2. 安装依赖

```powershell
npm install
```

#### 3. 启动网页和小红书 MCP

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-xhs.ps1
```

启动后打开：

```text
http://localhost:3000
```

启动脚本会同时启动：

- 小红书 MCP：`http://localhost:18060/mcp`
- Web 工作台：`http://localhost:3000`

#### 4. 登录小红书

如果左侧账号卡显示未登录，运行：

```powershell
.\login-xhs.ps1
```

在弹出的浏览器窗口完成小红书登录，然后回到网页刷新账号状态。

### 配置 AI 模型

打开网页左侧的 **Settings / 模型设置**：

- 普通用户：选择 Gemini 或 OpenAI，然后填写 API Key。
- 高级用户：如果使用第三方兼容接口，再填写 Base URL 和模型名称。

API Key 会保存在本地 `data/settings.json`，该目录已被 `.gitignore` 忽略，不会提交到 GitHub。

### 推荐使用流程

1. 打开 `http://localhost:3000`。
2. 在左侧确认小红书 MCP 已连接、账号已登录。
3. 在模型设置里填写文本模型和图片模型 API Key。
4. 进入 **Post Studio**，直接输入需求，例如：

```text
帮我找最近一周广州咖啡馆高收藏笔记，分析标题和图片风格，再给我生成一篇适合探店账号的图文笔记。
```

5. Agent 会搜索真实笔记、提炼证据、生成 CreativeBrief 和草稿。
6. 如果发现值得长期复用的高质量样本，可以在右侧证据面板保存到爆款库。
7. 在 Post Canvas 里检查标题、正文、标签和图片方向。
8. 到图片创作台生成 AI 图片、产品场景图或图文卡片。
9. 回到发布装配台，确认最终标题、正文、标签、图片、账号和可见范围。
10. 第一次真实发布建议使用“仅自己可见”。

### 多账号说明

项目支持保存多个小红书账号档案。每个账号档案对应一个 MCP 地址。

- 一个 MCP 服务通常对应一个小红书登录会话。
- 如果要同时管理多个账号，建议为每个账号启动独立 MCP 实例，例如 `18060`、`18061`、`18062`。
- 在模型设置里分别添加这些 MCP 地址。
- 当前搜索、发布、记忆和审计都会使用当前激活账号。

### 安全策略

默认发布策略是 `review_required`：

- 研究、生成草稿、生成图片可以直接执行。
- 真实发布会先生成确认单。
- 发布前会检查标题、正文、标签、图片、账号登录、定时时间和 Quality Gate。
- 发布审计会记录元数据和正文哈希，不保存完整正文。

可选策略：

- `draft_only`：只允许研究、草稿和图片，不允许发布。
- `review_required`：默认安全模式，发布前必须确认。
- `auto_publish_allowed`：允许更自动化的发布，但仍会经过后端安全检查。

### 常用命令

```powershell
npm run dev
npm test
npm run typecheck
npm run build
```

启动 MCP 和网页：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-xhs.ps1
```

登录小红书：

```powershell
.\login-xhs.ps1
```

### 本地数据

以下内容会在本地生成，默认不提交：

- `data/`：设置、任务、草稿、聊天历史、审计日志、模型调用统计。
- `generated-assets/`：上传图片、生成图片、图文卡片。
- `tools/**/cookies.json`：小红书登录状态。
- `.next/`：Next.js 构建缓存。
- `*.log`：运行日志。

不要把 API Key、cookies、登录状态、私有素材或生成内容提交到公开仓库。

---

## English Guide

XHS AI Content Studio is a local-first AI Agent workspace for Xiaohongshu content creation. It combines Xiaohongshu MCP, AI copywriting, AI image generation, card rendering, project state, publishing assembly, safety confirmation, and audit logs in one Next.js web app.

It is not just an auto-posting script. It is designed as an evidence-based content operations workspace:

- Search real Xiaohongshu posts and collect title, body, tags, images, and engagement signals.
- Extract reusable patterns from high-performing posts without copying them.
- Generate a CreativeBrief from evidence, then use it to drive both copy and visual direction.
- Create original titles, body copy, tags, image prompts, and image-text cards.
- Upload product images and generate product-scene visuals.
- Assemble copy and images into a final post.
- Run Quality Gate, human confirmation, account checks, and publishing audit before external publishing.

### Core Features

- **Post Studio**: The main workspace for one active post project, including AI chat, Post Canvas, research evidence, CreativeBrief, assets, and publishing checks.
- **AI Agent Orchestrator**: Detects user intent such as research, summarize, draft, revise, generate images, select images, prepare publishing, and schedule publishing.
- **PostProject State**: Stores topic, evidence pack, selected samples, CreativeBrief, copy versions, visual direction, generated images, final post, publish plan, and current stage.
- **Evidence-Based Research**: Uses Xiaohongshu MCP to search and read real notes before generating content.
- **Viral Knowledge RAG**: Saves strong samples as reusable creative patterns, including title hooks, copy structures, tag patterns, image style, pain points, and emotional triggers.
- **Original Rewriting**: Generates new Xiaohongshu content from extracted patterns and user requirements.
- **Image Studio**: Supports AI image generation, product-scene generation, reference-image generation, and local image-text card rendering.
- **Card Engine**: Renders Xiaohongshu-style card images locally for guides, lists, tutorials, and educational posts.
- **Publishing Assembly**: Reviews title, content, tags, images, visibility, account, immediate publishing, and scheduled publishing.
- **Publishing Safety**: Defaults to `review_required`; real publishing requires confirmation and backend guardrails.
- **Audit Logs**: Records publish preview, awaiting approval, publishing, published, scheduled, and failed events; stores content hashes instead of full body text.
- **Local Privacy**: API keys, cookies, drafts, assets, and history stay on the user's machine by default.

### Requirements

- Windows 10/11
- Node.js 20+
- npm
- A Xiaohongshu account
- A text model API key, such as Gemini, OpenAI, or an OpenAI-compatible provider
- An image model API key, such as Gemini 2.5 Flash Image / Nano Banana, OpenAI, or a compatible provider

### Quick Start

```powershell
git clone https://github.com/KemiZHANG/xhs-ai-content-studio.git
cd xhs-ai-content-studio
npm install
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-xhs.ps1
```

Then open:

```text
http://localhost:3000
```

The start script launches:

- Xiaohongshu MCP: `http://localhost:18060/mcp`
- Web app: `http://localhost:3000`

### Log In To Xiaohongshu

If the sidebar account card shows that Xiaohongshu is not logged in, run:

```powershell
.\login-xhs.ps1
```

Complete login in the popup window, return to the web app, and refresh the account status.

### Configure Models

Open **Settings / Model Settings**:

- For most users: choose Gemini or OpenAI and enter the API key.
- For custom OpenAI-compatible services: fill Base URL and model name in advanced settings.

API keys are stored locally in `data/settings.json`, which is ignored by Git.

### Recommended Workflow

1. Open `http://localhost:3000`.
2. Check Xiaohongshu MCP and login status in the sidebar.
3. Configure text and image model API keys.
4. Go to **Post Studio** and type a request, for example:

```text
Find high-save Guangzhou coffee shop posts from the last week, analyze title and image style, then generate a Xiaohongshu note for a cafe-review account.
```

5. The agent searches real posts, extracts evidence, creates a CreativeBrief, and drafts the post.
6. Save valuable samples into the Viral Knowledge Base when you find reusable patterns.
7. Review title, body, tags, and image direction in Post Canvas.
8. Use Image Studio to generate AI images, product-scene images, or image-text cards.
9. Use Publishing Assembly to confirm the final post, account, visibility, and schedule.
10. Use “private only” for the first real publishing test.

### Multi-Account Notes

The app can store multiple Xiaohongshu account profiles. Each profile points to one MCP endpoint.

- One MCP service usually maps to one Xiaohongshu login session.
- To manage multiple accounts, run separate MCP instances on different ports, such as `18060`, `18061`, and `18062`.
- Add each MCP endpoint as an account profile in the web app.
- Search, publishing, creator memory, and audit logs use the currently active account.

### Publishing Safety

The default policy is `review_required`:

- Research, drafting, and image generation can run directly.
- Real publishing creates a confirmation request first.
- Publishing checks title, body, tags, images, active account login, schedule time, and Quality Gate.
- The audit log stores metadata and a content hash, not the full body text.

Policies:

- `draft_only`: Research, draft, and image generation only.
- `review_required`: Default safety mode. Publishing requires confirmation.
- `auto_publish_allowed`: Allows more automation while still passing backend guardrails.

### Useful Commands

```powershell
npm run dev
npm test
npm run typecheck
npm run build
```

Start MCP and web app:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-xhs.ps1
```

Login to Xiaohongshu:

```powershell
.\login-xhs.ps1
```

### Local Data

The app creates local files that should not be committed:

- `data/`: settings, jobs, drafts, chat history, audit logs, model usage.
- `generated-assets/`: uploaded images, generated images, rendered cards.
- `tools/**/cookies.json`: Xiaohongshu login session.
- `.next/`: Next.js build cache.
- `*.log`: runtime logs.

Never commit API keys, cookies, login sessions, private assets, or generated personal content to a public repository.
