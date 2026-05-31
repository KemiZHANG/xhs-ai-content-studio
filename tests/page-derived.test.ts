import { describe, expect, it } from "vitest";
import {
  buildWorkflowRibbonState,
  hasRunningJobs,
  selectActiveJob,
  selectWorkflowResultForDisplay
} from "@/app/state/page-derived";
import type { DraftRecord, JobRecord, WorkflowResult, WorkspaceState } from "@/app/types";

const jobs: JobRecord[] = [
  { id: "job-1", type: "workflow", status: "completed", progress: 100, title: "done", createdAt: "" } as JobRecord,
  { id: "job-2", type: "workflow", status: "running", progress: 40, title: "run", createdAt: "" } as JobRecord
];

describe("page derived state", () => {
  it("selects active and running job state consistently", () => {
    expect(selectActiveJob(jobs, "job-2")?.id).toBe("job-2");
    expect(selectActiveJob(jobs, "missing")?.id).toBe("job-1");
    expect(hasRunningJobs(jobs)).toBe(true);
    expect(hasRunningJobs([{ ...jobs[0], status: "failed" }])).toBe(false);
  });

  it("keeps fresh research results visible over stale draft results", () => {
    const draft = { status: "draft_ready", evidence: [], samples: [] } as unknown as WorkflowResult;
    const research = { status: "research_ready", evidence: [{ id: "sample-1" }], samples: [] } as unknown as WorkflowResult;

    expect(selectWorkflowResultForDisplay({ workflowResult: research, researchResult: draft })).toBe(research);
    expect(selectWorkflowResultForDisplay({ workflowResult: draft, researchResult: research })).toBe(research);
  });

  it("builds ribbon readiness without duplicating page JSX logic", () => {
    const workspace = {
      selectedSamples: [{ id: "sample-1" }],
      selectedImageIds: [],
      publishPlan: { status: "awaiting_approval" }
    } as unknown as WorkspaceState;
    const currentDraft = { id: "draft-1", images: [{ path: "cover.png" }] } as unknown as DraftRecord;
    const state = buildWorkflowRibbonState({
      researchResult: null,
      workflowResult: null,
      workspace,
      currentDraft,
      publishAssetIds: [],
      workflowAssetIds: [],
      jobs
    });

    expect(state).toMatchObject({
      researchReady: true,
      draftReady: true,
      imageReady: true,
      publishReady: true,
      runningCount: 1
    });
  });
});
