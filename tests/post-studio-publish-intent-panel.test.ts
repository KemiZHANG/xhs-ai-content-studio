import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { labelForPublishStatus, PostStudioPublishIntentPanel } from "@/app/components/post-studio-publish-intent-panel";
import type { PendingPublishConfirmation, WorkspacePublishPlan } from "@/app/types";

const activePublishPlan: WorkspacePublishPlan = {
  id: "plan-1",
  status: "awaiting_approval",
  accountId: "main",
  accountLabel: "咖啡探店号",
  mcpUrl: "http://localhost:18060/mcp",
  images: ["asset-1", "asset-2"],
  tags: ["广州咖啡", "周末探店"],
  visibility: "仅自己可见",
  scheduleAt: "2026-06-02T20:00:00+08:00",
  confirmationChecklist: [
    { id: "account", label: "确认发布账号", required: true, confirmed: true, detail: "当前账号一致" },
    { id: "image", label: "确认图片版本", required: true, confirmed: false, detail: "需要人工确认" },
    { id: "time", label: "确认发布时间", required: true, confirmed: false, detail: "北京时间 20:00" }
  ],
  versionSnapshot: {
    copyVersionId: "copy-v1",
    imagePromptVersionIds: ["prompt-v1"],
    selectedImageIds: ["asset-1", "asset-2"],
    finalPostEvidenceIds: ["evidence-1"],
    qualityGateFresh: true,
    qualityCanPublish: true,
    finalPostMatchesCanvas: true,
    summary: "最终文案、图片和 Quality Gate 一致",
    warnings: []
  }
};

const pendingPublish: PendingPublishConfirmation = {
  publishIntentId: "plan-1",
  mode: "schedule",
  createdAt: "2026-06-02T10:00:00.000Z",
  accountId: "main",
  accountDisplayName: "咖啡探店号",
  mcpUrl: "http://localhost:18060/mcp",
  loginName: "xiaohongshu-mcp",
  payload: {
    title: "广州咖啡馆周末探店",
    content: "这是一篇待发布的小红书笔记。",
    tags: ["广州咖啡", "周末探店"],
    assetIds: ["asset-1", "asset-2"],
    visibility: "仅自己可见",
    scheduleAt: "2026-06-02T20:00:00+08:00",
    imagePrompt: "自然光探店图片"
  }
};

describe("post studio publish intent panel", () => {
  it("renders active publish confirmation and manual confirmation status", () => {
    const html = renderToStaticMarkup(createElement(PostStudioPublishIntentPanel, {
      activePublishPlan,
      requiredConfirmations: activePublishPlan.confirmationChecklist ?? [],
      confirmedRequiredCount: 1,
      publishVisibility: "仅自己可见",
      pendingPublish,
      busy: false,
      canConfirmExisting: true,
      staleAccountPublishPlan: null,
      activeAccountLabel: "咖啡探店号",
      staleCanvasPublishPlan: false,
      onCancelPublish: () => undefined,
      onConfirmPublish: () => undefined
    }));

    expect(html).toContain("当前确认单");
    expect(html).toContain("待确认");
    expect(html).toContain("咖啡探店号");
    expect(html).toContain("2 张");
    expect(html).toContain("版本快照已锁定");
    expect(html).toContain("文案：copy-v1");
    expect(html).toContain("人工确认：1/3 项");
    expect(html).toContain("取消确认单");
    expect(html).toContain("确认定时发布");
  });

  it("renders stale publish warnings for account mismatch and dirty canvas", () => {
    const html = renderToStaticMarkup(createElement(PostStudioPublishIntentPanel, {
      activePublishPlan: null,
      requiredConfirmations: [],
      confirmedRequiredCount: 0,
      publishVisibility: "仅自己可见",
      pendingPublish: null,
      busy: false,
      canConfirmExisting: false,
      staleAccountPublishPlan: { ...activePublishPlan, accountId: "other" },
      activeAccountLabel: "当前账号",
      staleCanvasPublishPlan: true,
      onCancelPublish: () => undefined,
      onConfirmPublish: () => undefined
    }));

    expect(html).toContain("发布确认单已与当前账号不匹配");
    expect(html).toContain("账号 other");
    expect(html).toContain("当前账号");
    expect(html).toContain("发布确认单已失效");
    expect(html).toContain("重新运行 Quality Gate");
  });

  it("labels publish statuses consistently", () => {
    expect(labelForPublishStatus("awaiting_approval")).toBe("待确认");
    expect(labelForPublishStatus("scheduled")).toBe("已定时");
    expect(labelForPublishStatus("custom_status")).toBe("custom_status");
    expect(labelForPublishStatus()).toBe("待检查");
  });
});
