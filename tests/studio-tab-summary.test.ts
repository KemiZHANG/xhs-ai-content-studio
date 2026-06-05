import { describe, expect, it } from "vitest";
import {
  buildBriefTabSummary,
  buildImageTabSummary,
  buildPublishTabSummary
} from "@/app/components/studio-tab-summary";
import type { PostProject } from "@/app/types";

function project(overrides: Partial<PostProject> = {}): PostProject {
  return {
    id: "post-1",
    topic: "广州咖啡馆",
    evidencePack: { sampleIds: [], insights: [] },
    focusedEvidenceIds: [],
    selectedSamples: [],
    copyVersions: [],
    imagePrompts: [],
    generatedImages: [],
    selectedImages: [],
    agentMemory: [],
    currentStage: "empty",
    allowedActions: [],
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}

describe("studio tab summary", () => {
  it("routes evidence without viral RAG toward RAG before Brief", () => {
    const summary = buildBriefTabSummary({
      project: null,
      evidenceCount: 3,
      viralEvidenceCount: 0
    });

    expect(summary.headline).toContain("爆款库 RAG");
    expect(summary.primaryAction).toBe("retrieve_viral_knowledge");
    expect(summary.primaryActionLabel).toBe("刷新爆款库 RAG");
  });

  it("routes an existing Brief toward copy creation", () => {
    const summary = buildBriefTabSummary({
      project: project({
        creativeBrief: {
          audience: "探店人群",
          painPoint: "选择困难",
          contentAngle: "安静咖啡馆",
          emotionalHook: "慢下来",
          proofPoints: ["真实体验"],
          tone: "真实分享",
          visualMood: "自然光",
          imageMustHave: [],
          imageMustAvoid: [],
          platformStyle: "小红书",
          tabooWords: [],
          complianceNotes: [],
          basedOnEvidenceIds: ["insight-1"]
        }
      }),
      evidenceCount: 3,
      viralEvidenceCount: 1
    });

    expect(summary.state).toBe("ready");
    expect(summary.primaryAction).toBe("generate_copy");
    expect(summary.detail).toContain("安静咖啡馆");
  });

  it("routes an existing Brief back to viral RAG when creative evidence is weak", () => {
    const summary = buildBriefTabSummary({
      project: project({
        creativeBrief: {
          audience: "探店人群",
          painPoint: "选择困难",
          contentAngle: "安静咖啡馆",
          emotionalHook: "慢下来",
          proofPoints: ["真实体验"],
          tone: "真实分享",
          visualMood: "自然光",
          imageMustHave: [],
          imageMustAvoid: [],
          platformStyle: "小红书",
          tabooWords: [],
          complianceNotes: [],
          basedOnEvidenceIds: ["viral-insight-1"]
        }
      }),
      evidenceCount: 3,
      viralEvidenceCount: 1,
      ragCreativeBlocked: true
    });

    expect(summary.primaryAction).toBe("retrieve_viral_knowledge");
    expect(summary.primaryActionLabel).toBe("刷新爆款库 RAG");
    expect(summary.detail).toContain("爆款库 RAG 证据还不足");
  });

  it("summarizes image tabs without exposing the whole asset library", () => {
    expect(buildImageTabSummary({
      selectedCount: 0,
      previewCount: 4,
      hiddenCount: 8,
      mode: "generated"
    })).toMatchObject({
      state: "warn",
      primaryAction: "select_images",
      primaryActionLabel: "选择图片"
    });

    expect(buildImageTabSummary({
      selectedCount: 2,
      previewCount: 4,
      hiddenCount: 8,
      mode: "reference"
    })).toMatchObject({
      state: "ready",
      primaryAction: "run_quality_gate",
      primaryActionLabel: "进入发布检查"
    });
  });

  it("routes empty generated image tabs back to viral RAG when creative evidence is weak", () => {
    expect(buildImageTabSummary({
      selectedCount: 0,
      previewCount: 0,
      hiddenCount: 0,
      mode: "generated",
      ragCreativeBlocked: true
    })).toMatchObject({
      state: "empty",
      primaryAction: "retrieve_viral_knowledge",
      primaryActionLabel: "刷新爆款库 RAG"
    });
  });

  it("summarizes publish readiness and pending confirmations", () => {
    expect(buildPublishTabSummary({
      publishReady: false,
      pendingConfirmation: false,
      blockerCount: 4,
      riskLevel: "blocked"
    })).toMatchObject({
      state: "warn",
      primaryAction: "run_quality_gate"
    });

    expect(buildPublishTabSummary({
      publishReady: true,
      pendingConfirmation: false,
      blockerCount: 0,
      riskLevel: "ok"
    })).toMatchObject({
      state: "ready",
      primaryAction: "request_publish_confirmation"
    });

    expect(buildPublishTabSummary({
      publishReady: true,
      pendingConfirmation: true,
      blockerCount: 0,
      riskLevel: "warn"
    })).toMatchObject({
      headline: "确认单已生成，等待人工确认",
      primaryAction: "review_publish_confirmation"
    });
  });
});
