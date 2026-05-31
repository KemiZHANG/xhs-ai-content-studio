import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readWorkspaceState, resetWorkspaceState, updateWorkspaceState } from "@/lib/agent/state";
import { defaultSettings } from "@/lib/storage/settings";

let originalCwd: string;
let tempDir: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  tempDir = await mkdtemp(path.join(os.tmpdir(), "xhs-agent-state-"));
  process.chdir(tempDir);
  await mkdir("data", { recursive: true });
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe("workspace state", () => {
  it("initializes from legacy current draft, history, assets, and jobs", async () => {
    await writeFile(
      path.join("data", "drafts.json"),
      JSON.stringify({
        currentDraft: {
          id: "draft-1",
          updatedAt: "2026-05-21T00:00:00.000Z",
          draft: {
            title: "Draft title",
            content: "Draft content",
            tags: ["tag"],
            structure: [],
            imagePrompt: "image prompt"
          },
          images: [{ path: "C:\\tmp\\image.png" }],
          visibility: defaultSettings.defaultVisibility
        }
      })
    );
    await writeFile(
      path.join("data", "history.json"),
      JSON.stringify([
        {
          id: "run-1",
          createdAt: "2026-05-21T00:00:00.000Z",
          input: { topic: "coffee", contentType: "note", timeRange: "week", sampleCount: 4 },
          result: {
            status: "research_ready",
            steps: [],
            samples: [],
            evidence: [{ id: "note-1", title: "sample" }],
            researchSummary: { learningsForContent: ["hook"], learningsForImages: ["light"] },
            report: "report",
            imageStyleReport: "image style",
            draft: null,
            images: [],
            publishResult: {}
          }
        }
      ])
    );
    await writeFile(
      path.join("data", "assets.json"),
      JSON.stringify([{ id: "asset-1", kind: "upload", name: "product", absolutePath: "C:\\tmp\\p.png" }])
    );
    await writeFile(path.join("data", "jobs.json"), JSON.stringify([{ id: "job-1", status: "completed" }]));

    const state = await readWorkspaceState();

    expect(state.schemaVersion).toBe(1);
    expect(state.topic).toBe("coffee");
    expect(state.researchRunId).toBe("run-1");
    expect(state.currentDraftId).toBe("draft-1");
    expect(state.currentDraft?.draft.title).toBe("Draft title");
    expect(state.productImageIds).toEqual(["asset-1"]);
    expect(state.recentJobIds).toEqual(["job-1"]);
  });

  it("persists workspace patches", async () => {
    const state = await updateWorkspaceState({
      topic: "new topic",
      selectedImageIds: ["asset-2"],
      lastUserIntent: "generateDraft"
    });
    const reread = await readWorkspaceState();

    expect(state.topic).toBe("new topic");
    expect(reread.selectedImageIds).toEqual(["asset-2"]);
    expect(reread.lastUserIntent).toBe("generateDraft");
  });

  it("resets to a blank workspace without reviving legacy history or drafts", async () => {
    await writeFile(
      path.join("data", "drafts.json"),
      JSON.stringify({
        currentDraft: {
          id: "draft-legacy",
          updatedAt: "2026-05-21T00:00:00.000Z",
          draft: {
            title: "Legacy draft",
            content: "Legacy content",
            tags: ["legacy"],
            structure: [],
            imagePrompt: "legacy prompt"
          },
          images: [],
          visibility: defaultSettings.defaultVisibility
        }
      })
    );
    await writeFile(
      path.join("data", "history.json"),
      JSON.stringify([
        {
          id: "run-legacy",
          createdAt: "2026-05-21T00:00:00.000Z",
          input: { topic: "old topic", contentType: "note", timeRange: "week", sampleCount: 4 },
          result: {
            status: "research_ready",
            steps: [],
            samples: [],
            evidence: [{ id: "note-1", title: "old sample" }],
            researchSummary: { contentStrengths: ["old"] },
            report: "old report",
            imageStyleReport: "",
            draft: null,
            images: [],
            publishResult: {}
          }
        }
      ])
    );

    const reset = await resetWorkspaceState({ topic: "fresh topic" });
    const reread = await readWorkspaceState();

    expect(reset.topic).toBe("fresh topic");
    expect(reset.researchRunId).toBeUndefined();
    expect(reset.currentDraft).toBeNull();
    expect(reset.selectedSamples).toEqual([]);
    expect(reset.workspaceId).not.toBe("local-default");
    expect(reread.topic).toBe("fresh topic");
    expect(reread.researchRunId).toBeUndefined();
    expect(reread.currentDraft).toBeNull();
  });

  it("ignores undefined patch fields so partial updates do not wipe context", async () => {
    await updateWorkspaceState({
      topic: "coffee",
      selectedSamples: [{ id: "note-1" }],
      selectedImageIds: ["asset-1"],
      publishPlan: {
        id: "publish-1",
        mode: "manual",
        status: "awaiting_approval",
        title: "title",
        content: "content",
        tags: ["tag"],
        images: ["image.png"],
        visibility: defaultSettings.defaultVisibility,
        requestedBy: "chat",
        requestedAt: "2026-05-21T00:00:00.000Z",
        idempotencyKey: "key",
        guardrailResults: []
      }
    });

    const next = await updateWorkspaceState({
      topic: undefined,
      selectedSamples: undefined,
      productImageIds: ["asset-2"],
      publishPlan: undefined
    });

    expect(next.topic).toBe("coffee");
    expect(next.selectedSamples).toEqual([{ id: "note-1" }]);
    expect(next.selectedImageIds).toEqual(["asset-1"]);
    expect(next.productImageIds).toEqual(["asset-2"]);
    expect(next.publishPlan?.id).toBe("publish-1");
  });

  it("clears currentDraftId when the active draft is explicitly cleared", async () => {
    await updateWorkspaceState({
      currentDraftId: "draft-old",
      currentDraft: {
        id: "draft-old",
        updatedAt: "2026-05-21T00:00:00.000Z",
        draft: {
          title: "Old draft",
          content: "Old content",
          tags: ["old"],
          structure: [],
          imagePrompt: "old prompt"
        },
        images: [],
        visibility: defaultSettings.defaultVisibility
      }
    });

    const next = await updateWorkspaceState({ currentDraft: null });

    expect(next.currentDraft).toBeNull();
    expect(next.currentDraftId).toBeUndefined();
  });
});
