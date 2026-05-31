import type { PublishVersionSnapshot } from "@/lib/agent/types";
import type { PostProject } from "@/lib/post-project/types";

export type PostVersionStatus = {
  activeCopyVersionId?: string;
  activeImagePromptVersionIds: string[];
  finalPostMatchesCanvas: boolean;
  qualityGateFresh: boolean;
  needsReassemble: boolean;
  needsQualityGate: boolean;
  summary: string;
  warnings: string[];
};

export type PostVersionDiff = {
  field: "title" | "content" | "tags" | "images" | "imagePrompts";
  label: string;
  changed: boolean;
  beforeSummary: string;
  afterSummary: string;
};

export type PostVersionDiffReport = {
  hasChanges: boolean;
  changedFields: PostVersionDiff["field"][];
  changes: PostVersionDiff[];
  summary: string;
};

export function getPostVersionStatus(project: Pick<
  PostProject,
  "copyDraft" | "selectedImages" | "imagePrompts" | "finalPost" | "qualityCheck"
>): PostVersionStatus {
  const activeCopyVersionId = project.copyDraft ? `copy-${project.copyDraft.id}` : undefined;
  const selectedImages = Array.isArray(project.selectedImages) ? project.selectedImages : [];
  const imagePrompts = Array.isArray(project.imagePrompts) ? project.imagePrompts : [];
  const activeImagePromptVersionIds = getActiveImagePromptVersionIds(imagePrompts);
  const finalPost = project.finalPost;
  const copyMatchesFinalPost = Boolean(
    finalPost &&
      (project.copyDraft
        ? finalPost.copyVersionId === activeCopyVersionId &&
          finalPost.title === project.copyDraft.draft.title &&
          finalPost.content === project.copyDraft.draft.content &&
          finalPost.tags.join("|") === project.copyDraft.draft.tags.join("|")
        : !finalPost.copyVersionId)
  );
  const finalPostMatchesCanvas = Boolean(
    finalPost &&
      copyMatchesFinalPost &&
      sameStringSet(finalPost.imageIds ?? [], selectedImages) &&
      sameStringSet(safeStringArray(finalPost.imagePromptVersionIds), activeImagePromptVersionIds)
  );
  const qualityGateFresh = Boolean(project.qualityCheck && finalPostMatchesCanvas);
  const warnings = [
    !project.copyDraft ? "还没有当前文案版本" : "",
    !selectedImages.length ? "还没有选中发布图片" : "",
    project.finalPost && !finalPostMatchesCanvas ? "最终帖子快照已落后于当前画布" : "",
    project.qualityCheck && !qualityGateFresh ? "Quality Gate 已失效，需要重新检查" : "",
    !project.qualityCheck ? "Quality Gate 尚未运行" : ""
  ].filter(Boolean);

  return {
    activeCopyVersionId,
    activeImagePromptVersionIds,
    finalPostMatchesCanvas,
    qualityGateFresh,
    needsReassemble: Boolean(project.copyDraft && selectedImages.length && !finalPostMatchesCanvas),
    needsQualityGate: !qualityGateFresh,
    summary: qualityGateFresh
      ? "当前最终帖子和 Quality Gate 与画布一致"
      : finalPostMatchesCanvas
        ? "最终帖子已组装，仍需刷新 Quality Gate"
        : "画布有新版本，发布前需要重新组装并检查",
    warnings
  };
}

export function getPostVersionDiffReport(project: Pick<
  PostProject,
  "copyDraft" | "selectedImages" | "imagePrompts" | "finalPost"
>): PostVersionDiffReport {
  const finalPost = project.finalPost;
  const draft = project.copyDraft?.draft;
  const activePromptIds = getActiveImagePromptVersionIds(project.imagePrompts);
  const changes: PostVersionDiff[] = [
    diffItem("title", "标题", finalPost?.title ?? "", draft?.title ?? ""),
    diffItem("content", "正文", finalPost?.content ?? "", draft?.content ?? ""),
    diffItem("tags", "标签", finalPost?.tags.join(" / ") ?? "", draft?.tags.join(" / ") ?? ""),
    diffItem("images", "图片", safeStringArray(finalPost?.imageIds).join(" / "), safeStringArray(project.selectedImages).join(" / ")),
    diffItem("imagePrompts", "图片 Prompt", safeStringArray(finalPost?.imagePromptVersionIds).join(" / "), activePromptIds.join(" / "))
  ];
  const changedFields = changes.filter((item) => item.changed).map((item) => item.field);
  return {
    hasChanges: changedFields.length > 0,
    changedFields,
    changes,
    summary: changedFields.length
      ? `检测到 ${changedFields.length} 处版本差异：${changes.filter((item) => item.changed).map((item) => item.label).join("、")}`
      : "当前画布与最终发布快照一致"
  };
}

export function buildPublishVersionSnapshot(project: Pick<
  PostProject,
  "copyDraft" | "selectedImages" | "imagePrompts" | "finalPost" | "qualityCheck"
>): PublishVersionSnapshot {
  const status = getPostVersionStatus(project);
  return {
    copyVersionId: status.activeCopyVersionId,
    imagePromptVersionIds: status.activeImagePromptVersionIds,
    selectedImageIds: safeStringArray(project.selectedImages),
    finalPostEvidenceIds: project.finalPost?.basedOnEvidenceIds ?? [],
    qualityGateFresh: status.qualityGateFresh,
    qualityCanPublish: project.qualityCheck?.canPublish,
    finalPostMatchesCanvas: status.finalPostMatchesCanvas,
    summary: status.summary,
    warnings: status.warnings
  };
}

export function compareTextVersion<T extends { title?: string; content?: string; tags?: string[]; imagePrompt?: string }>(
  previous: T | undefined,
  next: T | undefined
): PostVersionDiffReport {
  const changes: PostVersionDiff[] = [
    diffItem("title", "标题", previous?.title ?? "", next?.title ?? ""),
    diffItem("content", "正文", previous?.content ?? "", next?.content ?? ""),
    diffItem("tags", "标签", (previous?.tags ?? []).join(" / "), (next?.tags ?? []).join(" / ")),
    diffItem("imagePrompts", "图片 Prompt", previous?.imagePrompt ?? "", next?.imagePrompt ?? "")
  ];
  const changedFields = changes.filter((item) => item.changed).map((item) => item.field);
  return {
    hasChanges: changedFields.length > 0,
    changedFields,
    changes,
    summary: changedFields.length
      ? `版本之间有 ${changedFields.length} 处差异：${changes.filter((item) => item.changed).map((item) => item.label).join("、")}`
      : "两个版本内容一致"
  };
}

function getActiveImagePromptVersionIds(imagePrompts: PostProject["imagePrompts"]): string[] {
  return imagePrompts.length ? [imagePrompts[imagePrompts.length - 1].id] : [];
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

function diffItem(
  field: PostVersionDiff["field"],
  label: string,
  before: string,
  after: string
): PostVersionDiff {
  const beforeSummary = summarizeVersionValue(before);
  const afterSummary = summarizeVersionValue(after);
  return {
    field,
    label,
    changed: normalizeVersionValue(before) !== normalizeVersionValue(after),
    beforeSummary,
    afterSummary
  };
}

function normalizeVersionValue(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function summarizeVersionValue(value: string): string {
  const normalized = normalizeVersionValue(value);
  if (!normalized) return "空";
  return normalized.length > 56 ? `${normalized.slice(0, 56)}...` : normalized;
}
