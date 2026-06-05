import { searchViralCasesFusion, viralCasesToEvidenceInsights } from "@/lib/viral-knowledge/store";
import type { ViralSearchResult } from "@/lib/viral-knowledge/types";
import type { EvidenceInsight } from "@/lib/post-project/types";

export type ViralRetrievalInput = {
  query: string;
  topic?: string;
  category?: string;
  audience?: string;
  painPoint?: string;
  tags?: string[];
  createdAfter?: string;
  createdBefore?: string;
  minLikes?: number;
  minCollects?: number;
  minComments?: number;
  minShares?: number;
  minScore?: number;
  sortBy?: "createdAt" | "likes" | "collects" | "comments" | "shares" | "score";
  sortOrder?: "asc" | "desc";
  limit?: number;
  realtimeEvidenceCount?: number;
};

export type ViralRetrievalFilters = Partial<Pick<
  ViralRetrievalInput,
  | "category"
  | "audience"
  | "painPoint"
  | "createdAfter"
  | "createdBefore"
  | "minLikes"
  | "minCollects"
  | "minComments"
  | "minShares"
  | "minScore"
  | "tags"
  | "sortBy"
  | "sortOrder"
>>;

export type RagSufficiency = {
  isEnough: boolean;
  realtimeCount: number;
  viralCount: number;
  weakViralCount?: number;
  missing: string[];
  recommendation: string;
};

export type ViralStrategyReport = {
  summary: string;
  titleMoves: string[];
  structureMoves: string[];
  visualMoves: string[];
  audiencePainPoints: string[];
  originalityRules: string[];
  recommendedAngles: string[];
  evidenceIds: string[];
};

export type ViralEvidenceTrace = {
  caseId: string;
  sourceSampleId: string;
  sourceUrl: string;
  score: number;
  matchedQueries: string[];
  reasons: string[];
  evidenceInsightIds: string[];
};

export type ViralKnowledgePack = {
  query: string;
  rewrittenQueries: string[];
  filters?: ViralRetrievalFilters;
  filterSummary?: string;
  results: ViralSearchResult[];
  insights: EvidenceInsight[];
  evidenceTrace?: ViralEvidenceTrace[];
  sufficiency: RagSufficiency;
  strategyReport: ViralStrategyReport;
};

export async function retrieveViralKnowledge(input: ViralRetrievalInput): Promise<ViralKnowledgePack> {
  const rewrittenQueries = rewriteRetrievalQueries(input);
  const filters = extractViralRetrievalFilters(input);
  const results = await retrieveViralCasesWithFusion(input, rewrittenQueries);
  const insights = viralCasesToEvidenceInsights(results.map((result) => result.case));
  const evidenceTrace = buildViralEvidenceTrace(results, insights);
  const usableResults = results.filter((result) => !isWeakReferenceCase(result.case));
  const usableInsights = insights.filter((insight) => !isWeakReferenceInsight(insight));
  const sufficiency = evaluateRagSufficiency({
    realtimeCount: input.realtimeEvidenceCount ?? 0,
    viralCount: usableResults.length,
    weakViralCount: results.length - usableResults.length,
    hasVisual: usableInsights.some((insight) => insight.type === "visual"),
    hasHook: usableInsights.some((insight) => insight.type === "hook" || insight.type === "title"),
    hasStructure: usableInsights.some((insight) => insight.type === "structure" || insight.type === "copy"),
    hasTag: usableInsights.some((insight) => insight.type === "tag"),
    hasAudienceOrPain: usableInsights.some((insight) => insight.type === "audience" || insight.type === "pain_point" || insight.type === "comment")
  });
  return {
    query: input.query,
    rewrittenQueries,
    ...(filters ? { filters, filterSummary: summarizeViralRetrievalFilters(filters) } : {}),
    results,
    insights,
    evidenceTrace,
    sufficiency,
    strategyReport: buildViralStrategyReport({ query: input.query, results: usableResults, insights: usableInsights, sufficiency })
  };
}

