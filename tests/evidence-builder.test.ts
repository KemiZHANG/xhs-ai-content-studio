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
    insight: "Lead with a clear scene and user benefit",
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
      audience: "local review account followers",
      painPoint: "fear of wasting time on overhyped places",
      contentAngle: "honest visit notes",
      emotionalHook: "avoid disappointment",
      proofPoints: ["average spend", "queue time"],
      tone: "honest",
      visualMood: "natural light",
      imageMustHave: ["interior scene"],
      imageMustAvoid: ["copied source images"],
      platformStyle: "xiaohongshu image-text post",
      tabooWords: ["best"],
      complianceNotes: ["do not exaggerate"],
      basedOnEvidenceIds: ["insight-live-title"]
    },
    ...overrides
  };
}

function pack(overrides: Partial<ViralKnowledgePack> = {}): ViralKnowledgePack {
  return {
    query: "Guangzhou cafe",
    rewrittenQueries: ["Guangzhou cafe high collect"],
    filters: { minCollects: 1000 },
    filterSummary: "collects >= 1000",
    results: [
      {
        score: 0.8,
        reasons: ["semantic match"],
        case: {
          id: "viral-case-1",
          platform: "xiaohongshu",
          topic: "Guangzhou cafe",
          category: "local guide",
          title: "High collect cafe guide",
          bodyExcerpt: "Start with audience, then location and average spend.",
          tags: ["cafe"],
          imageStyle: "natural light",
          hookType: "avoidance hook",
          contentStructure: ["audience", "scene", "reminder"],
          painPoint: "fear of wasting time",
          audience: "local review followers",
          emotionalTrigger: "honest avoid-disappointment note",
          metrics: { likes: 1200, collects: 1800, comments: 90, shares: 20, score: 3000 },
          sourceUrl: "https://www.xiaohongshu.com/explore/viral-case-1",
          createdAt: now,
          embedding: [],
          extractedInsights: {
            titleHooks: ["avoidance hook"],
            copyStructures: ["audience / scene / reminder"],
            tagPatterns: ["topic + scene"],
            visualPatterns: ["natural light"],
            audienceSignals: ["local review followers"],
            painPoints: ["fear of wasting time"],
            emotionalTriggers: ["honest avoid-disappointment note"],
            commentConcerns: ["average spend"],
            reusableRules: ["keep the structure, do not copy source text"],
            avoidCopying: ["do not copy title wording"]
          },
          creativeSafety: {
            summary: "Use as reusable pattern evidence only.",
            reusablePatterns: ["audience / scene / reminder"],
            doNotCopy: ["do not copy title wording"],
            transformationGuidance: ["replace with your own scene and proof"]
          }
        }
      }
    ],
    insights: [
      insight({
        id: "viral-insight-hook",
        sourceType: undefined,
        type: "hook",
        insight: "Use an avoid-disappointment scene hook",
        sourceSampleIds: ["viral-case-1"],
        confidence: 1.4
      }),
      insight({
        id: "insight-live-title",
        sourceType: "viral_library",
        type: "title",
        insight: "Duplicate evidence should not be added again",
        sourceSampleIds: ["viral-case-1"]
      })
    ],
    sufficiency: {
      isEnough: true,
      realtimeCount: 1,
      viralCount: 1,
      missing: [],
      recommendation: "enough evidence"
    },
    strategyReport: {
      summary: "Viral strategy summary",
      titleMoves: ["avoidance hook"],
      structureMoves: ["audience / scene / reminder"],
      visualMoves: ["natural light"],
      audiencePainPoints: ["fear of wasting time"],
      originalityRules: ["learn structure without copying source text"],
      recommendedAngles: ["avoidance hook + honest scene"],
      evidenceIds: ["viral-case-1", "viral-insight-hook"]
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
        filterSummary: "collects >= 1000",
        strategyReport: {
          summary: "Viral strategy summary"
        },
        evidenceSourceCounts: { realtime: 1, viral_library: 1, user_input: 0 }
      }
    });
    expect(result.shouldRefreshCreativeBrief).toBe(true);
  });
});
