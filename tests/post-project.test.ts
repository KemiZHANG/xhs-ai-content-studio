import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetWorkspaceState, updateWorkspaceState } from "@/lib/agent/state";
import {
  addViralCasesToPostProject,
  appendPostProjectMemoryFromTurn,
  getPostStageGuidance,
  getAllowedPostActions,
  postProjectFromWorkspace,
  readPostProject,
  resetPostProject,
  updatePostProject
} from "@/lib/post-project";
import { runPostQualityGate } from "@/lib/post-project/quality";
import { defaultSettings } from "@/lib/storage/settings";
import { createViralCaseFromEvidence } from "@/lib/viral-knowledge/store";

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
