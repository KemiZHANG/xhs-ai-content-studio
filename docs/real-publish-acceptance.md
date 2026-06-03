# 真实发布验收指南

这份指南只用于你明确决定测试真实发布或真实定时发布时使用。默认情况下，XHS AI Content Studio 只会生成发布确认单，不会因为一句聊天指令直接把内容发到小红书。

## 前置条件

1. 已运行 `powershell -NoProfile -ExecutionPolicy Bypass -File .\start-xhs.ps1`。
2. 网页能打开 `http://localhost:3000`。
3. `/api/health/mcp` 显示 `reachable: true`、`loggedIn: true`。
4. Settings 里已配置文本模型；如果要生图，也要配置图片模型。
5. 已在 Post Studio 完成一篇帖子项目：
   - 有当前标题、正文、标签。
   - 至少选择 1 张图片。
   - 已生成或确认图片方向 / Prompt。
   - 已运行 Quality Gate 且 `canPublish: true`。
   - 当前账号就是你想发布的账号。

## 推荐安全验收顺序

### 1. 先做研究与草稿

在 Post Studio 输入：

```text
帮我找最近一周广州咖啡馆高收藏笔记，分析标题、正文、标签和图片风格。
```

确认右侧只显示摘要，原始证据可以展开查看。

### 2. 生成文案和图片

继续输入：

```text
基于当前证据生成 CreativeBrief，再写一篇原创小红书笔记。
确认当前图片方向，然后生成 1 张小红书封面图。
```

如果图片不是你想要的，先修改图片方向，不要进入发布。

### 3. 组装最终帖子并运行 Quality Gate

继续输入：

```text
就用当前文案和图片组装成最终帖子，并运行 Quality Gate。
```

必须看到发布检查通过。如果提示夸张词、图文不一致、证据不可追溯、图片方向未确认或产品外观风险，先修正再继续。

### 4. 生成确认单，不直接发布

第一次建议只生成“仅自己可见”的确认单：

```text
生成立即发布确认单，仅自己可见。
```

或：

```text
今晚 8 点生成定时发布确认单，仅自己可见。
```

通过标准：
- 页面显示发布确认单。
- 确认单显示当前账号、可见范围、标题、标签、图片数量和定时时间。
- 确认前不会调用小红书发布。

### 5. 人工确认真实发布

只有当你确认以下信息都正确时，才点击确认按钮：

- 当前小红书账号正确。
- 可见范围正确，第一次建议“仅自己可见”。
- 标题、正文、标签是最终版本。
- 图片是最终版本。
- 图片方向 / Prompt 已确认。
- Quality Gate 通过。
- 定时时间和时区正确。

点击确认后才会调用小红书 MCP 的发布能力。

## 发布后检查

1. 在 Publish History / 发布历史查看审计记录。
2. 确认记录里有账号、可见范围、图片数量、发布状态和 idempotencyKey 后缀。
3. 审计日志不保存完整正文，只保存正文哈希和元数据。
4. 到小红书账号中确认笔记是否已发布或已进入定时状态。

## 如果失败

- 如果提示未登录：运行 `.\login-xhs.ps1` 重新登录。
- 如果提示 Quality Gate 失败：回到 Post Studio 修改文案、图片或证据引用。
- 如果提示确认单失效：说明你修改过文案、图片、账号或证据，需要重新生成确认单。
- 如果提示 MCP 超时：确认 `http://localhost:18060/mcp` 正在运行，然后重试。

## 不要做的事

- 不要把 `data/`、`generated-assets/`、cookies 或 API Key 提交到 Git。
- 不要用公开可见做第一次真实发布测试。
- 不要绕过 Post Studio 直接调用发布接口。
- 不要发布复制竞品原文或竞品图片的内容。
- 不要发布包含虚假认证、虚假销量、夸大功效或不实 before/after 的内容。

---

# Real Publishing Acceptance Guide

Use this guide only when you explicitly decide to test real publishing or scheduled publishing. By default, XHS AI Content Studio creates a publish confirmation first. It does not publish to Xiaohongshu directly from a vague chat command.

## Preconditions

1. Run `powershell -NoProfile -ExecutionPolicy Bypass -File .\start-xhs.ps1`.
2. Open `http://localhost:3000`.
3. `/api/health/mcp` reports `reachable: true` and `loggedIn: true`.
4. A text model is configured in Settings; configure an image model if you want image generation.
5. A Post Studio project is ready:
   - Title, body, and tags exist.
   - At least one image is selected.
   - Visual direction / prompt is generated or confirmed.
   - Quality Gate has passed with `canPublish: true`.
   - The active account is the account you want to publish with.

## Recommended Safe Test Flow

1. Research and draft in Post Studio.
2. Generate or select images.
3. Assemble the final post and run Quality Gate.
4. Create a publish confirmation, preferably with private visibility first.
5. Manually confirm only after checking account, visibility, final copy, final images, visual direction, Quality Gate, and schedule time.

Only the final manual confirmation triggers the Xiaohongshu MCP publishing action.

## After Publishing

1. Check Publish History / audit logs.
2. Confirm account, visibility, image count, status, and idempotency suffix.
3. Confirm the note in Xiaohongshu.

## Failure Handling

- Not logged in: run `.\login-xhs.ps1`.
- Quality Gate failed: revise copy, images, or evidence citations in Post Studio.
- Confirmation expired: regenerate the confirmation after changing copy, image, account, or evidence.
- MCP timeout: make sure `http://localhost:18060/mcp` is running.

## Do Not

- Do not commit `data/`, `generated-assets/`, cookies, or API keys.
- Do not use public visibility for the first real publishing test.
- Do not bypass Post Studio and call publishing APIs directly.
- Do not publish copied competitor copy or images.
- Do not publish false certifications, fake sales claims, exaggerated efficacy, or misleading before/after claims.

## Completion Evidence / 完成证据

Real publishing is complete only when all evidence below is present:

- Post Studio shows that the user manually confirmed the publish action.
- The active Xiaohongshu account shows the private note after publishing.
- Publish History records a `published` receipt with account name, account ID when available, MCP URL, visibility, image count, and idempotency key.
- The audit record proves that the final title, copy hash, tag list, selected images, account, and visibility match the confirmed publish order.

Scheduled publishing is complete only when all evidence below is present:

- Post Studio shows that the user manually confirmed the scheduled publish action.
- The Xiaohongshu account or MCP response shows the future scheduled task.
- Publish History records a `scheduled` receipt with schedule time, timezone, account name, account ID when available, MCP URL, visibility, image count, and idempotency key.
- The scheduled time is in the future and matches the confirmation order shown to the user.

These gates cannot be marked as automated completion. They require manual external validation because the final proof lives in the real Xiaohongshu account and MCP session, not only in local tests.
