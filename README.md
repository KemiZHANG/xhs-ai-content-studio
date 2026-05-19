# XHS Studio 小红书内容中台

## 中文说明

XHS Studio 是一个本地运行的小红书内容工作台。它把小红书 MCP、AI 文本模型、AI 图片模型和网页 UI 组合在一起，用来完成从选题研究、爆款证据分析、文案生成、图片生成到最终发布装配的完整流程。

### 主要作用

1. **小红书登录与连接检测**
   - 通过本地小红书 MCP 服务连接你的小红书登录态。
   - 页面左下角会显示“小红书已登录 / 待检测登录”。

2. **主题研究台**
   - 输入主题、内容类型、时间范围和样本数量。
   - 自动搜索相关小红书笔记。
   - 展示标题、作者、点赞、收藏、评论、链接、正文片段、评论片段和图片证据。
   - 输出研究总结，包括标题规律、正文结构、标签方向、图片风格和创作前需要补充的信息。

3. **AI 对话 / 文案创作**
   - 可以像 ChatGPT 一样自然语言追问。
   - 研究完成后进入文案创作窗口时，只带入精简文案简报，不会把原帖全文和图片证据塞给模型。
   - 支持上传产品图或参考图，让 AI 结合图片理解产品、包装、场景和风格。

4. **图片创作台**
   - 可以拖入、粘贴或上传产品图 / 参考图。
   - 可以基于产品图生成小红书场景图。
   - 也可以不上传图片，直接根据主题和图片风格简报生成原创配图。

5. **产品素材 / 参考图**
   - 管理本地上传的产品图、参考图和 AI 生成图。
   - 图片创作台生成的新图会保存到素材库。

6. **发布装配台**
   - 最终发布前统一确认标题、正文、标签、图片、可见范围和发布时间。
   - 支持立即发布和定时发布。
   - 默认建议先选择“仅自己可见”测试真实链路。

7. **任务进度与历史记录**
   - 长任务会在后台执行。
   - 可查看任务进度、历史研究记录和对话历史。

### 本地启动方式

进入项目目录：

```powershell
cd C:\Users\张祎鸣\Documents\xhs
```

启动小红书 MCP 和网页：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-xhs.ps1
```

打开网页：

```text
http://localhost:3000
```

如果页面显示小红书未登录，运行：

```powershell
.\login-xhs.ps1
```

### 日常使用流程

1. 打开 `http://localhost:3000`。
2. 进入“模型设置”，配置文本模型和图片模型 API Key。
3. 进入“一键发帖 / 主题研究台”。
4. 输入主题，例如“广州咖啡馆”“通勤包”“新品护肤礼盒”。
5. 选择时间范围、样本数量，点击“开始证据研究”。
6. 研究完成后查看真实笔记证据和研究总结。
7. 点击“进入文案创作窗口”，补充你的产品、卖点、目标人群，再发送给 AI。
8. 点击“进入图片创作台”，上传产品图或直接生成配图。
9. 进入“发布装配台”，确认文案和图片。
10. 选择“立即发布”或“定时发布”。

### 安全说明

- `data/`、`generated-assets/`、日志、API Key、本地 cookie 都不会提交到 Git。
- `tools/**/cookies.json` 已被忽略，避免把小红书登录态推送到 GitHub。
- 发布是真实外部动作，正式公开发布前建议先用“仅自己可见”测试。

---

## English Guide

XHS Studio is a local Xiaohongshu content operations workspace. It combines a Xiaohongshu MCP service, AI text models, AI image models, and a web UI to support the full workflow from topic research and evidence analysis to copy generation, image generation, final assembly, and publishing.

### What It Does

1. **Xiaohongshu Login And Connection Check**
   - Connects to your local Xiaohongshu MCP session.
   - The sidebar shows whether Xiaohongshu is logged in.

2. **Topic Research Desk**
   - Enter a topic, content type, time range, and sample count.
   - Search related Xiaohongshu posts.
   - Display titles, authors, likes, saves, comments, links, body snippets, comment snippets, and image evidence.
   - Generate a research summary covering title patterns, body structure, tag direction, image style, and missing information before creation.

3. **AI Chat / Copy Workspace**
   - Works like a ChatGPT-style web chat.
   - After research, the copy workspace only receives a compact copy brief. It does not pass full original post bodies or image evidence into the text-generation prompt.
   - Supports uploaded product or reference images so the AI can understand product shape, packaging, usage context, and style.

4. **Image Studio**
   - Drag, paste, or upload product/reference images.
   - Generate Xiaohongshu-style product scene images from product photos.
   - Or generate original images directly from the topic and image-style brief without source images.

5. **Product Assets / Reference Images**
   - Manage uploaded product images, reference images, and generated images.
   - New images created in Image Studio are saved into the asset library.

6. **Publishing Assembly Desk**
   - Final confirmation page for title, body, tags, images, visibility, and scheduled time.
   - Supports immediate publishing and scheduled publishing.
   - “Private only” is recommended for the first real publishing test.

7. **Job Progress And History**
   - Long-running workflows run in the background.
   - You can review job progress, research history, and chat history.

### How To Start Locally

Open the project directory:

```powershell
cd C:\Users\张祎鸣\Documents\xhs
```

Start the Xiaohongshu MCP service and the web app:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-xhs.ps1
```

Open:

```text
http://localhost:3000
```

If the page says Xiaohongshu is not logged in, run:

```powershell
.\login-xhs.ps1
```

### Daily Workflow

1. Open `http://localhost:3000`.
2. Go to “Model Settings” and configure the text and image model API keys.
3. Go to “One-Click Posting / Topic Research Desk”.
4. Enter a topic such as “Guangzhou coffee shops”, “commuter bag”, or “new skincare gift box”.
5. Choose the time range and sample count, then start evidence research.
6. Review the real post evidence and research summary.
7. Open the copy workspace, add product details, selling points, and target audience, then send it to the AI.
8. Open Image Studio, upload product images or generate images directly.
9. Go to the Publishing Assembly Desk and confirm copy plus images.
10. Choose immediate publishing or scheduled publishing.

### Safety Notes

- `data/`, `generated-assets/`, logs, API keys, and local cookies are not committed to Git.
- `tools/**/cookies.json` is ignored to avoid pushing Xiaohongshu login sessions to GitHub.
- Publishing is a real external action. Use “private only” before public posting.
