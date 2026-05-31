import { describe, expect, it } from "vitest";
import { buildPublishConfirmationSummary } from "@/app/components/publish-confirmation-summary";
import type { PendingPublishConfirmation, PostProject, PublishDraftState } from "@/app/types";

const readyDraft: PublishDraftState = {
  title: "广州咖啡馆周末探店",
  content: "这是一篇有场景、有路线、有收藏价值的小红书笔记。",
  tagsText: "#广州咖啡 #探店",
  imagePrompt: "warm cafe lifestyle photo"
};

function project(overrides: Partial<PostProject> = {}): PostProject {
  return {
    id: "post-1",
    topic: "广州咖啡馆",
    currentStage: "reviewing",
    allowedActions: [],
    evidencePack: {
      sampleIds: ["sample-1"],
      insights: [
        {
          id: "insight-1",
          sourceType: "realtime",
          type: "title",
          insight: "标题使用城市 + 场景 + 收藏理由。",
          sourceSampleIds: ["sample-1"],
          confidence: 0.88,
          createdAt: "2026-05-31T00:00:00.000Z"
        }
      ]
    },
    focusedEvidenceIds: ["insight-1"],
    selectedSamples: [],
    copyVersions: [],
    imagePrompts: [],
    generatedImages: [],
    selectedImages: ["asset-1"],
    agentMemory: [],
    updatedAt: "2026-05-31T00:00:00.000Z",
    creativeBrief: {
      audience: "广州周末探店人群",
      painPoint: "不知道去哪家咖啡馆",
      contentAngle: "真实路线和氛围感",
      emotionalHook: "周末松弛感",
      proofPoints: ["位置", "价格", "出片角落"],
      tone: "真实分享",
      visualMood: "暖色自然光",
      imageMustHave: ["咖啡", "店内环境"],
      imageMustAvoid: ["虚假logo"],
      platformStyle: "小红书探店",
      tabooWords: [],
      complianceNotes: [],
      basedOnEvidenceIds: ["insight-1"]
    },
    copyDraft: {
      id: "draft-1",
      updatedAt: "2026-05-31T00:00:00.000Z",
      draft: {
        title: readyDraft.title,
        content: readyDraft.content,
        tags: ["广州咖啡", "探店"],
        structure: ["标题钩子", "路线体验", "收藏理由"],
        imagePrompt: readyDraft.imagePrompt,
        basedOnEvidenceIds: ["insight-1"]
      },
      images: [],
      visibility: "仅自己可见"
    },
    visualDirection: {
      mood: "暖色自然光",
      composition: "近景咖啡 + 背景环境",
      colorPalette: "奶油白与木色",
      mustHave: ["咖啡杯"],
      mustAvoid: ["错误品牌字"],
      basedOnEvidenceIds: ["insight-1"]
    },
    finalPost: {
      title: readyDraft.title,
      content: readyDraft.content,
      tags: ["广州咖啡", "探店"],
      imageIds: ["asset-1"],
      imagePromptVersionIds: [],
      basedOnEvidenceIds: ["insight-1"]
    },
    qualityCheck: {
      titleScore: 86,
      copyScore: 88,
      visualConsistencyScore: 90,
      platformFitScore: 87,
      complianceScore: 92,
      canPublish: true,
      issues: [],
      suggestions: [],
      checkedAt: "2026-05-31T00:00:00.000Z"
    },
    ...overrides
  };
}

function pendingPublish(): PendingPublishConfirmation {
  return {
    payload: {
      title: readyDraft.title,
      content: readyDraft.content,
      tags: ["广州咖啡", "探店"],
      assetIds: ["asset-1"],
      visibility: "仅自己可见",
      scheduleAt: "2099-05-31T20:00:00+08:00",
      imagePrompt: readyDraft.imagePrompt
    },
    publishIntentId: "intent-1",
    mode: "schedule",
    createdAt: "2026-05-31T00:00:00.000Z",
    accountId: "account-a",
    accountDisplayName: "主账号",
    mcpUrl: "http://localhost:18060/mcp",
    loginName: "xhs-user"
  };
}

describe("publish confirmation summary", () => {
  it("summarizes a ready publish state before confirmation creation", () => {
    const summary = buildPublishConfirmationSummary({
      draft: readyDraft,
      selectedImageCount: 1,
      activePlan: null,
      pendingPublish: null,
      project: project(),
      activeAccountName: "主账号",
      activeLoginName: "xhs-user",
      visibility: "仅自己可见",
      scheduleAt: "",
      publishReady: true,
      citationTraceReady: true,
      canvasDirty: false,
      accountReady: true,
      hasVisualDirection: true,
      qualityGateFresh: true
    });

    expect(summary.riskLevel).toBe("ok");
    expect(summary.headline).toBe("已具备生成发布确认单条件");
    expect(summary.blockers).toEqual([]);
    expect(summary.accountLine).toContain("xhs-user");
    expect(summary.evidenceLine).toContain("引用 1 条证据");
  });

  it("summarizes a pending scheduled confirmation with account and checklist state", () => {
    const summary = buildPublishConfirmationSummary({
      draft: readyDraft,
      selectedImageCount: 1,
      activePlan: {
        status: "awaiting_approval",
        visibility: "仅自己可见",
        scheduleAt: "2099-05-31T20:00:00+08:00",
        images: ["asset-1"],
        tags: ["广州咖啡", "探店"],
        accountName: "主账号",
        loginName: "xhs-user",
        confirmationChecklist: [
          { required: true, confirmed: true, label: "确认账号" },
          { required: true, confirmed: false, label: "确认图片" }
        ],
        versionSnapshot: {
          qualityGateFresh: true,
          qualityCanPublish: true,
          finalPostMatchesCanvas: true,
          warnings: []
        }
      },
      pendingPublish: pendingPublish(),
      project: project(),
      activeAccountName: "主账号",
      activeLoginName: "xhs-user",
      visibility: "仅自己可见",
      scheduleAt: "",
      publishReady: true,
      citationTraceReady: true,
      canvasDirty: false,
      accountReady: true,
      hasVisualDirection: true,
      qualityGateFresh: true
    });

    expect(summary.headline).toBe("发布确认单已生成，等待人工确认");
    expect(summary.modeLabel).toBe("定时发布");
    expect(summary.riskLevel).toBe("warn");
    expect(summary.checklistLine).toBe("人工确认 1/2 项");
  });

  it("lists concrete blockers for unsafe publish states", () => {
    const summary = buildPublishConfirmationSummary({
      draft: { title: "", content: "", tagsText: "", imagePrompt: "" },
      selectedImageCount: 0,
      activePlan: null,
      pendingPublish: null,
      project: project({
        qualityCheck: {
          titleScore: 40,
          copyScore: 45,
          visualConsistencyScore: 20,
          platformFitScore: 50,
          complianceScore: 30,
          canPublish: false,
          issues: ["广告感过强"],
          suggestions: [],
          checkedAt: "2026-05-31T00:00:00.000Z"
        }
      }),
      visibility: "公开可见",
      scheduleAt: "2000-01-01T08:00",
      publishReady: false,
      citationTraceReady: false,
      canvasDirty: true,
      accountReady: false,
      hasVisualDirection: false,
      qualityGateFresh: false
    });

    expect(summary.riskLevel).toBe("blocked");
    expect(summary.blockers).toEqual(
      expect.arrayContaining([
        "缺少标题",
        "缺少正文",
        "缺少标签",
        "缺少发布图片",
        "字段级证据引用未通过",
        "Quality Gate 未通过",
        "定时时间必须晚于当前时间"
      ])
    );
  });
});
