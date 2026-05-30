import { createHash } from "node:crypto";
import type { ProductInfo } from "@/lib/post-project/types";
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

export function insightsFromUserBriefInput({
  topic,
  targetAudience,
  goal,
  tone,
  productInfo
}: {
  topic?: string;
  targetAudience?: string;
  goal?: string;
  tone?: string;
  productInfo?: Partial<ProductInfo>;
}): EvidenceInsight[] {
  const now = new Date().toISOString();
  const sampleIds = ["user-brief"];
  return [
    ...toInsights("title", topic ? [`用户指定主题：${topic}`] : [], sampleIds, now, "user_input", 0.95),
    ...toInsights("audience", targetAudience ? [`用户指定目标人群：${targetAudience}`] : [], sampleIds, now, "user_input", 0.95),
    ...toInsights("copy", goal ? [`用户指定内容目标：${goal}`] : [], sampleIds, now, "user_input", 0.94),
    ...toInsights("copy", tone ? [`用户指定语气：${tone}`] : [], sampleIds, now, "user_input", 0.9),
    ...toInsights("copy", productInfo?.name ? [`用户指定产品/店铺：${productInfo.name}`] : [], sampleIds, now, "user_input", 0.92),
    ...toInsights("pain_point", productInfo?.sellingPoints ? [`用户指定卖点/重点：${productInfo.sellingPoints}`] : [], sampleIds, now, "user_input", 0.9),
    ...toInsights("visual", productInfo?.scene ? [`用户指定使用/拍摄场景：${productInfo.scene}`] : [], sampleIds, now, "user_input", 0.88)
  ];
}

export function mergeEvidenceInsights(existing: EvidenceInsight[], incoming: EvidenceInsight[]): EvidenceInsight[] {
  const ids = new Set(existing.map((insight) => insight.id));
  return [
    ...existing,
    ...incoming.filter((insight) => {
      if (ids.has(insight.id)) return false;
      ids.add(insight.id);
      return true;
    })
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
      id: stableEvidenceInsightId({ type, sourceType, sampleIds, insight }),
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

function stableEvidenceInsightId({
  type,
  sourceType,
  sampleIds,
  insight
}: {
  type: EvidenceInsightType;
  sourceType: EvidenceSourceType;
  sampleIds: string[];
  insight: string;
}): string {
  const key = JSON.stringify({
    type,
    sourceType,
    sampleIds: [...sampleIds].sort(),
    insight: insight.replace(/\s+/g, " ").trim()
  });
  return `insight-${type}-${createHash("sha1").update(key).digest("hex").slice(0, 10)}`;
}
