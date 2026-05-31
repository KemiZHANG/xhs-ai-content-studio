import { beforeEach, describe, expect, it, vi } from "vitest";

describe("jobs stream route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("streams the latest jobs, workspace, and PostProject snapshot as SSE", async () => {
    vi.doMock("@/lib/storage/jobs", () => ({
      listJobs: vi.fn(async () => [
        {
          id: "job-1",
          type: "workflow",
          title: "research",
          status: "running",
          progress: 60,
          createdAt: "",
          updatedAt: "",
          input: {},
          steps: []
        }
      ])
    }));
    vi.doMock("@/lib/agent/state", () => ({
      readWorkspaceState: vi.fn(async () => ({
        schemaVersion: 1,
        workspaceId: "workspace-1",
        updatedAt: "",
        selectedSamples: [],
        selectedImageIds: [],
        productImageIds: [],
        recentJobIds: [],
        recentRunIds: [],
        recentConversationIds: []
      }))
    }));
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: vi.fn(async () => ({
        schemaVersion: 1,
        id: "post-1",
        topic: "广州咖啡馆",
        currentStage: "researching",
        allowedActions: []
      }))
    }));

    const { GET } = await import("@/app/api/jobs/stream/route");
    const response = await GET();
    const reader = response.body?.getReader();
    const chunks: string[] = [];

    for (let index = 0; index < 2; index += 1) {
      const next = await reader?.read();
      if (next?.value) {
        chunks.push(new TextDecoder().decode(next.value));
      }
    }
    await reader?.cancel();

    const text = chunks.join("");
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(text).toContain("event: jobs");
    expect(text).toContain("\"id\":\"job-1\"");
    expect(text).toContain("\"workspaceId\":\"workspace-1\"");
    expect(text).toContain("\"id\":\"post-1\"");
    expect(text).toContain("\"topic\":\"广州咖啡馆\"");
  });
});
