import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { WorkspaceState } from "@/lib/agent/types";
import { syncPostProjectFromWorkspace } from "@/lib/post-project/store";
import { listAssets } from "@/lib/storage/assets";
import { listChatConversations } from "@/lib/storage/chat";
import { readCurrentDraft } from "@/lib/storage/drafts";
import { listHistory } from "@/lib/storage/history";
import { listJobs } from "@/lib/storage/jobs";

const WORKSPACE_SCHEMA_VERSION = 1 as const;
const globalForWorkspace = globalThis as typeof globalThis & {
  xhsWorkspaceWriteQueue?: Promise<unknown>;
};

const workspaceStatePath = () => path.join(process.cwd(), "data", "workspace-state.json");

export async function readWorkspaceState(): Promise<WorkspaceState> {
  try {
    const raw = await readFile(workspaceStatePath(), "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as WorkspaceState;
    if (parsed?.schemaVersion === WORKSPACE_SCHEMA_VERSION) {
      return normalizeWorkspaceState(parsed);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof SyntaxError)) {
      throw error;
    }
  }

  const initial = await createInitialWorkspaceState();
  await writeWorkspaceState(initial);
  return initial;
}

export async function writeWorkspaceState(state: WorkspaceState): Promise<WorkspaceState> {
  return queueWorkspaceWrite(async () => {
    const workspace = await writeWorkspaceStateNow(state);
    await syncPostProjectFromWorkspace(workspace);
    return workspace;
  });
}

async function writeWorkspaceStateNow(state: WorkspaceState): Promise<WorkspaceState> {
  const normalized = normalizeWorkspaceState({
    ...state,
    updatedAt: new Date().toISOString()
  });
  const filePath = workspaceStatePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  await renameWithRetry(tempPath, filePath);
  return normalized;
}

async function renameWithRetry(source: string, destination: string): Promise<void> {
  const attempts = 6;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await rename(source, destination);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!["EPERM", "EBUSY", "EACCES"].includes(code ?? "") || attempt === attempts) {
        throw error;
      }
      await delay(25 * attempt);
    }
  }
}

async function queueWorkspaceWrite<T>(operation: () => Promise<T>): Promise<T> {
  const previous = globalForWorkspace.xhsWorkspaceWriteQueue ?? Promise.resolve();
  const next = previous.then(operation, operation);
  globalForWorkspace.xhsWorkspaceWriteQueue = next.catch(() => undefined);
  return next;
}

export async function updateWorkspaceState(
  patch: Partial<Omit<WorkspaceState, "schemaVersion" | "workspaceId" | "updatedAt">>
): Promise<WorkspaceState> {
  const current = await readWorkspaceState();
  return writeWorkspaceState({
    ...current,
    ...normalizeWorkspacePatch(patch)
  });
}

export function createBlankWorkspaceState(seed: Partial<WorkspaceState> = {}): WorkspaceState {
  return normalizeWorkspaceState({
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    workspaceId: `workspace-${Date.now()}-${randomUUID().slice(0, 8)}`,
    updatedAt: new Date().toISOString(),
    topic: seed.topic,
    researchRunId: seed.researchRunId,
    evidenceSummary: seed.evidenceSummary,
    selectedSamples: Array.isArray(seed.selectedSamples) ? seed.selectedSamples : [],
    currentDraftId: seed.currentDraftId,
    currentDraft: seed.currentDraft ?? null,
    selectedImageIds: Array.isArray(seed.selectedImageIds) ? seed.selectedImageIds : [],
    productImageIds: Array.isArray(seed.productImageIds) ? seed.productImageIds : [],
    publishPlan: seed.publishPlan ?? null,
    lastUserIntent: seed.lastUserIntent,
    recentJobIds: Array.isArray(seed.recentJobIds) ? seed.recentJobIds : [],
    recentRunIds: Array.isArray(seed.recentRunIds) ? seed.recentRunIds : [],
    recentConversationIds: Array.isArray(seed.recentConversationIds) ? seed.recentConversationIds : []
  });
}

export async function resetWorkspaceState(seed: Partial<WorkspaceState> = {}): Promise<WorkspaceState> {
  return writeWorkspaceState(createBlankWorkspaceState(seed));
}

async function createInitialWorkspaceState(): Promise<WorkspaceState> {
  const [currentDraft, history, assets, jobs, conversations] = await Promise.all([
    readCurrentDraft().catch(() => null),
    listHistory().catch(() => []),
    listAssets().catch(() => []),
    listJobs().catch(() => []),
    listChatConversations().catch(() => [])
  ]);
  const latestResearch = history.find((run) => run.result?.researchSummary || run.result?.evidence?.length) ?? history[0];

  return normalizeWorkspaceState({
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    workspaceId: "local-default",
    updatedAt: new Date().toISOString(),
    topic: latestResearch?.input?.topic,
    researchRunId: latestResearch?.id,
    evidenceSummary: latestResearch?.result?.researchSummary ?? null,
    selectedSamples: latestResearch?.result?.evidence ?? [],
    currentDraftId: currentDraft?.id,
    currentDraft,
    selectedImageIds: [],
    productImageIds: assets.filter((asset) => asset.kind === "upload").map((asset) => asset.id),
    publishPlan: null,
    lastUserIntent: undefined,
    recentJobIds: jobs.map((job) => job.id).slice(0, 20),
    recentRunIds: history.map((run) => run.id).slice(0, 20),
    recentConversationIds: conversations.map((conversation) => conversation.id).slice(0, 20)
  });
}

function normalizeWorkspaceState(state: WorkspaceState): WorkspaceState {
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    workspaceId: state.workspaceId || "local-default",
    updatedAt: state.updatedAt || new Date().toISOString(),
    topic: state.topic,
    researchRunId: state.researchRunId,
    evidenceSummary: state.evidenceSummary,
    selectedSamples: Array.isArray(state.selectedSamples) ? state.selectedSamples : [],
    currentDraftId: state.currentDraftId,
    currentDraft: state.currentDraft ?? null,
    selectedImageIds: Array.isArray(state.selectedImageIds) ? state.selectedImageIds : [],
    productImageIds: Array.isArray(state.productImageIds) ? state.productImageIds : [],
    publishPlan: state.publishPlan ?? null,
    lastUserIntent: state.lastUserIntent,
    recentJobIds: Array.isArray(state.recentJobIds) ? state.recentJobIds : [],
    recentRunIds: Array.isArray(state.recentRunIds) ? state.recentRunIds : [],
    recentConversationIds: Array.isArray(state.recentConversationIds) ? state.recentConversationIds : []
  };
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

function normalizeWorkspacePatch(
  patch: Partial<Omit<WorkspaceState, "schemaVersion" | "workspaceId" | "updatedAt">>
): Partial<WorkspaceState> {
  const normalized = stripUndefined(patch);
  if (Object.prototype.hasOwnProperty.call(patch, "currentDraft") && patch.currentDraft === null) {
    normalized.currentDraft = null;
    normalized.currentDraftId = undefined;
  }
  return normalized as Partial<WorkspaceState>;
}
