import { beforeEach, describe, expect, it, vi } from "vitest";

describe("jobs route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns jobs with workspace and PostProject snapshots for polling fallback", async () => {
    vi.doMock("@/lib/jobs/runner", () => ({
      getJobRunner: () => ({
        listJobs: vi.fn(async () => [
          {
            id: "job-1",
            type: "workflow",
            title: "research",
            status: "completed",
            progress: 100,
            createdAt: "",
            updatedAt: "",
            input: {},
            steps: []
          }
        ])
      })
    }));
    vi.doMock("@/lib/agent/state", () => ({
      readWorkspaceState: vi.fn(async () => ({
        schemaVersion: 1,
        workspaceId: "workspace-1",
        updatedAt: "",
        selectedSamples: [],
        selectedImageIds: ["asset-1"],
        productImageIds: [],
        recentJobIds: ["job-1"],
        recentRunIds: [],
        recentConversationIds: []
      })),
      resetWorkspaceState: vi.fn()
    }));
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: vi.fn(async () => ({
        schemaVersion: 1,
        id: "post-1",
        topic: "广州咖啡馆",
        selectedImages: ["asset-1"],
        currentStage: "assets_ready",
        allowedActions: []
      })),
      resetPostProject: vi.fn()
    }));

    const { GET } = await import("@/app/api/jobs/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.jobs).toEqual([expect.objectContaining({ id: "job-1" })]);
    expect(payload.workspace).toEqual(expect.objectContaining({
      workspaceId: "workspace-1",
      selectedImageIds: ["asset-1"]
    }));
    expect(payload.postProject).toEqual(expect.objectContaining({
      id: "post-1",
      topic: "广州咖啡馆",
      selectedImages: ["asset-1"]
    }));
  });
});
