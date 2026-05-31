import { describe, expect, it } from "vitest";
import { getJobDisplayMeta, selectRunningJobForWorkspace } from "@/app/components/job-display";
import type { JobRecord, WorkspaceState } from "@/app/types";

const workspace: WorkspaceState = {
  workspaceId: "workspace-current",
  selectedSamples: [],
  selectedImageIds: [],
  productImageIds: [],
  recentJobIds: ["legacy-job"],
  recentRunIds: [],
  recentConversationIds: []
};

function job(overrides: Partial<JobRecord>): JobRecord {
  return {
    id: "job-1",
    type: "workflow",
    title: "研究咖啡馆",
    status: "completed",
    progress: 100,
    createdAt: "2026-05-31T00:00:00.000Z",
    updatedAt: "2026-05-31T00:00:00.000Z",
    input: {},
    steps: [],
    result: { status: "research_ready" } as never,
    ...overrides
  };
}

describe("job display meta", () => {
  it("allows current workspace job results to be viewed directly", () => {
    const meta = getJobDisplayMeta(job({ workspaceId: "workspace-current", postProjectId: "post-current" }), workspace);

    expect(meta.scopeLabel).toBe("当前项目");
    expect(meta.canViewResult).toBe(true);
    expect(meta.canRestoreResult).toBe(true);
    expect(meta.resultHint).toContain("直接查看");
  });

  it("requires explicit restore for jobs from another PostProject", () => {
    const meta = getJobDisplayMeta(job({ workspaceId: "workspace-old", postProjectId: "post-old" }), workspace);

    expect(meta.scopeLabel).toBe("历史项目");
    expect(meta.canViewResult).toBe(false);
    expect(meta.canRestoreResult).toBe(true);
    expect(meta.resultHint).toContain("恢复前不会覆盖");
  });

  it("keeps running jobs progress-focused", () => {
    const meta = getJobDisplayMeta(job({ status: "running", progress: 40, result: undefined }), workspace);

    expect(meta.statusLabel).toBe("运行中 · 40%");
    expect(meta.primaryActionLabel).toBe("查看进度");
    expect(meta.canViewResult).toBe(false);
    expect(meta.canRestoreResult).toBe(false);
  });

  it("shows only running jobs that belong to the current Post Studio workspace", () => {
    const current = job({
      id: "job-current",
      status: "running",
      progress: 30,
      workspaceId: "workspace-current",
      postProjectId: "post-current",
      result: undefined
    });
    const old = job({
      id: "job-old",
      status: "running",
      progress: 70,
      workspaceId: "workspace-old",
      postProjectId: "post-old",
      result: undefined
    });

    expect(selectRunningJobForWorkspace([old, current], workspace)?.id).toBe("job-current");
    expect(selectRunningJobForWorkspace([old], workspace)).toBeNull();
  });
});
