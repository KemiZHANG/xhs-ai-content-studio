import { describe, expect, it } from "vitest";
import { buildPendingPublishFromPlan, buildPublishConfirmationReadiness } from "@/app/components/publish-confirmation";
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

function versionSnapshot(overrides: Partial<NonNullable<WorkspacePublishPlan["versionSnapshot"]>> = {}): NonNullable<WorkspacePublishPlan["versionSnapshot"]> {
  return {
    copyVersionId: "copy-draft-1",
    imagePromptVersionIds: ["prompt-1"],
    selectedImageIds: ["asset-1"],
    finalPostEvidenceIds: ["insight-1"],
    qualityGateFresh: true,
    qualityCanPublish: true,
    finalPostMatchesCanvas: true,
    summary: "版本已锁定",
    warnings: [],
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

  it("does not hydrate a publish confirmation when its version snapshot is stale", () => {
    expect(
      buildPendingPublishFromPlan({
        plan: publishPlan({ versionSnapshot: versionSnapshot({ qualityGateFresh: false, warnings: ["Quality Gate 已失效"] }) }),
        settings,
        health
      })
    ).toBeNull();

    expect(
      buildPendingPublishFromPlan({
        plan: publishPlan({ versionSnapshot: versionSnapshot() }),
        currentVersionSnapshot: versionSnapshot({ selectedImageIds: ["asset-2"] }),
        settings,
        health
      })
    ).toBeNull();
  });

  it("labels publish actions as confirmation creation instead of direct external publishing", () => {
    const ready = buildPublishConfirmationReadiness({
      contentReady: true,
      accountReady: true,
      qualityCanPublish: true,
      qualityGateFresh: true,
      hasScheduleAt: true
    });

    expect(ready.canCreateNowConfirmation).toBe(true);
    expect(ready.canCreateScheduleConfirmation).toBe(true);
    expect(ready.nowButtonLabel).toBe("生成立即发布确认单");
    expect(ready.scheduleButtonLabel).toBe("生成定时发布确认单");
    expect(ready.helperText).toContain("确认前不会提交");
  });

  it("explains why publish confirmation cannot be created yet", () => {
    const blocked = buildPublishConfirmationReadiness({
      contentReady: false,
      accountReady: false,
      qualityCanPublish: false,
      qualityGateFresh: false,
      hasScheduleAt: false
    });

    expect(blocked.canCreateNowConfirmation).toBe(false);
    expect(blocked.canCreateScheduleConfirmation).toBe(false);
    expect(blocked.blockingReasons).toEqual(
      expect.arrayContaining([
        "补齐标题、正文、标签和至少一张图片",
        "检测并确认当前小红书账号已登录",
        "运行并通过 Quality Gate"
      ])
    );
    expect(blocked.helperText).toContain("还不能生成发布确认单");
  });
});
