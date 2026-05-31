import { describe, expect, it } from "vitest";
import { buildPendingPublishFromPlan } from "@/app/components/publish-confirmation";
import type { Health, RedactedSettings, WorkspacePublishPlan } from "@/app/types";

const settings: RedactedSettings = {
  mcpUrl: "http://localhost:18060/mcp",
  textBaseUrl: "",
  textModel: "",
  textApiKey: "configured",
  imageBaseUrl: "",
  imageModel: "",
  imageApiKey: "configured",
  defaultVisibility: "仅自己可见",
  defaultAutoPublish: false,
  agentPublishPolicy: "review_required",
  dailyTextCallLimit: 80,
  dailyImageCallLimit: 20,
  maxResearchSamples: 12,
  activeAccountId: "account-a",
  actionToken: "token",
  accounts: [
    {
      id: "account-a",
      displayName: "主账号",
      mcpUrl: "http://localhost:18060/mcp",
      status: "logged_in",
      createdAt: "2026-05-31T00:00:00.000Z",
      updatedAt: "2026-05-31T00:00:00.000Z"
    }
  ]
};

const health: Health = {
  ok: true,
  reachable: true,
  loggedIn: true,
  message: "已登录",
  mcpUrl: settings.mcpUrl,
  activeAccount: {
    ...settings.accounts[0],
    status: "logged_in",
    loginName: "xhs-user"
  }
};

function publishPlan(overrides: Partial<WorkspacePublishPlan> = {}): WorkspacePublishPlan {
  return {
    id: "publish-1",
    status: "awaiting_approval",
    title: "广州周末咖啡馆",
    content: "适合周末坐一下午的真实探店笔记。",
    tags: ["广州咖啡", "探店"],
    images: ["asset-1"],
    visibility: "仅自己可见",
    scheduleAt: "2099-05-31T20:00:00+08:00",
    requestedAt: "2026-05-31T00:00:00.000Z",
    requestedBy: "manual",
    accountId: "account-a",
    mcpUrl: settings.mcpUrl,
    ...overrides
  };
}

describe("publish confirmation hydration", () => {
  it("rebuilds a pending confirmation from a persisted manual publish plan", () => {
    const pending = buildPendingPublishFromPlan({ plan: publishPlan(), settings, health });

    expect(pending).toMatchObject({
      publishIntentId: "publish-1",
      mode: "schedule",
      accountDisplayName: "主账号",
      loginName: "xhs-user",
      payload: {
        title: "广州周末咖啡馆",
        assetIds: ["asset-1"],
        visibility: "仅自己可见",
        scheduleAt: "2099-05-31T20:00:00+08:00"
      }
    });
  });

  it("does not hydrate unsafe or non-manual confirmation contexts", () => {
    expect(buildPendingPublishFromPlan({ plan: publishPlan({ requestedBy: "chat" }), settings, health })).toBeNull();
    expect(buildPendingPublishFromPlan({ plan: publishPlan({ status: "published" }), settings, health })).toBeNull();
    expect(buildPendingPublishFromPlan({ plan: publishPlan({ accountId: "account-b" }), settings, health })).toBeNull();
  });
});
