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
  limit?: number;
  realtimeEvidenceCount?: number;
};

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
  results: ViralSearchResult[];
  insights: EvidenceInsight[];
  sufficiency: RagSufficiency;
};

export async function retrieveViralKnowledge(input: ViralRetrievalInput): Promise<ViralKnowledgePack> {
  const rewrittenQueries = rewriteRetrievalQueries(input);
  const results = await searchViralCasesFusion({
    query: rewrittenQueries.join(" "),
    topic: input.topic,
    category: input.category,
    audience: input.audience,
    painPoint: input.painPoint,
    tags: input.tags,
    limit: input.limit
  });
  const insights = viralCasesToEvidenceInsights(results.map((result) => result.case));
  return {
    query: input.query,
    rewrittenQueries,
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
