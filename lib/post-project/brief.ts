import { randomUUID } from "node:crypto";
import type {
  CreativeBrief,
  EvidenceInsight,
  FinalPost,
  ImagePromptVersion,
  PostProject,
  VisualDirection
} from "@/lib/post-project/types";
import type { DraftRecord } from "@/lib/storage/drafts";

export function deriveCreativeBrief(project: Pick<
  PostProject,
  "topic" | "productInfo" | "targetAudience" | "goal" | "tone" | "evidencePack" | "focusedEvidenceIds" | "creativeBrief"
>): CreativeBrief | undefined {
  if (project.creativeBrief) {
    return project.creativeBrief;
  }
  const allInsights = project.evidencePack.insights;
  const focusedIds = new Set(project.focusedEvidenceIds ?? []);
  const insights = prioritizeBriefInsights(allInsights, project.focusedEvidenceIds ?? []);
  if (!allInsights.length && !project.topic && !project.productInfo.name) {
    return undefined;
  }

  const evidenceIds = insights.map((insight) => insight.id);
  const titleInsights = byType(insights, "title");
  const hookInsights = byType(insights, "hook");
  const structureInsights = byType(insights, "structure");
  const copyInsights = byType(insights, "copy");
  const visualInsights = byType(insights, "visual");
  const audienceInsights = [...byType(insights, "audience"), ...byType(insights, "comment")];
  const painPointInsights = byType(insights, "pain_point");
  const viralStrategy = extractViralStrategy(project.evidencePack.summary);
  const strategyEvidenceIds = viralStrategy
    ? viralStrategy.evidenceIds.filter((id) => evidenceIds.includes(id) || (!focusedIds.size && allInsights.some((insight) => insight.id === id)))
    : [];
  const basedOnEvidenceIds = uniqueStrings([...evidenceIds, ...strategyEvidenceIds]);

  return {
    audience: project.targetAudience || firstText(audienceInsights) || "对这个主题感兴趣、需要真实经验和可执行建议的小红书用户",
    painPoint: firstText(painPointInsights) || firstText(audienceInsights) || "不知道如何判断内容是否真实有用，容易被硬广或空泛推荐劝退",
    contentAngle: project.goal || first(viralStrategy?.recommendedAngles ?? []) || firstText(structureInsights) || firstText(titleInsights) || `${project.topic ?? project.productInfo.name ?? "这个主题"}的真实体验与可收藏建议`,
    emotionalHook: firstText(hookInsights) || first(viralStrategy?.titleMoves ?? []) || firstText(titleInsights) || "用具体场景和真实细节建立代入感",
    proofPoints: uniqueStrings([...takeTexts([...structureInsights, ...copyInsights], 4), ...(viralStrategy?.structureMoves ?? [])]).slice(0, 5),
    tone: project.tone || "真实、生活化、不夸张、不像硬广",
    visualMood: firstText(visualInsights) || first(viralStrategy?.visualMoves ?? []) || "真实生活感、主体清晰、适合小红书封面浏览",
    imageMustHave: uniqueStrings([...takeTexts(visualInsights, 3), ...(viralStrategy?.visualMoves ?? [])]).slice(0, 4),
    imageMustAvoid: uniqueStrings([
      "不要盗用竞品图片",
      "不要生成错误文字、假 logo、假认证",
      "不要夸大功效或制造虚假对比",
      ...(viralStrategy?.originalityRules ?? [])
    ]).slice(0, 8),
    platformStyle: "小红书图文：标题前置利益点，正文有真实场景、结构清晰，标签聚焦主题和场景",
    tabooWords: ["最", "第一", "必买", "永久", "绝对", "治愈", "保证"],
    complianceNotes: uniqueStrings([
      "基于证据提炼写法，不复制原帖表达",
      "产品信息不编造认证、销量、功效或价格",
      "图片不能误改产品外观和包装文字",
      ...(viralStrategy?.originalityRules ?? [])
    ]).slice(0, 8),
    basedOnEvidenceIds
  };
}

export function deriveVisualDirection(project: Pick<PostProject, "creativeBrief" | "visualDirection">): VisualDirection | undefined {
  if (project.visualDirection) {
    return project.visualDirection;
  }
  const brief = project.creativeBrief;
  if (!brief) {
    return undefined;
  }
  return {
    mood: brief.visualMood,
    composition: "封面突出主体和标题信息，正文图保持真实场景与细节递进",
    colorPalette: "自然光、低饱和、干净背景，避免廉价素材感",
    mustHave: brief.imageMustHave.length ? brief.imageMustHave : ["主体清晰", "场景真实", "适合小红书封面裁切"],
    mustAvoid: brief.imageMustAvoid,
    basedOnEvidenceIds: brief.basedOnEvidenceIds
  };
}

