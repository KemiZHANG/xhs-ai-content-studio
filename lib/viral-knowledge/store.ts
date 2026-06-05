import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ModelProvider } from "@/lib/models/provider";
import type { SampleEvidence } from "@/lib/workflows/one-click";
import type {
  ViralCase,
  ViralCaseFilters,
  ViralCreativeSafety,
  ViralExtractionProvenance,
  ViralExtractedInsights,
  ViralKnowledgeQuality,
  ViralSearchInput,
  ViralSearchResult
} from "@/lib/viral-knowledge/types";

const VIRAL_SCHEMA_VERSION = 1 as const;
const globalForViralKnowledge = globalThis as typeof globalThis & {
  xhsViralKnowledgeWriteQueue?: Promise<unknown>;
};

type ViralKnowledgeFile = {
  schemaVersion: typeof VIRAL_SCHEMA_VERSION;
  cases: ViralCase[];
};

export type ViralSaveCandidateReview = {
  sampleId: string;
  shouldSave: boolean;
  score: number;
  reasons: string[];
  warnings: string[];
};

const viralKnowledgePath = () => path.join(process.cwd(), "data", "viral-knowledge.json");

export function reviewViralSaveCandidate(sample: SampleEvidence): ViralSaveCandidateReview {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;
  const engagementScore = Number(sample.score ?? 0);
  const likes = Number(sample.likes ?? 0);
  const collects = Number(sample.collects ?? 0);
  const comments = Number(sample.comments ?? 0);
  const shares = Number(sample.shares ?? 0);
  const detailLength = (sample.detailText ?? "").trim().length;
  const imageCount = (sample.cachedImageUrls?.length ?? 0) + (sample.imageUrls?.length ?? 0);
  const commentCount = sample.commentSnippets?.filter(Boolean).length ?? 0;

  if (engagementScore >= 1000 || likes + collects >= 1000) {
    score += 30;
    reasons.push("互动数据达到高价值样本门槛");
  } else if (engagementScore >= 300 || likes + collects >= 300) {
    score += 18;
    reasons.push("互动数据具备参考价值");
  } else if (likes + collects + comments + shares > 0) {
    score += 8;
    reasons.push("有基础互动数据");
  } else {
    warnings.push("缺少点赞、收藏、评论、分享等互动数据");
  }

  if (collects >= 300) {
    score += 15;
    reasons.push("收藏量较高，适合沉淀可复用选题规律");
  } else if (collects > 0 && collects < 50) {
    warnings.push("收藏量偏低，可能不是强参考样本");
  }

  if (comments >= 20) {
    score += 10;
    reasons.push("评论量足够，可辅助提取用户关注点");
  } else if (comments === 0) {
    warnings.push("缺少评论数据，用户关注点可信度较弱");
  }

  if (shares >= 5) {
    score += 5;
    reasons.push("分享数据可作为传播性参考");
  }

  if (detailLength >= 80) {
    score += 20;
    reasons.push("正文细节充足，可提取结构和表达规律");
  } else if (detailLength >= 30) {
    score += 10;
    reasons.push("正文有一定细节，可做轻量参考");
  } else {
    warnings.push("正文内容过短，难以提取可靠创作规律");
  }

  if (imageCount >= 3) {
    score += 12;
    reasons.push("图片样本较完整，可用于视觉风格分析");
  } else if (imageCount > 0) {
    score += 7;
    reasons.push("包含图片，可提供基础视觉参考");
  } else {
    warnings.push("缺少图片，无法沉淀视觉规律");
  }

  if (commentCount >= 2) {
    score += 6;
    reasons.push("评论片段可补充痛点和问题意识");
  }

  if (sample.url) {
    score += 4;
  } else {
    warnings.push("缺少来源链接，后续追溯能力较弱");
  }

  if (!sample.title?.trim()) {
    warnings.push("缺少标题，无法提取标题钩子");
  }

  const normalizedScore = Math.min(100, Math.max(0, Math.round(score)));
  return {
    sampleId: sample.id,
    shouldSave: normalizedScore >= 45,
    score: normalizedScore,
    reasons: uniqueStrings(reasons).slice(0, 6),
    warnings: uniqueStrings(warnings).slice(0, 6)
  };
}

export async function listViralCases(filters: ViralCaseFilters = {}): Promise<ViralCase[]> {
  const file = await readViralKnowledgeFile();
  return sortViralCases(file.cases.filter((item) => matchesFilters(item, filters)), filters);
}

