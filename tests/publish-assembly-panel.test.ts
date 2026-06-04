import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublishAssemblyPanel } from "@/app/components/publish-assembly-panel";
import type { PendingPublishConfirmation, PostProject, PublishDraftState, RedactedSettings } from "@/app/types";

const noop = () => {};

const settings = {
  mcpUrl: "http://localhost:3001",
  activeAccountId: "account-1",
  defaultVisibility: "仅自己可见",
  accounts: [{
    id: "account-1",
    displayName: "主账号",
    mcpUrl: "http://localhost:3001"
  }]
} as RedactedSettings;

const draft: PublishDraftState = {
  title: "广州咖啡周末避坑指南",
  content: "真实探店后整理 queue time、客单价和适合拍照的位置。",
  tagsText: "#广州咖啡 #周末探店",
  imagePrompt: "real cafe table, natural light"
};

const postProject = {
  schemaVersion: 1,
  id: "project-1",
  productInfo: { referenceAssetIds: [] },
  evidencePack: { sampleIds: ["viral-risk"], insights: [] },
  focusedEvidenceIds: [],
  selectedSamples: [],
  copyVersions: [],
  imagePrompts: [],
  generatedImages: [],
  selectedImages: ["asset-1"],
  finalPost: {
    title: draft.title,
    content: draft.content,
    tags: ["广州咖啡", "周末探店"],
    imageIds: ["asset-1"],
    imagePromptVersionIds: [],
    basedOnEvidenceIds: ["viral-insight-hook"]
  },
  qualityCheck: {
    titleScore: 82,
    copyScore: 78,
    visualConsistencyScore: 86,
    platformFitScore: 90,
    complianceScore: 88,
    canPublish: false,
    issues: ["爆款库原创边界风险：Quiet Guangzhou cafe guide for laptop work"],
    suggestions: ["把同款表达改成自己的真实路线"],
    originalityReview: {
      rules: ["不要复刻爆款库原文段落", "只借鉴问答式信息结构"],
      sourceSampleIds: ["viral-risk"],
      riskSamples: ["Quiet Guangzhou cafe guide for laptop work"],
      isSafe: false,
      summary: "发现近似复刻风险"
    },
    checkedAt: "2026-06-01T00:00:00.000Z"
  },
  agentMemory: [],
  currentStage: "reviewing",
  allowedActions: [],
  updatedAt: "2026-06-01T00:00:00.000Z"
} as PostProject;

const pendingPublish = {
  id: "confirm-1",
  publishIntentId: "intent-1",
  mode: "now",
  createdAt: "2026-06-01T00:00:00.000Z",
  accountId: "account-1",
  accountDisplayName: "主账号",
  loginName: "xhs-user",
  mcpUrl: "http://localhost:3001",
  payload: {
    title: draft.title,
    content: draft.content,
    tags: ["广州咖啡", "周末探店"],
    assetIds: ["asset-1"],
    imagePrompt: draft.imagePrompt,
    visibility: "仅自己可见",
    scheduleAt: ""
  }
} as PendingPublishConfirmation;

describe("publish assembly panel", () => {
  it("shows viral originality rules and risk samples in the publish confirmation flow", () => {
    const html = renderToStaticMarkup(createElement(PublishAssemblyPanel, {
      assets: [{
        id: "asset-1",
        name: "cover.png",
        originalName: "cover.png",
        kind: "generated",
        mimeType: "image/png",
        size: 1024,
        createdAt: "2026-06-01T00:00:00.000Z"
      }],
      settings,
      health: null,
      draft,
      selectedAssetIds: ["asset-1"],
      visibility: "仅自己可见",
      scheduleAt: "",
      status: "",
      pendingPublish,
      postProject,
      busy: false,
      onDraftChange: noop,
      onToggleAsset: noop,
      onVisibilityChange: noop,
      onScheduleAtChange: noop,
      onPublishNow: noop,
      onSchedule: noop,
      onConfirmPublish: noop,
      onCancelPublish: noop,
      onGoCopy: noop,
      onGoImage: noop
    }));

    expect(html).toContain("原创边界风险");
    expect(html).toContain("发现近似复刻风险");
    expect(html).toContain("只学规律：不要复刻爆款库原文段落");
    expect(html).toContain("参考样本：viral-risk");
    expect(html).toContain("风险样本：Quiet Guangzhou cafe guide for laptop work");
  });
});
