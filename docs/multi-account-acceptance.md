# 多账号验收指南

这份指南用于安全验证 XHS AI Content Studio 的多账号能力。它只说明如何配置、检查和做发布前确认；不要在没有明确授权的情况下点击真实发布或定时发布。

## 核心原则

- 一个 Xiaohongshu MCP 服务通常只对应一个小红书登录会话。
- 多账号不是在同一个 MCP 会话里切换 cookie，而是为每个账号准备一个独立 MCP 地址。
- 推荐端口示例：`18060`、`18061`、`18062`。
- Post Studio 当前搜索、研究、记忆、发布检查和审计都以“当前激活账号”为准。
- 切换账号后，旧的发布确认单必须重新生成，不能继续使用旧账号下的确认结果。

## 验收前准备

1. 启动网页和默认 MCP：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-xhs.ps1
```

2. 打开网页：

```text
http://localhost:3000
```

3. 登录第一个小红书账号：

```powershell
.\login-xhs.ps1
```

4. 如果要验证第二个或第三个账号，请为每个账号启动独立 MCP 实例，并使用不同端口，例如 `18061`、`18062`。具体启动方式取决于你本地 MCP 的部署方式；验收标准是每个 MCP URL 都能独立返回登录状态。

## 网页内配置

1. 进入 **Settings / 模型设置**。
2. 在账号配置里添加账号档案：
   - 账号显示名，例如 `咖啡探店号`。
   - MCP URL，例如 `http://localhost:18060/mcp`。
   - 如果有第二个账号，添加 `http://localhost:18061/mcp`。
3. 保存后回到 **Post Studio**。
4. 在左侧账号状态或顶部账号区域切换当前账号。
5. 点击“检测当前账号”或刷新账号状态，确认显示的是当前要使用的账号和 MCP 地址。

## 安全 Smoke 检查

只检查账号绑定和 MCP 健康状态，不搜索、不生图、不发布：

```powershell
npm run smoke:accounts
```

只检查发布接口会停在预览和确认单，不会真实发布：

```powershell
npm run smoke:publish-dry-run
```

完整安全检查：

```powershell
npm run smoke:safe
```

## 多账号人工验收步骤

1. 选择账号 A。
2. 运行一次 Post Studio 研究或使用已有草稿，生成发布检查。
3. 进入发布检查区，确认账号显示为账号 A。
4. 不要点击真实发布。先生成 dry-run 或确认单。
5. 切换到账号 B。
6. 再次刷新账号状态，确认 MCP URL 和登录状态变为账号 B。
7. 检查旧确认单是否失效或需要重新生成。
8. 重新生成账号 B 的发布检查和确认单。
9. 打开 **Publish History**，确认审计记录里包含账号 ID、MCP URL、可见范围、发布时间或定时时间。
10. 第一次真实验收必须使用“仅自己可见”，并且只在你明确决定测试真实发布时进行。

## 必须停止的情况

- `/api/health/mcp` 显示 `fetch failed`。
- 页面显示的当前账号和你准备发布的账号不一致。
- 当前账号的 MCP URL 不是你预期的端口。
- 切换账号后，旧确认单仍然允许直接发布。
- 发布检查没有显示账号、可见范围、图片、标题、正文和 Quality Gate 状态。

## 常见问题

### 为什么不能只用一个 MCP 管多个账号？

因为 MCP 保存的是浏览器登录会话。一个会话通常只能代表一个当前登录账号。多账号要可靠，最好每个账号一个独立 MCP 实例和端口。

### `npm run smoke:accounts` 会切换账号吗？

不会。它只读取当前配置和 MCP 健康状态，不会切换账号、不搜索、不生成图片、不发布、不定时。

### 切换账号后为什么要重新生成确认单？

发布确认单绑定账号、内容、图片、可见范围和时间。账号变化后，原确认单的风险上下文已经变了，必须重新确认。

### 多账号发布是否已经等于 100% 完成？

代码和安全检查已经具备多账号档案、当前账号绑定和审计能力；真正的 100% 还需要用多个真实小红书登录会话分别验收，因为这是外部账号状态，不应该由自动测试伪造为完成。

---

# Multi-Account Acceptance Guide

Use this guide to validate multiple Xiaohongshu accounts safely. Each account should use its own MCP endpoint, such as `18060`, `18061`, or `18062`.

Run:

```powershell
npm run smoke:accounts
npm run smoke:publish-dry-run
```

These checks do not publish. Real publishing must be manually confirmed in Post Studio, preferably with private visibility for the first test. After switching accounts, regenerate the publishing confirmation before any real external action.

## Completion Evidence / 完成证据

Multi-account switching is complete only when all evidence below is present:

- At least two real Xiaohongshu accounts are logged in through independent MCP URLs, for example `http://localhost:18060/mcp` and `http://localhost:18061/mcp`.
- Post Studio clearly shows the active account name and MCP URL before publish confirmation.
- Switching from account A to account B invalidates the old publish confirmation and requires a regenerated confirmation order.
- Publish History or the audit record stores the correct account ID when available, account display name, MCP URL, visibility, publish mode, and timestamp for each account-specific action.
- A real private publishing test, if performed, appears only under the selected account and never under the previous account.

This gate cannot be marked as automated completion. Local smoke tests can prove that the account registry, dry-run flow, and audit fields exist, but only manual validation with multiple real logged-in MCP sessions can prove end-to-end multi-account behavior.