export async function searchViralCases(input: ViralSearchInput): Promise<ViralSearchResult[]> {
  const limit = Math.max(1, Math.min(Number(input.limit ?? 8), 30));
  const queryTokens = tokenize([
    input.query,
    input.topic,
    input.category,
    input.audience,
    input.painPoint,
    ...(input.tags ?? [])
  ].filter(Boolean).join(" "));
  const cases = await listViralCases(input);
  return cases
    .map((item) => scoreViralCase(item, queryTokens, input))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function searchViralCasesFusion(input: ViralSearchInput): Promise<ViralSearchResult[]> {
  const limit = Math.max(1, Math.min(Number(input.limit ?? 8), 30));
  const queries = rewriteViralQueries(input);
  const merged = new Map<string, ViralSearchResult>();

  for (const query of queries) {
    const partial = await searchViralCases({
      ...input,
      query,
      limit: Math.max(limit * 2, 8)
    });
    for (const result of partial) {
      const existing = merged.get(result.case.id);
      if (!existing) {
        merged.set(result.case.id, {
          ...result,
          matchedQueries: [query],
          reasons: uniqueStrings([...result.reasons, `检索 query：${query}`])
        });
        continue;
      }
      existing.score = Number(Math.max(existing.score, result.score).toFixed(4));
      if (!existing.scoreBreakdown || result.score >= existing.score) {
        existing.scoreBreakdown = result.scoreBreakdown;
      }
      existing.reasons = uniqueStrings([...existing.reasons, ...result.reasons, `检索 query：${query}`]).slice(0, 8);
      existing.matchedQueries = uniqueStrings([...(existing.matchedQueries ?? []), query]).slice(0, 5);
    }
  }

  return diversifyViralResults([...merged.values()]).slice(0, limit);
}

export async function upsertViralCases(cases: ViralCase[]): Promise<ViralCase[]> {
  return queueViralKnowledgeWrite(async () => {
    const file = await readViralKnowledgeFile();
    const normalizedCases = dedupeViralCasesBySource(cases.map(normalizeViralCase));
    const ids = new Set(normalizedCases.map((item) => item.id));
    const sourceKeys = new Set(normalizedCases.map(viralSourceKey));
    const next = [
      ...normalizedCases,
      ...file.cases.filter((item) => !ids.has(item.id) && !sourceKeys.has(viralSourceKey(item)))
    ].slice(0, 2000);
    await writeViralKnowledgeFile({ schemaVersion: VIRAL_SCHEMA_VERSION, cases: next });
    return normalizedCases;
  });
}

export async function createViralCaseFromEvidence({
  sample,
  topic,
  category,
  model
}: {
  sample: SampleEvidence;
  topic: string;
  category: string;
  model?: ModelProvider;
}): Promise<ViralCase> {
  const extracted = await extractViralInsights({ sample, topic, category, model });
  const extractedInsights = decontaminateViralInsights(extracted.insights, sample);
  const hookType = first(extractedInsights.titleHooks) || inferHookType(sample.title);
  const bodyExcerpt = summarizeBody(sample.detailText);
  const contentStructure = extractedInsights.copyStructures.length
    ? extractedInsights.copyStructures
    : inferStructure(sample.detailText);
  const imageStyle = first(extractedInsights.visualPatterns) || inferImageStyle(sample);
  const creativeSafety = buildCreativeSafety({
    title: sample.title,
    extractedInsights,
    contentStructure,
    imageStyle
  });
  return normalizeViralCase({
    id: `viral-${Date.now()}-${randomUUID().slice(0, 8)}`,
    platform: "xiaohongshu",
    sourceSampleId: sample.id,
    topic,
    category,
    title: sample.title,
    bodyExcerpt,
    tags: inferTags(sample, topic, category),
    imageStyle,
    hookType,
    contentStructure,
    painPoint: first(extractedInsights.painPoints) || "用户需要更真实、具体、可执行的判断依据",
    audience: first(extractedInsights.audienceSignals) || "对该主题感兴趣的小红书用户",
    emotionalTrigger: first(extractedInsights.emotionalTriggers) || "真实体验、避坑感、可收藏",
    metrics: {
      likes: sample.likes,
      collects: sample.collects,
      comments: sample.comments,
      shares: sample.shares,
      score: sample.score
    },
    sourceUrl: sample.url,
    createdAt: new Date().toISOString(),
    embedding: createLocalEmbedding(buildViralEmbeddingText({
      title: sample.title,
      bodyExcerpt,
      tags: inferTags(sample, topic, category),
      imageStyle,
      hookType,
      contentStructure,
      painPoint: first(extractedInsights.painPoints) || "用户需要更真实、具体、可执行的判断依据",
      audience: first(extractedInsights.audienceSignals) || "对该主题感兴趣的小红书用户",
      emotionalTrigger: first(extractedInsights.emotionalTriggers) || "真实体验、避坑感、可收藏",
      extractedInsights,
      creativeSafety
    })),
    extractedInsights,
    creativeSafety,
    quality: evaluateViralKnowledgeQuality({
      extractedInsights,
      creativeSafety,
      extractionMethod: extracted.method
    }),
    extraction: {
      sourceSampleId: sample.id,
      method: extracted.method,
      extractedAt: new Date().toISOString(),
      fallbackReason: extracted.fallbackReason
    }
  });
}

export function viralCasesToEvidenceInsights(cases: ViralCase[]) {
  const now = new Date().toISOString();
  return cases.flatMap((item) => {
    const sourceSampleIds = [item.id];
    const confidence = (base: number) => Number(Math.min(0.94, base + (item.quality?.score ?? 0.5) * 0.08).toFixed(2));
    return compact([
      evidenceInsight("hook", first(item.extractedInsights.titleHooks) || item.hookType, sourceSampleIds, now, confidence(0.76)),
      evidenceInsight("structure", item.contentStructure.slice(0, 3).join(" / "), sourceSampleIds, now, confidence(0.74)),
      evidenceInsight("tag", item.extractedInsights.tagPatterns.slice(0, 3).join("；") || item.tags.join("、"), sourceSampleIds, now, confidence(0.68)),
      evidenceInsight("visual", item.imageStyle, sourceSampleIds, now, confidence(0.72)),
      evidenceInsight("audience", item.audience, sourceSampleIds, now, confidence(0.68)),
      evidenceInsight("pain_point", item.painPoint, sourceSampleIds, now, confidence(0.7)),
      evidenceInsight("comment", summarizeCommentConcerns(item.extractedInsights.commentConcerns), sourceSampleIds, now, confidence(0.7)),
      evidenceInsight("copy", item.creativeSafety?.summary ?? "", sourceSampleIds, now, confidence(0.78))
    ]);
  });
}

function summarizeCommentConcerns(commentConcerns: string[]): string {
  const concerns = uniqueStrings(commentConcerns)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 5);
  return concerns.length
    ? `评论关注点应转化为新内容的决策信息或互动问题：${concerns.join(" / ")}`
    : "";
}

