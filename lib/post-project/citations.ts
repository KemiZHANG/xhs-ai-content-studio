import type { GeneratedDraft } from "@/lib/workflows/one-click";
import type { EvidenceInsight, EvidenceSourceType, PostProject } from "@/lib/post-project/types";

export type EvidenceCitationField = "title" | "content" | "tags" | "imagePrompt";

export type EvidenceCitationSection = {
  field: EvidenceCitationField;
  evidenceIds: string[];
  insights: EvidenceInsight[];
  missingEvidenceIds: string[];
  sourceCounts: Record<EvidenceSourceType, number>;
};

export type EvidenceCitationReport = {
  sections: EvidenceCitationSection[];
  allEvidenceIds: string[];
  missingEvidenceIds: string[];
  sourceCounts: Record<EvidenceSourceType, number>;
  viralEvidenceTrace?: EvidenceCitationTrace[];
  hasRealtimeEvidence: boolean;
  hasViralEvidence: boolean;
  hasUserInputEvidence: boolean;
  warnings: string[];
  summary: string;
};

export type EvidenceCitationTrace = {
  caseId: string;
  sourceUrl: string;
  score: number;
  matchedQueries: string[];
  reasons: string[];
  evidenceInsightIds: string[];
};

export type EvidenceReferenceSummary = {
  evidenceIds: string[];
  insights: EvidenceInsight[];
  missingEvidenceIds: string[];
  sourceCounts: Record<EvidenceSourceType, number>;
  hasRealtimeEvidence: boolean;
  hasViralEvidence: boolean;
  hasUserInputEvidence: boolean;
  summary: string;
};

type EvidenceCitationProject = Pick<PostProject, "evidencePack" | "creativeBrief"> & {
  visualDirection?: { basedOnEvidenceIds?: string[] };
  imagePrompts?: Array<{ basedOnEvidenceIds?: string[] }>;
  generatedImages?: Array<{ basedOnEvidenceIds?: string[] }>;
  finalPost?: { basedOnEvidenceIds?: string[] };
};

export function buildEvidenceCitationReport(
  project: EvidenceCitationProject,
  evidenceIds: string[] = [],
  evidenceReferences?: GeneratedDraft["evidenceReferences"]
): EvidenceCitationReport {
  const fallbackIds = uniqueIds([
    ...evidenceIds,
    ...(project.creativeBrief?.basedOnEvidenceIds ?? [])
  ]);
  const visualFallbackIds = uniqueIds([
    ...fallbackIds,
    ...(project.visualDirection?.basedOnEvidenceIds ?? []),
    ...(project.imagePrompts ?? []).flatMap((prompt) => prompt.basedOnEvidenceIds ?? []),
    ...(project.generatedImages ?? []).flatMap((image) => image.basedOnEvidenceIds ?? []),
    ...(project.finalPost?.basedOnEvidenceIds ?? [])
  ]);
  const sections: EvidenceCitationSection[] = (["title", "content", "tags", "imagePrompt"] as const).map((field) => {
    const explicitIds = evidenceReferences?.[field] ?? [];
    const inferredIds = inferFieldEvidenceIds(project.evidencePack.insights, field, field === "imagePrompt" ? visualFallbackIds : fallbackIds);
    const ids = uniqueIds([...(explicitIds.length ? explicitIds : []), ...inferredIds]).slice(0, 8);
    return buildCitationSection(project.evidencePack.insights, field, ids);
  });
  const allEvidenceIds = uniqueIds(sections.flatMap((section) => section.evidenceIds));
  const missingEvidenceIds = uniqueIds(sections.flatMap((section) => section.missingEvidenceIds));
  const sourceCounts = countSources(sections.flatMap((section) => section.insights));
  const warnings = buildCitationWarnings(sections, missingEvidenceIds, sourceCounts);
  const viralEvidenceTrace = extractViralEvidenceTrace(project.evidencePack.summary, allEvidenceIds);

  return {
    sections,
    allEvidenceIds,
    missingEvidenceIds,
    sourceCounts,
    viralEvidenceTrace,
    hasRealtimeEvidence: sourceCounts.realtime > 0,
    hasViralEvidence: sourceCounts.viral_library > 0,
    hasUserInputEvidence: sourceCounts.user_input > 0,
    warnings,
    summary: formatCitationSummary(sourceCounts, missingEvidenceIds, warnings)
  };
}

export function formatEvidenceCitationReport(report: EvidenceCitationReport): string {
  const visibleSections = report.sections
    .map((section) => {
      const insights = section.insights.slice(0, 3);
      if (!insights.length) return "";
      return `${labelForCitationField(section.field)}：\n${insights.map(formatInsightLine).join("\n")}`;
    })
    .filter(Boolean);

  const warningText = report.warnings.length ? `注意：${report.warnings.join("；")}` : "";
  return [
    "这版为什么这样写：",
    report.summary,
    ...formatSourceOverview(report),
    ...formatViralEvidenceTrace(report.viralEvidenceTrace),
    ...visibleSections,
    warningText
  ].filter(Boolean).join("\n");
}

