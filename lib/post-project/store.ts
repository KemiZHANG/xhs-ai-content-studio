import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
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
import type { EvidenceInsight, PostProject } from "@/lib/post-project/types";
import { viralCasesToEvidenceInsights } from "@/lib/viral-knowledge/store";
import type { ViralCase } from "@/lib/viral-knowledge/types";
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
  if (!existing) {
    return writePostProject(migrated);
  }
  if (existing.id !== migrated.id && shouldPreserveExistingProjectOnWorkspaceSync(existing, migrated)) {
    return writePostProject(mergePostProjects(existing, migrated));
  }
  if (existing.id !== migrated.id) {
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
    ...normalizePatchForExplicitClears(patch)
  });
}

export async function resetPostProject(seed: Partial<PostProject> = {}): Promise<PostProject> {
  return writePostProject(createBlankPostProject(seed));
}

export async function addViralCasesToPostProject(cases: ViralCase[]): Promise<PostProject> {
  const result = await addViralCasesToPostProjectWithSummary(cases);
  return result.project;
}

export async function addViralCasesToPostProjectWithSummary(cases: ViralCase[]): Promise<{
  project: PostProject;
  addedInsightIds: string[];
  addedInsights: EvidenceInsight[];
  addedSampleIds: string[];
}> {
  if (!cases.length) {
    return {
      project: await readPostProject(),
      addedInsightIds: [],
      addedInsights: [],
      addedSampleIds: []
    };
  }
  const current = await readPostProject();
  const existingInsightKeys = new Set(current.evidencePack.insights.map(viralInsightKey));
  const existingInsightIds = new Set(current.evidencePack.insights.map((insight) => insight.id));
  const existingSampleIds = new Set(current.evidencePack.sampleIds);
  const incomingInsights = viralCasesToEvidenceInsights(cases)
    .filter((insight) => {
      const key = viralInsightKey(insight);
      if (existingInsightKeys.has(key)) return false;
      existingInsightKeys.add(key);
      return true;
    });
  const sampleIds = uniqueIds([
    ...current.evidencePack.sampleIds,
    ...cases.map((item) => item.id)
  ]);
  const evidencePack = {
    ...current.evidencePack,
    sampleIds,
    insights: [...current.evidencePack.insights, ...incomingInsights],
    summary: mergeSavedViralCasesSummary(current.evidencePack.summary, cases),
    updatedAt: new Date().toISOString()
  };
  const candidate = {
    ...current,
    evidencePack,
    selectedSamples: current.selectedSamples,
    creativeBrief: undefined,
    visualDirection: undefined,
    qualityCheck: undefined,
    auditStatus: "unchecked" as const
  };
  const creativeBrief = deriveCreativeBrief(candidate);
  const project = await updatePostProject({
    evidencePack,
    creativeBrief,
    visualDirection: undefined,
    imagePrompts: [],
    finalPost: undefined,
    qualityCheck: undefined,
    auditStatus: "unchecked",
    currentStage: creativeBrief ? "brief_ready" : "evidence_ready"
  });
  const addedInsights = project.evidencePack.insights.filter(
    (insight) => insight.sourceType === "viral_library" && !existingInsightIds.has(insight.id)
  );
  return {
    project,
    addedInsights,
    addedInsightIds: addedInsights.map((insight) => insight.id),
    addedSampleIds: project.evidencePack.sampleIds.filter((id) => !existingSampleIds.has(id))
  };
}

