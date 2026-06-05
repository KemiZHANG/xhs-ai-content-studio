import type { PostProject, ViralCase, WorkflowResult } from "@/app/types";

type ProjectInsight = PostProject["evidencePack"]["insights"][number];
type ViralSearchResult = NonNullable<WorkflowResult["viralKnowledge"]>["results"][number];

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
  coverage: Array<{
    id: "title" | "copy" | "tag" | "visual";
    label: string;
    status: "ready" | "cited" | "missing";
    evidenceIds: string[];
    line: string;
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
    matchedQueries?: string[];
    reasons?: string[];
    scoreBreakdownLine?: string;
  }>;
  traceLine: string;
  missingLine?: string;
  weakViralEvidenceCount: number;
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
  const allViralInsights = project?.evidencePack.insights.filter((insight) => insight.sourceType === "viral_library") ?? [];
  const viralInsights = allViralInsights.filter((insight) => !isWeakViralInsight(insight));
  const weakViralEvidenceCount = allViralInsights.length - viralInsights.length;
  const focusedIds = new Set(project?.focusedEvidenceIds ?? []);
  const citedIds = new Set([
    ...(project?.creativeBrief?.basedOnEvidenceIds ?? []),
    ...(project?.copyDraft?.draft.basedOnEvidenceIds ?? []),
    ...(project?.visualDirection?.basedOnEvidenceIds ?? []),
    ...(project?.imagePrompts ?? []).flatMap((prompt) => prompt.basedOnEvidenceIds ?? []),
    ...(project?.generatedImages ?? []).flatMap((image) => image.basedOnEvidenceIds ?? []),
    ...(project?.finalPost?.basedOnEvidenceIds ?? [])
  ]);
  const sourceCaseById = new Map(viralCases.map((item) => [item.id, item]));
  const ragTraceByCaseId = buildViralRagTraceByCaseId(viralKnowledge);
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
    .map((item) => {
      const trace = ragTraceByCaseId.get(item.id);
      return {
        id: item.id,
        title: item.title,
        hookType: item.hookType,
        category: item.category,
        score: item.metrics.score,
        safetySummary: item.creativeSafety?.summary ?? "只复用结构、风格和决策逻辑，不复制原文原图。",
        reusablePatterns: (item.creativeSafety?.reusablePatterns ?? item.extractedInsights.reusableRules).slice(0, 2),
        doNotCopy: (item.creativeSafety?.doNotCopy ?? item.extractedInsights.avoidCopying).slice(0, 2),
        matchedQueries: trace?.matchedQueries,
        reasons: trace?.reasons,
        scoreBreakdownLine: trace?.scoreBreakdownLine
      };
    });
  const citedCount = viralInsights.filter((insight) => citedIds.has(insight.id)).length;
  const focusedCount = viralInsights.filter((insight) => focusedIds.has(insight.id)).length;
  const coverage = buildViralCoverage({ viralInsights, citedIds });
  const sufficiency = viralKnowledge?.sufficiency;
  const weakLine = weakViralEvidenceCount ? ` · 弱参考 ${weakViralEvidenceCount} 条` : "";
  const sourceLine = `爆款库 evidencePack ${viralInsights.length} 条${weakLine} · 本次重点 ${focusedCount} 条 · 已被创作引用 ${citedCount} 条`;

  if (!viralInsights.length) {
    return {
      hasEvidence: false,
      headline: "爆款库还没接入当前帖子",
      detail: "刷新 RAG 或把高质量实时样本保存进爆款库后，这里只展示可复用规律，不展示原文合集。",
      sourceLine: `可检索历史样本 ${viralCases.length} 条${weakLine}`,
      keyInsights: [],
      coverage,
      sourceCases: [],
      traceLine: "当前文案和图片方向暂未引用 viral_library 证据。",
      missingLine: sufficiency?.recommendation,
      weakViralEvidenceCount
    };
  }

  return {
    hasEvidence: true,
    headline: focusedCount ? "已选定本次重点爆款规律" : "爆款库规律已接入当前帖子",
    detail: sufficiency?.isEnough === false
      ? `证据仍偏薄：${sufficiency.recommendation}`
      : "Agent 会把这些规律用于 CreativeBrief、标题、正文、标签和图片方向，但只复用结构、风格和决策逻辑，不复制原文原图。",
    sourceLine,
    keyInsights,
    coverage,
    sourceCases,
    traceLine: buildTraceLine({ citedCount, focusedCount, viralInsightCount: viralInsights.length }),
    missingLine: sufficiency?.isEnough === false && sufficiency.missing.length
      ? `缺口：${sufficiency.missing.slice(0, 3).join("、")}`
      : undefined,
    weakViralEvidenceCount
  };
}

