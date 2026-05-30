import { NextResponse } from "next/server";
import { updateWorkspaceState } from "@/lib/agent/state";
import { requireLocalActionToken } from "@/lib/security/action-token";
import { copyVersionFromDraft, deriveFinalPost } from "@/lib/post-project/brief";
import { runPostQualityGate } from "@/lib/post-project/quality";
import { buildPostReadinessReport } from "@/lib/post-project/readiness";
import type { PostReadinessReport } from "@/lib/post-project/readiness";
import { readPostProject, updatePostProject } from "@/lib/post-project/store";
import { createDraftRecord, writeCurrentDraft, type DraftRecord } from "@/lib/storage/drafts";
import { readSettings } from "@/lib/storage/settings";
import type { PostProject } from "@/lib/post-project/types";

export const runtime = "nodejs";

type PostProjectActionBody =
  | {
      action: "commit_canvas";
      draft: DraftRecord["draft"];
      selectedImageIds?: string[];
      visibility?: DraftRecord["visibility"];
    }
  | {
      action: "run_quality_gate";
      draft: DraftRecord["draft"];
      selectedImageIds?: string[];
      visibility?: DraftRecord["visibility"];
    }
  | {
      action: "select_copy_version";
      versionId: string;
    }
  | {
      action: "select_image_prompt_version";
      versionId: string;
    }
  | {
      action: "select_images";
      selectedImageIds: string[];
    };

export async function GET() {
  const project = await readPostProject();
  return NextResponse.json(withReadiness({ project }));
}

export async function PATCH(request: Request) {
  const authError = await requireLocalActionToken(request);
  if (authError) return authError;

  const patch = await request.json();

  if (isActionBody(patch)) {
    const result = await handlePostProjectAction(patch);
    return NextResponse.json(withReadiness(result));
  }

  const project = await updatePostProject(sanitizeExternalPatch(patch));
  return NextResponse.json(withReadiness({ project }));
}

