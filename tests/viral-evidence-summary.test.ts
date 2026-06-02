import { describe, expect, it } from "vitest";
import { buildViralEvidenceSummary } from "@/app/components/viral-evidence-summary";
import type { PostProject, ViralCase } from "@/app/types";

const baseViralCase: ViralCase = {
  id: "viral-case-1",
  platform: "xiaohongshu",
  sourceSampleId: "note-1",
  topic: "广州咖啡馆",
  category: "探店",
  title: "周末咖啡馆",
  bodyExcerpt: "不保存原文，只保留摘要片段",
  tags: ["广州咖啡", "探店"],
  imageStyle: "自然光桌面近景",
  hookType: "场景收藏钩子",
  contentStructure: ["场景", "理由", "建议"],
  painPoint: "不知道周末去哪坐",
  audience: "周末探店用户",
  emotionalTrigger: "慢下来",
  metrics: { likes: 1200, collects: 980, comments: 66, shares: 20, score: 3600 },
  sourceUrl: "https://www.xiaohongshu.com/explore/note-1",
  createdAt: "2026-05-31T00:00:00.000Z",
  embedding: [],
  extractedInsights: {
    titleHooks: ["用具体场景开头"],
    copyStructures: ["先说人群，再说选择标准"],
    tagPatterns: ["城市 + 品类 + 场景"],
    visualPatterns: ["自然光桌面近景"],
    audienceSignals: ["周末探店用户"],
    painPoints: ["不知道去哪坐"],
    emotionalTriggers: ["慢下来"],
    commentConcerns: ["地址和营业时间"],
    reusableRules: ["把评论问题变成正文决策信息"],
    avoidCopying: ["不要复用原文句式"]
  },
  creativeSafety: {
    summary: "只学习场景和结构，不复制标题正文",
    reusablePatterns: ["场景钩子 + 收藏理由"],
    doNotCopy: ["不要复制原文表达"],
    transformationGuidance: ["替换地点、细节和叙事顺序"]
  },
  quality: { score: 0.86, structuredFieldCount: 8, reusableRuleCount: 3, safetyRuleCount: 3, warnings: [] },
  extraction: { sourceSampleId: "note-1", method: "model", extractedAt: "2026-05-31T00:00:00.000Z" }
};

function projectWithViralEvidence(): PostProject {
  return {
    id: "post-1",
    topic: "广州咖啡馆",
    evidencePack: {
      sampleIds: ["viral-case-1"],
      insights: [
        {
          id: "viral-insight-hook",
          sourceType: "viral_library",
          type: "hook",
          insight: "标题用具体周末场景制造收藏动机",
          sourceSampleIds: ["viral-case-1"],
          confidence: 0.86,
          createdAt: "2026-05-31T00:00:00.000Z"
        },
        {
          id: "viral-insight-visual",
          sourceType: "viral_library",
          type: "visual",
          insight: "图片使用自然光桌面近景，主体清晰但不复刻原图",
          sourceSampleIds: ["viral-case-1"],
          confidence: 0.82,
          createdAt: "2026-05-31T00:00:00.000Z"
        },
        {
          id: "realtime-insight-copy",
          sourceType: "realtime",
          type: "copy",
          insight: "正文补充真实路线和注意事项",
          sourceSampleIds: ["note-live"],
          confidence: 0.9,
          createdAt: "2026-05-31T00:00:00.000Z"
        }
      ]
    },
    focusedEvidenceIds: ["viral-insight-hook"],
    selectedSamples: [],
    creativeBrief: {
      audience: "周末探店用户",
      painPoint: "不知道去哪坐",
      contentAngle: "安静咖啡馆真实分享",
      emotionalHook: "慢下来",
      proofPoints: ["自然光", "座位"],
      tone: "真实",
      visualMood: "自然光",
      imageMustHave: ["咖啡"],
      imageMustAvoid: ["广告感"],
      platformStyle: "小红书",
      tabooWords: [],
      complianceNotes: [],
      basedOnEvidenceIds: ["viral-insight-hook", "realtime-insight-copy"]
    },
    copyDraft: null,
    copyVersions: [],
    imagePrompts: [],
    generatedImages: [],
    selectedImages: [],
    agentMemory: [],
    currentStage: "brief_ready",
    allowedActions: [],
    updatedAt: "2026-05-31T00:00:00.000Z"
  };
}

describe("viral evidence summary", () => {
  it("compresses viral_library evidence into focused and cited learnings", () => {
    const summary = buildViralEvidenceSummary({
      project: projectWithViralEvidence(),
      viralCases: [baseViralCase],
      viralKnowledge: null
    });

    expect(summary.hasEvidence).toBe(true);
    expect(summary.headline).toContain("重点爆款规律");
    expect(summary.keyInsights).toHaveLength(2);
    expect(summary.keyInsights[0]).toMatchObject({
      id: "viral-insight-hook",
      isFocused: true,
      isCited: true
    });
    expect(summary.coverage).toEqual([
      expect.objectContaining({
        id: "title",
        status: "cited",
        evidenceIds: ["viral-insight-hook"]
      }),
      expect.objectContaining({
        id: "copy",
        status: "missing",
        evidenceIds: []
      }),
      expect.objectContaining({
        id: "tag",
        status: "missing",
        evidenceIds: []
      }),
      expect.objectContaining({
        id: "visual",
        status: "ready",
        evidenceIds: ["viral-insight-visual"]
      })
    ]);
    expect(summary.sourceCases[0]).toMatchObject({
      id: "viral-case-1",
      hookType: "场景收藏钩子",
      safetySummary: "只学习场景和结构，不复制标题正文",
      reusablePatterns: ["场景钩子 + 收藏理由"],
      doNotCopy: ["不要复制原文表达"]
    });
    expect(summary.traceLine).toContain("已被 Brief");
  });

  it("explains the RAG gap when no viral evidence has been merged into the project", () => {
    const summary = buildViralEvidenceSummary({
      project: { ...projectWithViralEvidence(), evidencePack: { sampleIds: [], insights: [] }, focusedEvidenceIds: [] },
      viralCases: [baseViralCase],
      viralKnowledge: {
        query: "广州咖啡馆",
        rewrittenQueries: [],
        filterSummary: "",
        sufficiency: {
          isEnough: false,
          realtimeCount: 1,
          viralCount: 0,
          missing: ["爆款库样本不足"],
          recommendation: "请保存更多高收藏样本"
        },
        strategyReport: {
          summary: "",
          titleMoves: [],
          structureMoves: [],
          visualMoves: [],
          audiencePainPoints: [],
          originalityRules: [],
          recommendedAngles: [],
          evidenceIds: []
        },
        insights: [],
        evidenceTrace: [],
        results: []
      }
    });

    expect(summary.hasEvidence).toBe(false);
    expect(summary.coverage.map((item) => item.status)).toEqual(["missing", "missing", "missing", "missing"]);
    expect(summary.sourceLine).toContain("可检索历史样本 1 条");
    expect(summary.missingLine).toBe("请保存更多高收藏样本");
  });
});