async function extractViralInsightsWithModel({
  sample,
  topic,
  category,
  model
}: {
  sample: SampleEvidence;
  topic: string;
  category: string;
  model: ModelProvider;
}): Promise<ViralExtractedInsights> {
  const prompt = `你是小红书爆款库分析器。请只提取可复用创作规律，不要保存或仿写原文。

主题：${topic}
分类：${category}
样本标题：${sample.title}
互动数据：点赞 ${sample.likes}，收藏 ${sample.collects}，评论 ${sample.comments}
正文摘要：
${sample.detailText.slice(0, 1200) || "未获取到正文"}
评论片段：
${sample.commentSnippets.slice(0, 6).join("\n") || "无"}

请只返回 JSON：
{
  "titleHooks": ["标题钩子规律"],
  "copyStructures": ["正文结构规律"],
  "tagPatterns": ["标签组合规律"],
  "visualPatterns": ["图片风格规律"],
  "audienceSignals": ["目标人群信号"],
  "painPoints": ["痛点"],
  "emotionalTriggers": ["情绪触发点"],
  "commentConcerns": ["评论关注点"],
  "reusableRules": ["可复用创作规则"],
  "avoidCopying": ["禁止复制/仿写的点"]
}`;
  const raw = await model.generateStructuredText(
    prompt,
    "Extract structured Xiaohongshu creative patterns. Do not copy source text."
  );
  const parsed = parseJsonObject(raw);
  return normalizeExtractedInsights(parsed);
}

async function extractViralInsights({
  sample,
  topic,
  category,
  model
}: {
  sample: SampleEvidence;
  topic: string;
  category: string;
  model?: ModelProvider;
}): Promise<{ insights: ViralExtractedInsights; method: ViralExtractionProvenance["method"]; fallbackReason?: string }> {
  if (!model) {
    return {
      insights: extractViralInsightsHeuristically(sample),
      method: "heuristic"
    };
  }

  try {
    return {
      insights: await extractViralInsightsWithModel({ sample, topic, category, model }),
      method: "model"
    };
  } catch (error) {
    return {
      insights: extractViralInsightsHeuristically(sample),
      method: "heuristic",
      fallbackReason: error instanceof Error ? error.message : "model extraction failed"
    };
  }
}

function normalizeViralCase(item: ViralCase): ViralCase {
  const extractedInsights = normalizeExtractedInsights(item.extractedInsights);
  const contentStructure = uniqueStrings(item.contentStructure).slice(0, 8);
  const imageStyle = item.imageStyle || first(extractedInsights.visualPatterns) || "";
  const extraction = normalizeExtractionProvenance(item.extraction, item);
  const creativeSafety = normalizeCreativeSafety(item.creativeSafety, {
    title: item.title,
    extractedInsights,
    contentStructure,
    imageStyle
  });
  return {
    ...item,
    platform: "xiaohongshu",
    sourceSampleId: typeof item.sourceSampleId === "string" && item.sourceSampleId.trim() ? item.sourceSampleId : inferSourceSampleId(item),
    tags: uniqueStrings(item.tags).slice(0, 12),
    imageStyle,
    contentStructure,
    embedding: createLocalEmbedding(buildViralEmbeddingText({
      ...item,
      imageStyle,
      contentStructure,
      extractedInsights,
      creativeSafety
    })),
    extractedInsights,
    creativeSafety,
    quality: normalizeViralKnowledgeQuality(item.quality, {
      extractedInsights,
      creativeSafety,
      extractionMethod: extraction.method
    }),
    extraction
  };
}

export function evaluateViralKnowledgeQuality({
  extractedInsights,
  creativeSafety,
  extractionMethod
}: {
  extractedInsights: ViralExtractedInsights;
  creativeSafety?: ViralCreativeSafety;
  extractionMethod: ViralExtractionProvenance["method"];
}): ViralKnowledgeQuality {
  const structuredFields = [
    extractedInsights.titleHooks,
    extractedInsights.copyStructures,
    extractedInsights.tagPatterns,
    extractedInsights.visualPatterns,
    extractedInsights.audienceSignals,
    extractedInsights.painPoints,
    extractedInsights.emotionalTriggers,
    extractedInsights.commentConcerns
  ];
  const structuredFieldCount = structuredFields.filter((items) => items.length > 0).length;
  const reusableRuleCount = extractedInsights.reusableRules.length + (creativeSafety?.reusablePatterns.length ?? 0);
  const safetyRuleCount = extractedInsights.avoidCopying.length
    + (creativeSafety?.doNotCopy.length ?? 0)
    + (creativeSafety?.transformationGuidance.length ?? 0);
  const warnings = [
    structuredFieldCount < 5 ? "结构化规律不足：建议补充标题、正文、标签、图片、人群或痛点维度。" : "",
    reusableRuleCount < 3 ? "可复用规则不足：不要只保存原文摘要，应提炼可迁移的创作方法。" : "",
    safetyRuleCount < 3 ? "防复制约束不足：需要明确哪些标题、正文、图片或数据不能复用。" : "",
    extractionMethod === "heuristic" ? "当前为启发式提取；配置文本模型后可获得更稳的 AI 结构化规律。" : ""
  ].filter(Boolean);
  const score = Math.min(
    1,
    structuredFieldCount / 8 * 0.5
      + Math.min(reusableRuleCount, 6) / 6 * 0.25
      + Math.min(safetyRuleCount, 6) / 6 * 0.2
      + (extractionMethod === "model" ? 0.05 : 0)
  );
  return {
    score: Number(score.toFixed(2)),
    structuredFieldCount,
    reusableRuleCount,
    safetyRuleCount,
    warnings
  };
}

