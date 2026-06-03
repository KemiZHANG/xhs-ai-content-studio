# 真实发布验收指南

这份指南只用于你明确决定测试真实发布或真实定时发布时使用。默认情况下，XHS AI Content Studio 只会生成发布确认单，不会因为一句模糊的聊天指令直接把内容发到小红书。

## 前置条件

1. 已运行 `powershell -NoProfile -ExecutionPolicy Bypass -File .\start-xhs.ps1`。
2. 网页能打开 `http://localhost:3000`。
3. `/api/health/mcp` 显示 `reachable: true` 和 `loggedIn: true`。
4. Settings 里已配置文本模型；如果要生图，也要配置图片模型。
5. Post Studio 里已有一篇准备发布的帖子项目：
   - 有标题、正文和标签。
   - 至少选择 1 张图片。
   - 图片方向或 Prompt 已确认。
   - Quality Gate 显示 `canPublish: true`。
   - 当前小红书账号就是你要发布的账号。

## 推荐安全流程

1. 在 Post Studio 完成主题研究、证据总结和 CreativeBrief。
2. 生成或选择文案、标签、图片。
3. 组装最终帖子并运行 Quality Gate。
4. 第一次真实测试只生成“仅自己可见”的发布确认单。
5. 人工检查账号、可见范围、标题、正文、标签、图片、定时时间和时区。
6. 只有最后点击人工确认后，才会调用小红书 MCP 发布能力。

## 推荐对话指令

```text
生成立即发布确认单，仅自己可见。
```

```text
今晚 8 点生成定时发布确认单，仅自己可见。
```

这些指令只生成确认单。确认前不会调用小红书发布，点击确认后才会调用小红书 MCP 的发布能力。

## 发布后检查

1. 在 Publish History / 发布历史中查看审计记录。
2. 确认记录里有账号、MCP URL、可见范围、图片数量、发布状态和 idempotencyKey。
3. 到小红书账号中确认笔记已发布，或确认定时任务已创建。
4. 如果修改过文案、图片、账号或可见范围，旧确认单必须失效并重新生成。

## Completion Evidence / 完成证据

真实发布只有在以下证据齐全时才算完成：

- Post Studio 显示用户手动确认了发布动作。
- 小红书账号中出现“仅自己可见”笔记。
- Publish History 记录 `published` 回执。
- 审计记录包含账号名、账号 ID（如可用）、MCP URL、可见范围、图片数量和 idempotencyKey。

真实定时发布只有在以下证据齐全时才算完成：

- Post Studio 显示用户手动确认了定时发布动作。
- 小红书账号或 MCP 响应显示未来定时任务。
- Publish History 记录 `scheduled` 回执。
- 审计记录包含定时时间、时区、账号、MCP URL、可见范围和 idempotencyKey。

这些验收不能只靠自动化测试标记完成，因为最终证据存在真实小红书账号和 MCP 会话里。

## 失败处理

- 未登录：运行 `.\login-xhs.ps1` 后重新检测账号。
- Quality Gate 未通过：回到 Post Studio 修改文案、图片或证据引用。
- 确认单失效：说明文案、图片、账号或证据变化过，需要重新生成确认单。
- MCP 超时：确认 `http://localhost:18060/mcp` 正在运行，然后重试。

## 不要做

- 不要提交 `data/`、`generated-assets/`、cookies 或 API Key。
- 不要用公开可见做第一次真实发布测试。
- 不要绕过 Post Studio 直接调用发布接口。
- 不要发布复制竞品原文或竞品图片的内容。
- 不要发布虚假认证、虚假销量、夸大功效或不实 before/after。

---

# Real Publishing Acceptance Guide

Use this guide only when you explicitly decide to test real publishing or scheduled publishing. By default, XHS AI Content Studio creates a publish confirmation first. It does not publish to Xiaohongshu directly from a vague chat command.

## Preconditions

1. Run `powershell -NoProfile -ExecutionPolicy Bypass -File .\start-xhs.ps1`.
2. Open `http://localhost:3000`.
3. `/api/health/mcp` reports `reachable: true` and `loggedIn: true`.
4. Configure a text model in Settings. Configure an image model if you want image generation.
5. A Post Studio project is ready:
   - Title, body, and tags exist.
   - At least one image is selected.
   - Visual direction or Prompt is confirmed.
   - Quality Gate has passed with `canPublish: true`.
   - The active account is the account you want to publish with.

## Recommended Safe Flow

1. Complete research, evidence summary, and CreativeBrief in Post Studio.
2. Generate or select copy, tags, and images.
3. Assemble the final post and run Quality Gate.
4. For the first real test, create a private-visibility publish confirmation.
5. Manually check account, visibility, title, body, tags, images, schedule time, and timezone.
6. Only the final manual confirmation triggers the Xiaohongshu MCP publishing action.

## Suggested Chat Commands

```text
Create an immediate publish confirmation with private visibility.
```

```text
Create a scheduled publish confirmation for 8 PM tonight with private visibility.
```

These commands only create confirmations. They do not publish before manual confirmation.

## After Publishing

1. Check Publish History / audit logs.
2. Confirm account, MCP URL, visibility, image count, status, and idempotencyKey.
3. Confirm the note or future scheduled task in Xiaohongshu.
4. If copy, images, account, or visibility changed, the previous confirmation must expire and be regenerated.

## Completion Evidence

Real publishing is complete only when all evidence below is present:

- Post Studio shows that the user manually confirmed the publish action.
- The active Xiaohongshu account shows the private note after publishing.
- Publish History records a `published` receipt.
- The audit record includes account name, account ID when available, MCP URL, visibility, image count, and idempotencyKey.

Scheduled publishing is complete only when all evidence below is present:

- Post Studio shows that the user manually confirmed the scheduled publish action.
- The Xiaohongshu account or MCP response shows the future scheduled task.
- Publish History records a `scheduled` receipt.
- The audit record includes schedule time, timezone, account, MCP URL, visibility, and idempotencyKey.

These gates cannot be marked as automated completion because the final proof lives in the real Xiaohongshu account and MCP session.

## Failure Handling

- Not logged in: run `.\login-xhs.ps1` and check the account again.
- Quality Gate failed: revise copy, images, or evidence citations in Post Studio.
- Confirmation expired: regenerate the confirmation after changing copy, images, account, or evidence.
- MCP timeout: make sure `http://localhost:18060/mcp` is running, then retry.

## Do Not

- Do not commit `data/`, `generated-assets/`, cookies, or API keys.
- Do not use public visibility for the first real publishing test.
- Do not bypass Post Studio and call publishing APIs directly.
- Do not publish copied competitor copy or images.
- Do not publish false certifications, fake sales claims, exaggerated efficacy, or misleading before/after claims.
