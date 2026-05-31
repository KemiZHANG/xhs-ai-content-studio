import { getAllowedPostActions, normalizePostStage } from "@/lib/post-project/stage-machine";
import type { PostAction, PostStage } from "@/lib/post-project/types";

export type PostReadinessStepId =
  | "evidence"
  | "brief"
  | "copy"
  | "visual"
  | "images"
  | "assembly"
  | "quality"
  | "confirmation";

export type PostReadinessItem = {
  id: PostReadinessStepId;
  label: string;
  ready: boolean;
  detail: string;
  action?: PostAction;
};

export type PostReadinessReport = {
  items: PostReadinessItem[];
  visibleItems: PostReadinessItem[];
  blockers: PostReadinessItem[];
  nextAction?: PostAction;
  progress: number;
  summary: string;
  canRequestPublish: boolean;
};

type ReadinessProject = {
  allowedActions?: readonly string[];
  copyDraft?: {
    id?: string;
    draft?: {
      title?: string;
      content?: string;
      tags?: readonly string[];
    };
  } | null;
  creativeBrief?: unknown;
  currentStage?: PostStage | string;
  evidencePack?: {
    insights?: readonly unknown[];
  } | null;
  finalPost?: {
    title?: string;
    content?: string;
    tags?: readonly string[];
    imageIds?: readonly string[];
    imagePromptVersionIds?: readonly string[];
    copyVersionId?: string;
  };
  imagePrompts?: readonly unknown[];
  publishPlan?: {
    status?: string;
  } | null;
  qualityCheck?: {
    canPublish?: boolean;
    issues: string[];
  };
  selectedImages?: readonly string[];
  selectedSamples?: readonly unknown[];
  visualDirection?: unknown;
};

export function buildPostReadinessReport(project: ReadinessProject): PostReadinessReport {
  const currentStage = normalizePostStage(project.currentStage);
  const allowedActions = project.allowedActions?.length ? project.allowedActions : getAllowedPostActions(currentStage);
  const actionSet = new Set(allowedActions);
  const insights = project.evidencePack?.insights ?? [];
  const selectedSamples = project.selectedSamples ?? [];
  const imagePrompts = project.imagePrompts ?? [];
  const selectedImages = project.selectedImages ?? [];
  const hasEvidence = Boolean(insights.length || selectedSamples.length);
  const hasBrief = Boolean(project.creativeBrief);
  const draft = project.copyDraft?.draft;
  const hasCopy = Boolean(draft?.title?.trim() && draft?.content?.trim());
  const hasVisualPlan = hasTraceableVisualPlan(project.visualDirection, imagePrompts);
  const hasImages = selectedImages.length > 0;
  const hasFinalPost = Boolean(project.finalPost);
  const finalPostCurrent = isFinalPostCurrent(project);
  const qualityFreshEnough = Boolean(project.qualityCheck?.canPublish && finalPostCurrent);
  const canRunQualityGate = finalPostCurrent && hasImages && hasCopy && actionSet.has("run_quality_gate");
  const canRequestPublish = qualityFreshEnough && hasFinalPost && hasImages && hasCopy;
  const hasPublishConfirmation = Boolean(
    project.publishPlan?.status === "awaiting_approval" ||
      project.publishPlan?.status === "approved" ||
      project.publishPlan?.status === "scheduled" ||
      project.publishPlan?.status === "published"
  );

  const items: PostReadinessItem[] = [
    {
      id: "evidence",
      label: "研究证据",
      ready: hasEvidence,
      detail: hasEvidence ? `已沉淀 ${insights.length} 条规律` : "先搜索真实笔记或补充参考样本",
      action: actionSet.has("search_research") ? "search_research" : undefined
    },
    {
      id: "brief",
      label: "创作策略",
      ready: hasBrief,
      detail: hasBrief ? "CreativeBrief 已生成" : "把证据压缩成目标人群、角度和视觉方向",
      action: actionSet.has("create_creative_brief") ? "create_creative_brief" : undefined
    },
    {
      id: "copy",
      label: "文案草稿",
      ready: hasCopy,
      detail: hasCopy ? "标题、正文已可继续微调" : "基于证据生成原创标题、正文和标签",
      action: actionSet.has("generate_copy") ? "generate_copy" : undefined
    },
    {
      id: "visual",
      label: "图片方向",
      ready: hasVisualPlan,
      detail: hasVisualPlan ? "图片方向或 Prompt 已引用 CreativeBrief / evidencePack 证据" : "规划封面、场景、构图和禁用项，并绑定证据",
      action: actionSet.has("plan_visuals")
        ? "plan_visuals"
        : actionSet.has("generate_image_prompts")
          ? "generate_image_prompts"
          : undefined
    },
    {
      id: "images",
      label: "发布图片",
      ready: hasImages,
      detail: hasImages ? `已选择 ${selectedImages.length} 张图片` : "生成图片、卡片或从素材中选图",
      action: actionSet.has("select_images")
        ? "select_images"
        : actionSet.has("generate_images")
          ? "generate_images"
          : actionSet.has("generate_cards")
            ? "generate_cards"
            : undefined
    },
    {
      id: "assembly",
      label: "成稿装配",
      ready: finalPostCurrent,
      detail: finalPostCurrent
        ? "文案和图片已绑定为同一篇帖子"
        : hasFinalPost
          ? "最终帖子快照已落后于当前画布，需要重新装配"
          : "把当前草稿和选中图片装配成最终帖子",
      action: actionSet.has("assemble_post") ? "assemble_post" : undefined
    },
    {
      id: "quality",
      label: "质量检查",
      ready: qualityFreshEnough,
      detail: qualityFreshEnough
        ? "质量门已通过"
        : project.qualityCheck?.canPublish && !finalPostCurrent
          ? "Quality Gate 已失效：文案、图片或 Prompt 已与最终帖子快照不一致"
          : project.qualityCheck?.issues.slice(0, 2).join("；") || "运行证据、原创性和发布风险检查",
      action: qualityFreshEnough || !canRunQualityGate ? undefined : "run_quality_gate"
    },
    {
      id: "confirmation",
      label: "发布确认",
      ready: hasPublishConfirmation,
      detail: hasPublishConfirmation ? "已有待确认或已执行的发布计划" : "生成发布确认单后才能真实发布",
      action: canRequestPublish && actionSet.has("request_publish_confirmation") ? "request_publish_confirmation" : undefined
    }
  ];

  const readyCount = items.filter((item) => item.ready).length;
  const blockers = items.filter((item) => !item.ready);
  const nextAction = blockers.find((item) => item.action)?.action;
  const progress = Math.round((readyCount / items.length) * 100);
  const summary = blockers.length
    ? `还差 ${blockers.length} 步：${blockers.slice(0, 2).map((item) => item.label).join("、")}`
    : "已具备发布前确认条件";

  return {
    items,
    visibleItems: selectVisibleReadinessItems(items, blockers),
    blockers,
    nextAction,
    progress,
    summary,
    canRequestPublish
  };
}