function isWeakViralInsight(insight: ProjectInsight): boolean {
  return insight.insight.trim().startsWith("弱参考：");
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

function buildViralCoverage({
  viralInsights,
  citedIds
}: {
  viralInsights: ProjectInsight[];
  citedIds: Set<string>;
}): ViralEvidenceSummaryModel["coverage"] {
  const fields: Array<{
    id: ViralEvidenceSummaryModel["coverage"][number]["id"];
    label: string;
    types: ProjectInsight["type"][];
  }> = [
    { id: "title", label: "标题", types: ["title", "hook"] },
    { id: "copy", label: "正文", types: ["copy", "structure", "pain_point", "audience", "comment"] },
    { id: "tag", label: "标签", types: ["tag"] },
    { id: "visual", label: "图片", types: ["visual"] }
  ];

  return fields.map((field) => {
    const evidenceIds = viralInsights
      .filter((insight) => field.types.includes(insight.type))
      .map((insight) => insight.id);
    const citedCount = evidenceIds.filter((id) => citedIds.has(id)).length;
    const status = citedCount ? "cited" : evidenceIds.length ? "ready" : "missing";
    const line = status === "cited"
      ? `已引用 ${citedCount}/${evidenceIds.length} 条`
      : status === "ready"
        ? `可用 ${evidenceIds.length} 条，尚未引用`
        : "缺少爆款库证据";
    return {
      id: field.id,
      label: field.label,
      status,
      evidenceIds: evidenceIds.slice(0, 5),
      line
    };
  });
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

type ViralRagTrace = {
  matchedQueries: string[];
  reasons: string[];
  scoreBreakdownLine: string;
};

function buildViralRagTraceByCaseId(viralKnowledge: WorkflowResult["viralKnowledge"] | null | undefined): Map<string, ViralRagTrace> {
  const traces = new Map<string, ViralRagTrace>();
  for (const result of viralKnowledge?.results ?? []) {
    const caseId = result.case.id;
    mergeViralRagTrace(traces, caseId, {
      matchedQueries: result.matchedQueries ?? [],
      reasons: result.reasons ?? [],
      scoreBreakdownLine: formatScoreBreakdown(result.scoreBreakdown)
    });
  }
  for (const trace of viralKnowledge?.evidenceTrace ?? []) {
    mergeViralRagTrace(traces, trace.caseId, {
      matchedQueries: trace.matchedQueries ?? [],
      reasons: trace.reasons ?? [],
      scoreBreakdownLine: traces.get(trace.caseId)?.scoreBreakdownLine ?? ""
    });
  }
  return traces;
}

function mergeViralRagTrace(traces: Map<string, ViralRagTrace>, caseId: string, next: ViralRagTrace): void {
  if (!caseId) return;
  const current = traces.get(caseId);
  traces.set(caseId, {
    matchedQueries: uniqueStrings([...(current?.matchedQueries ?? []), ...next.matchedQueries]).slice(0, 3),
    reasons: uniqueStrings([...(current?.reasons ?? []), ...next.reasons]).slice(0, 3),
    scoreBreakdownLine: current?.scoreBreakdownLine || next.scoreBreakdownLine
  });
}

function formatScoreBreakdown(scoreBreakdown?: ViralSearchResult["scoreBreakdown"]): string {
  if (!scoreBreakdown || typeof scoreBreakdown !== "object") return "";
  const value = scoreBreakdown as Record<string, unknown>;
  return [
    ["语义", value.semantic],
    ["关键词", value.keyword],
    ["互动", value.metrics],
    ["质量", value.quality],
    ["筛选", value.filters]
  ]
    .filter(([, score]) => typeof score === "number" && Number.isFinite(score) && score > 0)
    .map(([label, score]) => `${label} ${Number(score).toFixed(2)}`)
    .join(" / ");
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