function normalizeViralKnowledgeQuality(
  value: ViralKnowledgeQuality | undefined,
  fallback: {
    extractedInsights: ViralExtractedInsights;
    creativeSafety?: ViralCreativeSafety;
    extractionMethod: ViralExtractionProvenance["method"];
  }
): ViralKnowledgeQuality {
  const generated = evaluateViralKnowledgeQuality(fallback);
  if (!value) return generated;
  return {
    score: Number.isFinite(value.score) ? Math.max(0, Math.min(value.score, 1)) : generated.score,
    structuredFieldCount: Number.isFinite(value.structuredFieldCount) ? Math.max(0, value.structuredFieldCount) : generated.structuredFieldCount,
    reusableRuleCount: Number.isFinite(value.reusableRuleCount) ? Math.max(0, value.reusableRuleCount) : generated.reusableRuleCount,
    safetyRuleCount: Number.isFinite(value.safetyRuleCount) ? Math.max(0, value.safetyRuleCount) : generated.safetyRuleCount,
    warnings: value.warnings?.length ? uniqueStrings(value.warnings).slice(0, 8) : generated.warnings
  };
}

function normalizeExtractionProvenance(value: ViralExtractionProvenance | undefined, item: ViralCase): ViralExtractionProvenance {
  const record: Record<string, unknown> = isRecord(value) ? value : {};
  const method = record.method === "model" || record.method === "heuristic" ? record.method : "heuristic";
  const sourceSampleId = typeof record.sourceSampleId === "string" && record.sourceSampleId.trim()
    ? record.sourceSampleId.trim()
    : inferSourceSampleId(item);
  return {
    sourceSampleId,
    method,
    extractedAt: typeof record.extractedAt === "string" && record.extractedAt.trim() ? record.extractedAt.trim() : item.createdAt,
    fallbackReason: typeof record.fallbackReason === "string" && record.fallbackReason.trim() ? record.fallbackReason.trim() : undefined
  };
}