export async function appendPostProjectMemoryFromTurn({
  message,
  currentDraft
}: {
  message: string;
  currentDraft?: { draft?: { title?: string } } | null;
}): Promise<PostProject> {
  const current = await readPostProject();
  const items = extractProjectMemoryItems(message, currentDraft);
  if (!items.length) {
    return current;
  }
  const existing = new Set(current.agentMemory.map(normalizeMemoryText));
  const nextItems = items.filter((item) => {
    const key = normalizeMemoryText(item);
    if (!key || existing.has(key)) return false;
    existing.add(key);
    return true;
  });
  if (!nextItems.length) {
    return current;
  }
  return updatePostProject({
    agentMemory: [...nextItems, ...current.agentMemory].slice(0, 20)
  });
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
    focusedEvidenceIds: Array.isArray(seed.focusedEvidenceIds) ? seed.focusedEvidenceIds : [],
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

function extractProjectMemoryItems(message: string, currentDraft?: { draft?: { title?: string } } | null): string[] {
  const text = message.replace(/\s+/g, " ").trim();
  if (!text) return [];
  const matches = [
    ...matchMemory(text, /(我喜欢|更喜欢|满意|保持|就要这种)([^。！？!?]{2,80})/g),
    ...matchMemory(text, /(不喜欢|不要再|避免|别再|太像广告|太营销|太夸张|这个不对)([^。！？!?]{2,80})/g),
    ...matchMemory(text, /(语气|口吻|风格|调性|目标人群|产品|卖点|禁忌词)([^。！？!?]{2,100})/g)
  ];
  if (currentDraft?.draft?.title && /(满意|就用|可以|定稿|保持)/.test(text)) {
    matches.push(`用户认可当前草稿：${currentDraft.draft.title}`);
  }
  return uniqueIds(matches.map((item) => item.slice(0, 120))).slice(0, 5);
}

function matchMemory(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].map((match) => match[0].trim()).filter(Boolean);
}

function normalizeMemoryText(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase();
}

export function postProjectFromWorkspace(workspace: WorkspaceState): PostProject {
  const samples = Array.isArray(workspace.selectedSamples) ? workspace.selectedSamples : [];
  const summary = workspace.evidenceSummary as ResearchSummary | null | undefined;
  const viralCases = extractViralCasesFromSummary(summary);
  const insights = [
    ...insightsFromResearchSummary(summary, samples, "realtime"),
    ...viralCasesToEvidenceInsights(viralCases)
  ];
  const evidenceIds = insights.map((insight) => insight.id);
  const currentDraft = workspace.currentDraft ? withDraftEvidenceIds(workspace.currentDraft, evidenceIds) : null;
  const copyVersions = currentDraft ? [copyVersionFromDraft(currentDraft, evidenceIds)] : [];

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
    focusedEvidenceIds: [],
    selectedSamples: samples as SampleEvidence[] | unknown[],
    copyDraft: currentDraft,
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

function extractViralCasesFromSummary(summary: ResearchSummary | null | undefined) {
  const value = (summary as { viralKnowledge?: { results?: Array<{ case?: unknown }> } } | null | undefined)?.viralKnowledge;
  return Array.isArray(value?.results)
    ? value.results.map((item) => item.case).filter((item): item is ViralCase => isRecord(item))
    : [];
}

function normalizeFocusedEvidenceIds(value: unknown, insights: Array<{ id?: unknown }>): string[] {
  const validIds = new Set(insights.map((insight) => insight.id).filter((id): id is string => typeof id === "string"));
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).map((id) => id.trim()).filter(Boolean))]
    .filter((id) => !validIds.size || validIds.has(id))
    .slice(0, 8);
}

