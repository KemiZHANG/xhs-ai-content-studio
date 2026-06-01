import { describe, expect, it } from "vitest";
import { buildPageJobsSnapshotPlan } from "@/app/state/page-jobs";
import type { JobRecord, PostProject, WorkflowResult, WorkspaceState } from "@/app/types";

function workspace(id: string, recentJobIds: string[] = []): WorkspaceState {
  return {
    schemaVersion: 1,
    workspaceId: id,
    updatedAt: "2026-06-02T00:00:00.000Z",
    selectedSamples: [],
    selectedImageIds: [],
    productImageIds: [],
    recentJobIds,
    recentRunIds: [],
    recentConversationIds: [],
    publishPlan: null
  } as WorkspaceState;
}

function result(status: WorkflowResult["status"], extra: Partial<WorkflowResult> = {}): WorkflowResult {
  return {
    status,
    steps: [],
    samples: [],
    evidence: [],
    researchSummary: null,
    report: "",
    imageStyleReport: "",
    draft: null,
    images: [],
    publishResult: { skipped: true },
    ...extra
  } as WorkflowResult;
}

function job(input: Partial<JobRecord>): JobRecord {
  return {
    id: "job-1",
    type: "workflow",
    title: "research",
    status: "completed",
    progress: 100,
    createdAt: "2026-06-02T00:00:00.000Z",
    updatedAt: "2026-06-02T00:00:00.000Z",
    steps: [],
    ...input
  } as JobRecord;
}

describe("page jobs snapshot plan", () => {
  it("applies streamed workspace snapshots only when they belong to the current PostProject workspace", () => {
    const current = workspace("workspace-a", ["job-a"]);
    const streamed = workspace("workspace-b", ["job-b"]);
    const streamedProject = { id: "post-b" } as PostProject;

    const plan = buildPageJobsSnapshotPlan({
      nextJobs: [],
      streamedWorkspace: streamed,
      streamedPostProject: streamedProject,
      currentWorkspace: current,
      autoReturnJobId: null,
      autoReturnTarget: "flow",
      currentWorkflowResult: null
    });

    expect(plan.shouldApplyStreamedWorkspace).toBe(false);
    expect(plan.activeWorkspace).toBe(current);
    expect(plan.applyStreamedWorkspace).toBeUndefined();
    expect(plan.applyStreamedPostProject).toBeUndefined();
  });

  it("returns an auto-return plan when the watched job completes for the active workspace", () => {
    const draftResult = result("draft", { draft: { title: "t", content: "c", tags: [], structure: [], imagePrompt: "" } });
    const completed = job({ id: "job-a", workspaceId: "workspace-a", result: draftResult });

    const plan = buildPageJobsSnapshotPlan({
      nextJobs: [completed],
      currentWorkspace: workspace("workspace-a", ["job-a"]),
      autoReturnJobId: "job-a",
      autoReturnTarget: "flow",
      currentWorkflowResult: null
    });

    expect(plan.autoReturn).toMatchObject({
      job: completed,
      targetSection: "flow",
      reloadCurrentDraft: true
    });
    expect(plan.clearAutoReturn).toBe(true);
    expect(plan.autoReturn?.notice).toContain("研究完成");
  });

  it("clears stale auto-return jobs without importing another workspace result", () => {
    const completed = job({ id: "job-b", workspaceId: "workspace-b", result: result("research_ready") });

    const plan = buildPageJobsSnapshotPlan({
      nextJobs: [completed],
      currentWorkspace: workspace("workspace-a", ["job-a"]),
      autoReturnJobId: "job-b",
      autoReturnTarget: "flow",
      currentWorkflowResult: null
    });

    expect(plan.autoReturn).toBeUndefined();
    expect(plan.clearAutoReturn).toBe(true);
    expect(plan.latestResult).toBeUndefined();
  });

  it("keeps fresh research visible without replacing an existing draft workflow result", () => {
    const researchResult = result("research_ready", {
      evidence: [{ id: "sample-1", title: "sample" }] as WorkflowResult["evidence"]
    });
    const completed = job({ id: "job-a", workspaceId: "workspace-a", result: researchResult });

    const plan = buildPageJobsSnapshotPlan({
      nextJobs: [completed],
      currentWorkspace: workspace("workspace-a", ["job-a"]),
      autoReturnJobId: null,
      autoReturnTarget: "flow",
      currentWorkflowResult: result("draft")
    });

    expect(plan.latestResult).toMatchObject({
      job: completed,
      result: researchResult,
      target: "research"
    });
  });

  it("ignores completed draft jobs after a workflow result is already visible", () => {
    const completed = job({ id: "job-a", workspaceId: "workspace-a", result: result("draft") });

    const plan = buildPageJobsSnapshotPlan({
      nextJobs: [completed],
      currentWorkspace: workspace("workspace-a", ["job-a"]),
      autoReturnJobId: null,
      autoReturnTarget: "flow",
      currentWorkflowResult: result("draft")
    });

    expect(plan.latestResult).toBeUndefined();
  });
});
