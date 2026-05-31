import { describe, expect, it } from "vitest";
import { buildPostReadinessReport } from "@/lib/post-project/readiness";
import type { PostProject } from "@/lib/post-project/types";

function project(overrides: Partial<PostProject> = {}): PostProject {
  return {
    schemaVersion: 1,
    id: "project-1",
    topic: "广州咖啡馆",
    productInfo: { referenceAssetIds: [] },
    evidencePack: { sampleIds: [], insights: [] },
    selectedSamples: [],
    copyVersions: [],
    imagePrompts: [],
    generatedImages: [],
    selectedImages: [],
    agentMemory: [],
    currentStage: "empty",
    allowedActions: ["search_research"],
    updatedAt: "2026-05-31T00:00:00.000Z",
    ...overrides
  };
}

describe("post readiness report", () => {
  it("points a blank project to research as the first useful action", () => {
    const report = buildPostReadinessReport(project());

    expect(report.progress).toBe(0);
    expect(report.nextAction).toBe("search_research");
    expect(report.blockers[0]).toMatchObject({ id: "evidence", label: "研究证据" });
    expect(report.canRequestPublish).toBe(false);
  });

  it("tracks a publish-ready project and allows requesting confirmation", () => {
    const report = buildPostReadinessReport(project({
      evidencePack: {
        sampleIds: ["sample-1"],
        insights: [
          {
            id: "insight-1",
            sourceType: "realtime",
            type: "title",
            insight: "标题先给场景再给利益点",
            sourceSampleIds: ["sample-1"],
            confidence: 0.8,
            createdAt: "2026-05-31T00:00:00.000Z"
          }
        ]
      },
      selectedSamples: [{ id: "sample-1", title: "sample" }],
      creativeBrief: {
        audience: "周末探店人群",
        painPoint: "不知道去哪坐一下午",
        contentAngle: "安静咖啡馆清单",
        emotionalHook: "周末慢下来",
        proofPoints: ["真实体验"],
        tone: "真实分享",
        visualMood: "暖色真实照片",
        imageMustHave: ["咖啡", "环境"],
        imageMustAvoid: ["夸张广告"],
        platformStyle: "小红书探店",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["insight-1"]
      },
      copyDraft: {
        id: "draft-1",
        updatedAt: "2026-05-31T00:00:00.000Z",
        draft: {
          title: "广州周末安静咖啡馆",
          content: "适合坐一下午的真实探店清单。",
          tags: ["广州咖啡", "周末探店"],
          structure: [],
          imagePrompt: "真实咖啡馆场景",
          basedOnEvidenceIds: ["insight-1"]
        },
        images: [],
        visibility: "仅自己可见"
      },
      copyVersions: [],
      visualDirection: {
        mood: "暖色真实",
        composition: "桌面近景加环境远景",
        colorPalette: "木色和奶油白",
        mustHave: ["咖啡杯"],
        mustAvoid: ["虚假价格"],
        basedOnEvidenceIds: ["insight-1"]
      },
      imagePrompts: [
        {
          id: "prompt-1",
          label: "主图",
          createdAt: "2026-05-31T00:00:00.000Z",
          basedOnEvidenceIds: ["insight-1"],
          value: { prompt: "真实咖啡馆场景" }
        }
      ],
      selectedImages: ["asset-1"],
      finalPost: {
        title: "广州周末安静咖啡馆",
        content: "适合坐一下午的真实探店清单。",
        tags: ["广州咖啡", "周末探店"],
        imageIds: ["asset-1"],
        imagePromptVersionIds: ["prompt-1"],
        copyVersionId: "draft-1"
      },
      qualityCheck: {
        titleScore: 90,
        copyScore: 90,
        visualConsistencyScore: 90,
        platformFitScore: 90,
        complianceScore: 90,
        canPublish: true,
        issues: [],
        suggestions: [],
        checkedAt: "2026-05-31T00:00:00.000Z"
      },
      currentStage: "reviewing",
      allowedActions: ["request_publish_confirmation"]
    }));

    expect(report.progress).toBe(88);
    expect(report.canRequestPublish).toBe(true);
    expect(report.nextAction).toBe("request_publish_confirmation");
    expect(report.blockers).toEqual([
      expect.objectContaining({ id: "confirmation" })
    ]);
  });

  it("shows quality issues before allowing publish confirmation", () => {
    const report = buildPostReadinessReport(project({
      evidencePack: {
        sampleIds: ["sample-1"],
        insights: [
          {
            id: "insight-1",
            type: "copy",
            insight: "正文要保留真实体验",
            sourceSampleIds: ["sample-1"],
            confidence: 0.8,
            createdAt: "2026-05-31T00:00:00.000Z"
          }
        ]
      },
      creativeBrief: {
        audience: "探店人群",
        painPoint: "选择困难",
        contentAngle: "咖啡馆清单",
        emotionalHook: "放松",
        proofPoints: ["体验"],
        tone: "真实",
        visualMood: "自然光",
        imageMustHave: [],
        imageMustAvoid: [],
        platformStyle: "小红书",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["insight-1"]
      },
      copyDraft: {
        id: "draft-1",
        updatedAt: "2026-05-31T00:00:00.000Z",
        draft: { title: "标题", content: "正文", tags: ["tag"], structure: [], imagePrompt: "图片方向", basedOnEvidenceIds: ["insight-1"] },
        images: [],
        visibility: "仅自己可见"
      },
      imagePrompts: [],
      selectedImages: ["asset-1"],
      finalPost: {
        title: "标题",
        content: "正文",
        tags: ["tag"],
        imageIds: ["asset-1"],
        imagePromptVersionIds: [],
        copyVersionId: "draft-1"
      },
      qualityCheck: {
        titleScore: 50,
        copyScore: 50,
        visualConsistencyScore: 20,
        platformFitScore: 50,
        complianceScore: 50,
        canPublish: false,
        issues: ["图片方向与文案引用的证据不一致"],
        suggestions: [],
        checkedAt: "2026-05-31T00:00:00.000Z"
      },
      allowedActions: ["run_quality_gate"]
    }));

    expect(report.canRequestPublish).toBe(false);
    expect(report.blockers.map((item) => item.id)).toContain("quality");
    expect(report.items.find((item) => item.id === "quality")?.detail).toContain("图片方向");
  });

  it("does not treat an untraced prompt as confirmed visual direction", () => {
    const report = buildPostReadinessReport(project({
      evidencePack: {
        sampleIds: ["sample-1"],
        insights: [{
          id: "insight-1",
          type: "visual",
          insight: "图片要有真实自然光",
          sourceSampleIds: ["sample-1"],
          confidence: 0.8,
          createdAt: "2026-05-31T00:00:00.000Z"
        }]
      },
      creativeBrief: {
        audience: "探店人群",
        painPoint: "选择困难",
        contentAngle: "咖啡馆清单",
        emotionalHook: "放松",
        proofPoints: ["体验"],
        tone: "真实",
        visualMood: "自然光",
        imageMustHave: [],
        imageMustAvoid: [],
        platformStyle: "小红书",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["insight-1"]
      },
      copyDraft: {
        id: "draft-1",
        updatedAt: "2026-05-31T00:00:00.000Z",
        draft: { title: "标题", content: "正文", tags: ["tag"], structure: [], imagePrompt: "手写图片方向", basedOnEvidenceIds: ["insight-1"] },
        images: [],
        visibility: "仅自己可见"
      },
      imagePrompts: [{
        id: "prompt-untraced",
        label: "手写 Prompt",
        createdAt: "2026-05-31T00:00:00.000Z",
        basedOnEvidenceIds: [],
        value: { prompt: "手写图片方向" }
      }],
      selectedImages: ["asset-1"],
      currentStage: "image_ready",
      allowedActions: ["plan_visuals"]
    }));

    expect(report.items.find((item) => item.id === "visual")).toMatchObject({
      ready: false,
      detail: expect.stringContaining("绑定证据")
    });
    expect(report.nextAction).toBe("plan_visuals");
    expect(report.canRequestPublish).toBe(false);
  });

  it("does not suggest quality gate before the final post is assembled", () => {
    const report = buildPostReadinessReport(project({
      evidencePack: {
        sampleIds: ["sample-1"],
        insights: [
          {
            id: "insight-1",
            type: "copy",
            insight: "正文要保留真实体验",
            sourceSampleIds: ["sample-1"],
            confidence: 0.8,
            createdAt: "2026-05-31T00:00:00.000Z"
          }
        ]
      },
      creativeBrief: {
        audience: "探店人群",
        painPoint: "选择困难",
        contentAngle: "咖啡馆清单",
        emotionalHook: "放松",
        proofPoints: ["体验"],
        tone: "真实",
        visualMood: "自然光",
        imageMustHave: [],
        imageMustAvoid: [],
        platformStyle: "小红书",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["insight-1"]
      },
      copyDraft: {
        id: "draft-1",
        updatedAt: "2026-05-31T00:00:00.000Z",
        draft: { title: "标题", content: "正文", tags: ["tag"], structure: [], imagePrompt: "图片方向", basedOnEvidenceIds: ["insight-1"] },
        images: [],
        visibility: "仅自己可见"
      },
      selectedImages: ["asset-1"],
      currentStage: "assembling",
      allowedActions: ["run_quality_gate"]
    }));

    expect(report.items.find((item) => item.id === "assembly")).toMatchObject({
      ready: false
    });
    expect(report.items.find((item) => item.id === "quality")?.action).toBeUndefined();
    expect(report.nextAction).toBeUndefined();
    expect(report.canRequestPublish).toBe(false);
  });
});
