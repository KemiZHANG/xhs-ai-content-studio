# XHS AI Content Studio

## 中文说明

XHS AI Content Studio 是一个本地优先的小红书 AI Agent 内容工作台。它把小红书 MCP、文本模型、图片模型、图文卡片生成、发布装配和安全审计放在同一个网页里，帮助创作者和运营人员完成从选题研究到发布前确认的完整流程。

适合场景：

- 小红书选题研究和爆款笔记拆解
- 标题、正文、标签、图片风格分析
- 基于证据生成原创笔记，而不是复制拼接
- 产品图场景化、生图、图文卡片生成
- 多步骤 AI 对话创作
- 发布前装配、定时发布和审计留痕

### 核心能力

- **AI Agent 主工作台**：在同一个对话里搜索笔记、分析证据、生成草稿、生成图片、准备发布。
- **真实证据研究**：通过 Xiaohongshu MCP 搜索和读取真实笔记，再提炼标题、正文、标签和图片规律。
- **原创重写**：基于研究总结生成新的标题、正文和标签，避免直接复制原帖。
- **图片创作台**：支持 AI 生图、产品图场景化和本地图文卡片渲染。
- **成果画布**：右侧实时展示当前研究、草稿、图片、发布计划和任务进度。
- **发布装配台**：在发布前统一检查标题、正文、标签、图片、可见范围和定时时间。
- **发布安全**：默认需要确认，记录发布审计日志，正文只保存哈希，不保存全文。
- **本地隐私**：API Key、cookie、草稿、素材、历史记录默认都保存在使用者自己的电脑上，不提交到 Git。

### 环境要求

- Windows 10/11
- Node.js 20 或更高版本
- npm
- 一个可登录的小红书账号
- 一个文本模型 API Key，例如 Gemini、OpenAI 或兼容 OpenAI API 的服务
- 一个图片模型 API Key，例如 Gemini 2.5 Flash Image / Nano Banana、OpenAI 或兼容接口

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

`start-xhs.ps1` 会同时启动：

- 小红书 MCP：`http://localhost:18060/mcp`
- Web 工作台：`http://localhost:3000`

#### 4. 登录小红书

如果网页左侧账号卡显示未登录或 MCP 未连接，先确认 MCP 已启动，然后运行：

```powershell
.\login-xhs.ps1
```

在弹出的登录窗口完成小红书登录后，回到网页点击左侧账号卡里的“检测”。

### 配置 AI 模型

进入网页左侧的“模型设置”，填写：

- 文本模型服务商：Gemini / OpenAI / 自定义
- 文本模型 API Key
- 图片模型服务商：Gemini / OpenAI / 自定义
- 图片模型 API Key

普通用户通常只需要选择 Gemini 或 OpenAI 并填写 API Key。Base URL 和模型名称会自动填好。只有使用第三方兼容接口时，才需要展开高级设置手动填写 Base URL 和模型名称。

API Key 会保存在本地 `data/settings.json`，该目录已经被 `.gitignore` 忽略，不会提交到 GitHub。

### 推荐使用流程

1. 打开 `http://localhost:3000`。
2. 在左侧账号卡确认小红书 MCP 和登录状态。
3. 进入“模型设置”，配置文本模型和图片模型。
4. 回到“AI 工作台”，直接输入需求，例如：

```text
帮我找最近一周广州咖啡馆高收藏笔记，分析标题和图片风格，再给我生成一篇适合探店账号的图文笔记。
```

5. Agent 会根据需求搜索、分析、生成草稿，并把结果同步到右侧成果画布。
6. 如果需要图片，可以进入“图片创作台”生成 AI 图片或图文卡片。
7. 最后进入“发布装配台”，检查标题、正文、标签、图片和可见范围。
8. 首次真实发布建议选择“仅自己可见”。

### 多账号说明

当前版本支持在网页里保存多个“小红书账号档案”，每个账号档案对应一个 MCP 地址。你可以在左侧账号卡快速切换当前激活账号，也可以在“模型设置”里新增或编辑账号档案。

需要注意：

- 一个 MCP 服务通常只对应一个小红书登录态。
- 如果要同时管理多个小红书账号，建议为每个账号启动独立 MCP 实例，并使用不同端口，例如 `18060`、`18061`、`18062`。
- 然后在网页“模型设置”里分别添加这些 MCP 地址，再通过左侧账号卡切换。
- 当前发布、搜索、AI 记忆和审计都会使用“当前激活账号”。

### 发布安全策略

项目默认使用 `review_required` 发布策略：

- 研究、草稿、图片生成可以直接执行。
- 真实发布前会生成发布确认单。
- 发布记录会写入审计日志。
- 审计日志只保存标题、标签、图片数量、可见范围、账号、MCP 地址、状态和正文哈希，不保存正文全文。

你可以在“模型设置”里调整发布策略：

- `draft_only`：只允许研究、草稿和图片，不允许发布。
- `review_required`：默认安全模式，发布前必须确认。
- `auto_publish_allowed`：允许更自动化的发布，但仍会经过后端安全检查。

### 常用命令

启动开发服务：

```powershell
npm run dev
```