export function buildViralEvidenceTrace(
  results: ViralSearchResult[],
  insights: EvidenceInsight[]
): ViralEvidenceTrace[] {
  return results.map((result) => {
    const evidenceInsightIds = insights
      .filter((insight) => insight.sourceSampleIds.includes(result.case.id))
      .map((insight) => insight.id);

    return {
      caseId: result.case.id,
      sourceSampleId: result.case.sourceSampleId,
      sourceUrl: result.case.sourceUrl,
      score: result.score,
      matchedQueries: uniqueStrings(result.matchedQueries ?? []),
      reasons: uniqueStrings(result.reasons).slice(0, 8),
      evidenceInsightIds
    };
  });
}

export function buildViralStrategyReport({
  query,
  results,
  insights,
  sufficiency
}: {
  query: string;
  results: ViralSearchResult[];
  insights: EvidenceInsight[];
  sufficiency: RagSufficiency;
}): ViralStrategyReport {
  const cases = results.map((result) => result.case);
  const evidenceIds = uniqueStrings([
    ...cases.map((item) => item.id),
    ...insights.map((item) => item.id)
  ]).slice(0, 24);
  const titleMoves = uniqueStrings([
    ...cases.flatMap((item) => item.extractedInsights.titleHooks),
    ...insights.filter((item) => item.type === "hook" || item.type === "title").map((item) => item.insight)
  ]).slice(0, 5);
  const structureMoves = uniqueStrings([
    ...cases.flatMap((item) => item.contentStructure),
    ...cases.flatMap((item) => item.extractedInsights.copyStructures),
    ...insights.filter((item) => item.type === "structure" || item.type === "copy").map((item) => item.insight)
  ]).slice(0, 5);
  const visualMoves = uniqueStrings([
    ...cases.map((item) => item.imageStyle),
    ...cases.flatMap((item) => item.extractedInsights.visualPatterns),
    ...insights.filter((item) => item.type === "visual").map((item) => item.insight)
  ]).slice(0, 5);
  const audiencePainPoints = uniqueStrings([
    ...cases.map((item) => item.audience),
    ...cases.map((item) => item.painPoint),
    ...cases.flatMap((item) => item.extractedInsights.audienceSignals),
    ...cases.flatMap((item) => item.extractedInsights.painPoints),
    ...insights.filter((item) => item.type === "audience" || item.type === "pain_point" || item.type === "comment").map((item) => item.insight)
  ]).slice(0, 5);
  const originalityRules = uniqueStrings([
    ...cases.flatMap((item) => item.creativeSafety?.doNotCopy ?? item.extractedInsights.avoidCopying),
    ...cases.flatMap((item) => item.creativeSafety?.transformationGuidance ?? []),
    "只学习结构、钩子、节奏和视觉规律，不能复制原文、原图、具体数据或作者表达。"
  ]).slice(0, 6);
  const recommendedAngles = uniqueStrings([
    ...cases.map((item) => [item.hookType, item.painPoint, item.emotionalTrigger].filter(Boolean).join(" + ")),
    ...titleMoves.slice(0, 2).map((item) => `标题先用 ${item}，正文再落到自己的真实场景和证据。`),
    ...visualMoves.slice(0, 2).map((item) => `图片方向学习 ${item}，但使用自有素材或重新生成。`)
  ]).slice(0, 5);
  const summary = results.length
    ? `爆款库为“${query}”提炼出 ${results.length} 个历史样本的可复用策略：先用清晰钩子承接人群/痛点，再用可收藏结构组织正文，图片只学习风格和信息层级。${sufficiency.isEnough ? "" : ` ${sufficiency.recommendation}`}`.trim()
    : `爆款库暂未命中“${query}”的可用历史策略，建议继续实时搜索或手动保存参考样本。`;
  return {
    summary,
    titleMoves,
    structureMoves,
    visualMoves,
    audiencePainPoints,
    originalityRules,
    recommendedAngles,
    evidenceIds
  };
}

