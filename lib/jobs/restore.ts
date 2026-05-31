import { resetWorkspaceState } from "@/lib/agent/state";
import { syncPostProjectFromWorkspace } from "@/lib/post-project/store";
import { createDraftRecord, writeCurrentDraft } from "@/lib/storage/drafts";
import { readSettings } from "@/lib/storage/settings";
import type { JobRecord } from "@/lib/storage/jobs";
import type { GeneratedDraft, OneClickInput, OneClickResult } from "@/lib/workflows/one-click";

export async function restoreJobResultAsWorkspace(job: JobRecord) {
  const result = parseWorkflowResult(job.result);
  if (!result) {
    throw new Error("Job does not contain a restorable workflow result");
  }

  const input = parseOneClickInput(job.input);
  const settings = await readSettings();
  const draft = parseGeneratedDraft(result.draft);
  const currentDraft = draft
    ? await writeCurrentDraft(
        createDraftRecord({
          draft,
          images: Array.isArray(result.images) ? result.images : [],
          visibility: input?.visibility ?? settings.defaultVisibility,
          input,
          runId: `restored-from-${job.id}`
        })
      )
    : null;

  if (!draft) {
    await writeCurrentDraft(null);
  }

  const workspace = await resetWorkspaceState({
    topic: input?.topic ?? inferTopicFromJob(job),
    researchRunId: `restored-from-${job.id}`,
    evidenceSummary: result.researchSummary ?? null,
    selectedSamples: Array.isArray(result.evidence) ? result.evidence : [],
    currentDraftId: currentDraft?.id,
    currentDraft,
    selectedImageIds: [],
    productImageIds: Array.isArray(input?.assetIds) ? input.assetIds : [],
    publishPlan: null,
    lastUserIntent: "restore_job_result",
    recentJobIds: [job.id]
  });
  const postProject = await syncPostProjectFromWorkspace(workspace);

  return {
    workspace,
    postProject,
    workflowResult: result
  };
}

function parseWorkflowResult(value: unknown): OneClickResult | null {
  if (!isRecord(value)) {
    return null;
  }

  return value as OneClickResult;
}

function parseOneClickInput(value: unknown): OneClickInput | undefined {
  return isRecord(value) ? (value as OneClickInput) : undefined;
}

function parseGeneratedDraft(value: unknown): GeneratedDraft | null {
  if (!isRecord(value) || typeof value.title !== "string" || typeof value.content !== "string" || !Array.isArray(value.tags)) {
    return null;
  }

  return value as GeneratedDraft;
}

function inferTopicFromJob(job: JobRecord): string | undefined {
  if (isRecord(job.input) && typeof job.input.topic === "string") {
    return job.input.topic;
  }

  return job.title;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
