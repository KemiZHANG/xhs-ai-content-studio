import type { JobRecord, PostProject, Section, WorkflowResult, WorkspaceState } from "@/app/types";
import { canApplyWorkspaceSnapshot, isJobForWorkspace } from "@/lib/jobs/context";

export type PageJobsSnapshotPlan = {
  shouldApplyStreamedWorkspace: boolean;
  activeWorkspace: WorkspaceState | null;
  applyStreamedWorkspace?: WorkspaceState;
  applyStreamedPostProject?: PostProject;
  autoReturn?: {
    job: JobRecord;
    targetSection: Extract<Section, "flow" | "chat">;
    notice: string;
    reloadCurrentDraft: boolean;
  };
  clearAutoReturn: boolean;
  latestResult?: {
    job: JobRecord;
    result: WorkflowResult;
    target: "workflow" | "research";
  };
};

export function buildPageJobsSnapshotPlan({
  nextJobs,
  streamedWorkspace,
  streamedPostProject,
  currentWorkspace,
  autoReturnJobId,
  autoReturnTarget,
  currentWorkflowResult
}: {
  nextJobs: JobRecord[];
  streamedWorkspace?: WorkspaceState;
  streamedPostProject?: PostProject;
  currentWorkspace: WorkspaceState | null;
  autoReturnJobId: string | null;
  autoReturnTarget: Extract<Section, "flow" | "chat">;
  currentWorkflowResult: WorkflowResult | null;
}): PageJobsSnapshotPlan {
  const shouldApplyStreamedWorkspace = canApplyWorkspaceSnapshot(streamedWorkspace, currentWorkspace);
  const activeWorkspace = shouldApplyStreamedWorkspace && streamedWorkspace ? streamedWorkspace : currentWorkspace;
  const activeRecentJobIds = activeWorkspace?.recentJobIds;
  const autoReturnJob = autoReturnJobId ? nextJobs.find((job) => job.id === autoReturnJobId) : null;

  if (autoReturnJob?.status === "completed" && autoReturnJob.result && isJobForWorkspace(autoReturnJob, activeWorkspace)) {
    return {
      shouldApplyStreamedWorkspace,
      activeWorkspace,
      applyStreamedWorkspace: shouldApplyStreamedWorkspace ? streamedWorkspace : undefined,
      applyStreamedPostProject: shouldApplyStreamedWorkspace ? streamedPostProject : undefined,
      autoReturn: {
        job: autoReturnJob,
        targetSection: autoReturnTarget,
        notice: "研究完成，已回到结果页。可以继续进入文案创作或图片创作。",
        reloadCurrentDraft: Boolean(autoReturnJob.result.draft)
      },
      clearAutoReturn: true
    };
  }

  const clearAutoReturn = Boolean(
    autoReturnJob?.status === "failed" ||
      (autoReturnJob?.status === "completed" && !isJobForWorkspace(autoReturnJob, activeWorkspace))
  );

  const latestCompleted = nextJobs.find((job) => job.status === "completed" && job.result && isJobForWorkspace(job, activeWorkspace));
  const latestResult =
    latestCompleted && (!activeRecentJobIds || activeRecentJobIds.includes(latestCompleted.id))
      ? buildLatestResultPlan(latestCompleted, currentWorkflowResult)
      : undefined;

  return {
    shouldApplyStreamedWorkspace,
    activeWorkspace,
    applyStreamedWorkspace: shouldApplyStreamedWorkspace ? streamedWorkspace : undefined,
    applyStreamedPostProject: shouldApplyStreamedWorkspace ? streamedPostProject : undefined,
    clearAutoReturn,
    latestResult
  };
}

function buildLatestResultPlan(job: JobRecord, currentWorkflowResult: WorkflowResult | null): PageJobsSnapshotPlan["latestResult"] {
  if (!job.result) return undefined;
  if (!currentWorkflowResult) {
    return { job, result: job.result, target: "workflow" };
  }
  if (job.result.status === "research_ready" || job.result.researchSummary) {
    return { job, result: job.result, target: "research" };
  }
  return undefined;
}
