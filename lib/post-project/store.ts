import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { WorkspaceState } from "@/lib/agent/types";
import { readWorkspaceState } from "@/lib/agent/state";
import { insightsFromResearchSummary } from "@/lib/post-project/evidence";
import {
  copyVersionFromDraft,
  deriveCreativeBrief,
  deriveFinalPost,
  deriveImagePromptVersion,
  deriveVisualDirection
} from "@/lib/post-project/brief";
import { runPostQualityGate } from "@/lib/post-project/quality";
import { inferPostStage, withAllowedActions } from "@/lib/post-project/stage-machine";
import type { PostProject } from "@/lib/post-project/types";
import type { ResearchSummary, SampleEvidence } from "@/lib/workflows/one-click";

const POST_PROJECT_SCHEMA_VERSION = 1 as const;
const globalForPostProject = globalThis as typeof globalThis & {
  xhsPostProjectWriteQueue?: Promise<unknown>;
};

const postProjectPath = () => path.join(process.cwd(), "data", "post-project.json");

export async function readPostProject(): Promise<PostProject> {
  try {
    const raw = await readFile(postProjectPath(), "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as PostProject;
    if (parsed?.schemaVersion === POST_PROJECT_SCHEMA_VERSION) {
      return normalizePostProject(parsed);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof SyntaxError)) {
      throw error;
    }
  }

  const project = postProjectFromWorkspace(await readWorkspaceState());
  await writePostProject(project);
  return project;
}

export async function writePostProject(project: PostProject): Promise<PostProject> {
  return queuePostProjectWrite(async () => writePostProjectNow(project));
}

export async function syncPostProjectFromWorkspace(workspace: WorkspaceState): Promise<PostProject> {
  const migrated = postProjectFromWorkspace(workspace);
  const existing = await readExistingPostProject();
  if (!existing || existing.id !== migrated.id) {
    return writePostProject(migrated);
  }
  return writePostProject(mergePostProjects(existing, migrated));
}

export async function updatePostProject(
  patch: Partial<Omit<PostProject, "schemaVersion" | "id" | "updatedAt" | "allowedActions">>
): Promise<PostProject> {
  const current = await readPostProject();
  return writePostProject({
    ...current,
    ...stripUndefined(patch)
  });
}

export async function resetPostProject(seed: Partial<PostProject> = {}): Promise<PostProject> {
  return writePostProject(createBlankPostProject(seed));
}

export function createBlankPostProject(seed: Partial<PostProject> = {}): PostProject {
  return normalizePostProject({
    schemaVersion: POST_PROJECT_SCHEMA_VERSION,
    id: seed.id || `post-${Date.now()}-${randomUUID().slice(0, 8)}`,
    topic: seed.topic,
    productInfo: seed.productInfo ?? { referenceAssetIds: [] },
    targetAudience: seed.targetAudience,
    goal: seed.goal,
    tone: seed.tone,
    evidencePack: seed.evidencePack ?? { sampleIds: [], insights: [] },
    selectedSamples: Array.isArray(seed.selectedSamples) ? seed.selectedSamples : [],
    creativeBrief: seed.creativeBrief,
    copyDraft: seed.copyDraft ?? null,
    copyVersions: Array.isArray(seed.copyVersions) ? seed.copyVersions : [],
    visualDirection: seed.visualDirection,
    imagePrompts: Array.isArray(seed.imagePrompts) ? seed.imagePrompts : [],
    generatedImages: Array.isArray(seed.generatedImages) ? seed.generatedImages : [],
    selectedImages: Array.isArray(seed.selectedImages) ? seed.selectedImages : [],
    finalPost: seed.finalPost,
    publishPlan: seed.publishPlan ?? null,
    agentMemory: Array.isArray(seed.agentMemory) ? seed.agentMemory : [],
    auditStatus: seed.auditStatus ?? "unchecked",
    qualityCheck: seed.qualityCheck,
    currentStage: seed.currentStage ?? "empty",
    allowedActions: [],
    updatedAt: seed.updatedAt ?? new Date().toISOString()
  });
}

