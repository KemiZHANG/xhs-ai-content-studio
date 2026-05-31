import { describe, expect, it } from "vitest";
import { buildPublishAccountSafety } from "@/app/components/publish-account-safety";
import { defaultSettings } from "@/app/config/default-settings";
import type { PendingPublishConfirmation, PostProject, RedactedSettings } from "@/app/types";

function settingsWithAccounts(activeAccountId = "account-a"): RedactedSettings {
  return {
    ...defaultSettings,
    activeAccountId,
    mcpUrl: activeAccountId === "account-a" ? "http://localhost:18060/mcp" : "http://localhost:18061/mcp",
    accounts: [
      {
        id: "account-a",
        displayName: "主账号",
        mcpUrl: "http://localhost:18060/mcp",
        status: "unknown",
        createdAt: "2026-05-31T00:00:00.000Z",
        updatedAt: "2026-05-31T00:00:00.000Z"
      },
      {
        id: "account-b",
        displayName: "探店账号",
        mcpUrl: "http://localhost:18061/mcp",
        status: "unknown",
        createdAt: "2026-05-31T00:00:00.000Z",
        updatedAt: "2026-05-31T00:00:00.000Z"
      }
    ]
  };
}

function pendingPublish(accountId = "account-a"): PendingPublishConfirmation {
  return {
    payload: {
      title: "广州咖啡馆周末探店",
      content: "一篇真实探店笔记。",
      tags: ["广州咖啡", "探店"],
      assetIds: ["asset-1"],
      visibility: "仅自己可见",
      scheduleAt: "",
      imagePrompt: ""
    },
    publishIntentId: "intent-1",
    mode: "now",
    createdAt: "2026-05-31T00:00:00.000Z",
    accountId,
    accountDisplayName: accountId === "account-a" ? "主账号" : "探店账号",
    mcpUrl: accountId === "account-a" ? "http://localhost:18060/mcp" : "http://localhost:18061/mcp",
    loginName: accountId === "account-a" ? "xhs-main" : "xhs-cafe"
  };
}

describe("publish account safety", () => {
  it("marks the current account as ready when health and confirmation binding match", () => {
    const settings = settingsWithAccounts("account-a");
    const model = buildPublishAccountSafety({
      settings,
      health: {
        ok: true,
        reachable: true,
        loggedIn: true,
        message: "ok",
        mcpUrl: "http://localhost:18060/mcp",
        activeAccount: { ...settings.accounts[0], loginName: "xhs-main" }
      },
      publishPlan: null,
      pendingPublish: pendingPublish("account-a"),
      canvasDirty: false
    });

    expect(model.status).toBe("ready");
    expect(model.canCreateConfirmation).toBe(true);
    expect(model.canConfirmExisting).toBe(true);
    expect(model.activeAccountLine).toContain("xhs-main");
    expect(model.lockedAccountLine).toContain("主账号");
    expect(model.checks.every((check) => check.severity !== "blocked")).toBe(true);
  });

  it("blocks confirmation when a pending publish belongs to another account", () => {
    const settings = settingsWithAccounts("account-b");
    const model = buildPublishAccountSafety({
      settings,
      health: {
        ok: true,
        reachable: true,
        loggedIn: true,
        message: "ok",
        mcpUrl: "http://localhost:18061/mcp",
        activeAccount: { ...settings.accounts[1], loginName: "xhs-cafe" }
      },
      publishPlan: null,
      pendingPublish: pendingPublish("account-a"),
      canvasDirty: false
    });

    expect(model.status).toBe("blocked");
    expect(model.canConfirmExisting).toBe(false);
    expect(model.detail).toContain("其他账号");
    expect(model.checks.find((check) => check.label === "确认单账号绑定")).toMatchObject({
      ok: false,
      severity: "blocked"
    });
  });

  it("blocks stale confirmation after the canvas changes", () => {
    const settings = settingsWithAccounts("account-a");
    const model = buildPublishAccountSafety({
      settings,
      health: {
        ok: true,
        reachable: true,
        loggedIn: true,
        message: "ok",
        mcpUrl: "http://localhost:18060/mcp",
        activeAccount: { ...settings.accounts[0], loginName: "xhs-main" }
      },
      publishPlan: { id: "intent-1", accountId: "account-a", status: "awaiting_approval" } as PostProject["publishPlan"],
      pendingPublish: null,
      canvasDirty: true
    });

    expect(model.status).toBe("blocked");
    expect(model.canCreateConfirmation).toBe(false);
    expect(model.checks.find((check) => check.label === "画布版本状态")).toMatchObject({
      ok: false,
      severity: "blocked"
    });
  });

  it("warns before a confirmation is created but still allows creating one after account login is verified", () => {
    const settings = settingsWithAccounts("account-a");
    const model = buildPublishAccountSafety({
      settings,
      health: {
        ok: true,
        reachable: true,
        loggedIn: true,
        message: "ok",
        mcpUrl: "http://localhost:18060/mcp",
        activeAccount: { ...settings.accounts[0], loginName: "xhs-main" }
      },
      publishPlan: null,
      pendingPublish: null,
      canvasDirty: false
    });

    expect(model.status).toBe("warn");
    expect(model.canCreateConfirmation).toBe(true);
    expect(model.canConfirmExisting).toBe(false);
    expect(model.lockedAccountLine).toContain("尚未生成");
  });
});
