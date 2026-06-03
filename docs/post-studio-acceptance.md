# Post Studio 验收清单

这份清单用于验证 XHS AI Content Studio 是否已经像“围绕一个帖子项目运行的创作 Agent”，而不是分散的聊天、研究、图片和发布工具。

## 1. 基础启动

1. 运行 `npm install`。
2. 运行 `powershell -NoProfile -ExecutionPolicy Bypass -File .\start-xhs.ps1`。
3. 打开 `http://localhost:3000`。
4. 在侧边栏确认当前入口是 **Post Studio**。
5. 在 Settings 中确认文本模型和图片模型已经配置。
6. 在账号区域确认小红书 MCP 可访问，并能看到当前账号状态。
7. 如需接口级确认，可访问 `/api/health/mcp`，结果应显示 `reachable: true`、`loggedIn: true`。
8. 启动网页后可运行 `npm run smoke:safe`，确认网页、MCP、登录状态、当前 PostProject 和发布 dry-run 预览都可用。
9. 也可单独运行 `npm run smoke:local`，确认网页、MCP、登录状态和当前 PostProject 都可读。
10. 如需验证真实研究链路，可运行 `npm run smoke:research`，它只搜索、读取详情和生成证据，不生成草稿、不生成图片、不发布。
11. 如需验证发布接口仍停留在预览/确认单阶段，可运行 `npm run smoke:publish-dry-run`，它只调用 dry-run，不确认、不定时、不发布。

通过标准：
- 页面默认把日常创作引导回 Post Studio。
- 旧页面仍可进入，但文案明确它们是高级/备用入口。
- 未登录或模型缺失时，页面能给出可理解的状态提示。
- 如果健康检查返回 `fetch failed`，先启动 MCP 或重新登录，不要把它判断成 Post Studio 前端损坏。
- `npm run smoke:safe` 是默认安全 smoke，组合健康检查和发布 dry-run，不搜索、不生图、不发布。
- `npm run smoke:local` 是只读检查，不会搜索、生成图片或发布。
- `npm run smoke:research` 是研究链路检查，会读取小红书真实数据，但强制 `research` 模式，不会调用发布接口。
- `npm run smoke:publish-dry-run` 是发布预览检查，只验证确认单和风险提示，不会触发小红书写入动作。

## 2. 新建 PostProject

1. 点击新建项目。
2. 输入一个新主题，例如“广州咖啡馆探店”。
3. 查看顶部项目卡片。

通过标准：
- 顶部显示当前主题、阶段、保存状态、账号状态和下一步建议。
- 页面说明旧证据、旧草稿、旧图片和旧发布计划不会自动带入。
- AI 对话、Post Canvas、右侧证据/素材面板都围绕同一个 PostProject。

## 3. 真实研究与证据

1. 在 AI Agent 区输入：“帮我找最近一周广州咖啡馆高收藏笔记，分析标题、正文、标签和图片风格。”
2. 等待任务完成。
3. 查看右侧研究证据和可学习结论。

通过标准：
- 研究任务写入当前 PostProject。
- 默认只显示 3-5 条核心结论。
- 原始样本、完整笔记、评论和图片证据在 drawer/modal 中查看。
- evidencePack insight 包含类型、来源样本、置信度和创建时间。
- 真实研究只验证搜索、详情、证据和草稿链路；不要在这一阶段触发真实发布。

建议继续用自然语言驱动下一步：
- “把这些高质量样本保存到爆款库。”
- “基于实时证据和爆款库规律生成 CreativeBrief。”
- “基于当前 CreativeBrief 生成原创文案，不要重新搜索。”

## 4. 爆款库 RAG

1. 在研究证据中选择高质量样本保存到爆款库。
2. 刷新爆款库 RAG。
3. 查看右侧“爆款库证据”。

通过标准：
- 爆款库保存的是标题钩子、正文结构、标签组合、图片风格、痛点和情绪触发点，不是原文合集。
- 爆款库证据进入 evidencePack 时带 `sourceType: "viral_library"`。
- Post Canvas 能显示当前稿件引用了多少实时研究、爆款库和用户输入证据。
- AI 生成内容时不能把没有证据支持的内容伪装成研究结论。

## 5. CreativeBrief、文案和图片方向

1. 让 Agent 基于当前证据生成 CreativeBrief。
2. 让 Agent 生成小红书标题、正文和标签。
3. 让 Agent 生成图片方向和图片 Prompt。

通过标准：
- CreativeBrief 同时驱动文案和图片方向。
- 标题、正文、标签、图片方向都记录 `basedOnEvidenceIds`。
- Post Canvas 能编辑标题、正文、标签、图片 Prompt。
- 文案版本和图片 Prompt 版本可切换、回滚，并能看到差异/状态提示。

## 6. 图片与图文卡片

1. 上传产品图或参考图。
2. 生成产品场景图、AI 配图或图文卡片。
3. 在右侧素材区域选择发布图片。

通过标准：
- 图片进入当前 PostProject 的候选素材。
- 默认只展示选中图和最近生成图，完整素材在对应面板中查看。
- 发布图片和图片 Prompt 能追溯到当前证据或 CreativeBrief。

## 7. 组装最终帖子

1. 在 Post Canvas 保存当前画布。
2. 组装最终帖子。
3. 查看最终预览。

通过标准：
- finalPost 包含标题、正文、标签、图片、文案版本、图片 Prompt 版本和证据 ID。
- 如果切换版本或修改画布，旧发布确认单和 Quality Gate 会失效。

## 8. Quality Gate

1. 运行发布检查。
2. 查看 Quality Gate 结果。

通过标准：
- 检查标题夸张、广告感、标签堆砌、虚假认证/数据/销量/功效、before/after 夸大、图文一致、产品外观改变和证据引用。
- 显示 `titleScore`、`copyScore`、`visualConsistencyScore`、`platformFitScore`、`complianceScore`、`canPublish`、`issues`、`suggestions`。
- 爆款库覆盖会显示标题、正文、标签和图片方向哪些字段已有长期规律支撑。

## 9. 发布确认

1. 在发布检查区生成立即发布确认单或定时发布确认单。
2. 不要直接点击真实发布，除非当前测试明确授权。
3. 查看“真实发布闸门”和确认清单。

通过标准：
- 页面明确说明生成确认单不会直接发布到小红书。
- 确认前不会调用小红书 MCP。
- 自动发布默认关闭。
- 发布前必须人工确认账号、可见范围、最终文案版本、图片版本、图片方向、Quality Gate 和定时时间/时区。
- 确认单绑定当前账号；切换账号或修改画布后需要重新生成确认单。

## 10. 回归命令

每次产品级改动后运行：

```powershell
npm run verify
npm run acceptance
npm test
npm run typecheck
npm run build
```

通过标准：
- `npm run verify` 会连续运行完整产品测试、TypeScript 检查和生产构建，是每次提交前推荐的一键验证命令。
- `npm run acceptance` 会运行 `tests` 目录下的完整产品测试套件，覆盖 Post Studio 文档锚点、PostProject、Agent、RAG、Canvas、发布检查、MCP、素材、任务、模型设置和旧流程回归。
- 全量测试通过。
- TypeScript 无错误。
- Next.js 生产构建通过。

## 当前不自动验收的部分

以下内容必须由使用者明确授权后才能做真实测试：
- 真实发布到小红书。
- 定时发布到小红书。
- 使用真实付费模型进行大量生图。
- 读取或切换多个真实小红书账号。
