import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetWorkspaceState, updateWorkspaceState } from "@/lib/agent/state";
import {
  getAllowedPostActions,
  postProjectFromWorkspace,
  readPostProject,
  resetPostProject,
  updatePostProject
} from "@/lib/post-project";
import { runPostQualityGate } from "@/lib/post-project/quality";
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
    expect(project.creativeBrief?.basedOnEvidenceIds.length).toBeGreaterThan(0);
    expect(project.visualDirection?.basedOnEvidenceIds).toEqual(project.creativeBrief?.basedOnEvidenceIds);
    expect(project.imagePrompts[0].basedOnEvidenceIds).toEqual(project.creativeBrief?.basedOnEvidenceIds);
    expect(project.finalPost?.title).toBe("Draft");
    expect(project.qualityCheck?.canPublish).toBe(true);
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
    expect(project.creativeBrief?.emotionalHook).toBe("hook");
    expect(project.allowedActions).toEqual(getAllowedPostActions(project.currentStage));
  });

  it("preserves an existing creative brief while syncing newer workspace data", async () => {
    const workspace = await resetWorkspaceState({ topic: "coffee" });
    await resetPostProject({
      id: workspace.workspaceId.replace(/^workspace-/, "post-"),
      topic: "coffee",
      creativeBrief: {
        audience: "自定义人群",
        painPoint: "自定义痛点",
        contentAngle: "自定义角度",
        emotionalHook: "自定义钩子",
        proofPoints: ["自定义证明"],
        tone: "自定义语气",
        visualMood: "自定义视觉",
        imageMustHave: ["产品主体"],
        imageMustAvoid: ["错误文字"],
        platformStyle: "自定义平台风格",
        tabooWords: ["绝对"],
        complianceNotes: ["不要夸大"],
        basedOnEvidenceIds: ["manual-insight"]
      }
    });

    await updateWorkspaceState({
      topic: "coffee updated",
      evidenceSummary: {
        contentStrengths: ["新标题证据"],
        learningsForContent: ["新正文证据"],
        imageStrengths: [],
        learningsForImages: [],
        nextQuestions: []
      },
      selectedSamples: [{ id: "note-1" }]
    });

    const project = await readPostProject();

    expect(project.topic).toBe("coffee updated");
    expect(project.creativeBrief?.audience).toBe("自定义人群");
    expect(project.evidencePack.insights.map((insight) => insight.insight)).toContain("新标题证据");
  });

  it("blocks publish quality when claims are exaggerated or images are missing", () => {
    const quality = runPostQualityGate({
      creativeBrief: undefined,
      visualDirection: undefined,
      selectedImages: [],
      finalPost: {
        title: "全网第一必买神器",
        content: "保证治愈，官方认证销量第一。",
        tags: ["tag"],
        imageIds: [],
        imagePromptVersionIds: []
      },
      copyDraft: null
    });

    expect(quality.canPublish).toBe(false);
    expect(quality.issues.join(" ")).toContain("未选择发布图片");
    expect(quality.issues.join(" ")).toContain("夸张词");
    expect(quality.complianceScore).toBeLessThan(100);
  });

  it("flags drafts that are too close to source samples", () => {
    const sourceText = "真实探店体验先讲排队和人均再给适合拍照的位置最后提醒周末避开高峰";
    const quality = runPostQualityGate({
      creativeBrief: {
        audience: "广州咖啡爱好者",
        painPoint: "不知道周末是否值得去",
        contentAngle: "真实避坑",
        emotionalHook: "先说结论",
        proofPoints: ["排队", "人均"],
        tone: "真实",
        visualMood: "自然光",
        imageMustHave: ["门头"],
        imageMustAvoid: [],
        platformStyle: "小红书",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["insight-1"]
      },
      visualDirection: {
        mood: "自然光",
        composition: "门头+饮品",
        colorPalette: "暖色",
        mustHave: ["门头"],
        mustAvoid: [],
        basedOnEvidenceIds: ["insight-1"]
      },
      selectedImages: ["asset-1"],
      selectedSamples: [{ title: "广州咖啡馆避坑清单", detailText: sourceText }],
      evidencePack: { insights: [{ id: "insight-1", type: "copy", insight: "写真实避坑", sourceSampleIds: ["note-1"], confidence: 0.8, createdAt: "2026-05-30T00:00:00.000Z" }], sampleIds: ["note-1"] },
      finalPost: {
        title: "广州咖啡馆避坑清单",
        content: sourceText,
        tags: ["咖啡"],
        imageIds: ["asset-1"],
        imagePromptVersionIds: []
      },
      copyDraft: null
    });

    expect(quality.canPublish).toBe(false);
    expect(quality.issues.join(" ")).toContain("疑似过度仿写样本");
  });

  it("refreshes stale final posts when the current draft changes", () => {
    const project = postProjectFromWorkspace({
      schemaVersion: 1,
      workspaceId: "workspace-version",
      updatedAt: "2026-05-30T00:00:00.000Z",
      topic: "coffee",
      evidenceSummary: { contentStrengths: ["真实标题"] },
      selectedSamples: [{ id: "note-1" }],
      currentDraftId: "draft-new",
      currentDraft: {
        id: "draft-new",
        updatedAt: "2026-05-30T00:00:00.000Z",
        draft: {
          title: "新标题",
          content: "这是一段足够具体的正文，包含真实场景、体验细节、适用人群和注意事项，方便发布前进行检查。",
          tags: ["咖啡"],
          structure: [],
          imagePrompt: "新图片方向"
        },
        images: [],
        visibility: defaultSettings.defaultVisibility
      },
      selectedImageIds: ["asset-new"],
      productImageIds: [],
      publishPlan: null,
      lastUserIntent: "revise",
      recentJobIds: [],
      recentRunIds: [],
      recentConversationIds: []
    });

    expect(project.finalPost?.title).toBe("新标题");
    expect(project.finalPost?.imageIds).toEqual(["asset-new"]);
    expect(project.finalPost?.copyVersionId).toBe("copy-draft-new");
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