function selectVisibleReadinessItems(items: PostReadinessItem[], blockers: PostReadinessItem[]): PostReadinessItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const pinnedIds = [
    blockers[0]?.id,
    items.find((item) => item.action)?.id,
    "quality",
    "confirmation"
  ].filter((id): id is PostReadinessStepId => Boolean(id));
  const visible: PostReadinessItem[] = [];

  for (const id of pinnedIds) {
    const item = byId.get(id);
    if (item && !visible.some((existing) => existing.id === item.id)) {
      visible.push(item);
    }
  }

  for (const item of items) {
    if (visible.length >= 5) break;
    if (!visible.some((existing) => existing.id === item.id)) {
      visible.push(item);
    }
  }

  return visible.sort((left, right) => items.indexOf(left) - items.indexOf(right));
}

function hasTraceableVisualPlan(visualDirection: unknown, imagePrompts: readonly unknown[]): boolean {
  return Boolean(hasEvidenceIds(visualDirection) || imagePrompts.some(hasEvidenceIds));
}

function isFinalPostCurrent(project: ReadinessProject): boolean {
  const finalPost = project.finalPost;
  const draft = project.copyDraft;
  if (!finalPost || !draft?.id || !draft.draft) {
    return false;
  }

  const activePromptIds = getActiveImagePromptVersionIds(project.imagePrompts ?? []);
  return (
    finalPost.copyVersionId === `copy-${draft.id}` &&
    finalPost.title === draft.draft.title &&
    finalPost.content === draft.draft.content &&
    sameStringSet(safeStringArray(finalPost.tags), safeStringArray(draft.draft.tags)) &&
    sameStringSet(safeStringArray(finalPost.imageIds), safeStringArray(project.selectedImages)) &&
    sameStringSet(safeStringArray(finalPost.imagePromptVersionIds), activePromptIds)
  );
}

function getActiveImagePromptVersionIds(imagePrompts: readonly unknown[]): string[] {
  const promptIds = imagePrompts
    .map((prompt) => {
      if (!prompt || typeof prompt !== "object") return "";
      const id = (prompt as { id?: unknown }).id;
      return typeof id === "string" ? id.trim() : "";
    })
    .filter(Boolean);
  return promptIds.length ? [promptIds[promptIds.length - 1]] : [];
}

function hasEvidenceIds(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const evidenceIds = (value as { basedOnEvidenceIds?: unknown }).basedOnEvidenceIds;
  return Array.isArray(evidenceIds) && evidenceIds.some((item) => typeof item === "string" && item.trim());
}

function safeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}
