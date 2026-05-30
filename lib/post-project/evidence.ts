import { randomUUID } from "node:crypto";
import type { ResearchSummary, SampleEvidence } from "@/lib/workflows/one-click";
import type { EvidenceInsight, EvidenceInsightType, EvidenceSourceType } from "@/lib/post-project/types";

export function insightsFromResearchSummary(
  summary: ResearchSummary | null | undefined,
  samples: SampleEvidence[] | unknown[] = [],
  sourceType: EvidenceSourceType = "realtime"
): EvidenceInsight[] {
  if (!summary) return [];
  const sampleIds = samples
    .map((sample) => (isRecord(sample) && typeof sample.id === "string" ? sample.id : undefined))
    .filter((id): id is string => Boolean(id));
  const now = new Date().toISOString();
  return [
    ...toInsights("title", safeStringArray(summary.contentStrengths), sampleIds, now, sourceType),
    ...toInsights("hook", safeStringArray(summary.hookInsights), sampleIds, now, sourceType),
    ...toInsights("structure", safeStringArray(summary.structureInsights), sampleIds, now, sourceType),
    ...toInsights("copy", safeStringArray(summary.learningsForContent), sampleIds, now, sourceType),
    ...toInsights("visual", [...safeStringArray(summary.imageStrengths), ...safeStringArray(summary.learningsForImages)], sampleIds, now, sourceType),
    ...toInsights("audience", safeStringArray(summary.nextQuestions), sampleIds, now, sourceType, 0.55)
  ];
}

function toInsights(
  type: EvidenceInsightType,
  values: string[] | undefined,
  sampleIds: string[],
  createdAt: string,
  sourceType: EvidenceSourceType,
  confidence = 0.72
): EvidenceInsight[] {
  return (values ?? [])
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((insight) => ({
      id: `insight-${type}-${randomUUID().slice(0, 8)}`,
      sourceType,
      type,
      insight,
      sourceSampleIds: sampleIds,
      confidence,
      createdAt
    }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function safeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