export function buildEvidenceReferenceSummary(
  project: Pick<PostProject, "evidencePack">,
  evidenceIds: string[] = [],
  limit = 5
): EvidenceReferenceSummary {
  const ids = uniqueIds(evidenceIds).slice(0, Math.max(1, limit));
  const section = buildCitationSection(project.evidencePack.insights, "content", ids);
  const sourceCounts = countSources(section.insights);
  return {
    evidenceIds: section.evidenceIds,
    insights: section.insights,
    missingEvidenceIds: section.missingEvidenceIds,
    sourceCounts,
    hasRealtimeEvidence: sourceCounts.realtime > 0,
    hasViralEvidence: sourceCounts.viral_library > 0,
    hasUserInputEvidence: sourceCounts.user_input > 0,
    summary: formatReferenceSummary(sourceCounts, section.missingEvidenceIds, section.insights.length)
  };
}

function inferFieldEvidenceIds(
  insights: EvidenceInsight[],
  field: EvidenceCitationField,
  fallbackIds: string[]
): string[] {
  const fallbackSet = new Set(fallbackIds);
  const allowedTypes = citationFieldInsightTypes(field);
  const relevant = insights
    .filter((insight) => fallbackSet.has(insight.id))
    .filter((insight) => insight.sourceType === "user_input" || allowedTypes.includes(insight.type))
    .sort((left, right) => {
      const byType = allowedTypes.indexOf(left.type) - allowedTypes.indexOf(right.type);
      const bySource = sourcePriority(left.sourceType) - sourcePriority(right.sourceType);
      return byType || bySource || right.confidence - left.confidence || left.id.localeCompare(right.id);
    })
    .map((insight) => insight.id);
  return relevant.length ? uniqueIds(relevant) : fallbackIds;
}

function citationFieldInsightTypes(field: EvidenceCitationField): EvidenceInsight["type"][] {
  const types: Record<EvidenceCitationField, EvidenceInsight["type"][]> = {
    title: ["hook", "title", "structure", "pain_point", "audience"],
    content: ["copy", "structure", "pain_point", "audience", "comment", "hook"],
    tags: ["tag", "audience", "pain_point", "title"],
    imagePrompt: ["visual", "structure", "audience", "pain_point"]
  };
  return types[field];
}

function sourcePriority(sourceType?: EvidenceSourceType): number {
  if (sourceType === "user_input") return 0;
  if (sourceType === "realtime" || !sourceType) return 1;
  if (sourceType === "viral_library") return 2;
  return 3;
}

function formatSourceOverview(report: EvidenceCitationReport): string[] {
  const directInsights = report.sections.flatMap((section) => section.insights);
  const uniqueInsights = uniqueInsightsById(directInsights);
  const realtime = uniqueInsights.filter((insight) => (insight.sourceType ?? "realtime") === "realtime").slice(0, 3);
  const viral = uniqueInsights.filter((insight) => insight.sourceType === "viral_library").slice(0, 3);
  return [
    realtime.length ? `文案直接引用的证据：\n${realtime.map(formatInsightLine).join("\n")}` : "",
    viral.length ? `爆款库补充规律：\n${viral.map(formatInsightLine).join("\n")}` : ""
  ].filter(Boolean);
}

function formatViralEvidenceTrace(trace: EvidenceCitationTrace[] | undefined): string[] {
  if (!trace?.length) return [];
  const lines = trace.slice(0, 3).map((item) => {
    const matched = item.matchedQueries.length ? `｜query: ${item.matchedQueries.slice(0, 2).join(" / ")}` : "";
    const reason = item.reasons.length ? `｜reason: ${item.reasons.slice(0, 2).join(" / ")}` : "";
    return `- ${item.caseId}｜score ${item.score}${matched}${reason}｜evidence: ${item.evidenceInsightIds.slice(0, 4).join("、")}`;
  });
  return [`爆款库检索追溯：\n${lines.join("\n")}`];
}

function extractViralEvidenceTrace(summary: unknown, evidenceIds: string[]): EvidenceCitationTrace[] {
  if (!isRecord(summary)) return [];
  const viralKnowledge = isRecord(summary.viralKnowledge) ? summary.viralKnowledge : undefined;
  const rawTrace = isRecord(viralKnowledge) && Array.isArray(viralKnowledge.evidenceTrace)
    ? viralKnowledge.evidenceTrace
    : [];
  const evidenceIdSet = new Set(evidenceIds);
  return rawTrace
    .map((item) => normalizeViralTrace(item))
    .filter((item): item is EvidenceCitationTrace => Boolean(item))
    .filter((item) => item.evidenceInsightIds.some((id) => evidenceIdSet.has(id)))
    .slice(0, 8);
}

function normalizeViralTrace(value: unknown): EvidenceCitationTrace | null {
  if (!isRecord(value)) return null;
  const caseId = typeof value.caseId === "string" ? value.caseId : "";
  const sourceUrl = typeof value.sourceUrl === "string" ? value.sourceUrl : "";
  const score = typeof value.score === "number" && Number.isFinite(value.score) ? value.score : 0;
  const evidenceInsightIds = stringArray(value.evidenceInsightIds);
  if (!caseId || !evidenceInsightIds.length) return null;
  return {
    caseId,
    sourceUrl,
    score,
    matchedQueries: stringArray(value.matchedQueries),
    reasons: stringArray(value.reasons),
    evidenceInsightIds
  };
}

