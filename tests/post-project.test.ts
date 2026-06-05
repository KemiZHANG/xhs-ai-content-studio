import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetWorkspaceState, updateWorkspaceState } from "@/lib/agent/state";
import { deriveCreativeBrief } from "@/lib/post-project/brief";
import {
  addViralCasesToPostProject,
  addViralCasesToPostProjectWithSummary,
  appendPostProjectMemoryFromTurn,
  getOrderedPostNextActions,
  getPostStageGuidance,
  getAllowedPostActions,
  postProjectFromWorkspace,
  readPostProject,
  resetPostProject,
  syncPostProjectFromWorkspace,
  updatePostProject
} from "@/lib/post-project";
import { buildEvidenceCitationReport } from "@/lib/post-project/citations";
import { runPostQualityGate } from "@/lib/post-project/quality";
import { defaultSettings } from "@/lib/storage/settings";
import { createViralCaseFromEvidence, markForcedLowQualityViralCase, reviewViralSaveCandidate } from "@/lib/viral-knowledge/store";

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

  it("describes stage-specific next steps for the Post Studio header", () => {
    const evidenceGuidance = getPostStageGuidance("evidence_ready", ["create_creative_brief", "search_research"]);
    const imageGuidance = getPostStageGuidance("image_ready", ["select_images", "assemble_post"]);
    const reviewGuidance = getPostStageGuidance("reviewing", ["request_publish_confirmation", "revise_copy"]);

    expect(evidenceGuidance.title).toContain("CreativeBrief");
    expect(evidenceGuidance.primaryAction).toBe("create_creative_brief");
    expect(imageGuidance.primaryAction).toBe("assemble_post");
    expect(reviewGuidance.description).toContain("账号");
    expect(reviewGuidance.primaryAction).toBe("request_publish_confirmation");
  });

  it("orders the primary next action first in Post Studio", () => {
    expect(getOrderedPostNextActions("copy_ready", getAllowedPostActions("copy_ready")).slice(0, 3)).toEqual([
      "plan_visuals",
      "revise_copy",
      "generate_cards"
    ]);
    expect(getOrderedPostNextActions("image_ready", getAllowedPostActions("image_ready")).slice(0, 3)).toEqual([
      "assemble_post",
      "select_images",
      "generate_images"
    ]);
    expect(getOrderedPostNextActions("reviewing", getAllowedPostActions("reviewing"))[0]).toBe("request_publish_confirmation");
  });

  it("allows card rendering directly from the main Post Studio flow", () => {
    expect(getAllowedPostActions("copy_ready")).toContain("generate_cards");
    expect(getAllowedPostActions("image_prompt_ready")).toContain("generate_cards");
    expect(getAllowedPostActions("image_ready")).toContain("generate_cards");
  });

  it("does not surface direct publish actions from the reviewing stage before confirmation", () => {
    const actions = getAllowedPostActions("reviewing");

    expect(actions).toContain("request_publish_confirmation");
    expect(actions).not.toContain("schedule_publish");
    expect(actions).not.toContain("publish_now");
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
    expect(project.qualityCheck?.canPublish).toBe(false);
    expect(project.qualityCheck?.issues).toContain("图片方向尚未人工确认");
    expect(project.currentStage).toBe("reviewing");
  });

  it("keeps migrated evidence ids stable across repeated workspace syncs", async () => {
    const workspace = await resetWorkspaceState({
      topic: "coffee",
      researchRunId: "run-stable",
      evidenceSummary: {
        contentStrengths: ["标题前置真实场景"],
        learningsForContent: ["正文先讲痛点再给选择标准"],
        imageStrengths: ["封面主体清晰"],
        learningsForImages: ["用环境细节增加真实感"],
        nextQuestions: ["补充目标人群"]
      },
      selectedSamples: [{ id: "note-stable", title: "sample" }]
    });

    const first = postProjectFromWorkspace(workspace).evidencePack.insights.map((insight) => insight.id);
    const second = postProjectFromWorkspace(workspace).evidencePack.insights.map((insight) => insight.id);

    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual(first);
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

  it("does not erase an active post project during lightweight workspace updates", async () => {
    await resetPostProject({
      topic: "coffee",
      evidencePack: {
        sampleIds: ["sample-1"],
        insights: [{
          id: "insight-title-1",
          sourceType: "realtime",
          type: "title",
          insight: "Use a concrete scene and save-worthy reason in the title",
          sourceSampleIds: ["sample-1"],
          confidence: 0.82,
          createdAt: "2026-05-30T00:00:00.000Z"
        }]
      },
      currentStage: "evidence_ready"
    });

    await updateWorkspaceState({ lastUserIntent: "ask" });
    const project = await readPostProject();

    expect(project.topic).toBe("coffee");
    expect(project.evidencePack.sampleIds).toEqual(["sample-1"]);
    expect(project.evidencePack.insights[0].id).toBe("insight-title-1");
    expect(project.currentStage).not.toBe("empty");
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

  it("syncs completed background research into the active PostProject instead of leaving it researching", async () => {
    const workspace = await resetWorkspaceState({ topic: "广州咖啡馆" });
    await resetPostProject({
      id: workspace.workspaceId.replace(/^workspace-/, "post-"),
      topic: "广州咖啡馆",
      currentStage: "researching"
    });

    const completedWorkspace = await updateWorkspaceState({
      topic: "广州咖啡馆",
      researchRunId: "run-background-1",
      evidenceSummary: {
        contentStrengths: ["标题强调可收藏的真实场景"],
        learningsForContent: ["正文先交代场景，再给选择标准"],
        imageStrengths: ["封面主体清晰，环境有氛围"],
        learningsForImages: ["图片要保留店内光线和座位细节"],
        nextQuestions: ["补充账号调性"]
      },
      selectedSamples: [{ id: "note-background-1", title: "广州咖啡馆收藏清单" }]
    });

    const project = await syncPostProjectFromWorkspace(completedWorkspace);

    expect(project.id).toBe(workspace.workspaceId.replace(/^workspace-/, "post-"));
    expect(project.currentStage).not.toBe("researching");
    expect(["brief_ready", "visual_planning", "image_prompt_ready"]).toContain(project.currentStage);
    expect(project.evidencePack.runId).toBe("run-background-1");
    expect(project.evidencePack.insights.map((insight) => insight.insight)).toEqual(
      expect.arrayContaining([
        "标题强调可收藏的真实场景",
        "正文先交代场景，再给选择标准",
        "封面主体清晰，环境有氛围"
      ])
    );
    expect(project.creativeBrief?.basedOnEvidenceIds.length).toBeGreaterThan(0);
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

  it("blocks product-image prompts that change packaging or logos", () => {
    const baseProject = {
      productInfo: {
        name: "低因咖啡豆",
        referenceAssetIds: ["product-photo-1"]
      },
      creativeBrief: {
        audience: "咖啡新手",
        painPoint: "怕晚上喝咖啡影响睡眠",
        contentAngle: "真实产品使用场景",
        emotionalHook: "晚上也想喝咖啡但不想太兴奋",
        proofPoints: ["低因", "晚间场景", "冲泡方式"],
        tone: "真实分享",
        visualMood: "居家暖光",
        imageMustHave: ["产品主体"],
        imageMustAvoid: ["虚假认证"],
        platformStyle: "小红书真实种草",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["insight-product"]
      },
      visualDirection: {
        mood: "居家暖光",
        composition: "产品放在桌面，旁边有咖啡杯",
        colorPalette: "warm",
        mustHave: ["产品主体"],
        mustAvoid: ["虚假 logo"],
        basedOnEvidenceIds: ["insight-product"]
      },
      evidencePack: {
        sampleIds: ["note-product"],
        insights: [{
          id: "insight-product",
          sourceType: "user_input",
          type: "visual",
          insight: "保留产品主体，换成居家晚间场景。",
          sourceSampleIds: ["note-product"],
          confidence: 0.9,
          createdAt: "2026-05-31T00:00:00.000Z"
        }]
      },
      selectedImages: ["asset-product"],
      finalPost: {
        title: "晚上也能安心喝的低因咖啡豆",
        content: "这篇笔记从晚间使用场景出发，讲清楚适合哪些人、怎么冲泡、口感细节和需要注意的地方，用真实体验帮助用户判断是否适合自己。",
        tags: ["低因咖啡", "咖啡豆", "晚间咖啡"],
        imageIds: ["asset-product"],
        imagePromptVersionIds: ["prompt-risk"]
      },
      copyDraft: {
        id: "draft-product",
        updatedAt: "2026-05-31T00:00:00.000Z",
        visibility: defaultSettings.defaultVisibility,
        images: [],
        draft: {
          title: "晚上也能安心喝的低因咖啡豆",
          content: "这篇笔记从晚间使用场景出发，讲清楚适合哪些人、怎么冲泡、口感细节和需要注意的地方，用真实体验帮助用户判断是否适合自己。",
          tags: ["低因咖啡", "咖啡豆", "晚间咖啡"],
          structure: ["场景", "体验", "适合人群"],
          imagePrompt: "居家暖光产品场景图",
          basedOnEvidenceIds: ["insight-product"],
          evidenceReferences: {
            title: ["insight-product"],
            content: ["insight-product"],
            tags: ["insight-product"],
            imagePrompt: ["insight-product"]
          }
        }
      }
    } satisfies Parameters<typeof runPostQualityGate>[0];
    const quality = runPostQualityGate({
      ...baseProject,
      imagePrompts: [{
        id: "prompt-risk",
        createdAt: "2026-05-31T00:00:00.000Z",
        label: "风险图片提示词",
        value: { prompt: "重新设计产品包装和 logo，让标签换成更高级的文字" },
        basedOnEvidenceIds: ["insight-product"]
      }]
    });
    const safeQuality = runPostQualityGate({
      ...baseProject,
      imagePrompts: [{
        id: "prompt-safe",
        createdAt: "2026-05-31T00:00:00.000Z",
        label: "安全图片提示词",
        value: { prompt: "保留产品包装、logo、标签、颜色和轮廓，只替换居家暖光背景" },
        basedOnEvidenceIds: ["insight-product"]
      }]
    });

    expect(quality.canPublish).toBe(false);
    expect(quality.issues.join(" ")).toContain("产品外观");
    expect(quality.suggestions.join(" ")).toContain("不要改变包装");
    expect(safeQuality.issues.join(" ")).not.toContain("产品外观");
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

  it("flags drafts that are too close to viral library cases", () => {
    const sourceText = "先给适合拍照的座位再写人均和光线最后提醒周末排队和适合人群";
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
        basedOnEvidenceIds: ["viral-insight-1"]
      },
      visualDirection: {
        mood: "自然光",
        composition: "门头+饮品",
        colorPalette: "暖色",
        mustHave: ["门头"],
        mustAvoid: [],
        basedOnEvidenceIds: ["viral-insight-1"]
      },
      selectedImages: ["asset-1"],
      selectedSamples: [],
      evidencePack: {
        insights: [{
          id: "viral-insight-1",
          sourceType: "viral_library",
          type: "structure",
          insight: "开头座位，中段人均和光线，结尾排队提醒",
          sourceSampleIds: ["viral-1"],
          confidence: 0.8,
          createdAt: "2026-05-30T00:00:00.000Z"
        }],
        sampleIds: ["viral-1"],
        summary: {
          viralKnowledge: {
            results: [{
              case: {
                title: "广州咖啡馆高收藏拍照攻略",
                bodyExcerpt: sourceText
              }
            }]
          }
        }
      },
      finalPost: {
        title: "广州咖啡馆高收藏拍照攻略",
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

  it("flags drafts that copy structured viral knowledge rules", () => {
    const copiedRule = "开头直接给适合人群和使用场景，中段拆容量肩带分区和通勤细节，结尾给避坑提醒和互动问题";
    const quality = runPostQualityGate({
      creativeBrief: {
        audience: "上班族",
        painPoint: "不知道通勤包是否真的能装又不勒肩",
        contentAngle: "真实通勤包测评",
        emotionalHook: "先说适合谁",
        proofPoints: ["容量", "肩带", "分区"],
        tone: "真实",
        visualMood: "自然光",
        imageMustHave: ["包身"],
        imageMustAvoid: [],
        platformStyle: "小红书",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["viral-insight-rule"]
      },
      visualDirection: {
        mood: "自然光",
        composition: "包身+桌面",
        colorPalette: "中性色",
        mustHave: ["包身"],
        mustAvoid: [],
        basedOnEvidenceIds: ["viral-insight-rule"]
      },
      selectedImages: ["asset-1"],
      selectedSamples: [],
      evidencePack: {
        insights: [{
          id: "viral-insight-rule",
          sourceType: "viral_library",
          type: "structure",
          insight: copiedRule,
          sourceSampleIds: ["viral-rule-1"],
          confidence: 0.86,
          createdAt: "2026-05-30T00:00:00.000Z"
        }],
        sampleIds: ["viral-rule-1"],
        summary: {
          viralKnowledge: {
            results: [{
              case: {
                title: "通勤包高收藏测评",
                bodyExcerpt: "原帖摘要不同于生成文案，主要介绍真实测评。",
                extractedInsights: {
                  reusableRules: [copiedRule],
                  titleHooks: [],
                  copyStructures: [],
                  tagPatterns: [],
                  visualPatterns: []
                }
              }
            }]
          }
        }
      },
      finalPost: {
        title: "通勤包真实测评",
        content: copiedRule,
        tags: ["通勤包"],
        imageIds: ["asset-1"],
        imagePromptVersionIds: []
      },
      copyDraft: null
    });

    expect(quality.canPublish).toBe(false);
    expect(quality.issues.join(" ")).toContain("疑似过度仿写样本");
  });

  it("blocks publish when the active draft lacks traceable evidence ids", () => {
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
      evidencePack: {
        insights: [{
          id: "insight-1",
          sourceType: "realtime",
          type: "copy",
          insight: "真实写排队、人均和适合人群",
          sourceSampleIds: ["note-1"],
          confidence: 0.8,
          createdAt: "2026-05-30T00:00:00.000Z"
        }],
        sampleIds: ["note-1"]
      },
      copyDraft: {
        id: "draft-no-evidence",
        updatedAt: "2026-05-30T00:00:00.000Z",
        visibility: defaultSettings.defaultVisibility,
        images: [],
        draft: {
          title: "广州咖啡周末指南",
          content: "这篇适合想周末找安静咖啡馆的人。先看人均和排队，再看座位光线，最后给适合人群和避峰建议。",
          tags: ["广州咖啡馆", "探店"],
          structure: ["适合谁", "体验", "避坑"],
          imagePrompt: "自然光咖啡馆"
        }
      }
    });

    expect(quality.canPublish).toBe(false);
    expect(quality.issues.join(" ")).toContain("缺少 basedOnEvidenceIds");
  });

  it("summarizes realtime and viral evidence coverage for publish review", () => {
    const quality = runPostQualityGate({
      creativeBrief: {
        audience: "广州咖啡爱好者",
        painPoint: "怕踩雷",
        contentAngle: "真实探店",
        emotionalHook: "先给适合谁",
        proofPoints: ["人均", "排队"],
        tone: "真实",
        visualMood: "自然光",
        imageMustHave: ["窗边"],
        imageMustAvoid: [],
        platformStyle: "小红书",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["insight-live", "viral-insight-style"]
      },
      visualDirection: {
        mood: "自然光",
        composition: "窗边座位+咖啡",
        colorPalette: "暖色",
        mustHave: ["窗边"],
        mustAvoid: [],
        basedOnEvidenceIds: ["viral-insight-style"]
      },
      selectedImages: ["asset-1"],
      evidencePack: {
        sampleIds: ["note-1", "viral-1"],
        insights: [
          {
            id: "insight-live",
            sourceType: "realtime",
            type: "title",
            insight: "标题前置适合人群和避坑收益",
            sourceSampleIds: ["note-1"],
            confidence: 0.82,
            createdAt: "2026-05-30T00:00:00.000Z"
          },
          {
            id: "viral-insight-style",
            sourceType: "viral_library",
            type: "visual",
            insight: "封面突出窗边自然光和真实座位细节",
            sourceSampleIds: ["viral-1"],
            confidence: 0.8,
            createdAt: "2026-05-30T00:00:00.000Z"
          }
        ]
      },
      finalPost: {
        title: "广州咖啡周末指南",
        content: "这篇适合想周末找安静咖啡馆的人。先看人均和排队，再看座位光线，最后给适合人群和避峰建议。",
        tags: ["广州咖啡馆", "探店"],
        imageIds: ["asset-1"],
        imagePromptVersionIds: []
      },
      copyDraft: {
        id: "draft-coverage",
        updatedAt: "2026-05-30T00:00:00.000Z",
        draft: {
          title: "广州咖啡周末指南",
          content: "这篇适合想周末找安静咖啡馆的人。先看人均和排队，再看座位光线，最后给适合人群和避峰建议。",
          tags: ["广州咖啡馆", "探店"],
          structure: [],
          imagePrompt: "窗边自然光咖啡",
          basedOnEvidenceIds: ["insight-live", "viral-insight-style"]
        },
        images: [],
        visibility: defaultSettings.defaultVisibility
      }
    });

    expect(quality.evidenceReview?.realtimeEvidenceIds).toEqual(["insight-live"]);
    expect(quality.evidenceReview?.viralEvidenceIds).toEqual(["viral-insight-style"]);
    expect(quality.evidenceReview?.missingEvidenceIds).toEqual([]);
    expect(quality.evidenceReview?.summary).toContain("爆款库 1 条");
    expect(quality.evidenceAlignment?.isAligned).toBe(true);
    expect(quality.evidenceAlignment?.sharedEvidenceIds).toEqual(["viral-insight-style"]);
    expect(quality.viralCoverage?.summary).toContain("爆款库覆盖");
    expect(quality.viralCoverage?.fields.find((field) => field.field === "imagePrompt")).toMatchObject({
      status: "covered",
      viralEvidenceIds: ["viral-insight-style"]
    });
    expect(quality.viralCoverage?.fields.find((field) => field.field === "tags")).toMatchObject({
      status: "missing"
    });
    expect(quality.suggestions.join(" ")).toContain("爆款库证据未覆盖");
  });

  it("counts image prompt and generated-image evidence in Quality Gate viral coverage", () => {
    const quality = runPostQualityGate({
      creativeBrief: {
        audience: "广州咖啡爱好者",
        painPoint: "怕踩雷",
        contentAngle: "真实探店",
        emotionalHook: "先给适合谁",
        proofPoints: ["人均", "排队"],
        tone: "真实",
        visualMood: "自然光",
        imageMustHave: ["窗边"],
        imageMustAvoid: [],
        platformStyle: "小红书",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["insight-live"]
      },
      visualDirection: undefined,
      imagePrompts: [{
        id: "prompt-viral-visual",
        label: "窗边自然光封面",
        createdAt: "2026-05-30T00:00:00.000Z",
        value: { prompt: "窗边自然光咖啡馆封面，真实座位细节" },
        basedOnEvidenceIds: ["viral-insight-style"]
      }],
      generatedImages: [{
        id: "asset-1",
        assetId: "asset-1",
        createdAt: "2026-05-30T00:00:00.000Z",
        promptVersionId: "prompt-viral-visual",
        basedOnEvidenceIds: ["viral-insight-style"]
      }],
      selectedImages: ["asset-1"],
      evidencePack: {
        sampleIds: ["note-1", "viral-1"],
        insights: [
          {
            id: "insight-live",
            sourceType: "realtime",
            type: "copy",
            insight: "正文先说明适合人群，再补充排队和人均。",
            sourceSampleIds: ["note-1"],
            confidence: 0.82,
            createdAt: "2026-05-30T00:00:00.000Z"
          },
          {
            id: "viral-insight-style",
            sourceType: "viral_library",
            type: "visual",
            insight: "封面突出窗边自然光和真实座位细节。",
            sourceSampleIds: ["viral-1"],
            confidence: 0.8,
            createdAt: "2026-05-30T00:00:00.000Z"
          }
        ]
      },
      finalPost: {
        title: "广州咖啡周末指南",
        content: "这篇适合想周末找安静咖啡馆的人。先看人均和排队，再看座位光线，最后给适合人群和避峰建议。",
        tags: ["广州咖啡馆", "探店"],
        imageIds: ["asset-1"],
        imagePromptVersionIds: ["prompt-viral-visual"]
      },
      copyDraft: {
        id: "draft-prompt-coverage",
        updatedAt: "2026-05-30T00:00:00.000Z",
        draft: {
          title: "广州咖啡周末指南",
          content: "这篇适合想周末找安静咖啡馆的人。先看人均和排队，再看座位光线，最后给适合人群和避峰建议。",
          tags: ["广州咖啡馆", "探店"],
          structure: [],
          imagePrompt: "窗边自然光咖啡",
          basedOnEvidenceIds: ["insight-live"]
        },
        images: [],
        visibility: defaultSettings.defaultVisibility
      }
    });

    expect(quality.viralCoverage?.fields.find((field) => field.field === "imagePrompt")).toMatchObject({
      status: "covered",
      viralEvidenceIds: ["viral-insight-style"]
    });
    expect(quality.evidenceReview?.viralEvidenceIds).toEqual(["viral-insight-style"]);
  });

  it("blocks publish quality when the draft only cites viral-library evidence", () => {
    const quality = runPostQualityGate({
      creativeBrief: {
        audience: "coffee explorers",
        painPoint: "need a calm weekend cafe",
        contentAngle: "real visit guide",
        emotionalHook: "save before weekend",
        proofPoints: ["light", "seating"],
        tone: "grounded",
        visualMood: "warm window light",
        imageMustHave: ["coffee", "table"],
        imageMustAvoid: [],
        platformStyle: "xiaohongshu useful guide",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["viral-insight-style"]
      },
      visualDirection: {
        mood: "warm window light",
        composition: "coffee table with seat detail",
        colorPalette: "warm neutral",
        mustHave: ["coffee"],
        mustAvoid: [],
        basedOnEvidenceIds: ["viral-insight-style"]
      },
      selectedImages: ["asset-1"],
      evidencePack: {
        sampleIds: ["viral-1"],
        insights: [{
          id: "viral-insight-style",
          sourceType: "viral_library",
          type: "visual",
          insight: "Use a window-light cover with concrete seating detail",
          sourceSampleIds: ["viral-1"],
          confidence: 0.86,
          createdAt: "2026-05-30T00:00:00.000Z"
        }]
      },
      finalPost: {
        title: "Weekend cafe guide",
        content: "This note gives a grounded weekend cafe choice for people who want a calm seat, natural light, practical ordering ideas, and a reminder to avoid the busiest hour. It focuses on the user's own visit plan instead of copying any historical sample.",
        tags: ["coffee", "weekend"],
        imageIds: ["asset-1"],
        imagePromptVersionIds: []
      },
      copyDraft: {
        id: "draft-viral-only",
        updatedAt: "2026-05-30T00:00:00.000Z",
        draft: {
          title: "Weekend cafe guide",
          content: "This note gives a grounded weekend cafe choice for people who want a calm seat, natural light, practical ordering ideas, and a reminder to avoid the busiest hour. It focuses on the user's own visit plan instead of copying any historical sample.",
          tags: ["coffee", "weekend"],
          structure: [],
          imagePrompt: "warm window light coffee table",
          basedOnEvidenceIds: ["viral-insight-style"]
        },
        images: [],
        visibility: defaultSettings.defaultVisibility
      }
    });

    expect(quality.canPublish).toBe(false);
    expect(quality.issues.join(" ")).toContain("实时小红书研究证据");
    expect(quality.evidenceReview?.viralEvidenceIds).toEqual(["viral-insight-style"]);
    expect(quality.evidenceReview?.realtimeEvidenceIds).toEqual([]);
  });

  it("blocks publish when viral RAG sufficiency explicitly says evidence is not enough", () => {
    const longContent = "这篇笔记面向周末想找安静咖啡馆的人，先说明适合人群，再补充座位、光线、饮品体验和避坑提醒，最后用一个轻互动问题收尾，确保内容来自当前证据而不是凭空生成。";
    const quality = runPostQualityGate({
      creativeBrief: {
        audience: "广州咖啡爱好者",
        painPoint: "不知道周末去哪家咖啡馆更稳",
        contentAngle: "真实探店避坑",
        emotionalHook: "先给结论",
        proofPoints: ["座位", "光线", "饮品"],
        tone: "真实",
        visualMood: "自然光",
        imageMustHave: ["窗边座位"],
        imageMustAvoid: [],
        platformStyle: "小红书真实分享",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["insight-live", "viral-insight-style"]
      },
      visualDirection: {
        mood: "自然光",
        composition: "窗边座位和咖啡杯",
        colorPalette: "暖色",
        mustHave: ["窗边座位"],
        mustAvoid: [],
        basedOnEvidenceIds: ["insight-live", "viral-insight-style"]
      },
      imagePrompts: [{
        id: "prompt-1",
        label: "封面方向",
        createdAt: "2026-05-30T00:00:00.000Z",
        value: { prompt: "窗边自然光咖啡馆封面图" },
        basedOnEvidenceIds: ["insight-live", "viral-insight-style"]
      }],
      selectedImages: ["asset-1"],
      evidencePack: {
        sampleIds: ["note-1", "viral-1"],
        insights: [
          {
            id: "insight-live",
            sourceType: "realtime",
            type: "copy",
            insight: "实时样本会先说明适合人群，再补充座位和避坑提醒",
            sourceSampleIds: ["note-1"],
            confidence: 0.82,
            createdAt: "2026-05-30T00:00:00.000Z"
          },
          {
            id: "viral-insight-style",
            sourceType: "viral_library",
            type: "visual",
            insight: "爆款库规律建议用自然光和座位细节做封面",
            sourceSampleIds: ["viral-1"],
            confidence: 0.8,
            createdAt: "2026-05-30T00:00:00.000Z"
          }
        ],
        summary: {
          viralKnowledge: {
            sufficiency: {
              isEnough: false,
              missing: ["爆款库匹配样本不足 2 条"],
              recommendation: "建议继续搜索或保存更多高质量样本",
              realtimeCount: 3,
              viralCount: 1
            }
          }
        }
      },
      finalPost: {
        title: "广州周末咖啡馆真实探店",
        content: longContent,
        tags: ["广州咖啡馆", "周末探店"],
        imageIds: ["asset-1"],
        imagePromptVersionIds: ["prompt-1"],
        basedOnEvidenceIds: ["insight-live", "viral-insight-style"]
      },
      copyDraft: {
        id: "draft-rag-sufficiency",
        updatedAt: "2026-05-30T00:00:00.000Z",
        draft: {
          title: "广州周末咖啡馆真实探店",
          content: longContent,
          tags: ["广州咖啡馆", "周末探店"],
          structure: ["适合谁", "真实体验", "避坑提醒"],
          imagePrompt: "窗边自然光咖啡馆封面图",
          basedOnEvidenceIds: ["insight-live", "viral-insight-style"]
        },
        images: [],
        visibility: defaultSettings.defaultVisibility
      }
    });

    expect(quality.canPublish).toBe(false);
    expect(quality.issues.join(" ")).toContain("爆款库 RAG 证据不足");
    expect(quality.suggestions.join(" ")).toContain("继续搜索");
  });

  it("blocks publish when copy and visual direction cite different evidence", () => {
    const longContent = "这篇笔记面向周末想找安静咖啡馆的人，先说明适合的人群和真实体验，再补充座位、光线、人均、排队时间和避坑提醒，最后用一个轻互动问题收尾。";
    const quality = runPostQualityGate({
      creativeBrief: {
        audience: "广州咖啡爱好者",
        painPoint: "不知道周末去哪家咖啡馆更稳",
        contentAngle: "真实探店避坑",
        emotionalHook: "先给结论",
        proofPoints: ["人均", "排队", "座位"],
        tone: "真实",
        visualMood: "自然光",
        imageMustHave: ["窗边座位"],
        imageMustAvoid: [],
        platformStyle: "小红书真实分享",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["insight-copy", "insight-visual"]
      },
      visualDirection: {
        mood: "自然光",
        composition: "窗边座位和咖啡杯",
        colorPalette: "暖色",
        mustHave: ["窗边座位"],
        mustAvoid: [],
        basedOnEvidenceIds: ["insight-visual"]
      },
      imagePrompts: [{
        id: "prompt-1",
        label: "封面方向",
        createdAt: "2026-05-30T00:00:00.000Z",
        value: { prompt: "窗边自然光咖啡馆封面图" },
        basedOnEvidenceIds: ["insight-visual"]
      }],
      selectedImages: ["asset-1"],
      evidencePack: {
        sampleIds: ["note-1", "note-2"],
        insights: [
          {
            id: "insight-copy",
            sourceType: "realtime",
            type: "copy",
            insight: "正文先给适合人群，再补充座位、人均和避坑提醒",
            sourceSampleIds: ["note-1"],
            confidence: 0.82,
            createdAt: "2026-05-30T00:00:00.000Z"
          },
          {
            id: "insight-visual",
            sourceType: "viral_library",
            type: "visual",
            insight: "封面使用窗边自然光和真实座位细节",
            sourceSampleIds: ["note-2"],
            confidence: 0.8,
            createdAt: "2026-05-30T00:00:00.000Z"
          }
        ]
      },
      finalPost: {
        title: "广州周末咖啡馆真实探店",
        content: longContent,
        tags: ["广州咖啡馆", "周末探店"],
        imageIds: ["asset-1"],
        imagePromptVersionIds: ["prompt-1"]
      },
      copyDraft: {
        id: "draft-mismatch",
        updatedAt: "2026-05-30T00:00:00.000Z",
        draft: {
          title: "广州周末咖啡馆真实探店",
          content: longContent,
          tags: ["广州咖啡馆", "周末探店"],
          structure: ["适合谁", "真实体验", "避坑提醒"],
          imagePrompt: "窗边自然光咖啡馆封面图",
          basedOnEvidenceIds: ["insight-copy"]
        },
        images: [],
        visibility: defaultSettings.defaultVisibility
      }
    });

    expect(quality.canPublish).toBe(false);
    expect(quality.issues.join(" ")).toContain("图片方向与文案引用的证据不一致");
    expect(quality.visualConsistencyScore).toBeLessThan(100);
    expect(quality.evidenceAlignment?.isAligned).toBe(false);
    expect(quality.evidenceAlignment?.copyEvidenceIds).toEqual(["insight-copy"]);
    expect(quality.evidenceAlignment?.visualEvidenceIds).toEqual(["insight-visual"]);
    expect(quality.evidenceAlignment?.sharedEvidenceIds).toEqual([]);
  });

  it("blocks generated publish images without prompt and evidence provenance", () => {
    const longContent = "这篇笔记会面向周末想找安静咖啡馆的人，先讲适合人群，再补充座位、光线、饮品体验和避坑提醒，最后用一个轻互动问题收尾，保证不是空泛种草。";
    const quality = runPostQualityGate({
      creativeBrief: {
        audience: "广州咖啡爱好者",
        painPoint: "不知道周末去哪家咖啡馆更稳",
        contentAngle: "真实探店避坑",
        emotionalHook: "先给结论",
        proofPoints: ["座位", "光线", "饮品"],
        tone: "真实",
        visualMood: "自然光",
        imageMustHave: ["窗边座位"],
        imageMustAvoid: [],
        platformStyle: "小红书真实分享",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["insight-1"]
      },
      visualDirection: {
        mood: "自然光",
        composition: "窗边座位和咖啡杯",
        colorPalette: "暖色",
        mustHave: ["窗边座位"],
        mustAvoid: [],
        basedOnEvidenceIds: ["insight-1"]
      },
      imagePrompts: [{
        id: "prompt-1",
        label: "封面方向",
        createdAt: "2026-05-30T00:00:00.000Z",
        value: { prompt: "窗边自然光咖啡馆封面图" },
        basedOnEvidenceIds: ["insight-1"]
      }],
      generatedImages: [{
        id: "asset-1",
        assetId: "asset-1",
        path: "C:\\Users\\someone\\xhs\\generated-assets\\generated\\cover.png",
        createdAt: "2026-05-30T00:00:00.000Z",
        selected: true
      }],
      selectedImages: ["asset-1"],
      evidencePack: {
        sampleIds: ["note-1"],
        insights: [{
          id: "insight-1",
          sourceType: "realtime",
          type: "visual",
          insight: "真实咖啡馆笔记会展示自然光、座位和饮品细节",
          sourceSampleIds: ["note-1"],
          confidence: 0.82,
          createdAt: "2026-05-30T00:00:00.000Z"
        }]
      },
      finalPost: {
        title: "广州周末咖啡馆真实探店",
        content: longContent,
        tags: ["广州咖啡馆", "周末探店"],
        imageIds: ["asset-1"],
        imagePromptVersionIds: ["prompt-1"],
        basedOnEvidenceIds: ["insight-1"]
      },
      copyDraft: {
        id: "draft-image-provenance",
        updatedAt: "2026-05-30T00:00:00.000Z",
        draft: {
          title: "广州周末咖啡馆真实探店",
          content: longContent,
          tags: ["广州咖啡馆", "周末探店"],
          structure: ["适合谁", "真实体验", "避坑提醒"],
          imagePrompt: "窗边自然光咖啡馆封面图",
          basedOnEvidenceIds: ["insight-1"]
        },
        images: [],
        visibility: defaultSettings.defaultVisibility
      }
    });

    expect(quality.canPublish).toBe(false);
    expect(quality.issues.join(" ")).toContain("生成图缺少可追溯来源");
    expect(quality.visualConsistencyScore).toBeLessThan(100);
  });

  it("blocks publish when draft evidence ids are not in the current evidence pack", () => {
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
      evidencePack: {
        insights: [{
          id: "insight-1",
          sourceType: "realtime",
          type: "copy",
          insight: "真实写排队、人均和适合人群",
          sourceSampleIds: ["note-1"],
          confidence: 0.8,
          createdAt: "2026-05-30T00:00:00.000Z"
        }],
        sampleIds: ["note-1"]
      },
      copyDraft: {
        id: "draft-stale-evidence",
        updatedAt: "2026-05-30T00:00:00.000Z",
        visibility: defaultSettings.defaultVisibility,
        images: [],
        draft: {
          title: "广州咖啡周末指南",
          content: "这篇适合想周末找安静咖啡馆的人。先看人均和排队，再看座位光线，最后给适合人群和避峰建议。",
          tags: ["广州咖啡馆", "探店"],
          structure: ["适合谁", "体验", "避坑"],
          imagePrompt: "自然光咖啡馆",
          basedOnEvidenceIds: ["old-insight"]
        }
      }
    });

    expect(quality.canPublish).toBe(false);
    expect(quality.issues.join(" ")).toContain("引用了不存在的证据 ID");
  });

  it("blocks publish when the final post image version is stale", () => {
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
      selectedImages: ["asset-new"],
      evidencePack: {
        insights: [{
          id: "insight-1",
          sourceType: "realtime",
          type: "copy",
          insight: "真实写排队、人均和适合人群",
          sourceSampleIds: ["note-1"],
          confidence: 0.8,
          createdAt: "2026-05-30T00:00:00.000Z"
        }],
        sampleIds: ["note-1"]
      },
      copyDraft: {
        id: "draft-current",
        updatedAt: "2026-05-30T00:00:00.000Z",
        visibility: defaultSettings.defaultVisibility,
        images: [],
        draft: {
          title: "广州咖啡周末指南",
          content: "这篇适合想周末找安静咖啡馆的人。先看人均和排队，再看座位光线，最后给适合人群和避峰建议。",
          tags: ["广州咖啡馆", "探店"],
          structure: ["适合谁", "体验", "避坑"],
          imagePrompt: "自然光咖啡馆",
          basedOnEvidenceIds: ["insight-1"]
        }
      },
      finalPost: {
        title: "广州咖啡周末指南",
        content: "这篇适合想周末找安静咖啡馆的人。先看人均和排队，再看座位光线，最后给适合人群和避峰建议。",
        tags: ["广州咖啡馆", "探店"],
        imageIds: ["asset-old"],
        imagePromptVersionIds: []
      }
    });

    expect(quality.canPublish).toBe(false);
    expect(quality.issues.join(" ")).toContain("最终帖子图片版本与当前选中图片不一致");
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

  it("stores project-scoped memory from explicit user preferences", async () => {
    await resetPostProject({ topic: "广州咖啡馆" });

    const first = await appendPostProjectMemoryFromTurn({
      message: "我喜欢真实探店感，保持生活化语气，不要再写得太像广告。",
      currentDraft: {
        draft: {
          title: "广州咖啡馆周末指南"
        }
      }
    });
    const duplicate = await appendPostProjectMemoryFromTurn({
      message: "我喜欢真实探店感，保持生活化语气，不要再写得太像广告。",
      currentDraft: null
    });

    expect(first.agentMemory.join("\n")).toContain("我喜欢真实探店感");
    expect(first.agentMemory.join("\n")).toContain("不要再写得太像广告");
    expect(duplicate.agentMemory).toEqual(first.agentMemory);
  });

  it("adds saved viral cases to the active evidence pack and refreshes CreativeBrief", async () => {
    await resetPostProject({
      topic: "广州咖啡馆",
      targetAudience: "探店账号粉丝",
      goal: "生成真实避坑探店笔记",
      evidencePack: {
        sampleIds: ["note-live"],
        insights: [{
          id: "insight-live-title",
          sourceType: "realtime",
          type: "title",
          insight: "标题先给适用人群和避坑收益",
          sourceSampleIds: ["note-live"],
          confidence: 0.82,
          createdAt: "2026-05-30T00:00:00.000Z"
        }]
      },
      currentStage: "evidence_ready"
    });
    const viralCase = await createViralCaseFromEvidence({
      sample: {
        id: "note-viral",
        title: "广州咖啡馆高收藏拍照避坑",
        author: "author",
        likes: 1800,
        collects: 2400,
        comments: 120,
        shares: 40,
        score: 3600,
        url: "https://www.xiaohongshu.com/explore/note-viral",
        imageUrls: ["https://example.com/coffee.jpg"],
        cachedImageUrls: [],
        detailText: "先说明适合谁，再写人均、光线、座位和周末排队情况，最后提醒避开高峰。",
        commentSnippets: ["想知道人均", "哪张桌子适合拍照"],
        reasonHighlights: []
      },
      topic: "广州咖啡馆",
      category: "探店"
    });

    const updated = await addViralCasesToPostProject([viralCase]);
    const duplicate = await addViralCasesToPostProject([viralCase]);

    expect(updated.evidencePack.sampleIds).toContain(viralCase.id);
    expect(updated.evidencePack.insights.some((insight) => insight.sourceType === "viral_library")).toBe(true);
    expect(updated.evidencePack.summary).toMatchObject({
      viralKnowledge: {
        results: [expect.objectContaining({ case: expect.objectContaining({ id: viralCase.id }) })]
      }
    });
    expect(updated.creativeBrief?.basedOnEvidenceIds.some((id) => id.startsWith("viral-insight-"))).toBe(true);
    expect(duplicate.evidencePack.insights.length).toBe(updated.evidencePack.insights.length);
  });

  it("summarizes which viral library evidence was added to the active post project", async () => {
    await resetPostProject({ topic: "Guangzhou coffee" });
    const viralCase = await createViralCaseFromEvidence({
      sample: {
        id: "note-viral-summary",
        title: "Guangzhou coffee saved guide",
        author: "author",
        likes: 1800,
        collects: 2400,
        comments: 120,
        shares: 40,
        score: 3600,
        url: "https://www.xiaohongshu.com/explore/note-viral-summary",
        imageUrls: ["https://example.com/coffee.jpg"],
        cachedImageUrls: [],
        detailText: "Lead with who should save it, then average spend, lighting, seats, and weekend queue warnings.",
        commentSnippets: ["average spend?", "which seat is best for photos?"],
        reasonHighlights: []
      },
      topic: "Guangzhou coffee",
      category: "Cafe review"
    });

    const first = await addViralCasesToPostProjectWithSummary([viralCase]);
    const duplicate = await addViralCasesToPostProjectWithSummary([viralCase]);

    expect(first.addedSampleIds).toEqual([viralCase.id]);
    expect(first.addedInsightIds.length).toBeGreaterThan(0);
    expect(first.addedInsights.every((insight) => insight.sourceType === "viral_library")).toBe(true);
    expect(first.project.evidencePack.sampleIds).toContain(viralCase.id);
    expect(first.project.creativeBrief?.basedOnEvidenceIds).toEqual(
      expect.arrayContaining(first.addedInsightIds.slice(0, 1))
    );
    const firstSummary = first.project.evidencePack.summary as {
      viralKnowledge?: {
        insights?: unknown[];
        evidenceTrace?: Array<{
          caseId?: string;
          sourceSampleId?: string;
          sourceUrl?: string;
          matchedQueries?: string[];
          reasons?: string[];
          evidenceInsightIds?: string[];
        }>;
      };
    };
    const duplicateSummary = duplicate.project.evidencePack.summary as {
      viralKnowledge?: {
        insights?: unknown[];
        evidenceTrace?: unknown[];
      };
    };
    expect(firstSummary.viralKnowledge?.evidenceTrace?.[0]).toMatchObject({
      caseId: viralCase.id,
      sourceSampleId: "note-viral-summary",
      sourceUrl: "https://www.xiaohongshu.com/explore/note-viral-summary",
      matchedQueries: ["manual-save"]
    });
    expect(firstSummary.viralKnowledge?.evidenceTrace?.[0].reasons?.length).toBeGreaterThan(0);
    expect(firstSummary.viralKnowledge?.evidenceTrace?.[0].evidenceInsightIds).toEqual(
      expect.arrayContaining(first.addedInsightIds.slice(0, 1))
    );
    expect(duplicate.addedInsightIds).toEqual([]);
    expect(duplicate.addedSampleIds).toEqual([]);
    expect(duplicateSummary.viralKnowledge?.insights?.length).toBe(firstSummary.viralKnowledge?.insights?.length);
    expect(duplicateSummary.viralKnowledge?.evidenceTrace?.length).toBe(firstSummary.viralKnowledge?.evidenceTrace?.length);
  });

  it("keeps forced low-quality viral cases as weak references in project evidence trace", async () => {
    await resetPostProject({ topic: "Weak topic" });
    const weakSample = {
      id: "note-weak-project",
      title: "Short note",
      author: "author",
      likes: 0,
      collects: 0,
      comments: 0,
      shares: 0,
      score: 0,
      url: "",
      imageUrls: [],
      cachedImageUrls: [],
      detailText: "",
      commentSnippets: [],
      reasonHighlights: []
    };
    const viralCase = markForcedLowQualityViralCase(await createViralCaseFromEvidence({
      sample: weakSample,
      topic: "Weak topic",
      category: "Weak category"
    }), reviewViralSaveCandidate(weakSample));

    const result = await addViralCasesToPostProjectWithSummary([viralCase]);
    const summary = result.project.evidencePack.summary as {
      viralKnowledge?: { evidenceTrace?: Array<{ reasons?: string[] }> };
    };

    expect(result.addedInsights.length).toBeGreaterThan(0);
    expect(result.addedInsights.every((insight) => insight.insight.startsWith("弱参考："))).toBe(true);
    expect(Math.max(...result.addedInsights.map((insight) => insight.confidence))).toBeLessThanOrEqual(0.48);
    expect(summary.viralKnowledge?.evidenceTrace?.[0].reasons?.join(" ")).toContain("弱参考");
  });

  it("keeps weak viral references out of CreativeBrief primary fields when stronger evidence exists", () => {
    const brief = deriveCreativeBrief({
      topic: "Quiet cafe guide",
      productInfo: { referenceAssetIds: [] },
      targetAudience: undefined,
      goal: undefined,
      tone: undefined,
      focusedEvidenceIds: [],
      creativeBrief: undefined,
      evidencePack: {
        sampleIds: ["viral-weak", "note-live"],
        insights: [
          {
            id: "viral-weak-audience",
            sourceType: "viral_library",
            type: "audience",
            insight: "弱参考：泛泛的咖啡用户",
            sourceSampleIds: ["viral-weak"],
            confidence: 0.42,
            createdAt: "2026-05-31T00:00:00.000Z"
          },
          {
            id: "live-audience",
            sourceType: "realtime",
            type: "audience",
            insight: "需要安静座位和插座的广州自习/办公人群",
            sourceSampleIds: ["note-live"],
            confidence: 0.82,
            createdAt: "2026-05-31T00:00:00.000Z"
          },
          {
            id: "live-pain",
            sourceType: "realtime",
            type: "pain_point",
            insight: "到店前不知道噪音、座位和周末排队情况",
            sourceSampleIds: ["note-live"],
            confidence: 0.8,
            createdAt: "2026-05-31T00:00:00.000Z"
          },
          {
            id: "live-visual",
            sourceType: "realtime",
            type: "visual",
            insight: "封面展示自然光、桌面空间和清晰座位环境",
            sourceSampleIds: ["note-live"],
            confidence: 0.78,
            createdAt: "2026-05-31T00:00:00.000Z"
          }
        ]
      }
    });

    expect(brief?.audience).toBe("需要安静座位和插座的广州自习/办公人群");
    expect(brief?.painPoint).toBe("到店前不知道噪音、座位和周末排队情况");
    expect(brief?.visualMood).toBe("封面展示自然光、桌面空间和清晰座位环境");
    expect(brief?.basedOnEvidenceIds.slice(0, 3)).toEqual(["live-audience", "live-pain", "live-visual"]);
  });

  it("keeps saved viral sufficiency blocked when realtime evidence is missing", async () => {
    await resetPostProject({ topic: "Guangzhou coffee" });
    const firstCase = await createViralCaseFromEvidence({
      sample: {
        id: "note-viral-count-1",
        title: "Guangzhou coffee high save guide",
        author: "author",
        likes: 1800,
        collects: 2400,
        comments: 120,
        shares: 40,
        score: 3600,
        url: "https://www.xiaohongshu.com/explore/note-viral-count-1",
        imageUrls: ["https://example.com/coffee-1.jpg"],
        cachedImageUrls: [],
        detailText: "Lead with who should save it, then lighting, seats, budget, and weekend queue warnings.",
        commentSnippets: ["average spend?", "which seat is best for photos?"],
        reasonHighlights: []
      },
      topic: "Guangzhou coffee",
      category: "Cafe review"
    });
    const secondCase = await createViralCaseFromEvidence({
      sample: {
        id: "note-viral-count-2",
        title: "Guangzhou coffee weekend seat review",
        author: "author",
        likes: 1200,
        collects: 1600,
        comments: 90,
        shares: 35,
        score: 2800,
        url: "https://www.xiaohongshu.com/explore/note-viral-count-2",
        imageUrls: ["https://example.com/coffee-2.jpg"],
        cachedImageUrls: [],
        detailText: "Start from the weekend use case, compare seats and natural light, then close with a queue warning.",
        commentSnippets: ["is it crowded?", "good for laptop work?"],
        reasonHighlights: []
      },
      topic: "Guangzhou coffee",
      category: "Cafe review"
    });

    const result = await addViralCasesToPostProjectWithSummary([firstCase, secondCase]);
    const viralKnowledge = result.project.evidencePack.summary as {
      viralKnowledge?: {
        sufficiency?: { isEnough?: boolean; realtimeCount?: number; viralCount?: number; missing?: string[] };
      };
    };

    expect(viralKnowledge.viralKnowledge?.sufficiency).toMatchObject({
      isEnough: false,
      realtimeCount: 0,
      viralCount: 2,
      missing: expect.arrayContaining(["实时小红书样本不足 3 条"])
    });
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

  it("blocks publish when field-level evidence references are not traceable", () => {
    const quality = runPostQualityGate({
      creativeBrief: {
        audience: "coffee lovers",
        painPoint: "need a quiet weekend cafe",
        contentAngle: "real cafe recommendation",
        emotionalHook: "clear fit before details",
        proofPoints: ["queue", "seat", "price"],
        tone: "real",
        visualMood: "natural light",
        imageMustHave: ["window seat"],
        imageMustAvoid: [],
        platformStyle: "xiaohongshu real sharing",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["insight-1"]
      },
      visualDirection: {
        mood: "natural light",
        composition: "window seat and drink",
        colorPalette: "warm",
        mustHave: ["window seat"],
        mustAvoid: [],
        basedOnEvidenceIds: ["insight-1"]
      },
      selectedImages: ["asset-1"],
      evidencePack: {
        sampleIds: ["note-1"],
        insights: [{
          id: "insight-1",
          sourceType: "realtime",
          type: "copy",
          insight: "Write a real recommendation with queue, seating, price, and who it fits.",
          sourceSampleIds: ["note-1"],
          confidence: 0.82,
          createdAt: "2026-05-31T00:00:00.000Z"
        }]
      },
      copyDraft: {
        id: "draft-citation-missing",
        updatedAt: "2026-05-31T00:00:00.000Z",
        visibility: defaultSettings.defaultVisibility,
        images: [],
        draft: {
          title: "Guangzhou quiet cafe guide",
          content: "This post recommends a quiet weekend cafe through real details: who should go, when to avoid queues, how the seating and natural light feel, and what to check before saving it for a later visit.",
          tags: ["GuangzhouCafe", "CafeGuide"],
          structure: ["fit", "details", "reminder"],
          imagePrompt: "natural light cafe window seat",
          basedOnEvidenceIds: ["insight-1"],
          evidenceReferences: {
            title: ["insight-1"],
            content: ["missing-field-insight"],
            tags: ["insight-1"],
            imagePrompt: ["insight-1"]
          }
        }
      }
    });

    expect(quality.canPublish).toBe(false);
    expect(quality.issues.join(" ")).toContain("不可追溯证据");
    expect(quality.suggestions.join(" ")).toContain("当前 evidencePack");
  });

  it("infers field-specific evidence citations from shared basedOnEvidenceIds", () => {
    const report = buildEvidenceCitationReport({
      creativeBrief: {
        audience: "city cafe collectors",
        painPoint: "need a save-worthy quiet cafe",
        contentAngle: "real visit guide",
        emotionalHook: "avoid wasting time",
        proofPoints: ["queue", "price"],
        tone: "honest",
        visualMood: "natural light",
        imageMustHave: ["window seat"],
        imageMustAvoid: ["copied source images"],
        platformStyle: "xiaohongshu",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["insight-title", "insight-copy", "insight-tag", "insight-visual"]
      },
      evidencePack: {
        sampleIds: ["note-1", "viral-1"],
        insights: [
          {
            id: "insight-title",
            sourceType: "realtime",
            type: "title",
            insight: "Lead with the save-worthy cafe scene.",
            sourceSampleIds: ["note-1"],
            confidence: 0.9,
            createdAt: "2026-05-31T00:00:00.000Z"
          },
          {
            id: "insight-copy",
            sourceType: "viral_library",
            type: "structure",
            insight: "Use queue -> price -> seating -> reminder.",
            sourceSampleIds: ["viral-1"],
            confidence: 0.82,
            createdAt: "2026-05-31T00:00:00.000Z"
          },
          {
            id: "insight-tag",
            sourceType: "viral_library",
            type: "tag",
            insight: "Use city + scene + use-case tags.",
            sourceSampleIds: ["viral-1"],
            confidence: 0.75,
            createdAt: "2026-05-31T00:00:00.000Z"
          },
          {
            id: "insight-visual",
            sourceType: "realtime",
            type: "visual",
            insight: "Cover image should show natural light and a window seat.",
            sourceSampleIds: ["note-1"],
            confidence: 0.78,
            createdAt: "2026-05-31T00:00:00.000Z"
          }
        ]
      }
    }, ["insight-title", "insight-copy", "insight-tag", "insight-visual"]);

    expect(report.sections.find((section) => section.field === "title")?.evidenceIds).toEqual(["insight-title", "insight-copy"]);
    expect(report.sections.find((section) => section.field === "content")?.evidenceIds).toEqual(["insight-copy"]);
    expect(report.sections.find((section) => section.field === "tags")?.evidenceIds).toEqual(["insight-tag", "insight-title"]);
    expect(report.sections.find((section) => section.field === "imagePrompt")?.evidenceIds).toEqual(["insight-visual", "insight-copy"]);
  });
});
