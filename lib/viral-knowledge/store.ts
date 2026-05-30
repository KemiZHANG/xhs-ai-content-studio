import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ModelProvider } from "@/lib/models/provider";
import type { SampleEvidence } from "@/lib/workflows/one-click";
import type {
  ViralCase,
  ViralCaseFilters,
  ViralCreativeSafety,
  ViralExtractedInsights,
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

const viralKnowledgePath = () => path.join(process.cwd(), "data", "viral-knowledge.json");

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
      existing.reasons = uniqueStrings([...existing.reasons, ...result.reasons, `检索 query：${query}`]).slice(0, 8);
      existing.matchedQueries = uniqueStrings([...(existing.matchedQueries ?? []), query]).slice(0, 5);
    }
  }

  return diversifyViralResults([...merged.values()]).slice(0, limit);
}

export async function upsertViralCases(cases: ViralCase[]): Promise<ViralCase[]> {
  return queueViralKnowledgeWrite(async () => {
    const file = await readViralKnowledgeFile();
    const normalizedCases = cases.map(normalizeViralCase);
    const ids = new Set(normalizedCases.map((item) => item.id));
    const next = [...normalizedCases, ...file.cases.filter((item) => !ids.has(item.id))].slice(0, 2000);
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
  const extractedInsights = model
    ? await extractViralInsightsWithModel({ sample, topic, category, model }).catch(() => extractViralInsightsHeuristically(sample))
    : extractViralInsightsHeuristically(sample);
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
    embedding: createLocalEmbedding(`${sample.title}\n${bodyExcerpt}\n${creativeSafety.summary}\n${extractedInsights.reusableRules.join("\n")}`),
    extractedInsights,
    creativeSafety
  });
}

export function viralCasesToEvidenceInsights(cases: ViralCase[]) {
  const now = new Date().toISOString();
  return cases.flatMap((item) => {
    const sourceSampleIds = [item.id];
    return compact([
      evidenceInsight("hook", first(item.extractedInsights.titleHooks) || item.hookType, sourceSampleIds, now, 0.76),
      evidenceInsight("structure", item.contentStructure.slice(0, 3).join(" / "), sourceSampleIds, now, 0.74),
      evidenceInsight("tag", item.extractedInsights.tagPatterns.slice(0, 3).join("；") || item.tags.join("、"), sourceSampleIds, now, 0.68),
      evidenceInsight("visual", item.imageStyle, sourceSampleIds, now, 0.72),
      evidenceInsight("audience", item.audience, sourceSampleIds, now, 0.68),
      evidenceInsight("pain_point", item.painPoint, sourceSampleIds, now, 0.7),
      evidenceInsight("copy", item.creativeSafety?.summary ?? "", sourceSampleIds, now, 0.78)
    ]);
  });
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

function normalizeViralCase(item: ViralCase): ViralCase {
  const extractedInsights = normalizeExtractedInsights(item.extractedInsights);
  const contentStructure = uniqueStrings(item.contentStructure).slice(0, 8);
  const imageStyle = item.imageStyle || first(extractedInsights.visualPatterns) || "";
  const creativeSafety = normalizeCreativeSafety(item.creativeSafety, {
    title: item.title,
    extractedInsights,
    contentStructure,
    imageStyle
  });
  return {
    ...item,
    platform: "xiaohongshu",
    tags: uniqueStrings(item.tags).slice(0, 12),
    imageStyle,
    contentStructure,
    embedding: Array.isArray(item.embedding) && item.embedding.length
      ? item.embedding
      : createLocalEmbedding(`${item.title}\n${item.bodyExcerpt}\n${creativeSafety.summary}`),
    extractedInsights,
    creativeSafety
  };
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
    item.tags.join(" "),
    item.imageStyle,
    item.hookType,
    item.contentStructure.join(" "),
    item.painPoint,
    item.audience,
    item.emotionalTrigger,
    item.extractedInsights.reusableRules.join(" "),
    item.creativeSafety?.summary,
    item.creativeSafety?.reusablePatterns.join(" "),
    item.creativeSafety?.transformationGuidance.join(" ")
  ].join(" ");
  const textTokens = tokenize(text);
  const tokenHits = queryTokens.filter((token) => textTokens.includes(token));
  const semanticScore = cosineSimilarity(createLocalEmbedding(queryTokens.join(" ")), item.embedding);
  const metricScore = Math.min(0.25, Math.log10(1 + item.metrics.likes + item.metrics.collects * 1.4 + item.metrics.comments * 0.6) / 20);
  const filterBonus = [
    input.topic && includesLoose(item.topic, input.topic),
    input.category && includesLoose(item.category, input.category),
    input.audience && includesLoose(item.audience, input.audience),
    input.painPoint && includesLoose(item.painPoint, input.painPoint)
  ].filter(Boolean).length * 0.08;
  const score = tokenHits.length * 0.08 + semanticScore * 0.55 + metricScore + filterBonus;
  return {
    case: item,
    score: Number(score.toFixed(4)),
    reasons: [
      tokenHits.length ? `命中关键词：${tokenHits.slice(0, 5).join("、")}` : "",
      semanticScore > 0.1 ? "语义相似" : "",
      metricScore > 0.05 ? "互动数据较强" : ""
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
  const selected: ViralSearchResult[] = [];
  const usedAngles = new Map<string, number>();

  for (const result of sorted) {
    const angle = `${result.case.hookType}|${result.case.category}|${result.case.imageStyle}`.slice(0, 80);
    const count = usedAngles.get(angle) ?? 0;
    if (count >= 2 && selected.length >= 4) {
      continue;
    }
    selected.push(result);
    usedAngles.set(angle, count + 1);
  }

  return selected.length ? selected : sorted;
}

function matchesFilters(item: ViralCase, filters: ViralCaseFilters): boolean {
  if (filters.topic && !includesLoose(item.topic, filters.topic) && !includesLoose(item.title, filters.topic)) return false;
  if (filters.category && !includesLoose(item.category, filters.category)) return false;
  if (filters.audience && !includesLoose(item.audience, filters.audience)) return false;
  if (filters.painPoint && !includesLoose(item.painPoint, filters.painPoint)) return false;
  if (filters.tags?.length && !filters.tags.some((tag) => item.tags.some((itemTag) => includesLoose(itemTag, tag)))) return false;
  if (filters.createdAfter && Date.parse(item.createdAt) < Date.parse(filters.createdAfter)) return false;
  if (filters.createdBefore && Date.parse(item.createdAt) > Date.parse(filters.createdBefore)) return false;
  if (filters.minLikes !== undefined && item.metrics.likes < filters.minLikes) return false;
  if (filters.minCollects !== undefined && item.metrics.collects < filters.minCollects) return false;
  if (filters.minComments !== undefined && item.metrics.comments < filters.minComments) return false;
  if (filters.minShares !== undefined && item.metrics.shares < filters.minShares) return false;
  if (filters.minScore !== undefined && item.metrics.score < filters.minScore) return false;
  return true;
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
