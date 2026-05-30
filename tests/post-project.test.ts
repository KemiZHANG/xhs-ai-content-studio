import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getAllowedPostActions,
  postProjectFromWorkspace,
  readPostProject,
  resetPostProject,
  updatePostProject
} from "@/lib/post-project";
import { resetWorkspaceState } from "@/lib/agent/state";
import { defaultSettings } from "@/lib/storage/settings";

let originalCwd: string;
let tempDir: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  tempDir = await mkdtemp(path.join(os.tmpdir(), "xhs-post-project-"));
  process.chdir(tempDir);
  await mkdir("data", { recursive: true });
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe("post project", () => {
  it("creates a blank project with stage allowed actions", async () => {
    const project = await resetPostProject({ topic: "广州咖啡馆" });

    expect(project.schemaVersion).toBe(1);
    expect(project.topic).toBe("广州咖啡馆");
    expect(project.currentStage).toBe("briefing");
    expect(project.allowedActions).toContain("search_research");
  });

  it("migrates workspace evidence and draft into one post project", async () => {
    const workspace = await resetWorkspaceState({
      topic: "coffee",
      researchRunId: "run-1",
      evidenceSummary: {
        contentStrengths: ["标题前置场景"],
        learningsForContent: ["正文先讲痛点"],
        imageStrengths: ["封面大字"],
        learningsForImages: ["多图递进"],
        nextQuestions: ["补充目标人群"]
      },
      selectedSamples: [{ id: "note-1", title: "sample" }],
      currentDraftId: "draft-1",
      currentDraft: {
        id: "draft-1",
        updatedAt: "2026-05-30T00:00:00.000Z",
        draft: {
          title: "Draft",
          content: "Content",
          tags: ["tag"],
          structure: [],
          imagePrompt: "image"
        },
        images: [],
        visibility: defaultSettings.defaultVisibility
      },
      selectedImageIds: ["asset-1"]
    });

    const project = postProjectFromWorkspace(workspace);

    expect(project.topic).toBe("coffee");
    expect(project.evidencePack.runId).toBe("run-1");
    expect(project.evidencePack.insights.map((insight) => insight.type)).toContain("title");
    expect(project.copyDraft?.id).toBe("draft-1");
    expect(project.copyVersions[0].basedOnEvidenceIds.length).toBeGreaterThan(0);
    expect(project.selectedImages).toEqual(["asset-1"]);
    expect(project.currentStage).toBe("image_ready");
  });

  it("keeps post-project.json synchronized when workspace state is reset", async () => {
    await resetWorkspaceState({
      topic: "fresh",
      selectedSamples: [{ id: "note-1" }],
      evidenceSummary: { contentStrengths: ["hook"] }
    });

    const project = await readPostProject();

    expect(project.topic).toBe("fresh");
    expect(project.evidencePack.insights[0].insight).toBe("hook");
    expect(project.allowedActions).toEqual(getAllowedPostActions(project.currentStage));
  });

  it("persists post project patches without removing existing context", async () => {
    await resetPostProject({ topic: "coffee", targetAudience: "office workers" });
    const next = await updatePostProject({
      topic: undefined,
      tone: "真实分享",
      agentMemory: ["少一点广告感"]
    });

    expect(next.topic).toBe("coffee");
    expect(next.targetAudience).toBe("office workers");
    expect(next.tone).toBe("真实分享");
    expect(next.agentMemory).toEqual(["少一点广告感"]);
    expect(next.allowedActions).toContain("search_research");
  });

  it("initializes from legacy workspace-state when post project file is missing", async () => {
    await writeFile(
      path.join("data", "workspace-state.json"),
      JSON.stringify({
        schemaVersion: 1,
        workspaceId: "workspace-legacy",
        updatedAt: "2026-05-30T00:00:00.000Z",
        topic: "legacy topic",
        evidenceSummary: { learningsForContent: ["structure"] },
        selectedSamples: [{ id: "note-legacy" }],
        currentDraft: null,
        selectedImageIds: [],
        productImageIds: [],
        publishPlan: null,
        recentJobIds: [],
        recentRunIds: [],
        recentConversationIds: []
      })
    );

    const project = await readPostProject();

    expect(project.id).toBe("post-legacy");
    expect(project.topic).toBe("legacy topic");
    expect(project.evidencePack.sampleIds).toEqual(["note-legacy"]);
  });
});
