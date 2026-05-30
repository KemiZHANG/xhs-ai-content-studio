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

export function getPostVersionStatus(project: Pick<
  PostProject,
  "copyDraft" | "selectedImages" | "imagePrompts" | "finalPost" | "qualityCheck"
>): PostVersionStatus {
  const activeCopyVersionId = project.copyDraft ? `copy-${project.copyDraft.id}` : undefined;
  const activeImagePromptVersionIds = project.imagePrompts.map((prompt) => prompt.id);
  const finalPostMatchesCanvas = Boolean(
    project.finalPost &&
      activeCopyVersionId &&
      project.finalPost.copyVersionId === activeCopyVersionId &&
      project.finalPost.title === project.copyDraft?.draft.title &&
      project.finalPost.content === project.copyDraft?.draft.content &&
      project.finalPost.tags.join("|") === project.copyDraft?.draft.tags.join("|") &&
      sameStringSet(project.finalPost.imageIds, project.selectedImages) &&
      sameStringSet(project.finalPost.imagePromptVersionIds, activeImagePromptVersionIds)
  );
  const qualityGateFresh = Boolean(project.qualityCheck && finalPostMatchesCanvas);
  const warnings = [
    !project.copyDraft ? "还没有当前文案版本" : "",
    !project.selectedImages.length ? "还没有选中发布图片" : "",
    project.finalPost && !finalPostMatchesCanvas ? "最终帖子快照已落后于当前画布" : "",
    project.qualityCheck && !qualityGateFresh ? "Quality Gate 已失效，需要重新检查" : "",
    !project.qualityCheck ? "Quality Gate 尚未运行" : ""
  ].filter(Boolean);

  return {
    activeCopyVersionId,
    activeImagePromptVersionIds,
    finalPostMatchesCanvas,
    qualityGateFresh,
    needsReassemble: Boolean(project.copyDraft && project.selectedImages.length && !finalPostMatchesCanvas),
    needsQualityGate: !qualityGateFresh,
    summary: qualityGateFresh
      ? "当前最终帖子和 Quality Gate 与画布一致"
      : finalPostMatchesCanvas
        ? "最终帖子已组装，仍需刷新 Quality Gate"
        : "画布有新版本，发布前需要重新组装并检查",
    warnings
  };
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}
