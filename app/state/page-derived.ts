import type { DraftRecord, JobRecord, WorkflowResult, WorkspaceState } from "@/app/types";

export type WorkflowRibbonState = {
  researchReady: boolean;
  draftReady: boolean;
  imageReady: boolean;
  publishReady: boolean;
  runningCount: number;
};

export function selectActiveJob(jobs: JobRecord[], activeJobId: string | null): JobRecord | undefined {
  return jobs.find((job) => job.id === activeJobId) ?? jobs[0];
}

export function hasRunningJobs(jobs: JobRecord[]): boolean {
  return jobs.some((job) => job.status === "queued" || job.status === "running");
}

export function selectWorkflowResultForDisplay({
  workflowResult,
  researchResult
}: {
  workflowResult: WorkflowResult | null;
  researchResult: WorkflowResult | null;
}): WorkflowResult | null {
  return workflowResult?.status === "research_ready" ? workflowResult : researchResult ?? workflowResult;
}

export function buildWorkflowRibbonState({
  researchResult,
  workflowResult,
  workspace,
  currentDraft,
  publishAssetIds,
  workflowAssetIds,
  jobs
}: {
  researchResult: WorkflowResult | null;
  workflowResult: WorkflowResult | null;
  workspace: WorkspaceState | null;
  currentDraft: DraftRecord | null;
  publishAssetIds: string[];
  workflowAssetIds: string[];
  jobs: JobRecord[];
}): WorkflowRibbonState {
  return {
    researchReady: Boolean(
      researchResult?.evidence?.length ||
        workflowResult?.evidence?.length ||
        (Array.isArray(workspace?.selectedSamples) && workspace.selectedSamples.length)
    ),
    draftReady: Boolean(currentDraft || workflowResult?.draft),
    imageReady: Boolean(
      publishAssetIds.length ||
        workflowAssetIds.length ||
        workspace?.selectedImageIds.length ||
        currentDraft?.images?.length
    ),
    publishReady: Boolean(
      workspace?.publishPlan && !["blocked", "failed"].includes(workspace.publishPlan.status ?? "")
    ),
    runningCount: jobs.filter((job) => job.status === "queued" || job.status === "running").length
  };
}