export function postProjectFromWorkspace(workspace: WorkspaceState): PostProject {
  const samples = Array.isArray(workspace.selectedSamples) ? workspace.selectedSamples : [];
  const summary = workspace.evidenceSummary as ResearchSummary | null | undefined;
  const insights = insightsFromResearchSummary(summary, samples);
  const evidenceIds = insights.map((insight) => insight.id);
  const copyVersions = workspace.currentDraft ? [copyVersionFromDraft(workspace.currentDraft, evidenceIds)] : [];

  const base = normalizePostProject({
    schemaVersion: POST_PROJECT_SCHEMA_VERSION,
    id: workspace.workspaceId === "local-default" ? "post-local-default" : workspace.workspaceId.replace(/^workspace-/, "post-"),
    topic: workspace.topic,
    productInfo: { referenceAssetIds: workspace.productImageIds },
    evidencePack: {
      runId: workspace.researchRunId,
      sampleIds: samples
        .map((sample) => (isRecord(sample) && typeof sample.id === "string" ? sample.id : undefined))
        .filter((id): id is string => Boolean(id)),
      insights,
      summary: workspace.evidenceSummary ?? undefined,
      updatedAt: workspace.updatedAt
    },
    selectedSamples: samples as SampleEvidence[] | unknown[],
    copyDraft: workspace.currentDraft ?? null,
    copyVersions,
    imagePrompts: [],
    generatedImages: workspace.selectedImageIds.map((id) => ({
      id,
      assetId: id,
      createdAt: workspace.updatedAt,
      selected: true
    })),
    selectedImages: workspace.selectedImageIds,
    publishPlan: workspace.publishPlan ?? null,
    agentMemory: [],
    auditStatus: workspace.publishPlan ? "unchecked" : "unchecked",
    currentStage: inferPostStage({
      topic: workspace.topic,
      selectedSamples: samples,
      evidencePack: { sampleIds: [], insights },
      copyDraft: workspace.currentDraft,
      generatedImages: workspace.selectedImageIds.map((id) => ({ id, createdAt: workspace.updatedAt })),
      selectedImages: workspace.selectedImageIds,
      publishPlan: workspace.publishPlan ?? null
    }),
    allowedActions: [],
    updatedAt: workspace.updatedAt
  });
  return enrichPostProject(base);
}

function normalizePostProject(project: PostProject): PostProject {
  const inferredStage = inferPostStage(project);
  const currentStage = !project.currentStage || (project.currentStage === "empty" && inferredStage !== "empty")
    ? inferredStage
    : project.currentStage;
  const normalized = withAllowedActions({
    schemaVersion: POST_PROJECT_SCHEMA_VERSION,
    id: project.id || `post-${Date.now()}-${randomUUID().slice(0, 8)}`,
    topic: project.topic,
    productInfo: {
      ...project.productInfo,
      referenceAssetIds: Array.isArray(project.productInfo?.referenceAssetIds)
        ? project.productInfo.referenceAssetIds
        : []
    },
    targetAudience: project.targetAudience,
    goal: project.goal,
    tone: project.tone,
    evidencePack: {
      runId: project.evidencePack?.runId,
      sampleIds: Array.isArray(project.evidencePack?.sampleIds) ? project.evidencePack.sampleIds : [],
      insights: Array.isArray(project.evidencePack?.insights) ? project.evidencePack.insights : [],
      summary: project.evidencePack?.summary,
      updatedAt: project.evidencePack?.updatedAt
    },
    selectedSamples: Array.isArray(project.selectedSamples) ? project.selectedSamples : [],
    creativeBrief: project.creativeBrief,
    copyDraft: project.copyDraft ?? null,
    copyVersions: Array.isArray(project.copyVersions) ? project.copyVersions : [],
    visualDirection: project.visualDirection,
    imagePrompts: Array.isArray(project.imagePrompts) ? project.imagePrompts : [],
    generatedImages: Array.isArray(project.generatedImages) ? project.generatedImages : [],
    selectedImages: Array.isArray(project.selectedImages) ? project.selectedImages : [],
    finalPost: project.finalPost,
    publishPlan: project.publishPlan ?? null,
    agentMemory: Array.isArray(project.agentMemory) ? project.agentMemory : [],
    auditStatus: project.auditStatus ?? "unchecked",
    qualityCheck: project.qualityCheck,
    currentStage,
    updatedAt: project.updatedAt || new Date().toISOString()
  });

  return {
    ...normalized,
    updatedAt: normalized.updatedAt || new Date().toISOString()
  };
}