export function extractViralRetrievalFilters(input: ViralRetrievalInput): ViralRetrievalFilters | undefined {
  const filters: ViralRetrievalFilters = {
    category: input.category,
    audience: input.audience,
    painPoint: input.painPoint,
    createdAfter: input.createdAfter,
    createdBefore: input.createdBefore,
    minLikes: input.minLikes,
    minCollects: input.minCollects,
    minComments: input.minComments,
    minShares: input.minShares,
    minScore: input.minScore,
    tags: input.tags?.length ? input.tags : undefined,
    sortBy: input.sortBy,
    sortOrder: input.sortOrder
  };
  const cleaned = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined)) as ViralRetrievalFilters;
  return Object.keys(cleaned).length ? cleaned : undefined;
}

export function summarizeViralRetrievalFilters(filters?: ViralRetrievalFilters): string {
  if (!filters) return "";
  const items = [
    filters.category ? `类目 ${filters.category}` : "",
    filters.audience ? `人群 ${filters.audience}` : "",
    filters.painPoint ? `痛点 ${filters.painPoint}` : "",
    filters.createdAfter ? `入库时间 ≥ ${filters.createdAfter.slice(0, 10)}` : "",
    filters.createdBefore ? `入库时间 ≤ ${filters.createdBefore.slice(0, 10)}` : "",
    filters.minLikes !== undefined ? `点赞 ≥ ${filters.minLikes}` : "",
    filters.minCollects !== undefined ? `收藏 ≥ ${filters.minCollects}` : "",
    filters.minComments !== undefined ? `评论 ≥ ${filters.minComments}` : "",
    filters.minShares !== undefined ? `分享 ≥ ${filters.minShares}` : "",
    filters.minScore !== undefined ? `综合分 ≥ ${filters.minScore}` : "",
    filters.tags?.length ? `标签包含 ${filters.tags.join("、")}` : "",
    filters.sortBy ? `按${ragSortLabel(filters.sortBy)}${filters.sortOrder === "asc" ? "升序" : "降序"}排序` : ""
  ].filter(Boolean);
  return items.join("；");
}

async function retrieveViralCasesWithFusion(
  input: ViralRetrievalInput,
  rewrittenQueries: string[]
): Promise<ViralSearchResult[]> {
  const limit = Math.max(1, Math.min(Number(input.limit ?? 8), 30));
  const merged = new Map<string, ViralSearchResult>();
  const searchInputs = [
    input,
    ...(input.audience || input.painPoint || input.tags?.length
      ? [{
          ...input,
          audience: undefined,
          painPoint: undefined,
          tags: undefined
        }]
      : [])
  ];

  for (const searchInput of searchInputs) {
    for (const query of rewrittenQueries) {
      const partial = await searchViralCasesFusion({
        query,
        topic: searchInput.topic,
        category: searchInput.category,
        audience: searchInput.audience,
        painPoint: searchInput.painPoint,
        tags: searchInput.tags,
        createdAfter: searchInput.createdAfter,
        createdBefore: searchInput.createdBefore,
        minLikes: searchInput.minLikes,
        minCollects: searchInput.minCollects,
        minComments: searchInput.minComments,
        minShares: searchInput.minShares,
        minScore: searchInput.minScore,
        sortBy: searchInput.sortBy,
        sortOrder: searchInput.sortOrder,
        limit: Math.max(limit * 2, 8)
      });

      partial.forEach((result, rank) => {
        const existing = merged.get(result.case.id);
        const fusionBoost = 1 / (60 + rank + 1);
        const nextScore = Number((result.score + fusionBoost).toFixed(4));
        const relaxedFilterReason = searchInput === input ? "" : "已放宽人群/痛点筛选";
        if (!existing) {
          merged.set(result.case.id, {
            ...result,
            score: nextScore,
            matchedQueries: uniqueStrings([...(result.matchedQueries ?? []), query]),
            reasons: uniqueStrings([...result.reasons, `RAG-Fusion query: ${query}`, relaxedFilterReason]).slice(0, 10)
          });
          return;
        }
        existing.score = Number((Math.max(existing.score, result.score) + fusionBoost).toFixed(4));
        existing.reasons = uniqueStrings([...existing.reasons, ...result.reasons, `RAG-Fusion query: ${query}`, relaxedFilterReason]).slice(0, 10);
        existing.matchedQueries = uniqueStrings([...(existing.matchedQueries ?? []), ...(result.matchedQueries ?? []), query]).slice(0, 8);
      });
    }

    if (merged.size) {
      break;
    }
  }

  return diversifyRetrievedResults([...merged.values()]).slice(0, limit);
}