async function handlePostProjectAction(body: PostProjectActionBody): Promise<{
  project: PostProject;
  currentDraft?: DraftRecord | null;
}> {
  if (body.action === "commit_canvas" || body.action === "run_quality_gate") {
    const settings = await readSettings();
    const project = await readPostProject();
    const basedOnEvidenceIds = getCurrentEvidenceIds(project);
    const currentDraft = await writeCurrentDraft(
      createDraftRecord({
        draft: normalizeDraft(body.draft, basedOnEvidenceIds),
        images: [],
        visibility: body.visibility ?? settings.defaultVisibility
      })
    );
    await updateWorkspaceState({
      currentDraftId: currentDraft?.id,
      currentDraft,
      selectedImageIds: Array.isArray(body.selectedImageIds) ? body.selectedImageIds : [],
      publishPlan: null
    });
    if (!currentDraft) {
      throw new Error("保存画布草稿失败");
    }
    const syncedProject = await readPostProject();
    const copyVersion = copyVersionFromDraft(currentDraft, basedOnEvidenceIds);
    const selectedImageIds = Array.isArray(body.selectedImageIds) ? body.selectedImageIds.map(String).filter(Boolean) : syncedProject.selectedImages;
    const finalPost = body.action === "run_quality_gate"
      ? deriveFinalPost({
          copyDraft: currentDraft,
          selectedImages: selectedImageIds,
          imagePrompts: syncedProject.imagePrompts ?? [],
          finalPost: undefined
        })
      : undefined;
    const qualityCheck = body.action === "run_quality_gate"
      ? runPostQualityGate({
          ...syncedProject,
          copyDraft: currentDraft,
          selectedImages: selectedImageIds,
          finalPost
        })
      : undefined;
    const nextProject = await updatePostProject({
      copyDraft: currentDraft,
      copyVersions: [
        ...(Array.isArray(syncedProject.copyVersions) ? syncedProject.copyVersions : []).filter((version) => version.id !== copyVersion.id),
        copyVersion
      ],
      selectedImages: selectedImageIds,
      finalPost,
      publishPlan: null,
      qualityCheck,
      auditStatus: qualityCheck ? (qualityCheck.canPublish ? "passed" : "blocked") : "unchecked",
      currentStage: qualityCheck ? "reviewing" : "copy_ready"
    });
    return { project: nextProject, currentDraft };
  }

  const project = await readPostProject();
  if (body.action === "select_images") {
    const selectedImageIds = body.selectedImageIds.map(String).filter(Boolean);
    await updateWorkspaceState({ selectedImageIds, publishPlan: null });
    const nextProject = await updatePostProject({
      selectedImages: selectedImageIds,
      generatedImages: selectedImageIds.map((id) => ({
        id,
        assetId: id,
        createdAt: new Date().toISOString(),
        selected: true
      })),
      finalPost: undefined,
      publishPlan: null,
      qualityCheck: undefined,
      auditStatus: "unchecked"
    });
    return { project: nextProject };
  }

  if (body.action === "select_copy_version") {
    const version = project.copyVersions.find((item) => item.id === body.versionId);
    if (!version) {
      throw new Error("未找到要切换的文案版本");
    }
    const settings = await readSettings();
    const currentDraft = await writeCurrentDraft(
      createDraftRecord({
        draft: version.value,
        images: [],
        visibility: project.copyDraft?.visibility ?? settings.defaultVisibility
      })
    );
    await updateWorkspaceState({
      currentDraftId: currentDraft?.id,
      currentDraft,
      selectedImageIds: project.selectedImages,
      publishPlan: null
    });
    if (!currentDraft) {
      throw new Error("切换文案版本失败");
    }
    const copyVersion = copyVersionFromDraft(currentDraft, version.basedOnEvidenceIds);
    const nextProject = await updatePostProject({
      copyDraft: currentDraft,
      copyVersions: [
        ...project.copyVersions.filter((item) => item.id !== copyVersion.id),
        copyVersion
      ],
      finalPost: undefined,
      publishPlan: null,
      qualityCheck: undefined,
      auditStatus: "unchecked",
      currentStage: "copy_ready"
    });
    return { project: nextProject, currentDraft };
  }

  const version = project.imagePrompts.find((item) => item.id === body.versionId);
  if (!version) {
    throw new Error("未找到要切换的图片 Prompt 版本");
  }
  if (!project.copyDraft) {
    return { project };
  }
  const currentDraft = await writeCurrentDraft({
    ...project.copyDraft,
    id: `draft-${Date.now()}`,
    updatedAt: new Date().toISOString(),
    draft: {
      ...project.copyDraft.draft,
      imagePrompt: version.value.prompt
    }
  });
  await updateWorkspaceState({
    currentDraftId: currentDraft?.id,
    currentDraft,
    selectedImageIds: project.selectedImages,
    publishPlan: null
  });
  if (!currentDraft) {
    throw new Error("切换图片 Prompt 版本失败");
  }
  const copyVersion = copyVersionFromDraft(currentDraft, getCurrentEvidenceIds(project));
  const nextProject = await updatePostProject({
    copyDraft: currentDraft,
    copyVersions: [
      ...project.copyVersions.filter((item) => item.id !== copyVersion.id),
      copyVersion
    ],
    finalPost: undefined,
    publishPlan: null,
    qualityCheck: undefined,
    auditStatus: "unchecked",
    currentStage: "copy_ready"
  });
  return { project: nextProject, currentDraft };
}

function isActionBody(value: unknown): value is PostProjectActionBody {
  return value !== null && typeof value === "object" && "action" in value;
}

function normalizeDraft(draft: DraftRecord["draft"], basedOnEvidenceIds: string[] = []): DraftRecord["draft"] {
  return {
    title: draft.title ?? "",
    content: draft.content ?? "",
    tags: Array.isArray(draft.tags) ? draft.tags : [],
    structure: Array.isArray(draft.structure) ? draft.structure : [],
    imagePrompt: draft.imagePrompt ?? "",
    basedOnEvidenceIds: draft.basedOnEvidenceIds?.length ? draft.basedOnEvidenceIds : basedOnEvidenceIds,
    evidenceReferences: draft.evidenceReferences
  };
}

function getCurrentEvidenceIds(project: PostProject): string[] {
  return project.copyDraft?.draft.basedOnEvidenceIds?.length
    ? project.copyDraft.draft.basedOnEvidenceIds
    : project.creativeBrief?.basedOnEvidenceIds ?? project.evidencePack.insights.map((insight) => insight.id);
}

function sanitizeExternalPatch(value: unknown): Partial<PostProject> {
  if (!value || typeof value !== "object") {
    return {};
  }
  const {
    auditStatus: _auditStatus,
    qualityCheck: _qualityCheck,
    finalPost: _finalPost,
    publishPlan: _publishPlan,
    currentStage: _currentStage,
    allowedActions: _allowedActions,
    schemaVersion: _schemaVersion,
    id: _id,
    updatedAt: _updatedAt,
    ...safePatch
  } = value as Record<string, unknown>;
  return safePatch as Partial<PostProject>;
}

function withReadiness<T extends { project: PostProject }>(result: T): T & { readiness: PostReadinessReport } {
  return {
    ...result,
    readiness: buildPostReadinessReport(result.project)
  };
}
