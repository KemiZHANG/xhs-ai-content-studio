import { describe, expect, it } from "vitest";
import { buildEvidencePackWithViralKnowledge, normalizeEvidenceInsights } from "@/lib/agent/evidence-builder";
import type { EvidenceInsight, PostProject } from "@/lib/post-project/types";
import type { ViralKnowledgePack } from "@/lib/rag/viral";

const now = "2026-05-30T00:00:00.000Z";

function insight(overrides: Partial<EvidenceInsight> = {}): EvidenceInsight {
  return {
    id: "insight-live-title",
    sourceType: "realtime",
    type: "title",
    insight: "标题先给明确场景和利益点",
    sourceSampleIds: ["note-live"],
    confidence: 0.8,
    createdAt: now,
    ...overrides
  };
}

function project(overrides: Partial<PostProject> = {}): Pick<PostProject, "evidencePack" | "creativeBrief"> {
  return {
    evidencePack: {
      sampleIds: ["note-live"],
      insights: [insight()],
      summary: { report: "live evidence" },
      updatedAt: now
    },
    creativeBrief: {
      audience: "探店账号粉丝",
      painPoint: "怕踩雷",
      contentAngle: "真实体验",
      emotionalHook: "避坑感",
      proofPoints: ["人均", "排队"],
      tone: "真实",
      visualMood: "自然光",
      imageMustHave: ["店内场景"],
      imageMustAvoid: ["盗图"],
      platformStyle: "小红书图文",
      tabooWords: ["最"],
      complianceNotes: ["不夸大"],
      basedOnEvidenceIds: ["insight-live-title"]
    },
    ...overrides
  };
}

function pack(overrides: Partial<ViralKnowledgePack> = {}): ViralKnowledgePack {
  return {
    query: "广州咖啡馆",
    rewrittenQueries: ["广州咖啡馆 高收藏"],
    filters: { minCollects: 1000 },
    filterSummary: "收藏 ≥ 1000",
    results: [
      {
        score: 0.8,
        reasons: ["语义相似"],
        case: {
          id: "viral-case-1",
          platform: "xiaohongshu",
          topic: "广州咖啡馆",
          category: "探店",
          title: "高收藏咖啡馆攻略",
          bodyExcerpt: "先说人群，再说位置和人均。",
          tags: ["咖啡馆"],
          imageStyle: "自然光",
          hookType: "避坑钩子",
          contentStructure: ["人群", "场景", "提醒"],
          painPoint: "怕踩雷",
          audience: "探店账号粉丝",
          emotionalTrigger: "真实避坑",
          metrics: { likes: 1200, collects: 1800, comments: 90, shares: 20, score: 3000 },
          sourceUrl: "https://www.xiaohongshu.com/explore/viral-case-1",
          createdAt: now,
          embedding: [],
          extractedInsights: {
            titleHooks: ["避坑钩子"],
            copyStructures: ["人群/场景/提醒"],
            tagPatterns: ["主题+场景"],
            visualPatterns: ["自然光"],
            audienceSignals: ["探店账号粉丝"],
            painPoints: ["怕踩雷"],
            emotionalTriggers: ["真实避坑"],
            commentConcerns: ["人均"],
            reusableRules: ["保留结构，不复制原文"],
            avoidCopying: ["不要复制标题"]
          }
        }
      }
    ],
    insights: [
      insight({
        id: "viral-insight-hook",
        sourceType: undefined,
        type: "hook",
        insight: "标题用避坑场景切入",
        sourceSampleIds: ["viral-case-1"],
        confidence: 1.4
      }),
      insight({
        id: "insight-live-title",
        sourceType: "viral_library",
        type: "title",
        insight: "重复证据不应再次加入",
        sourceSampleIds: ["viral-case-1"]
      })
    ],
    sufficiency: {
      isEnough: true,
      realtimeCount: 1,
      viralCount: 1,
      missing: [],
      recommendation: "证据足够"
    },
    ...overrides
  };
}

describe("agent evidence builder", () => {
  it("normalizes source types and clamps confidence", () => {
    const normalized = normalizeEvidenceInsights([
      insight({ sourceType: undefined, confidence: 2, sourceSampleIds: [" a ", "a", "b"] })
    ], "viral_library");

    expect(normalized[0].sourceType).toBe("viral_library");
    expect(normalized[0].confidence).toBe(1);
    expect(normalized[0].sourceSampleIds).toEqual(["a", "b"]);
  });

  it("merges viral library evidence into an evidencePack without duplicating insights", () => {
    const result = buildEvidencePackWithViralKnowledge(project(), pack());

    expect(result.addedInsightIds).toEqual(["viral-insight-hook"]);
    expect(result.evidencePack.sampleIds).toEqual(["note-live", "viral-case-1"]);
    expect(result.evidencePack.insights.map((item) => item.id)).toEqual(["insight-live-title", "viral-insight-hook"]);
    expect(result.evidencePack.insights.find((item) => item.id === "viral-insight-hook")?.sourceType).toBe("viral_library");
    expect(result.sourceCounts).toMatchObject({ realtime: 1, viral_library: 1, user_input: 0 });
    expect(result.evidencePack.summary).toMatchObject({
      viralKnowledge: {
        filterSummary: "收藏 ≥ 1000",
        evidenceSourceCounts: { realtime: 1, viral_library: 1, user_input: 0 }
      }
    });
    expect(result.shouldRefreshCreativeBrief).toBe(true);
  });
});
