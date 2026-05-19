# XHS AI Content Studio 小红书 AI 内容中台

## 中文说明

XHS AI Content Studio 是一个本地运行的小红书内容中台。它把小红书 MCP、AI 文本模型、AI 图片模型和网页 UI 组合在一起，用来完成从选题研究、爆款证据分析、文案生成、图片生成到发布装配的完整流程。

> 适用场景：小红书运营、品牌种草、产品内容创作、探店内容分析、爆款笔记拆解、图文笔记生成与发布前整理。

### 项目能做什么

1. **连接小红书 MCP**
   - 通过本地 MCP 服务连接小红书登录态。
   - 支持检查登录状态。
   - 支持调用搜索、详情、发布等 MCP 能力。

2. **搜索与研究真实笔记**
   - 输入主题、内容类型、时间范围、样本数量。
   - 搜索相关小红书笔记。
   - 展示标题、作者、点赞、收藏、评论、链接、正文片段、评论片段和图片证据。
   - 输出标题规律、正文结构、标签方向、图片风格和创作前需要补充的信息。

3. **AI 文案创作**
   - 根据研究结论生成原创小红书标题、正文、标签和结构。
   - 文案创作只携带精简后的创作简报，不会把原帖全文和图片证据直接塞给模型。
   - 支持在网页 AI 对话里继续修改草稿。

4. **图片创作台**
   - 支持上传、拖入、粘贴产品图或参考图。
   - 可以基于产品图生成新的小红书场景图。
   - 也可以不上传图片，直接根据主题和图片风格简报生成原创配图。

5. **产品素材 / 参考图管理**
   - 管理上传的产品图、参考图和 AI 生成图。
   - 图片创作台生成的新图会自动进入素材库。

6. **发布装配台**
   - 最终发布前统一确认标题、正文、标签、图片、可见范围和发布时间。
   - 支持立即发布和定时发布。
   - 建议第一次真实测试使用“仅自己可见”。

7. **任务进度与历史记录**
   - 长任务会在后台执行。
   - 可以查看任务进度、历史研究记录和 AI 对话历史。

### 环境要求

- Windows 10/11
- Node.js 20 或更高版本
- npm
- 一个可用的小红书账号
- 一个文本模型 API Key
- 一个图片模型 API Key

默认模型配置提供 Gemini 和 OpenAI 预设。普通用户只需要选择服务商并填写自己的 API Key；只有使用第三方兼容接口时才需要展开高级设置，手动填写 Base URL 和模型名称。

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

#### 3. 启动项目

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-xhs.ps1
```

这个脚本会做两件事：

- 启动本地小红书 MCP 服务：`http://localhost:18060/mcp`
- 启动网页应用：`http://localhost:3000`

浏览器打开：

```text
http://localhost:3000
```

#### 4. 登录小红书

如果网页左下角显示“小红书未登录”或“待检测登录”，运行：

```powershell
.\login-xhs.ps1
```

根据弹出的登录窗口完成小红书登录。登录完成后回到网页刷新状态。

#### 5. 配置 AI 模型

打开网页后进入“模型设置”，填写：

- 文本模型服务商：Gemini / OpenAI / 自定义
- 文本模型 API Key
- 图片模型服务商：Gemini / OpenAI / 自定义
- 图片模型 API Key

如果选择 Gemini 或 OpenAI，Base URL 和模型名称会自动填好。只有选择“自定义”时，才需要在高级设置里填写自己的 Base URL 和模型名称。保存后，左下角会显示模型是否已配置。

### 推荐使用流程

1. 打开 `http://localhost:3000`。
2. 进入“模型设置”，配置文本模型和图片模型。
3. 进入“一键发帖 / 主题研究台”。
4. 输入主题，例如：
   - 广州咖啡馆
   - 通勤包
   - 新品护肤礼盒
   - 露营装备
5. 选择时间范围和样本数量。
6. 点击“开始证据研究”。
7. 研究完成后查看真实笔记证据、爆款样本表和研究总结。
8. 点击“进入文案创作窗口”，补充产品、卖点、目标人群，再发送给 AI。
9. 点击“进入图片创作台”，上传产品图或直接生成配图。
10. 进入“发布装配台”，确认标题、正文、标签和图片。
11. 选择“立即发布”或“定时发布”。

### 常用命令

开发启动：

```powershell
npm run dev
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

一键启动 MCP 和网页：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-xhs.ps1
```

登录小红书：

```powershell
.\login-xhs.ps1
```

### 本地数据说明

项目会在本地生成这些目录或文件：

- `data/`：设置、任务、历史记录、草稿、聊天记录。
- `generated-assets/`：上传图片、生成图片、缓存图片。
- `*.log`：运行日志。
- `tools/**/cookies.json`：小红书登录态。

这些文件默认不会提交到 Git。

