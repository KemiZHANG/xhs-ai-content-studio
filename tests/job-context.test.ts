import { describe, expect, it } from "vitest";
import { canApplyWorkspaceSnapshot, isJobForWorkspace } from "@/lib/jobs/context";

describe("job workspace context", () => {
  it("accepts jobs explicitly bound to the active workspace", () => {
    expect(
      isJobForWorkspace(
        { id: "job-1", workspaceId: "workspace-current", postProjectId: "post-current" },
        { workspaceId: "workspace-current", recentJobIds: [] }
      )
    ).toBe(true);
  });

  it("rejects completed jobs from a previous workspace", () => {
    expect(
      isJobForWorkspace(
        { id: "job-old", workspaceId: "workspace-old", postProjectId: "post-old" },
        { workspaceId: "workspace-new", recentJobIds: ["job-new"] }
      )
    ).toBe(false);
  });

  it("keeps legacy jobs compatible through recentJobIds", () => {
    expect(isJobForWorkspace({ id: "legacy-job" }, { workspaceId: "workspace-current", recentJobIds: ["legacy-job"] })).toBe(true);
    expect(isJobForWorkspace({ id: "legacy-job" }, { workspaceId: "workspace-current", recentJobIds: [] })).toBe(false);
  });

  it("only applies streamed workspace snapshots for the current workspace", () => {
    expect(canApplyWorkspaceSnapshot({ workspaceId: "workspace-current" }, { workspaceId: "workspace-current" })).toBe(true);
    expect(canApplyWorkspaceSnapshot({ workspaceId: "workspace-old" }, { workspaceId: "workspace-current" })).toBe(false);
  });
});