function normalizePostProject(project: PostProject): PostProject {
  const inferredStage = inferPostStage(project);
  const currentStage = !project.currentStage || shouldAdvanceStage(project.currentStage, inferredStage)
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
    focusedEvidenceIds: normalizeFocusedEvidenceIds(project.focusedEvidenceIds, project.evidencePack?.insights ?? []),
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

function shouldAdvanceStage(current: PostProject["currentStage"], inferred: PostProject["currentStage"]): boolean {
  if (current === inferred) return false;
  if (current === "failed") return false;
  return stageRank(inferred) > stageRank(current);
}

function stageRank(stage: PostProject["currentStage"]): number {
  const ranks: Record<PostProject["currentStage"], number> = {
    empty: 0,
    briefing: 1,
    researching: 2,
    evidence_ready: 3,
    brief_ready: 4,
    copy_drafting: 5,
    copy_ready: 6,
    visual_planning: 7,
    image_prompt_ready: 8,
    image_generating: 9,
    image_ready: 10,
    assembling: 11,
    reviewing: 12,
    scheduled: 13,
    published: 14,
    failed: 15
  };
  return ranks[stage] ?? 0;
}

function shouldPreserveExistingProjectOnWorkspaceSync(existing: PostProject, migrated: PostProject): boolean {
  return hasProjectWork(existing) && !hasWorkspaceAuthoredProjectContent(migrated);
}

function hasProjectWork(project: PostProject): boolean {
  return Boolean(
    project.topic ||
      project.targetAudience ||
      project.goal ||
      project.tone ||
      project.evidencePack.insights.length ||
      project.evidencePack.sampleIds.length ||
      project.selectedSamples.length ||
      project.creativeBrief ||
      project.copyDraft ||
      project.copyVersions.length ||
      project.visualDirection ||
      project.imagePrompts.length ||
      project.generatedImages.length ||
      project.selectedImages.length ||
      project.finalPost ||
      project.publishPlan ||
      project.agentMemory.length
  );
}

function hasWorkspaceAuthoredProjectContent(project: PostProject): boolean {
  return Boolean(
    project.evidencePack.insights.length ||
      project.evidencePack.sampleIds.length ||
      project.selectedSamples.length ||
      project.copyDraft ||
      project.copyVersions.length ||
      project.generatedImages.length ||
      project.selectedImages.length ||
      project.finalPost ||
      project.publishPlan
  );
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

function viralInsightKey(insight: { type: string; sourceSampleIds: string[]; insight: string }): string {
  return `${insight.type}|${insight.sourceSampleIds.join(",")}|${insight.insight}`;
}

function mergeSavedViralCasesSummary(summary: unknown, cases: ViralCase[]): unknown {
  const existingSummary = isRecord(summary) ? summary : {};
  const existingViral = isRecord(existingSummary.viralKnowledge) ? existingSummary.viralKnowledge : {};
  const existingResults = Array.isArray(existingViral.results) ? existingViral.results : [];
  const existingIds = new Set(
    existingResults
      .map((item) => (isRecord(item) && isRecord(item.case) && typeof item.case.id === "string" ? item.case.id : undefined))
      .filter(Boolean)
  );
  const savedResults = cases
    .filter((item) => !existingIds.has(item.id))
    .map((item) => ({
      case: item,
      score: 1,
      reasons: ["手动保存到爆款库"],
      matchedQueries: ["manual-save"]
    }));
  return {
    ...existingSummary,
    viralKnowledge: {
      ...existingViral,
      results: [...savedResults, ...existingResults].slice(0, 20),
      insights: [
        ...(Array.isArray(existingViral.insights) ? existingViral.insights : []),
        ...viralCasesToEvidenceInsights(cases)
      ].slice(0, 80),
      sufficiency: isRecord(existingViral.sufficiency)
        ? existingViral.sufficiency
        : {
            isEnough: cases.length >= 2,
            missing: cases.length >= 2 ? [] : ["爆款库匹配样本不足 2 条"],
            recommendation: cases.length >= 2 ? "已保存多个历史爆款规律，可辅助创作。" : "建议继续保存更多高质量样本，提升 RAG 参考多样性。",
            viralCount: cases.length
          }
    }
  };
}

function withDraftEvidenceIds(draft: WorkspaceState["currentDraft"], evidenceIds: string[]): NonNullable<WorkspaceState["currentDraft"]> | null {
  if (!draft) return null;
  if (Array.isArray(draft.draft.basedOnEvidenceIds) && draft.draft.basedOnEvidenceIds.length) {
    return draft;
  }
  return {
    ...draft,
    draft: {
      ...draft.draft,
      basedOnEvidenceIds: evidenceIds.slice(0, 8),
      evidenceReferences: {
        title: evidenceIds.slice(0, 3),
        content: evidenceIds.slice(0, 5),
        tags: evidenceIds.slice(0, 5),
        imagePrompt: evidenceIds.slice(0, 5)
      }
    }
  };
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
  await rm(filePath, { force: true }).catch(() => undefined);
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

function normalizePatchForExplicitClears(
  patch: Partial<Omit<PostProject, "schemaVersion" | "id" | "updatedAt" | "allowedActions">>
): Partial<PostProject> {
  const normalized = stripUndefined(patch);
  for (const key of ["creativeBrief", "visualDirection", "finalPost", "qualityCheck"] as const) {
    if (Object.prototype.hasOwnProperty.call(patch, key) && patch[key] === undefined) {
      normalized[key] = undefined;
    }
  }
  return normalized as Partial<PostProject>;
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