启动 MCP 和网页：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-xhs.ps1
```

登录小红书：

```powershell
.\login-xhs.ps1
```

运行测试：

```powershell
npm test
```

类型检查：

```powershell
npm run typecheck
```

生产构建：

```powershell
npm run build
```

### 本地数据

这些文件和目录会在本地生成，并且默认不会提交：

- `data/`：设置、任务、草稿、聊天记录、审计日志、模型调用统计。
- `generated-assets/`：上传图片、生成图片、图文卡片。
- `tools/**/cookies.json`：小红书登录态。
- `.next/`：Next.js 构建缓存。
- `*.log`：运行日志。

不要把 API Key、cookie、登录态、私有素材或生成结果提交到公开仓库。

### 项目结构

```text
app/                  Next.js 页面和 API 路由
app/components/       前端面板组件
lib/agent/            Agent 调度、工具注册、状态、发布保护
lib/workflows/        小红书研究和内容生成流程
lib/images/           图片生成相关逻辑
lib/cards/            本地图文卡片渲染
lib/mcp/              MCP HTTP 客户端
lib/storage/          本地 JSON 存储
tests/                Vitest 测试
tools/xiaohongshu-mcp 小红书 MCP 可执行文件
```

---

## English Guide

XHS AI Content Studio is a local-first AI Agent workspace for Xiaohongshu content operations. It combines Xiaohongshu MCP, text models, image models, card rendering, publishing assembly, and safety auditing in one web app.

It is designed for:

- Xiaohongshu topic research
- High-performing post analysis
- Title, body, tag, and image-style extraction
- Original rewriting based on evidence
- Product-scene image generation
- Image-text card creation
- Publishing assembly, scheduling, and audit trails

### Core Features

- **AI Agent Workbench**: Search posts, analyze evidence, generate drafts, create images, and prepare publishing in one conversation.
- **Evidence-Based Research**: Uses Xiaohongshu MCP to collect real posts before generating content.
- **Original Copywriting**: Generates new titles, body copy, and tags from extracted patterns instead of copying source posts.
- **Image Studio**: Supports AI image generation, product-image scene generation, and local image-text card rendering.
- **Workspace Canvas**: Shows current research, draft, selected images, publishing plan, and job progress in real time.
- **Publishing Assembly**: Checks title, body, tags, images, visibility, and schedule before publishing.
- **Safety Guardrails**: Publishing requires review by default and writes audit records without storing full draft content.
- **Local Privacy**: API keys, cookies, drafts, assets, and histories stay on the user's own machine.

### Requirements

- Windows 10/11
- Node.js 20 or later
- npm
- A Xiaohongshu account
- A text model API key, such as Gemini, OpenAI, or an OpenAI-compatible provider
- An image model API key, such as Gemini 2.5 Flash Image / Nano Banana, OpenAI, or a compatible provider

### Quick Start

#### 1. Clone

```powershell
git clone https://github.com/KemiZHANG/xhs-ai-content-studio.git
cd xhs-ai-content-studio
```

#### 2. Install Dependencies

```powershell
npm install
```

#### 3. Start The App

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-xhs.ps1
```

Then open:

```text
http://localhost:3000
```

The start script launches:

- Xiaohongshu MCP: `http://localhost:18060/mcp`
- Web app: `http://localhost:3000`

#### 4. Log In To Xiaohongshu

If the account card in the sidebar shows that Xiaohongshu is not logged in, run:

```powershell
.\login-xhs.ps1
```

Complete login in the popup window, return to the web app, and click "Check" in the sidebar account card.

### Configure AI Models

Open "Model Settings" in the web app and configure:

- Text model provider: Gemini / OpenAI / Custom
- Text model API key
- Image model provider: Gemini / OpenAI / Custom
- Image model API key

Most users only need to choose Gemini or OpenAI and enter their API keys. Base URL and model names are filled automatically. Use the advanced fields only for custom OpenAI-compatible providers.

API keys are stored locally in `data/settings.json`, which is ignored by Git.

### Recommended Workflow

1. Open `http://localhost:3000`.
2. Check the Xiaohongshu account status in the sidebar account card.
3. Configure text and image models in "Model Settings".
4. Go to "AI Workbench" and type a request, for example:

```text
Find high-save Guangzhou coffee shop posts from the last week, analyze title and image style, then generate a Xiaohongshu note for a cafe-review account.
```

5. The agent searches, analyzes, drafts, and syncs results to the right-side workspace canvas.
6. Use "Image Studio" to generate AI images or image-text cards when needed.
7. Use "Publishing Assembly" to review title, body, tags, images, and visibility.
8. Use "Private only" for the first real publishing test.

### Multi-Account Notes

The app can store multiple Xiaohongshu account profiles. Each profile points to one MCP endpoint. You can switch the active account from the sidebar account card, or manage profiles in "Model Settings".

Important notes:

- One MCP service usually maps to one Xiaohongshu login session.
- To manage multiple accounts at the same time, run separate MCP instances on different ports, such as `18060`, `18061`, and `18062`.
- Add each MCP endpoint as an account profile in the web app.
- Search, publishing, creator memory, and audit logs use the currently active account.

### Publishing Safety

The default policy is `review_required`:

- Research, drafting, and image generation can run directly.
- Real publishing creates a confirmation request first.
- Publishing events are recorded in the audit log.
- The audit log stores metadata and a content hash, not the full draft body.

Available policies:

- `draft_only`: Research, draft, and image generation only.
- `review_required`: Default safety mode. Publishing requires confirmation.
- `auto_publish_allowed`: Allows more automation, while still passing backend guardrails.

### Useful Commands

Development server:

```powershell
npm run dev
```

Start MCP and web app:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-xhs.ps1
```

Login to Xiaohongshu:

```powershell
.\login-xhs.ps1
```

Run tests:

```powershell
npm test
```

Type check:

```powershell
npm run typecheck
```

Production build:

```powershell
npm run build
```

### Local Data

The app creates local files that should not be committed:

- `data/`: settings, jobs, drafts, chat history, audit logs, model usage.
- `generated-assets/`: uploaded images, generated images, rendered cards.
- `tools/**/cookies.json`: Xiaohongshu login session.
- `.next/`: Next.js build cache.
- `*.log`: runtime logs.

Never commit API keys, cookies, login sessions, private assets, or generated personal content to a public repository.
