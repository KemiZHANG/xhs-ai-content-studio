import { describe, expect, it } from "vitest";
import { activeAccountReadinessHint, isHealthForActiveAccount } from "@/app/components/account-readiness";
import type { Health, RedactedSettings } from "@/app/types";

const settings: RedactedSettings = {
  mcpUrl: "http://localhost:18060/mcp",
  textBaseUrl: "",
  textModel: "",
  textApiKey: "missing",
  imageBaseUrl: "",
  imageModel: "",
  imageApiKey: "missing",
  actionToken: "",
  defaultVisibility: "仅自己可见",
  defaultAutoPublish: false,
  agentPublishPolicy: "review_required",
  dailyTextCallLimit: 80,
  dailyImageCallLimit: 20,
  maxResearchSamples: 12,
  activeAccountId: "account-a",
  accounts: [
    {
      id: "account-a",
      displayName: "账号 A",
      mcpUrl: "http://localhost:18060/mcp",
      status: "unknown",
      createdAt: "2026-05-31T00:00:00.000Z",
      updatedAt: "2026-05-31T00:00:00.000Z"
    }
  ]
};

describe("account readiness", () => {
  it("requires health to match the current account and MCP endpoint", () => {
    const health: Health = {
      ok: true,
      reachable: true,
      loggedIn: true,
      message: "logged in",
      mcpUrl: "http://localhost:18060/mcp/",
      activeAccount: { ...settings.accounts[0], status: "logged_in" }
    };

    expect(isHealthForActiveAccount(health, settings)).toBe(true);
    expect(activeAccountReadinessHint(health, settings)).toBe("当前账号登录状态有效");
  });

  it("rejects stale health from a previous account or endpoint", () => {
    const previousAccountHealth: Health = {
      ok: true,
      reachable: true,
      loggedIn: true,
      message: "logged in",
      mcpUrl: settings.mcpUrl,
      activeAccount: { ...settings.accounts[0], id: "account-b", status: "logged_in" }
    };
    const previousEndpointHealth: Health = {
      ok: true,
      reachable: true,
      loggedIn: true,
      message: "logged in",
      mcpUrl: "http://localhost:18061/mcp",
      activeAccount: { ...settings.accounts[0], status: "logged_in" }
    };

    expect(isHealthForActiveAccount(previousAccountHealth, settings)).toBe(false);
    expect(activeAccountReadinessHint(previousAccountHealth, settings)).toContain("旧账号");
    expect(isHealthForActiveAccount(previousEndpointHealth, settings)).toBe(false);
    expect(activeAccountReadinessHint(previousEndpointHealth, settings)).toContain("旧 MCP 地址");
  });
});
