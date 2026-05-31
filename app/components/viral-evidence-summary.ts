import type { PostProject, ViralCase, WorkflowResult } from "@/app/types";

type ProjectInsight = PostProject["evidencePack"]["insights"][number];

export type ViralEvidenceSummaryModel = {
  hasEvidence: boolean;
  headline: string;
  detail: string;
  sourceLine: string;
  keyInsights: Array<{
    id: string;
    type: ProjectInsight["type"];
    insight: string;
    confidence: number;
    sourceSampleIds: string[];
    isFocused: boolean;
    isCited: boolean;
  }>;
  sourceCases: Array<{
    id: string;
    title: string;
    hookType: string;
    category: string;
    score: number;
    safetySummary: string;
    reusablePatterns: string[];
    doNotCopy: string[];
  }>;
  traceLine: string;
  missingLine?: string;
};

export function buildViralEvidenceSummary({
  project,
  viralCases,
  viralKnowledge
}: {
  project: PostProject | null | undefined;
  viralCases: ViralCase[];
  viralKnowledge?: WorkflowResult["viralKnowledge"] | null;
}): ViralEvidenceSummaryModel {
  const viralInsights = project?.evidencePack.insights.filter((insight) => insight.sourceType === "viral_library") ?? [];
  const focusedIds = new Set(project?.focusedEvidenceIds ?? []);
  const citedIds = new Set([
    ...(project?.creativeBrief?.basedOnEvidenceIds ?? []),
    ...(project?.copyDraft?.draft.basedOnEvidenceIds ?? []),
    ...(project?.visualDirection?.basedOnEvidenceIds ?? []),
    ...(project?.finalPost?.basedOnEvidenceIds ?? [])
  ]);
  const sourceCaseById = new Map(viralCases.map((item) => [item.id, item]));
  const keyInsights = pickKeyViralInsights(viralInsights, focusedIds, citedIds).map((insight) => ({
    id: insight.id,
    type: insight.type,
    insight: insight.insight,
    confidence: insight.confidence,
    sourceSampleIds: insight.sourceSampleIds,
    isFocused: focusedIds.has(insight.id),
    isCited: citedIds.has(insight.id)
  }));
  const sourceCases = uniqueStrings(keyInsights.flatMap((insight) => insight.sourceSampleIds))
    .map((id) => sourceCaseById.get(id))
    .filter((item): item is ViralCase => Boolean(item))
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      title: item.title,
      hookType: item.hookType,
      category: item.category,
      score: item.metrics.score,
      safetySummary: item.creativeSafety?.summary ?? "只复用结构和风格，不复制原文原图。",
      reusablePatterns: (item.creativeSafety?.reusablePatterns ?? item.extractedInsights.reusableRules).slice(0, 2),
      doNotCopy: (item.creativeSafety?.doNotCopy ?? item.extractedInsights.avoidCopying).slice(0, 2)
    }));
  const citedCount = viralInsights.filter((insight) => citedIds.has(insight.id)).length;
  const focusedCount = viralInsights.filter((insight) => focusedIds.has(insight.id)).length;
  const sufficiency = viralKnowledge?.sufficiency;
  const sourceLine = `爆款库 evidencePack ${viralInsights.length} 条 · 本次重点 ${focusedCount} 条 · 已被创作引用 ${citedCount} 条`;

  if (!viralInsights.length) {
    return {
      hasEvidence: false,
      headline: "爆款库还没接入当前帖子",
      detail: "刷新 RAG 或把高质量实时样本保存进爆款库后，这里只展示可复用规律，不展示原文合集。",
      sourceLine: `可检索历史样本 ${viralCases.length} 条`,
      keyInsights: [],
      sourceCases: [],
      traceLine: "当前文案和图片方向暂未引用 viral_library 证据。",
      missingLine: sufficiency?.recommendation
    };
  }

  return {
    hasEvidence: true,
    headline: focusedCount ? "已选定本次重点爆款规律" : "爆款库规律已接入当前帖子",
    detail: sufficiency?.isEnough === false
      ? `证据仍偏薄：${sufficiency.recommendation}`
      : "Agent 会把这些规律用于 CreativeBrief、标题/正文/标签和图片方向，但只复用结构、风格和决策逻辑，不复制原文原图。",
    sourceLine,
    keyInsights,
    sourceCases,
    traceLine: buildTraceLine({ citedCount, focusedCount, viralInsightCount: viralInsights.length }),
    missingLine: sufficiency?.isEnough === false && sufficiency.missing.length
      ? `缺口：${sufficiency.missing.slice(0, 3).join("、")}`
      : undefined
  };
}

function pickKeyViralInsights(
  insights: ProjectInsight[],
  focusedIds: Set<string>,
  citedIds: Set<string>
): ProjectInsight[] {
  const preferredOrder = ["hook", "structure", "copy", "tag", "visual", "pain_point", "audience", "comment", "title"];
  const usedTypes = new Set<string>();
  const sorted = [...insights]
    .filter((insight) => insight.insight.trim())
    .sort((left, right) => {
      const byFocus = Number(focusedIds.has(right.id)) - Number(focusedIds.has(left.id));
      const byCitation = Number(citedIds.has(right.id)) - Number(citedIds.has(left.id));
      const leftRank = preferredOrder.indexOf(left.type);
      const rightRank = preferredOrder.indexOf(right.type);
      const byType = (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank);
      return byFocus || byCitation || byType || right.confidence - left.confidence || left.id.localeCompare(right.id);
    });
  const selected: ProjectInsight[] = [];
  for (const insight of sorted) {
    if (selected.length >= 5) break;
    if (usedTypes.has(insight.type) && selected.length < 3) continue;
    selected.push(insight);
    usedTypes.add(insight.type);
  }
  return selected.length ? selected : insights.slice(0, 5);
}

function buildTraceLine({
  citedCount,
  focusedCount,
  viralInsightCount
}: {
  citedCount: number;
  focusedCount: number;
  viralInsightCount: number;
}): string {
  if (citedCount) return `已被 Brief / 文案 / 图片方向引用 ${citedCount}/${viralInsightCount} 条，可追溯到 evidencePack。`;
  if (focusedCount) return `已选择 ${focusedCount} 条重点规律，下一步生成 CreativeBrief 或文案时会优先引用。`;
  return "已进入 evidencePack，但还未被 Brief、文案或图片方向引用。";
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