function dedupeViralCasesBySource(cases: ViralCase[]): ViralCase[] {
  const seen = new Set<string>();
  const deduped: ViralCase[] = [];
  for (const item of cases) {
    const key = viralSourceKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function viralSourceKey(item: Pick<ViralCase, "id" | "sourceSampleId" | "sourceUrl">): string {
  const sampleId = item.sourceSampleId?.trim();
  if (sampleId) return `sample:${sampleId}`;
  const url = item.sourceUrl?.trim();
  if (url) return `url:${url}`;
  return `id:${item.id}`;
}

function inferSourceSampleId(item: Pick<ViralCase, "sourceSampleId" | "sourceUrl" | "id">): string {
  if (typeof item.sourceSampleId === "string" && item.sourceSampleId.trim()) return item.sourceSampleId.trim();
  const match = item.sourceUrl?.match(/\/explore\/([^/?#]+)/);
  return match?.[1] || item.id;
}

function normalizeCreativeSafety(
  value: ViralCreativeSafety | undefined,
  fallback: {
    title: string;
    extractedInsights: ViralExtractedInsights;
    contentStructure: string[];
    imageStyle: string;
  }
): ViralCreativeSafety {
  const record: Record<string, unknown> = isRecord(value) ? value : {};
  const normalized: ViralCreativeSafety = {
    summary: typeof record.summary === "string" ? record.summary.trim() : "",
    reusablePatterns: stringArray(record.reusablePatterns),
    doNotCopy: stringArray(record.doNotCopy),
    transformationGuidance: stringArray(record.transformationGuidance)
  };
  const generated = buildCreativeSafety(fallback);
  return {
    summary: normalized.summary || generated.summary,
    reusablePatterns: normalized.reusablePatterns.length ? normalized.reusablePatterns : generated.reusablePatterns,
    doNotCopy: normalized.doNotCopy.length ? normalized.doNotCopy : generated.doNotCopy,
    transformationGuidance: normalized.transformationGuidance.length
      ? normalized.transformationGuidance
      : generated.transformationGuidance
  };
}

function buildCreativeSafety({
  title,
  extractedInsights,
  contentStructure,
  imageStyle
}: {
  title: string;
  extractedInsights: ViralExtractedInsights;
  contentStructure: string[];
  imageStyle: string;
}): ViralCreativeSafety {
  const reusablePatterns = uniqueStrings([
    ...extractedInsights.reusableRules,
    ...contentStructure.map((item) => `学习结构：${item}`),
    imageStyle ? `学习视觉规律：${imageStyle}` : ""
  ]).slice(0, 10);
  const doNotCopy = uniqueStrings([
    ...extractedInsights.avoidCopying,
    "不要复制标题原句、正文段落、评论表达或图片构图到近似可识别的程度。",
    "不要盗用原图、原作者视角、品牌认证、销量数据或无法验证的效果承诺。"
  ]).slice(0, 10);
  const transformationGuidance = uniqueStrings([
    first(extractedInsights.titleHooks) ? `把标题钩子转成自己的产品/场景/人群表达：${first(extractedInsights.titleHooks)}` : "",
    contentStructure.length ? `保留信息组织方式，但替换为自己的体验、证据和表达：${contentStructure.slice(0, 3).join(" / ")}` : "",
    imageStyle ? `图片只学习光线、信息层级和情绪氛围，必须重新生成或使用自有素材：${imageStyle}` : "",
    "生成内容时必须引用 evidencePack 里的规律编号，而不是复述样本原句。"
  ]).slice(0, 8);
  const summary = uniqueStrings([
    `样本「${title}」只能作为创作规律来源：学习钩子、结构、标签和视觉节奏。`,
    "输出必须换成新的主题事实、用户需求、产品信息和原创表达，避免标题/正文/图片的近似复刻。"
  ]).join(" ");
  return {
    summary,
    reusablePatterns,
    doNotCopy,
    transformationGuidance
  };
}

function buildViralEmbeddingText(item: Pick<
  ViralCase,
  "title" | "bodyExcerpt" | "tags" | "imageStyle" | "hookType" | "contentStructure" | "painPoint" | "audience" | "emotionalTrigger" | "extractedInsights"
> & { creativeSafety?: ViralCreativeSafety }): string {
  return [
    item.title,
    item.bodyExcerpt,
    item.tags.join(" "),
    item.imageStyle,
    item.hookType,
    item.contentStructure.join(" "),
    item.painPoint,
    item.audience,
    item.emotionalTrigger,
    item.extractedInsights.titleHooks.join(" "),
    item.extractedInsights.copyStructures.join(" "),
    item.extractedInsights.tagPatterns.join(" "),
    item.extractedInsights.visualPatterns.join(" "),
    item.extractedInsights.audienceSignals.join(" "),
    item.extractedInsights.painPoints.join(" "),
    item.extractedInsights.emotionalTriggers.join(" "),
    item.extractedInsights.commentConcerns.join(" "),
    item.extractedInsights.reusableRules.join(" "),
    item.extractedInsights.avoidCopying.join(" "),
    item.creativeSafety?.summary,
    item.creativeSafety?.reusablePatterns.join(" "),
    item.creativeSafety?.transformationGuidance.join(" ")
  ].filter(Boolean).join("\n");
}

function normalizeExtractedInsights(value: unknown): ViralExtractedInsights {
  const record = isRecord(value) ? value : {};
  return {
    titleHooks: stringArray(record.titleHooks),
    copyStructures: stringArray(record.copyStructures),
    tagPatterns: stringArray(record.tagPatterns),
    visualPatterns: stringArray(record.visualPatterns),
    audienceSignals: stringArray(record.audienceSignals),
    painPoints: stringArray(record.painPoints),
    emotionalTriggers: stringArray(record.emotionalTriggers),
    commentConcerns: stringArray(record.commentConcerns),
    reusableRules: stringArray(record.reusableRules),
    avoidCopying: stringArray(record.avoidCopying)
  };
}

function decontaminateViralInsights(insights: ViralExtractedInsights, sample: SampleEvidence): ViralExtractedInsights {
  const sourceTexts = buildSourceTextsForLeakCheck(sample);
  const clean = (values: string[]) => values.filter((value) => !looksLikeCopiedSource(value, sourceTexts));
  const removed = [
    ...insights.titleHooks,
    ...insights.copyStructures,
    ...insights.tagPatterns,
    ...insights.visualPatterns,
    ...insights.audienceSignals,
    ...insights.painPoints,
    ...insights.emotionalTriggers,
    ...insights.reusableRules
  ].filter((value) => looksLikeCopiedSource(value, sourceTexts));
  const removedWarnings = removed.length
    ? [
        "模型返回内容中存在接近原帖的表达，已从可学习规律中移除。",
        "不要复制或近似改写原样本标题、正文句子、评论表达或画面构图。"
      ]
    : [];
  return normalizeExtractedInsights({
    titleHooks: clean(insights.titleHooks),
    copyStructures: clean(insights.copyStructures),
    tagPatterns: clean(insights.tagPatterns),
    visualPatterns: clean(insights.visualPatterns),
    audienceSignals: clean(insights.audienceSignals),
    painPoints: clean(insights.painPoints),
    emotionalTriggers: clean(insights.emotionalTriggers),
    commentConcerns: transformCommentConcerns(insights.commentConcerns, sourceTexts),
    reusableRules: uniqueStrings([
      ...clean(insights.reusableRules),
      removed.length ? "只保留创作方法、信息层级和用户洞察，不保留原帖具体表达。" : ""
    ]),
    avoidCopying: uniqueStrings([
      ...insights.avoidCopying,
      ...removedWarnings,
      "禁止把爆款库样本的标题、正文句子、评论表达或图片构图当作可复用素材。"
    ])
  });
}

function transformCommentConcerns(values: string[], normalizedSourceTexts: string[]): string[] {
  return uniqueStrings(values.map((value) => {
    if (!looksLikeCopiedSource(value, normalizedSourceTexts)) return value;
    return generalizeCommentConcern(value);
  })).filter(Boolean);
}

function generalizeCommentConcern(value: string): string {
  if (/价格|预算|人均|费用|average|spend|price|cost/i.test(value)) return "评论关注价格、人均、预算或费用透明度";
  if (/排队|拥挤|人多|周末|crowd|queue|weekend/i.test(value)) return "评论关注排队、客流高峰和周末体验";
  if (/地址|位置|交通|停车|地铁|location|parking|metro/i.test(value)) return "评论关注位置、交通和到达成本";
  if (/预约|营业|时间|open|hour|book/i.test(value)) return "评论关注营业时间、预约方式和可执行安排";
  return "评论关注可帮助用户决策的具体信息，需要转化为互动问题或补充说明";
}

function buildSourceTextsForLeakCheck(sample: SampleEvidence): string[] {
  return uniqueStrings([
    sample.title,
    sample.detailText,
    ...sample.commentSnippets,
    ...sample.reasonHighlights
  ].map((value) => normalizeLeakText(value)).filter((value) => value.length >= 12));
}

function looksLikeCopiedSource(value: string, normalizedSourceTexts: string[]): boolean {
  const normalized = normalizeLeakText(value);
  if (normalized.length < 12) return false;
  return normalizedSourceTexts.some((source) => {
    if (!source) return false;
    if (source === normalized) return true;
    if (normalized.length >= 18 && source.includes(normalized)) return true;
    if (source.length >= 18 && normalized.includes(source)) return true;
    return longestSharedSubstringLength(normalized, source) >= Math.min(36, Math.max(18, Math.floor(normalized.length * 0.72)));
  });
}

function normalizeLeakText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\u4e00-\u9fa5]+/gu, "")
    .trim();
}

function longestSharedSubstringLength(left: string, right: string): number {
  if (!left || !right) return 0;
  const previous = Array.from({ length: right.length + 1 }, () => 0);
  let best = 0;
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = 0;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const saved = previous[rightIndex];
      previous[rightIndex] = left[leftIndex - 1] === right[rightIndex - 1] ? diagonal + 1 : 0;
      if (previous[rightIndex] > best) best = previous[rightIndex];
      diagonal = saved;
    }
  }
  return best;
}