function buildCitationSection(
  insights: EvidenceInsight[],
  field: EvidenceCitationField,
  evidenceIds: string[]
): EvidenceCitationSection {
  const insightById = new Map(insights.map((insight) => [insight.id, insight]));
  const citedInsights = evidenceIds
    .map((id) => insightById.get(id))
    .filter((insight): insight is EvidenceInsight => Boolean(insight));
  const foundIds = new Set(citedInsights.map((insight) => insight.id));
  return {
    field,
    evidenceIds,
    insights: citedInsights,
    missingEvidenceIds: evidenceIds.filter((id) => !foundIds.has(id)),
    sourceCounts: countSources(citedInsights)
  };
}

function buildCitationWarnings(
  sections: EvidenceCitationSection[],
  missingEvidenceIds: string[],
  sourceCounts: Record<EvidenceSourceType, number>
): string[] {
  const warnings: string[] = [];
  const emptyFields = sections.filter((section) => !section.insights.length).map((section) => labelForCitationField(section.field));
  if (emptyFields.length) warnings.push(`${emptyFields.join("、")}缺少可追溯证据`);
  if (missingEvidenceIds.length) warnings.push(`${missingEvidenceIds.length} 个证据 ID 不在当前 evidencePack 中`);
  if (sourceCounts.viral_library > 0 && sourceCounts.realtime === 0) warnings.push("仅引用爆款库规律，建议补充实时小红书证据");
  if (sourceCounts.realtime > 0 && sourceCounts.viral_library === 0) warnings.push("仅引用实时研究，建议补充爆款库长期规律");
  return warnings;
}

function countSources(insights: EvidenceInsight[]): Record<EvidenceSourceType, number> {
  return insights.reduce<Record<EvidenceSourceType, number>>(
    (counts, insight) => {
      const source = insight.sourceType ?? "realtime";
      counts[source] += 1;
      return counts;
    },
    { realtime: 0, viral_library: 0, user_input: 0 }
  );
}

function formatCitationSummary(
  sourceCounts: Record<EvidenceSourceType, number>,
  missingEvidenceIds: string[],
  warnings: string[]
): string {
  const parts = [
    sourceCounts.user_input ? `用户输入 ${sourceCounts.user_input} 条` : "",
    sourceCounts.realtime ? `实时研究 ${sourceCounts.realtime} 条` : "",
    sourceCounts.viral_library ? `爆款库 ${sourceCounts.viral_library} 条` : ""
  ].filter(Boolean);
  const base = parts.length ? `参考证据：${parts.join("、")}。` : "当前没有可追溯证据。";
  const missing = missingEvidenceIds.length ? `缺失证据 ${missingEvidenceIds.length} 个。` : "";
  const risk = warnings.length ? "发布前仍需 Quality Gate 复核。" : "";
  return [base, missing, risk].filter(Boolean).join("");
}

function formatReferenceSummary(
  sourceCounts: Record<EvidenceSourceType, number>,
  missingEvidenceIds: string[],
  insightCount: number
): string {
  if (!insightCount && !missingEvidenceIds.length) {
    return "当前还没有可追溯证据。";
  }
  const parts = [
    sourceCounts.user_input ? `用户输入 ${sourceCounts.user_input} 条` : "",
    sourceCounts.realtime ? `实时研究 ${sourceCounts.realtime} 条` : "",
    sourceCounts.viral_library ? `爆款库 ${sourceCounts.viral_library} 条` : ""
  ].filter(Boolean);
  const missing = missingEvidenceIds.length ? `，缺失 ${missingEvidenceIds.length} 个证据 ID` : "";
  return `引用 ${insightCount} 条证据：${parts.join("、") || "暂无可用来源"}${missing}`;
}

function formatInsightLine(insight: EvidenceInsight): string {
  return `- ${insight.id}｜${labelForEvidenceSource(insight.sourceType)}｜${insight.type}：${insight.insight}`;
}

function labelForCitationField(field: EvidenceCitationField): string {
  const labels: Record<EvidenceCitationField, string> = {
    title: "标题",
    content: "正文",
    tags: "标签",
    imagePrompt: "图片方向"
  };
  return labels[field];
}

function labelForEvidenceSource(sourceType?: EvidenceSourceType): string {
  const labels: Record<EvidenceSourceType, string> = {
    realtime: "实时研究",
    viral_library: "爆款库",
    user_input: "用户输入"
  };
  return labels[sourceType ?? "realtime"];
}

function uniqueIds(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueInsightsById(insights: EvidenceInsight[]): EvidenceInsight[] {
  const seen = new Set<string>();
  return insights.filter((insight) => {
    if (seen.has(insight.id)) return false;
    seen.add(insight.id);
    return true;
  });
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? uniqueIds(value.map((item) => String(item)).filter(Boolean))
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
