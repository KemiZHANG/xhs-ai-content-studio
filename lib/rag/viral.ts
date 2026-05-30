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
  missing: string[];
  recommendation: string;
};

export type ViralKnowledgePack = {
  query: string;
  rewrittenQueries: string[];
  filters?: ViralRetrievalFilters;
  filterSummary?: string;
  results: ViralSearchResult[];
  insights: EvidenceInsight[];
  sufficiency: RagSufficiency;
};

export async function retrieveViralKnowledge(input: ViralRetrievalInput): Promise<ViralKnowledgePack> {
  const rewrittenQueries = rewriteRetrievalQueries(input);
  const filters = extractViralRetrievalFilters(input);
  const results = await retrieveViralCasesWithFusion(input, rewrittenQueries);
  const insights = viralCasesToEvidenceInsights(results.map((result) => result.case));
  return {
    query: input.query,
    rewrittenQueries,
    ...(filters ? { filters, filterSummary: summarizeViralRetrievalFilters(filters) } : {}),
    results,
    insights,
    sufficiency: evaluateRagSufficiency({
      realtimeCount: input.realtimeEvidenceCount ?? 0,
      viralCount: results.length,
      hasVisual: insights.some((insight) => insight.type === "visual"),
      hasHook: insights.some((insight) => insight.type === "hook" || insight.type === "title"),
      hasStructure: insights.some((insight) => insight.type === "structure" || insight.type === "copy")
    })
  };
}

export function extractViralRetrievalFilters(input: ViralRetrievalInput): ViralRetrievalFilters | undefined {
  const filters: ViralRetrievalFilters = {
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
        const relaxedFilterReason = searchInput === input ? "" : "relaxed audience/pain-point filters";
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
  hasVisual,
  hasHook,
  hasStructure
}: {
  realtimeCount: number;
  viralCount: number;
  hasVisual: boolean;
  hasHook: boolean;
  hasStructure: boolean;
}): RagSufficiency {
  const missing: string[] = [];
  if (realtimeCount < 3) missing.push("实时小红书样本不足 3 条");
  if (viralCount < 2) missing.push("爆款库匹配样本不足 2 条");
  if (!hasHook) missing.push("缺少标题钩子规律");
  if (!hasStructure) missing.push("缺少正文结构规律");
  if (!hasVisual) missing.push("缺少图片风格规律");
  return {
    isEnough: missing.length <= 1,
    realtimeCount,
    viralCount,
    missing,
    recommendation: missing.length
      ? `建议继续搜索或补充参考样本：${missing.join("；")}`
      : "证据足够进入 CreativeBrief、文案和图片方向生成。"
  };
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
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