function extractViralInsightsHeuristically(sample: SampleEvidence): ViralExtractedInsights {
  const structure = inferStructure(sample.detailText);
  return {
    titleHooks: [inferHookType(sample.title)],
    copyStructures: structure,
    tagPatterns: inferTags(sample, "", "").map((tag) => `围绕 ${tag} 建立主题/场景标签`),
    visualPatterns: [inferImageStyle(sample)],
    audienceSignals: ["对主题有明确兴趣、会被真实细节和可收藏结构吸引的人群"],
    painPoints: ["缺少真实经验、避坑细节和可直接参考的决策依据"],
    emotionalTriggers: ["真实体验、强场景代入、收藏价值"],
    commentConcerns: sample.commentSnippets.slice(0, 5),
    reusableRules: [
      `${sample.title} 的可学习点应提炼为标题钩子、结构和场景，不复制原句。`,
      `优先学习高收藏样本的结构密度和信息组织方式。`
    ],
    avoidCopying: ["不要复制标题原句", "不要复刻正文表达", "不要盗用原图或模仿到近似画面"]
  };
}

function scoreViralCase(item: ViralCase, queryTokens: string[], input: ViralSearchInput): ViralSearchResult {
  const text = [
    item.topic,
    item.category,
    item.title,
    item.bodyExcerpt,
    item.tags.join(" "),
    item.imageStyle,
    item.hookType,
    item.contentStructure.join(" "),
    item.painPoint,
    item.audience,
    item.emotionalTrigger,
    item.extractedInsights.titleHooks.join(" "),
    item.extractedInsights.copyStructures.join(" "),
    item.extractedInsights.tagPatterns.join(" "),
    item.extractedInsights.visualPatterns.join(" "),
    item.extractedInsights.audienceSignals.join(" "),
    item.extractedInsights.painPoints.join(" "),
    item.extractedInsights.emotionalTriggers.join(" "),
    item.extractedInsights.commentConcerns.join(" "),
    item.extractedInsights.avoidCopying.join(" "),
    item.extractedInsights.reusableRules.join(" "),
    item.creativeSafety?.summary,
    item.creativeSafety?.reusablePatterns.join(" "),
    item.creativeSafety?.transformationGuidance.join(" ")
  ].join(" ");
  const textTokens = tokenize(text);
  const tokenHits = queryTokens.filter((token) => textTokens.includes(token));
  const semanticScore = cosineSimilarity(createLocalEmbedding(queryTokens.join(" ")), item.embedding);
  const metricScore = Math.min(0.25, Math.log10(1 + item.metrics.likes + item.metrics.collects * 1.4 + item.metrics.comments * 0.6) / 20);
  const qualityScore = Math.min(0.08, (item.quality?.score ?? 0.5) * 0.08);
  const filterBonus = [
    input.topic && includesLoose(item.topic, input.topic),
    input.category && includesLoose(item.category, input.category),
    input.audience && includesLoose(item.audience, input.audience),
    input.painPoint && includesLoose(item.painPoint, input.painPoint)
  ].filter(Boolean).length * 0.08;
  const keywordScore = tokenHits.length * 0.08;
  const weightedSemanticScore = semanticScore * 0.55;
  const score = keywordScore + weightedSemanticScore + metricScore + qualityScore + filterBonus;
  return {
    case: item,
    score: Number(score.toFixed(4)),
    scoreBreakdown: {
      keyword: Number(keywordScore.toFixed(4)),
      semantic: Number(weightedSemanticScore.toFixed(4)),
      metrics: Number(metricScore.toFixed(4)),
      quality: Number(qualityScore.toFixed(4)),
      filters: Number(filterBonus.toFixed(4))
    },
    diversityKey: viralDiversityKey(item),
    angleSummary: summarizeViralAngle(item),
    reasons: [
      tokenHits.length ? `命中关键词：${tokenHits.slice(0, 5).join("、")}` : "",
      semanticScore > 0.1 ? "语义相似" : "",
      metricScore > 0.05 ? "互动数据较强" : "",
      qualityScore > 0.05 ? "结构化规律质量较高" : ""
    ].filter(Boolean)
  };
}