### 安全提醒

- 不要把自己的 API Key、cookie、登录态文件提交到 GitHub。
- 发布是真实外部动作，第一次测试建议选择“仅自己可见”。
- 如果要公开仓库，请先确认没有提交任何个人数据、登录状态或生成素材。

---

## English Guide

XHS AI Content Studio is a local Xiaohongshu content operations workspace. It combines a Xiaohongshu MCP service, AI text models, AI image models, and a web UI to support topic research, viral post analysis, copy generation, image generation, final assembly, and publishing.

> Use cases: Xiaohongshu operations, brand seeding, product content creation, post research, viral note analysis, image-text note generation, and publishing preparation.

### What This Project Does

1. **Connect To Xiaohongshu MCP**
   - Connects to a local Xiaohongshu MCP service.
   - Checks whether the Xiaohongshu account is logged in.
   - Uses MCP tools for search, post detail fetching, and publishing.

2. **Search And Research Real Posts**
   - Enter a topic, content type, time range, and sample count.
   - Search related Xiaohongshu posts.
   - Display titles, authors, likes, saves, comments, links, body snippets, comment snippets, and image evidence.
   - Generate insights about title patterns, body structure, tag direction, image style, and missing information before creation.

3. **AI Copy Creation**
   - Generate original Xiaohongshu titles, body copy, tags, and structure from research insights.
   - The copy workspace only receives a compact creative brief. It does not pass full original post bodies or image evidence into the text model.
   - Supports continuing draft edits inside the web AI chat.

4. **Image Studio**
   - Upload, drag, or paste product/reference images.
   - Generate Xiaohongshu-style product scene images from product photos.
   - Or generate original images directly from topic and image-style briefs without source images.

5. **Product Assets / Reference Images**
   - Manage uploaded product images, reference images, and generated images.
   - Images generated in Image Studio are saved into the asset library.

6. **Publishing Assembly Desk**
   - Final confirmation page for title, body, tags, images, visibility, and scheduled time.
   - Supports immediate publishing and scheduled publishing.
   - “Private only” is recommended for the first real publishing test.

7. **Job Progress And History**
   - Long-running workflows run in the background.
   - Review job progress, research history, and AI chat history.

### Requirements

- Windows 10/11
- Node.js 20 or later
- npm
- A Xiaohongshu account
- A text model API key
- An image model API key

The default model settings provide Gemini and OpenAI presets. Most users only need to choose a provider and enter their own API key. Base URL and model names are only needed when using a custom OpenAI-compatible provider.

### Quick Start

#### 1. Clone The Repository

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

This script starts:

- Xiaohongshu MCP service: `http://localhost:18060/mcp`
- Web app: `http://localhost:3000`

Open:

```text
http://localhost:3000
```

#### 4. Login To Xiaohongshu

If the sidebar says Xiaohongshu is not logged in, run:

```powershell
.\login-xhs.ps1
```

Complete login in the popup window, then return to the web app and refresh the status.

#### 5. Configure AI Models

Open “Model Settings” in the web app and fill in:

- Text model provider: Gemini / OpenAI / Custom
- Text model API key
- Image model provider: Gemini / OpenAI / Custom
- Image model API key

If you choose Gemini or OpenAI, Base URL and model names are filled automatically. Only choose “Custom” when you need to enter your own Base URL and model names. After saving, the sidebar will show whether the models are configured.

### Recommended Workflow

1. Open `http://localhost:3000`.
2. Go to “Model Settings” and configure the text and image models.
3. Go to “One-Click Posting / Topic Research Desk”.
4. Enter a topic, such as:
   - Guangzhou coffee shops
   - commuter bag
   - new skincare gift box
   - camping gear
5. Choose the time range and sample count.
6. Click “Start Evidence Research”.
7. Review real post evidence, the sample table, and the research summary.
8. Open the copy workspace, add product details, selling points, and target audience, then send it to the AI.
9. Open Image Studio, upload product images or generate images directly.
10. Go to the Publishing Assembly Desk and confirm title, body, tags, and images.
11. Choose immediate publishing or scheduled publishing.

### Useful Commands

Development server:

```powershell
npm run dev
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

Start MCP and web app together:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-xhs.ps1
```

Login to Xiaohongshu:

```powershell
.\login-xhs.ps1
```

### Local Data

The project creates local files and folders:

- `data/`: settings, jobs, history, drafts, chat history.
- `generated-assets/`: uploaded images, generated images, cached images.
- `*.log`: runtime logs.
- `tools/**/cookies.json`: Xiaohongshu login session.

These files are ignored by Git by default.

### Safety Notes

- Do not commit API keys, cookies, or login session files.
- Publishing is a real external action. Use “private only” for the first real test.
- Before making the repository public, make sure no personal data, login sessions, or generated private assets have been committed.