export function deriveImagePromptVersion(
  project: Pick<PostProject, "imagePrompts" | "creativeBrief" | "visualDirection" | "topic" | "productInfo">
): ImagePromptVersion | undefined {
  if (project.imagePrompts.length || !project.creativeBrief || !project.visualDirection) {
    return undefined;
  }
  const prompt = [
    `小红书图文封面/配图，主题：${project.topic ?? project.productInfo.name ?? "内容主题"}`,
    `受众：${project.creativeBrief.audience}`,
    `情绪钩子：${project.creativeBrief.emotionalHook}`,
    `视觉氛围：${project.visualDirection.mood}`,
    `构图：${project.visualDirection.composition}`,
    `必须包含：${project.visualDirection.mustHave.join("；")}`,
    "真实生活方式摄影感，主体清晰，画面干净，有收藏价值，不使用竞品原图"
  ].join("\n");

  return {
    id: `image-prompt-${Date.now()}-${randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    label: "Brief-based image prompt",
    value: {
      prompt,
      negativePrompt: project.visualDirection.mustAvoid.join("；")
    },
    basedOnEvidenceIds: project.creativeBrief.basedOnEvidenceIds
  };
}

export function deriveFinalPost(project: Pick<PostProject, "copyDraft" | "selectedImages" | "imagePrompts" | "finalPost"> & Partial<Pick<PostProject, "generatedImageVersions">>): FinalPost | undefined {
  if (project.finalPost && finalPostStillMatchesProject(project.finalPost, project)) {
    return project.finalPost;
  }
  const draft = project.copyDraft;
  if (!draft) {
    return undefined;
  }
  const activeImagePrompts = getActiveImagePromptVersions(project.imagePrompts);
  const generatedImageVersionId = getActiveGeneratedImageVersionId(project);
  return {
    title: draft.draft.title,
    content: draft.draft.content,
    tags: draft.draft.tags,
    imageIds: project.selectedImages,
    coverImageId: project.selectedImages[0],
    copyVersionId: `copy-${draft.id}`,
    imagePromptVersionIds: activeImagePrompts.map((prompt) => prompt.id),
    generatedImageVersionId,
    basedOnEvidenceIds: uniqueStrings([
      ...(draft.draft.basedOnEvidenceIds ?? []),
      ...activeImagePrompts.flatMap((prompt) => prompt.basedOnEvidenceIds ?? [])
    ])
  };
}

function finalPostStillMatchesProject(
  finalPost: FinalPost,
  project: Pick<PostProject, "copyDraft" | "selectedImages" | "imagePrompts"> & Partial<Pick<PostProject, "generatedImageVersions">>
): boolean {
  if (!project.copyDraft) {
    return false;
  }
  const copyVersionId = `copy-${project.copyDraft.id}`;
  const imageIds = [...project.selectedImages].sort().join("|");
  const finalImageIds = [...finalPost.imageIds].sort().join("|");
  const promptIds = getActiveImagePromptVersions(project.imagePrompts).map((prompt) => prompt.id).sort().join("|");
  const finalPromptIds = [...finalPost.imagePromptVersionIds].sort().join("|");
  const activeGeneratedImageVersionId = getActiveGeneratedImageVersionId(project);
  const generatedImageVersionMatches = !activeGeneratedImageVersionId && !finalPost.generatedImageVersionId
    ? true
    : finalPost.generatedImageVersionId === activeGeneratedImageVersionId;
  return (
    finalPost.copyVersionId === copyVersionId &&
    finalPost.title === project.copyDraft.draft.title &&
    finalPost.content === project.copyDraft.draft.content &&
    finalPost.tags.join("|") === project.copyDraft.draft.tags.join("|") &&
    imageIds === finalImageIds &&
    promptIds === finalPromptIds &&
    generatedImageVersionMatches
  );
}

export function copyVersionFromDraft(draft: DraftRecord, basedOnEvidenceIds: string[]) {
  const draftEvidenceIds = Array.isArray(draft.draft.basedOnEvidenceIds) && draft.draft.basedOnEvidenceIds.length
    ? draft.draft.basedOnEvidenceIds
    : basedOnEvidenceIds;
  return {
    id: `copy-${draft.id}`,
    createdAt: draft.updatedAt,
    label: "Current draft",
    value: draft.draft,
    basedOnEvidenceIds: draftEvidenceIds
  };
}

function getActiveImagePromptVersions(imagePrompts: PostProject["imagePrompts"]): PostProject["imagePrompts"] {
  return imagePrompts.length ? [imagePrompts[imagePrompts.length - 1]] : [];
}

function getActiveGeneratedImageVersionId(project: Pick<PostProject, "selectedImages"> & Partial<Pick<PostProject, "generatedImageVersions">>): string | undefined {
  const versions = Array.isArray(project.generatedImageVersions) ? project.generatedImageVersions : [];
  const selectedImages = project.selectedImages ?? [];
  if (!versions.length || !selectedImages.length) {
    return undefined;
  }
  return [...versions].reverse().find((version) => sameStringSet(version.selectedImageIds, selectedImages))?.id;
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}

function byType(insights: EvidenceInsight[], type: EvidenceInsight["type"]): EvidenceInsight[] {
  return insights.filter((insight) => insight.type === type);
}

function prioritizeBriefInsights(insights: EvidenceInsight[], focusedEvidenceIds: string[]): EvidenceInsight[] {
  if (!focusedEvidenceIds.length) {
    return sortBriefInsights(insights);
  }
  const focusedSet = new Set(focusedEvidenceIds);
  const focused = focusedEvidenceIds
    .map((id) => insights.find((insight) => insight.id === id))
    .filter((insight): insight is EvidenceInsight => Boolean(insight));
  const focusedTypes = new Set(focused.map((insight) => insight.type));
  const supplemental = insights.filter((insight) => {
    if (focusedSet.has(insight.id)) return false;
    if (insight.sourceType === "user_input" || (insight.sourceType ?? "realtime") === "realtime") return true;
    return !focusedTypes.has(insight.type);
  });
  return uniqueInsights([...focused, ...sortBriefInsights(supplemental)]);
}

function sortBriefInsights(insights: EvidenceInsight[]): EvidenceInsight[] {
  return [...insights].sort((left, right) => {
    const weak = Number(isWeakReferenceInsight(left)) - Number(isWeakReferenceInsight(right));
    const bySource = briefSourcePriority(left) - briefSourcePriority(right);
    return weak || bySource || right.confidence - left.confidence || left.id.localeCompare(right.id);
  });
}

function isWeakReferenceInsight(insight: EvidenceInsight): boolean {
  return insight.insight.trim().startsWith("弱参考：");
}

function briefSourcePriority(insight: EvidenceInsight): number {
  if (insight.sourceType === "user_input") return 0;
  if (insight.sourceType === "realtime" || !insight.sourceType) return 1;
  if (insight.sourceType === "viral_library") return 2;
  return 3;
}

function uniqueInsights(insights: EvidenceInsight[]): EvidenceInsight[] {
  const seen = new Set<string>();
  return insights.filter((insight) => {
    if (seen.has(insight.id)) return false;
    seen.add(insight.id);
    return true;
  });
}

function firstText(insights: EvidenceInsight[]): string | undefined {
  return insights.find((insight) => insight.insight.trim())?.insight.trim();
}

function first(values: string[]): string | undefined {
  return values.find((item) => item.trim());
}

function takeTexts(insights: EvidenceInsight[], count: number): string[] {
  return insights.map((insight) => insight.insight.trim()).filter(Boolean).slice(0, count);
}

function extractViralStrategy(summary: unknown): {
  titleMoves: string[];
  structureMoves: string[];
  visualMoves: string[];
  originalityRules: string[];
  recommendedAngles: string[];
  evidenceIds: string[];
} | null {
  const viralKnowledge = isRecord(summary) ? summary.viralKnowledge : undefined;
  const strategyReport = isRecord(viralKnowledge) ? viralKnowledge.strategyReport : undefined;
  if (!isRecord(strategyReport)) return null;
  return {
    titleMoves: stringArray(strategyReport.titleMoves),
    structureMoves: stringArray(strategyReport.structureMoves),
    visualMoves: stringArray(strategyReport.visualMoves),
    originalityRules: stringArray(strategyReport.originalityRules),
    recommendedAngles: stringArray(strategyReport.recommendedAngles),
    evidenceIds: stringArray(strategyReport.evidenceIds)
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? uniqueStrings(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))
    : [];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