function rewriteViralQueries(input: ViralSearchInput): string[] {
  const base = [input.query, input.topic, input.category, input.audience, input.painPoint, ...(input.tags ?? [])]
    .filter(Boolean)
    .join(" ")
    .trim();
  return uniqueStrings([
    base,
    [input.topic, "标题钩子", "高收藏", input.audience].filter(Boolean).join(" "),
    [input.topic, "正文结构", "痛点", input.painPoint].filter(Boolean).join(" "),
    [input.topic, "图片风格", "封面", input.category].filter(Boolean).join(" "),
    [input.topic, "标签组合", "评论关注点"].filter(Boolean).join(" "),
    `理想参考摘要：${base} 小红书高互动笔记通常具备清晰标题钩子、真实场景、可收藏结构、图片主体明确和评论问题回应`
  ]).filter(Boolean).slice(0, 6);
}

function diversifyViralResults(results: ViralSearchResult[]): ViralSearchResult[] {
  const sorted = results.sort((a, b) => b.score - a.score);
  const groups = new Map<string, ViralSearchResult[]>();
  for (const result of sorted) {
    const angle = viralDiversityKey(result.case);
    groups.set(angle, [...(groups.get(angle) ?? []), result]);
  }

  const buckets = [...groups.values()].sort((left, right) => right[0].score - left[0].score);
  const selected: ViralSearchResult[] = [];
  let cursor = 0;
  while (selected.length < sorted.length && buckets.some((bucket) => bucket.length)) {
    const bucket = buckets[cursor % buckets.length];
    const next = bucket.shift();
    if (next) {
      selected.push(next);
    }
    cursor += 1;
  }

  return selected;
}

function viralDiversityKey(item: ViralCase): string {
  return [
    normalizeDiversityField(item.hookType),
    normalizeDiversityField(item.category),
    normalizeDiversityField(item.imageStyle)
  ].join("|");
}

function summarizeViralAngle(item: ViralCase): string {
  return [
    item.hookType,
    item.category,
    item.imageStyle
  ].map((value) => value.trim()).filter(Boolean).join(" · ");
}

function normalizeDiversityField(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 40);
}

function matchesFilters(item: ViralCase, filters: ViralCaseFilters): boolean {
  if (filters.topic && !includesLoose(item.topic, filters.topic) && !includesLoose(item.title, filters.topic)) return false;
  if (filters.category && !includesLoose(item.category, filters.category)) return false;
  if (filters.audience && !includesLoose(item.audience, filters.audience)) return false;
  if (filters.painPoint && !includesLoose(item.painPoint, filters.painPoint)) return false;
  if (filters.tags?.length && !filters.tags.some((tag) => viralTagFilterTargets(item).some((itemTag) => includesLoose(itemTag, tag)))) return false;
  if (filters.createdAfter && Date.parse(item.createdAt) < Date.parse(filters.createdAfter)) return false;
  if (filters.createdBefore && Date.parse(item.createdAt) > Date.parse(filters.createdBefore)) return false;
  if (filters.minLikes !== undefined && item.metrics.likes < filters.minLikes) return false;
  if (filters.minCollects !== undefined && item.metrics.collects < filters.minCollects) return false;
  if (filters.minComments !== undefined && item.metrics.comments < filters.minComments) return false;
  if (filters.minShares !== undefined && item.metrics.shares < filters.minShares) return false;
  if (filters.minScore !== undefined && item.metrics.score < filters.minScore) return false;
  return true;
}

function viralTagFilterTargets(item: ViralCase): string[] {
  return uniqueStrings([
    ...item.tags,
    ...item.extractedInsights.tagPatterns
  ]);
}

function sortViralCases(cases: ViralCase[], filters: ViralCaseFilters): ViralCase[] {
  const sortBy = filters.sortBy ?? "createdAt";
  const direction = filters.sortOrder === "asc" ? 1 : -1;
  return [...cases].sort((left, right) => {
    const leftValue = viralSortValue(left, sortBy);
    const rightValue = viralSortValue(right, sortBy);
    if (leftValue === rightValue) {
      return right.createdAt.localeCompare(left.createdAt);
    }
    return (leftValue > rightValue ? 1 : -1) * direction;
  });
}

function viralSortValue(item: ViralCase, sortBy: NonNullable<ViralCaseFilters["sortBy"]>): number | string {
  if (sortBy === "createdAt") return item.createdAt;
  return item.metrics[sortBy];
}