function enrichPostProject(project: PostProject): PostProject {
  const creativeBrief = deriveCreativeBrief(project);
  const withBrief = {
    ...project,
    creativeBrief
  };
  const visualDirection = deriveVisualDirection(withBrief);
  const imagePrompt = deriveImagePromptVersion({
    ...withBrief,
    visualDirection,
    imagePrompts: project.imagePrompts
  });
  const imagePrompts = imagePrompt ? [...project.imagePrompts, imagePrompt] : project.imagePrompts;
  const finalPost = deriveFinalPost({
    copyDraft: withBrief.copyDraft,
    selectedImages: withBrief.selectedImages,
    imagePrompts,
    finalPost: project.finalPost
  });
  const qualityCheck = finalPost
    ? runPostQualityGate({
        ...withBrief,
        visualDirection,
        finalPost,
        selectedImages: project.selectedImages
      })
    : project.qualityCheck;

  return normalizePostProject({
    ...withBrief,
    visualDirection,
    imagePrompts,
    finalPost,
    qualityCheck,
    auditStatus: qualityCheck ? (qualityCheck.canPublish ? "passed" : "blocked") : project.auditStatus
  });
}

function mergePostProjects(existing: PostProject, migrated: PostProject): PostProject {
  const migratedCopyIds = new Set(migrated.copyVersions.map((version) => version.id));
  const migratedPromptIds = new Set(migrated.imagePrompts.map((version) => version.id));
  const merged = normalizePostProject({
    ...existing,
    topic: migrated.topic ?? existing.topic,
    productInfo: {
      ...existing.productInfo,
      ...migrated.productInfo,
      referenceAssetIds: uniqueIds([
        ...existing.productInfo.referenceAssetIds,
        ...migrated.productInfo.referenceAssetIds
      ])
    },
    evidencePack: migrated.evidencePack.insights.length || migrated.evidencePack.sampleIds.length ? migrated.evidencePack : existing.evidencePack,
    selectedSamples: migrated.selectedSamples.length ? migrated.selectedSamples : existing.selectedSamples,
    creativeBrief: existing.creativeBrief ?? migrated.creativeBrief,
    copyDraft: migrated.copyDraft ?? existing.copyDraft,
    copyVersions: [
      ...existing.copyVersions.filter((version) => !migratedCopyIds.has(version.id)),
      ...migrated.copyVersions
    ],
    visualDirection: existing.visualDirection ?? migrated.visualDirection,
    imagePrompts: [
      ...existing.imagePrompts.filter((version) => !migratedPromptIds.has(version.id)),
      ...migrated.imagePrompts
    ],
    generatedImages: mergeImages(existing.generatedImages, migrated.generatedImages),
    selectedImages: migrated.selectedImages.length ? migrated.selectedImages : existing.selectedImages,
    finalPost: migrated.copyDraft || migrated.selectedImages.length ? undefined : existing.finalPost,
    publishPlan: migrated.publishPlan ?? existing.publishPlan,
    currentStage: migrated.currentStage,
    updatedAt: migrated.updatedAt
  });
  return enrichPostProject(merged);
}

async function writePostProjectNow(project: PostProject): Promise<PostProject> {
  const normalized = normalizePostProject({
    ...project,
    updatedAt: new Date().toISOString()
  });
  const filePath = postProjectPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
  return normalized;
}

async function readExistingPostProject(): Promise<PostProject | null> {
  try {
    const raw = await readFile(postProjectPath(), "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as PostProject;
    return parsed?.schemaVersion === POST_PROJECT_SCHEMA_VERSION ? normalizePostProject(parsed) : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof SyntaxError)) {
      throw error;
    }
    return null;
  }
}

async function queuePostProjectWrite<T>(operation: () => Promise<T>): Promise<T> {
  const previous = globalForPostProject.xhsPostProjectWriteQueue ?? Promise.resolve();
  const next = previous.then(operation, operation);
  globalForPostProject.xhsPostProjectWriteQueue = next.catch(() => undefined);
  return next;
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

function mergeImages<T extends { id: string }>(existing: T[], next: T[]): T[] {
  const ids = new Set(next.map((image) => image.id));
  return [...existing.filter((image) => !ids.has(image.id)), ...next];
}
