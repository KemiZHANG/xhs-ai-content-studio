import type { PostProject, EvidenceInsight, EvidenceSourceType } from "@/lib/post-project/types";
import type { ViralKnowledgePack } from "@/lib/rag/viral";

export type EvidenceBuildResult = {
  evidencePack: PostProject["evidencePack"];
  addedInsightIds: string[];
  sourceCounts: Record<EvidenceSourceType, number>;
  shouldRefreshCreativeBrief: boolean;
};

export function buildEvidencePackWithViralKnowledge(
  project: Pick<PostProject, "evidencePack" | "creativeBrief">,
  pack: ViralKnowledgePack
): EvidenceBuildResult {
  const existingInsightIds = new Set(project.evidencePack.insights.map((insight) => insight.id));
  const normalizedViralInsights = normalizeEvidenceInsights(pack.insights, "viral_library");
  const addedInsights = normalizedViralInsights.filter((insight) => !existingInsightIds.has(insight.id));
  const insights = [...normalizeEvidenceInsights(project.evidencePack.insights, "realtime"), ...addedInsights];
  const sourceCounts = countEvidenceSources(insights);
  const shouldRefreshCreativeBrief = !project.creativeBrief?.basedOnEvidenceIds.some((id) =>
    addedInsights.some((insight) => insight.id === id)
  );

  return {
    evidencePack: {
      ...project.evidencePack,
      sampleIds: mergeSampleIds(project.evidencePack.sampleIds, pack.results.map((result) => result.case.id)),
      insights,
      summary: mergeViralKnowledgeSummary(project.evidencePack.summary, pack, sourceCounts),
      updatedAt: new Date().toISOString()
    },
    addedInsightIds: addedInsights.map((insight) => insight.id),
    sourceCounts,
    shouldRefreshCreativeBrief
  };
}

export function normalizeEvidenceInsights(
  insights: EvidenceInsight[],
  fallbackSourceType: EvidenceSourceType
): EvidenceInsight[] {
  return insights.map((insight) => ({
    ...insight,
    sourceType: insight.sourceType ?? fallbackSourceType,
    confidence: clampConfidence(insight.confidence),
    sourceSampleIds: mergeSampleIds([], insight.sourceSampleIds)
  }));
}

function countEvidenceSources(insights: EvidenceInsight[]): Record<EvidenceSourceType, number> {
  return insights.reduce<Record<EvidenceSourceType, number>>(
    (counts, insight) => {
      counts[insight.sourceType ?? "realtime"] += 1;
      return counts;
    },
    { realtime: 0, viral_library: 0, user_input: 0 }
  );
}

function mergeViralKnowledgeSummary(
  summary: unknown,
  pack: ViralKnowledgePack,
  sourceCounts: Record<EvidenceSourceType, number>
): unknown {
  const nextViralKnowledge = {
    ...pack,
    evidenceSourceCounts: sourceCounts
  };
  if (isRecord(summary)) {
    return {
      ...summary,
      viralKnowledge: nextViralKnowledge
    };
  }
  return { viralKnowledge: nextViralKnowledge };
}

function mergeSampleIds(left: string[], right: string[]): string[] {
  return [...new Set([...left, ...right].map((item) => item.trim()).filter(Boolean))];
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