async function readViralKnowledgeFile(): Promise<ViralKnowledgeFile> {
  try {
    const raw = await readFile(viralKnowledgePath(), "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as ViralKnowledgeFile;
    if (parsed?.schemaVersion === VIRAL_SCHEMA_VERSION && Array.isArray(parsed.cases)) {
      return {
        schemaVersion: VIRAL_SCHEMA_VERSION,
        cases: parsed.cases.map(normalizeViralCase)
      };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof SyntaxError)) {
      throw error;
    }
  }
  return { schemaVersion: VIRAL_SCHEMA_VERSION, cases: [] };
}

async function writeViralKnowledgeFile(file: ViralKnowledgeFile): Promise<void> {
  const filePath = viralKnowledgePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  await rm(filePath, { force: true }).catch(() => undefined);
  await rename(tempPath, filePath);
}

async function queueViralKnowledgeWrite<T>(operation: () => Promise<T>): Promise<T> {
  const previous = globalForViralKnowledge.xhsViralKnowledgeWriteQueue ?? Promise.resolve();
  const next = previous.then(operation, operation);
  globalForViralKnowledge.xhsViralKnowledgeWriteQueue = next.catch(() => undefined);
  return next;
}

function evidenceInsight(
  type: "title" | "copy" | "tag" | "visual" | "comment" | "audience" | "pain_point" | "structure" | "hook",
  insight: string,
  sourceSampleIds: string[],
  createdAt: string,
  confidence: number
) {
  if (!insight.trim()) return null;
  return {
    id: stableViralInsightId({ type, sourceSampleIds, insight }),
    sourceType: "viral_library" as const,
    type,
    insight: insight.trim(),
    sourceSampleIds,
    confidence,
    createdAt
  };
}

function stableViralInsightId({
  type,
  sourceSampleIds,
  insight
}: {
  type: string;
  sourceSampleIds: string[];
  insight: string;
}): string {
  const key = JSON.stringify({
    type,
    sourceSampleIds: [...sourceSampleIds].sort(),
    insight: insight.replace(/\s+/g, " ").trim()
  });
  return `viral-insight-${type}-${createHash("sha1").update(key).digest("hex").slice(0, 10)}`;
}

function createLocalEmbedding(text: string): number[] {
  const vector = Array.from({ length: 64 }, () => 0);
  for (const token of tokenize(text)) {
    let hash = 0;
    for (const char of token) {
      hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }
    vector[hash % vector.length] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  if (!length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
}

function tokenize(text: string): string[] {
  return uniqueStrings(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\u4e00-\u9fa5]+/gu, " ")
      .split(/\s+/)
      .flatMap((token) => splitChineseToken(token))
      .filter((token) => token.length >= 2)
  );
}

function splitChineseToken(token: string): string[] {
  if (!/[\u4e00-\u9fa5]/.test(token) || token.length <= 4) {
    return [token];
  }
  const parts = [token];
  for (let index = 0; index < token.length - 1; index += 1) {
    parts.push(token.slice(index, index + 2));
  }
  return parts;
}

function inferHookType(title: string): string {
  if (/避坑|别踩|后悔|千万/.test(title)) return "避坑型钩子";
  if (/清单|合集|攻略|指南/.test(title)) return "清单攻略型钩子";
  if (/真实|实测|亲测|体验/.test(title)) return "真实体验型钩子";
  if (/低价|预算|省钱|平价/.test(title)) return "价格利益型钩子";
  return "场景利益前置型钩子";
}

function inferStructure(detailText: string): string[] {
  if (!detailText.trim()) return ["标题先给场景/利益点", "正文补充真实细节", "结尾给收藏或互动理由"];
  const structure = ["开头用具体场景或痛点建立代入"];
  if (detailText.length > 180) structure.push("中段用分点或步骤承载信息密度");
  if (/价格|预算|人均|费用/.test(detailText)) structure.push("加入价格/预算信息增强决策价值");
  if (/注意|避坑|建议/.test(detailText)) structure.push("加入注意事项或避坑提醒提升收藏价值");
  structure.push("结尾用适用人群或互动问题收束");
  return uniqueStrings(structure);
}

function inferImageStyle(sample: SampleEvidence): string {
  if (sample.imageUrls.length) {
    return "主体清晰、场景真实、适合封面浏览，可学习构图/光线/信息层级但不能复制原图";
  }
  return "缺少图片证据，需要后续补充参考图或产品图";
}

function inferTags(sample: SampleEvidence, topic: string, category: string): string[] {
  return uniqueStrings([
    topic.replace(/\s+/g, ""),
    category.replace(/\s+/g, ""),
    ...(sample.title.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,8}/g) ?? [])
  ].filter(Boolean)).slice(0, 8);
}

function summarizeBody(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 240);
}

function parseJsonObject(raw: string): unknown {
  const match = raw.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : {};
}

function includesLoose(value: string, expected: string): boolean {
  return value.toLowerCase().includes(expected.toLowerCase()) || expected.toLowerCase().includes(value.toLowerCase());
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? uniqueStrings(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)).slice(0, 10)
    : [];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function first(values: string[]): string | undefined {
  return values.find((item) => item.trim());
}

function compact<T>(values: Array<T | null | undefined>): T[] {
  return values.filter((value): value is T => value !== null && value !== undefined);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
