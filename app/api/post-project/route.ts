import { NextResponse } from "next/server";
import { updateWorkspaceState } from "@/lib/agent/state";
import { requireLocalActionToken } from "@/lib/security/action-token";
import { copyVersionFromDraft, deriveFinalPost } from "@/lib/post-project/brief";
import { runPostQualityGate } from "@/lib/post-project/quality";
import { buildPostReadinessReport } from "@/lib/post-project/readiness";
import type { PostReadinessReport } from "@/lib/post-project/readiness";
import { inferPostStage } from "@/lib/post-project/stage-machine";
import { readPostProject, updatePostProject } from "@/lib/post-project/store";
import { createDraftRecord, writeCurrentDraft, type DraftRecord } from "@/lib/storage/drafts";
import { getAsset } from "@/lib/storage/assets";
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
      dryRun?: boolean;
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
      action: "select_generated_image_version";
      versionId: string;
    }
  | {
      action: "select_images";
      selectedImageIds: string[];
    }
  | {
      action: "focus_evidence";
      focusedEvidenceIds: string[];
    }
  | {
      action: "update_reference_assets";
      referenceAssetIds: string[];
    }
  | {
      action: "recover";
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
  dryRun?: boolean;
}> {
  if (body.action === "commit_canvas" || body.action === "run_quality_gate") {
    const settings = await readSettings();
    const project = await readPostProject();
    const basedOnEvidenceIds = getCurrentEvidenceIds(project);
    const isDryRun = body.action === "run_quality_gate" && body.dryRun === true;
    const draftRecord = createDraftRecord({
      draft: normalizeDraft(body.draft, basedOnEvidenceIds),
      images: [],
      visibility: body.visibility ?? settings.defaultVisibility
    });
    const currentDraft = isDryRun ? draftRecord : await writeCurrentDraft(draftRecord);
    if (!isDryRun) {
      await updateWorkspaceState({
        currentDraftId: currentDraft?.id,
        currentDraft,
        selectedImageIds: Array.isArray(body.selectedImageIds) ? body.selectedImageIds : [],
        publishPlan: null
      });
    }
    if (!currentDraft) {
      throw new Error("保存画布草稿失败");
    }
    const syncedProject = isDryRun ? project : await readPostProject();
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
    const projectPatch: Partial<PostProject> = {
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
    };
    if (isDryRun) {
      return { project: { ...syncedProject, ...projectPatch }, currentDraft, dryRun: true };
    }
    const nextProject = await updatePostProject(projectPatch);
    return { project: nextProject, currentDraft };
  }

  const project = await readPostProject();
  if (body.action === "select_images") {
    const selectedImageIds = body.selectedImageIds.map(String).filter(Boolean);
    const generatedImages = await mergeSelectedImageRecords(project, selectedImageIds);
    await updateWorkspaceState({ selectedImageIds, publishPlan: null });
    const nextProject = await updatePostProject({
      selectedImages: selectedImageIds,
      generatedImages,
      generatedImageVersions: upsertGeneratedImageVersion(project, generatedImages, selectedImageIds, "Selected image set"),
      finalPost: undefined,
      publishPlan: null,
      qualityCheck: undefined,
      auditStatus: "unchecked"
    });
    return { project: nextProject };
  }

  if (body.action === "focus_evidence") {
    const validIds = new Set(project.evidencePack.insights.map((insight) => insight.id));
    const focusedEvidenceIds = uniqueStrings(body.focusedEvidenceIds).filter((id: string) => validIds.has(id)).slice(0, 8);
    const nextProject = await updatePostProject({
      focusedEvidenceIds,
      creativeBrief: undefined,
      visualDirection: undefined,
      imagePrompts: [],
      finalPost: undefined,
      publishPlan: null,
      qualityCheck: undefined,
      auditStatus: "unchecked"
    });
    return { project: nextProject };
  }

  if (body.action === "update_reference_assets") {
    const referenceAssetIds = uniqueStrings(body.referenceAssetIds);
    await updateWorkspaceState({
      productImageIds: referenceAssetIds,
      lastUserIntent: "upload_product_images"
    });
    const nextProject = await updatePostProject({
      productInfo: {
        ...project.productInfo,
        referenceAssetIds
      },
      finalPost: undefined,
      publishPlan: null,
      qualityCheck: undefined,
      auditStatus: "unchecked"
    });
    return { project: nextProject };
  }

  if (body.action === "recover") {
    const auditStatus: PostProject["auditStatus"] = project.qualityCheck
      ? (project.qualityCheck.canPublish ? "passed" : "blocked")
      : "unchecked";
    const recoveredProject = {
      ...project,
      publishPlan: project.publishPlan?.status === "blocked" || project.publishPlan?.status === "failed"
        ? null
        : project.publishPlan,
      auditStatus
    };
    const nextProject = await updatePostProject({
      publishPlan: recoveredProject.publishPlan,
      auditStatus: recoveredProject.auditStatus,
      currentStage: inferPostStage(recoveredProject)
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

  if (body.action === "select_generated_image_version") {
    const version = (project.generatedImageVersions ?? []).find((item) => item.id === body.versionId);
    if (!version) {
      throw new Error("未找到要切换的图片批次版本");
    }
    const selectedImageIds = version.selectedImageIds.length ? version.selectedImageIds : version.imageIds;
    const generatedImages = await mergeGeneratedImageRecordsForVersionSwitch(project, selectedImageIds);
    await updateWorkspaceState({ selectedImageIds, publishPlan: null });
    const nextProject = await updatePostProject({
      selectedImages: selectedImageIds,
      generatedImages,
      finalPost: undefined,
      publishPlan: null,
      qualityCheck: undefined,
      auditStatus: "unchecked",
      currentStage: selectedImageIds.length ? "image_ready" : "image_generating"
    });
    return { project: nextProject };
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
  const activeImagePrompts = [
    ...project.imagePrompts.filter((item) => item.id !== version.id),
    version
  ];
  const nextProject = await updatePostProject({
    copyDraft: currentDraft,
    copyVersions: [
      ...project.copyVersions.filter((item) => item.id !== copyVersion.id),
      copyVersion
    ],
    imagePrompts: activeImagePrompts,
    finalPost: undefined,
    publishPlan: null,
    qualityCheck: undefined,
    auditStatus: "unchecked",
    currentStage: "image_prompt_ready"
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

async function mergeSelectedImageRecords(project: PostProject, selectedImageIds: string[]): Promise<PostProject["generatedImages"]> {
  const selected = uniqueStrings(selectedImageIds);
  const existingById = new Map(project.generatedImages.map((image) => [image.assetId ?? image.id, image]));
  const assetsById = new Map(
    (await Promise.all(selected.map(async (id) => [id, await getAsset(id)] as const))).filter(
      (entry): entry is readonly [string, NonNullable<Awaited<ReturnType<typeof getAsset>>>] => Boolean(entry[1])
    )
  );
  const activePrompt = project.imagePrompts.at(-1);
  const fallbackEvidenceIds = uniqueStrings([
    ...(activePrompt?.basedOnEvidenceIds ?? []),
    ...(project.visualDirection?.basedOnEvidenceIds ?? []),
    ...(project.creativeBrief?.basedOnEvidenceIds ?? [])
  ]).slice(0, 12);
  return selected.map((id) => {
    const existing = existingById.get(id);
    const asset = assetsById.get(id);
    return {
      id: existing?.id ?? id,
      assetId: existing?.assetId ?? id,
      path: existing?.path ?? asset?.absolutePath,
      url: existing?.url,
      promptId: existing?.promptId ?? asset?.promptVersionId ?? activePrompt?.id,
      promptVersionId: existing?.promptVersionId ?? asset?.promptVersionId ?? existing?.promptId ?? activePrompt?.id,
      basedOnEvidenceIds: existing?.basedOnEvidenceIds?.length
        ? existing.basedOnEvidenceIds
        : asset?.basedOnEvidenceIds?.length
          ? asset.basedOnEvidenceIds
          : fallbackEvidenceIds,
      sourceAssetIds: existing?.sourceAssetIds?.length ? existing.sourceAssetIds : asset?.sourceAssetIds ?? [],
      createdAt: existing?.createdAt ?? asset?.createdAt ?? new Date().toISOString(),
      selected: true
    };
  });
}

async function mergeGeneratedImageRecordsForVersionSwitch(project: PostProject, selectedImageIds: string[]): Promise<PostProject["generatedImages"]> {
  const selectedRecords = await mergeSelectedImageRecords(project, selectedImageIds);
  const selectedSet = new Set(selectedImageIds);
  const selectedIdentitySet = new Set(selectedRecords.map((image) => image.assetId ?? image.id));
  const preserved = project.generatedImages
    .filter((image) => !selectedIdentitySet.has(image.assetId ?? image.id))
    .map((image) => ({
      ...image,
      selected: selectedSet.has(image.assetId ?? image.id)
    }));
  return [...selectedRecords, ...preserved];
}

function upsertGeneratedImageVersion(
  project: PostProject,
  generatedImages: PostProject["generatedImages"],
  selectedImageIds: string[],
  label: string
): PostProject["generatedImageVersions"] {
  const selected = uniqueStrings(selectedImageIds);
  const existingVersions = project.generatedImageVersions ?? [];
  if (!selected.length) return existingVersions;
  const existing = existingVersions.find((version) => sameStringSet(version.selectedImageIds, selected));
  if (existing) return existingVersions;
  const selectedSet = new Set(selected);
  const selectedRecords = generatedImages.filter((image) => selectedSet.has(image.assetId ?? image.id));
  const promptVersionIds = uniqueStrings(selectedRecords.flatMap((image) => [image.promptVersionId, image.promptId].filter(Boolean) as string[]));
  const createdAt = new Date().toISOString();
  return [
    ...existingVersions,
    {
      id: `generated-images-${Date.now()}-${selected.join("-").slice(0, 32)}`,
      createdAt,
      label,
      imageIds: uniqueStrings(selectedRecords.map((image) => image.assetId ?? image.id)).length
        ? uniqueStrings(selectedRecords.map((image) => image.assetId ?? image.id))
        : selected,
      selectedImageIds: selected,
      promptVersionId: promptVersionIds[0],
      basedOnEvidenceIds: uniqueStrings(selectedRecords.flatMap((image) => image.basedOnEvidenceIds ?? [])),
      sourceAssetIds: uniqueStrings(selectedRecords.flatMap((image) => image.sourceAssetIds ?? []))
    }
  ];
}

function sameStringSet(left: string[], right: string[]): boolean {
  const leftSet = new Set(left.map(String).filter(Boolean));
  const rightSet = new Set(right.map(String).filter(Boolean));
  return leftSet.size === rightSet.size && [...leftSet].every((item) => rightSet.has(item));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map(String).map((value) => value.trim()).filter(Boolean))];
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
