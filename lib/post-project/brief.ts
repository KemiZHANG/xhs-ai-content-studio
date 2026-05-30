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
  "topic" | "productInfo" | "targetAudience" | "goal" | "tone" | "evidencePack" | "creativeBrief"
>): CreativeBrief | undefined {
  if (project.creativeBrief) {
    return project.creativeBrief;
  }
  const insights = project.evidencePack.insights;
  if (!insights.length && !project.topic && !project.productInfo.name) {
    return undefined;
  }

  const evidenceIds = insights.map((insight) => insight.id);
  const titleInsights = byType(insights, "title");
  const copyInsights = byType(insights, "copy");
  const visualInsights = byType(insights, "visual");
  const audienceInsights = [...byType(insights, "audience"), ...byType(insights, "comment")];
  const painPointInsights = byType(insights, "pain_point");

  return {
    audience: project.targetAudience || firstText(audienceInsights) || "对这个主题感兴趣、需要真实经验和可执行建议的小红书用户",
    painPoint: firstText(painPointInsights) || firstText(audienceInsights) || "不知道如何判断内容是否真实有用，容易被硬广或空泛推荐劝退",
    contentAngle: project.goal || firstText(titleInsights) || `${project.topic ?? project.productInfo.name ?? "这个主题"}的真实体验与可收藏建议`,
    emotionalHook: firstText(titleInsights) || "用具体场景和真实细节建立代入感",
    proofPoints: takeTexts(copyInsights, 4),
    tone: project.tone || "真实、生活化、不夸张、不像硬广",
    visualMood: firstText(visualInsights) || "真实生活感、主体清晰、适合小红书封面浏览",
    imageMustHave: takeTexts(visualInsights, 3),
    imageMustAvoid: ["不要盗用竞品图片", "不要生成错误文字、假 logo、假认证", "不要夸大功效或制造虚假对比"],
    platformStyle: "小红书图文：标题前置利益点，正文有真实场景、结构清晰，标签聚焦主题和场景",
    tabooWords: ["最", "第一", "必买", "永久", "绝对", "治愈", "保证"],
    complianceNotes: ["基于证据提炼写法，不复制原帖表达", "产品信息不编造认证、销量、功效或价格", "图片不能误改产品外观和包装文字"],
    basedOnEvidenceIds: evidenceIds
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

export function deriveFinalPost(project: Pick<PostProject, "copyDraft" | "selectedImages" | "imagePrompts" | "finalPost">): FinalPost | undefined {
  if (project.finalPost && finalPostStillMatchesProject(project.finalPost, project)) {
    return project.finalPost;
  }
  const draft = project.copyDraft;
  if (!draft) {
    return undefined;
  }
  return {
    title: draft.draft.title,
    content: draft.draft.content,
    tags: draft.draft.tags,
    imageIds: project.selectedImages,
    coverImageId: project.selectedImages[0],
    copyVersionId: `copy-${draft.id}`,
    imagePromptVersionIds: project.imagePrompts.map((prompt) => prompt.id)
  };
}

function finalPostStillMatchesProject(
  finalPost: FinalPost,
  project: Pick<PostProject, "copyDraft" | "selectedImages" | "imagePrompts">
): boolean {
  if (!project.copyDraft) {
    return false;
  }
  const copyVersionId = `copy-${project.copyDraft.id}`;
  const imageIds = [...project.selectedImages].sort().join("|");
  const finalImageIds = [...finalPost.imageIds].sort().join("|");
  const promptIds = project.imagePrompts.map((prompt) => prompt.id).sort().join("|");
  const finalPromptIds = [...finalPost.imagePromptVersionIds].sort().join("|");
  return (
    finalPost.copyVersionId === copyVersionId &&
    finalPost.title === project.copyDraft.draft.title &&
    finalPost.content === project.copyDraft.draft.content &&
    finalPost.tags.join("|") === project.copyDraft.draft.tags.join("|") &&
    imageIds === finalImageIds &&
    promptIds === finalPromptIds
  );
}

export function copyVersionFromDraft(draft: DraftRecord, basedOnEvidenceIds: string[]) {
  return {
    id: `copy-${draft.id}`,
    createdAt: draft.updatedAt,
    label: "Current draft",
    value: draft.draft,
    basedOnEvidenceIds
  };
}

function byType(insights: EvidenceInsight[], type: EvidenceInsight["type"]): EvidenceInsight[] {
  return insights.filter((insight) => insight.type === type);
}

function firstText(insights: EvidenceInsight[]): string | undefined {
  return insights.find((insight) => insight.insight.trim())?.insight.trim();
}

function takeTexts(insights: EvidenceInsight[], count: number): string[] {
  return insights.map((insight) => insight.insight.trim()).filter(Boolean).slice(0, count);
}