function diversifyRetrievedResults(results: ViralSearchResult[]): ViralSearchResult[] {
  const sorted = results.sort((a, b) => b.score - a.score);
  const selected: ViralSearchResult[] = [];
  const angleCounts = new Map<string, number>();

  for (const result of sorted) {
    const angle = `${result.case.category}|${result.case.hookType}|${result.case.imageStyle}`.slice(0, 100);
    const count = angleCounts.get(angle) ?? 0;
    if (count >= 2 && selected.length >= 4) {
      continue;
    }
    selected.push(result);
    angleCounts.set(angle, count + 1);
  }

  return selected.length ? selected : sorted;
}

export function rewriteRetrievalQueries(input: ViralRetrievalInput): string[] {
  const base = [input.query, input.topic, input.category, input.audience, input.painPoint, ...(input.tags ?? [])]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const topic = input.topic || input.query;
  return uniqueStrings([
    base,
    [topic, "高收藏", "标题钩子", input.audience].filter(Boolean).join(" "),
    [topic, "正文结构", "痛点", input.painPoint].filter(Boolean).join(" "),
    [topic, "标签组合", "评论关注点", input.category].filter(Boolean).join(" "),
    [topic, "封面", "图片风格", "小红书图文"].filter(Boolean).join(" "),
    `理想参考摘要：${base} 需要可复用的标题钩子、正文结构、标签策略、视觉风格、痛点和情绪触发点`
  ]).filter(Boolean).slice(0, 6);
}

export function evaluateRagSufficiency({
  realtimeCount,
  viralCount,
  weakViralCount = 0,
  hasVisual,
  hasHook,
  hasStructure,
  hasTag,
  hasAudienceOrPain
}: {
  realtimeCount: number;
  viralCount: number;
  weakViralCount?: number;
  hasVisual: boolean;
  hasHook: boolean;
  hasStructure: boolean;
  hasTag: boolean;
  hasAudienceOrPain: boolean;
}): RagSufficiency {
  const missing: string[] = [];
  if (realtimeCount < 3) missing.push("实时小红书样本不足 3 条");
  if (viralCount < 2) missing.push("爆款库匹配样本不足 2 条");
  if (weakViralCount && viralCount < 2) missing.push(`${weakViralCount} 条爆款库命中仅为弱参考，不能计入可用样本`);
  if (!hasHook) missing.push("缺少标题钩子规律");
  if (!hasStructure) missing.push("缺少正文结构规律");
  if (!hasVisual) missing.push("缺少图片风格规律");
  if (!hasTag) missing.push("缺少标签组合规律");
  if (!hasAudienceOrPain) missing.push("缺少人群/痛点规律");
  return {
    isEnough: missing.length === 0,
    realtimeCount,
    viralCount,
    weakViralCount,
    missing,
    recommendation: missing.length
      ? `建议继续搜索或补充参考样本：${missing.join("；")}`
      : "证据足够进入 CreativeBrief、文案和图片方向生成。"
  };
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function isWeakReferenceCase(item: ViralSearchResult["case"]): boolean {
  return item.quality?.warnings?.some((warning) => warning.includes("低质量样本被人工强制入库")) ?? false;
}

function isWeakReferenceInsight(insight: EvidenceInsight): boolean {
  return insight.insight.trim().startsWith("弱参考：");
}

function ragSortLabel(sortBy: NonNullable<ViralRetrievalFilters["sortBy"]>): string {
  const labels = {
    createdAt: "入库时间",
    likes: "点赞",
    collects: "收藏",
    comments: "评论",
    shares: "分享",
    score: "综合分"
  };
  return labels[sortBy];
}
