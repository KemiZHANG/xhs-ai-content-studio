import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAgentTurn } from "@/lib/agent/orchestrator";
import { resetPostProject } from "@/lib/post-project/store";
import { defaultSettings } from "@/lib/storage/settings";
import { createViralCaseFromEvidence, upsertViralCases } from "@/lib/viral-knowledge/store";
import type { SampleEvidence } from "@/lib/workflows/one-click";

let originalCwd: string;
let tempDir: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  tempDir = await mkdtemp(path.join(os.tmpdir(), "xhs-agent-turn-"));
  process.chdir(tempDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe("agent orchestrator", () => {
  it("asks for clarification before delegating ambiguous empty-project input", async () => {
    const runChatAgent = vi.fn(async () => ({ answer: "old answer" }));
    const result = await runAgentTurn({
      message: "hello",
      conversationId: "chat-1",
      settings: defaultSettings,
      history: [],
      currentDraft: null,
      attachedAssets: [],
      mcp: {
        searchFeeds: async () => [],
        getFeedDetail: async () => null,
        publishContent: async () => ({ ok: true })
      },
      model: {
        generateStructuredText: async () => "",
        analyzeImageStyle: async () => "",
        generateImage: async () => null,
        generateImageFromReference: async () => null
      },
      runChatAgentImpl: runChatAgent
    });

    expect(result.answer).toContain("信息还不够明确");
    expect(result.reply).toContain("信息还不够明确");
    expect(result.intent).toBe("ask");
    expect(result.intentConfidence).toBeLessThan(0.7);
    expect(result.needsUserInput).toBe(true);
    expect(result.questions.join(" ")).toContain("具体主题");
    expect(result.quickActions.map((action) => action.action)).toContain("search_research");
    expect(result.toolTrace.length).toBeGreaterThan(0);
    expect(result.agentRun.id).toMatch(/^agent-run-/);
    expect(result.agentRun.plan.steps.length).toBeGreaterThan(0);
    expect(result.trace.events.map((event) => event.type)).toEqual(
      expect.arrayContaining(["plan_created", "tool_completed", "run_completed"])
    );
    expect(result.workspace.lastUserIntent).toBe(result.agentRun.plan.intent);
    expect(result.postProject?.currentStage).toBe("empty");
    expect(runChatAgent).not.toHaveBeenCalled();
  });

  it("turns publish requests into guarded publish intents before MCP is called", async () => {
    let publishCalls = 0;
    const result = await runAgentTurn({
      message: "publish current draft",
      conversationId: "chat-1",
      settings: defaultSettings,
      history: [],
      currentDraft: {
        id: "draft-1",
        updatedAt: "2026-05-21T00:00:00.000Z",
        draft: {
          title: "A useful title",
          content: "Original body content",
          tags: ["tag"],
          structure: [],
          imagePrompt: ""
        },
        images: [{ path: path.join(tempDir, "generated-assets", "generated", "draft.png") }],
        visibility: defaultSettings.defaultVisibility
      },
      attachedAssets: [],
      mcp: {
        searchFeeds: async () => [],
        getFeedDetail: async () => null,
        publishContent: async () => {
          publishCalls += 1;
          return { ok: true };
        }
      },
      model: {
        generateStructuredText: async () => "",
        analyzeImageStyle: async () => "",
        generateImage: async () => null,
        generateImageFromReference: async () => null
      }
    });

    expect(publishCalls).toBe(0);
    expect(result.answer).toContain("确认");
    expect(result.cards.map((card) => card.type)).toContain("publish_check");
    expect(result.stage).toBe("reviewing");
    expect(result.workspace.publishPlan?.status).toBe("awaiting_approval");
    expect(result.trace.events.map((event) => event.type)).toContain("tool_called");
  });

  it("generates images from the current draft inside the agent turn and updates workspace state", async () => {
    const imagePath = path.join(tempDir, "generated-assets", "generated", "agent-image.png");
    let prompt = "";

    const result = await runAgentTurn({
      message: "generate image for this draft",
      conversationId: "chat-1",
      settings: { ...defaultSettings, imageApiKey: "image-key" },
      history: [],
      currentDraft: {
        id: "draft-1",
        updatedAt: "2026-05-21T00:00:00.000Z",
        draft: {
          title: "A useful title",
          content: "Original body content",
          tags: ["tag"],
          structure: [],
          imagePrompt: "warm coffee shop cover image"
        },
        images: [],
        visibility: defaultSettings.defaultVisibility
      },
      attachedAssets: [],
      mcp: {
        searchFeeds: async () => [],
        getFeedDetail: async () => null,
        publishContent: async () => ({ ok: true })
      },
      model: {
        generateStructuredText: async () => "",
        analyzeImageStyle: async () => "",
        generateImage: async (input) => {
          prompt = input;
          return { path: imagePath };
        },
        generateImageFromReference: async () => null
      }
    });

    expect(prompt).toContain("warm coffee shop cover image");
    expect(result.answer).toContain("图片");
    expect(result.currentDraft?.images).toEqual([{ path: imagePath }]);
    expect(result.workspace.selectedImageIds.length).toBe(1);
  });

  it("plans visual direction from the active PostProject before image generation", async () => {
    await resetPostProject({
      topic: "广州咖啡馆",
      evidencePack: {
        sampleIds: ["note-1"],
        insights: [{
          id: "insight-visual",
          type: "visual",
          insight: "窗边自然光和桌面细节容易形成收藏感",
          sourceSampleIds: ["note-1"],
          confidence: 0.82,
          createdAt: "2026-05-30T00:00:00.000Z"
        }]
      },
      creativeBrief: {
        audience: "广州咖啡爱好者",
        painPoint: "不知道哪家店适合安静办公",
        contentAngle: "真实探店避坑",
        emotionalHook: "先给适用人群",
        proofPoints: ["座位", "价格"],
        tone: "真实生活化",
        visualMood: "窗边自然光、桌面细节",
        imageMustHave: ["咖啡杯", "窗边座位"],
        imageMustAvoid: ["不要盗用竞品图片"],
        platformStyle: "小红书图文",
        tabooWords: [],
        complianceNotes: ["不夸大"],
        basedOnEvidenceIds: ["insight-visual"]
      },
      currentStage: "brief_ready"
    });

    const result = await runAgentTurn({
      message: "请基于当前 CreativeBrief 生成图片方向和图片提示词",
      conversationId: "chat-visual",
      settings: defaultSettings,
      history: [],
      currentDraft: null,
      attachedAssets: [],
      mcp: {
        searchFeeds: async () => [],
        getFeedDetail: async () => null,
        publishContent: async () => ({ ok: true })
      },
      model: {
        generateStructuredText: async () => "",
        analyzeImageStyle: async () => "",
        generateImage: async () => null,
        generateImageFromReference: async () => null
      }
    });

    expect(result.answer).toContain("图片方向");
    expect(result.postProject?.visualDirection?.mood).toContain("窗边自然光");
    expect(result.postProject?.imagePrompts.length).toBeGreaterThan(0);
    expect(result.cards.map((card) => card.type)).toContain("visual_direction");
  });

  it("updates PostProject brief slots from natural-language requirements before asking more questions", async () => {
    const runChatAgent = vi.fn(async () => ({ answer: "legacy answer" }));
    const result = await runAgentTurn({
      message: "主题是广州咖啡馆，目标人群是探店账号粉丝，内容目标是生成真实避坑探店笔记，语气希望生活化不广告，店铺信息是独立咖啡店合集，卖点是安静办公和自然光",
      conversationId: "chat-brief",
      settings: defaultSettings,
      history: [],
      currentDraft: null,
      attachedAssets: [],
      mcp: {
        searchFeeds: async () => [],
        getFeedDetail: async () => null,
        publishContent: async () => ({ ok: true })
      },
      model: {
        generateStructuredText: async () => "",
        analyzeImageStyle: async () => "",
        generateImage: async () => null,
        generateImageFromReference: async () => null
      },
      runChatAgentImpl: runChatAgent
    });

    expect(runChatAgent).not.toHaveBeenCalled();
    expect(result.answer).toContain("写入当前 PostProject");
    expect(result.postProject?.topic).toBe("广州咖啡馆");
    expect(result.postProject?.targetAudience).toBe("探店账号粉丝");
    expect(result.postProject?.goal).toBe("生成真实避坑探店笔记");
    expect(result.postProject?.tone).toBe("生活化不广告");
    expect(result.postProject?.productInfo.name).toBe("独立咖啡店合集");
    expect(result.postProject?.productInfo.sellingPoints).toBe("安静办公和自然光");
    expect(result.postProject?.creativeBrief?.audience).toBe("探店账号粉丝");
    expect(result.stage).toBe("brief_ready");
    expect(result.workspace.topic).toBe("广州咖啡馆");
  });

  it("generates a PostProject draft with viral RAG evidence ids before falling back to legacy chat", async () => {
    const viralSample: SampleEvidence = {
      id: "note-viral-coffee",
      title: "广州咖啡馆高收藏避坑指南",
      author: "author",
      likes: 1200,
      collects: 1600,
      comments: 90,
      shares: 20,
      score: 2400,
      url: "https://www.xiaohongshu.com/explore/note-viral-coffee",
      imageUrls: ["https://example.com/coffee.jpg"],
      cachedImageUrls: [],
      detailText: "先讲适合人群，再写人均、排队、座位和拍照光线，最后提醒周末避峰。",
      commentSnippets: ["想知道人均", "哪张桌子适合拍照"],
      reasonHighlights: []
    };
    await upsertViralCases([
      await createViralCaseFromEvidence({
        sample: viralSample,
        topic: "广州咖啡馆",
        category: "探店"
      })
    ]);
    await resetPostProject({
      topic: "广州咖啡馆",
      targetAudience: "探店账号粉丝",
      goal: "生成真实探店笔记",
      evidencePack: {
        sampleIds: ["note-live-1"],
        insights: [{
          id: "insight-live-title",
          sourceType: "realtime",
          type: "title",
          insight: "标题先给适用人群和避坑收益",
          sourceSampleIds: ["note-live-1"],
          confidence: 0.82,
          createdAt: "2026-05-30T00:00:00.000Z"
        }]
      },
      selectedSamples: [viralSample],
      currentStage: "evidence_ready"
    });
    const runChatAgent = vi.fn(async () => ({ answer: "legacy answer" }));

    const result = await runAgentTurn({
      message: "请基于当前证据和爆款库规律生成一篇原创小红书笔记",
      conversationId: "chat-draft",
      settings: { ...defaultSettings, textApiKey: "text-key" },
      history: [],
      currentDraft: null,
      attachedAssets: [],
      mcp: {
        searchFeeds: async () => [],
        getFeedDetail: async () => null,
        publishContent: async () => ({ ok: true })
      },
      model: {
        generateStructuredText: async () => JSON.stringify({
          title: "广州咖啡探店避坑",
          content: "这篇适合想周末找安静咖啡馆的人。先看人均和排队，再看座位光线，最后给适合人群和避峰建议。",
          tags: ["广州咖啡馆", "探店", "周末去哪"],
          structure: ["适合谁", "核心体验", "避坑提醒"],
          imagePrompt: "广州咖啡馆窗边自然光，桌面咖啡和座位细节，真实探店感",
          basedOnEvidenceIds: ["insight-live-title"],
          evidenceReferences: {
            title: ["insight-live-title"],
            content: ["insight-live-title"],
            tags: ["insight-live-title"],
            imagePrompt: ["insight-live-title"]
          }
        }),
        analyzeImageStyle: async () => "",
        generateImage: async () => null,
        generateImageFromReference: async () => null
      },
      runChatAgentImpl: runChatAgent
    });

    expect(runChatAgent).not.toHaveBeenCalled();
    expect(result.currentDraft?.draft.title).toBe("广州咖啡探店避坑");
    expect(result.currentDraft?.draft.basedOnEvidenceIds?.length).toBeGreaterThan(0);
    expect(result.postProject?.evidencePack.insights.some((insight) => insight.sourceType === "viral_library")).toBe(true);
    expect(result.postProject?.copyDraft?.id).toBe(result.currentDraft?.id);
    expect(result.answer).toContain("爆款库");
    expect(result.cards.map((card) => card.type)).toContain("copy_draft");
  });

  it("uses the selected image index when preparing a scheduled publish intent", async () => {
    const firstImage = path.join(tempDir, "generated-assets", "generated", "one.png");
    const secondImage = path.join(tempDir, "generated-assets", "generated", "two.png");
    await runAgentTurn({
      message: "generate image one",
      conversationId: "chat-1",
      settings: { ...defaultSettings, imageApiKey: "image-key" },
      history: [],
      currentDraft: {
        id: "draft-1",
        updatedAt: "2026-05-21T00:00:00.000Z",
        draft: {
          title: "A useful title",
          content: "Original body content",
          tags: ["tag"],
          structure: [],
          imagePrompt: "first"
        },
        images: [],
        visibility: defaultSettings.defaultVisibility
      },
      attachedAssets: [],
      mcp: {
        searchFeeds: async () => [],
        getFeedDetail: async () => null,
        publishContent: async () => ({ ok: true })
      },
      model: {
        generateStructuredText: async () => "",
        analyzeImageStyle: async () => "",
        generateImage: async () => ({ path: firstImage }),
        generateImageFromReference: async () => null
      }
    });
    const result = await runAgentTurn({
      message: "generate image two",
      conversationId: "chat-1",
      settings: { ...defaultSettings, imageApiKey: "image-key" },
      history: [],
      currentDraft: {
        id: "draft-1",
        updatedAt: "2026-05-21T00:00:00.000Z",
        draft: {
          title: "A useful title",
          content: "Original body content",
          tags: ["tag"],
          structure: [],
          imagePrompt: "second"
        },
        images: [{ path: firstImage }],
        visibility: defaultSettings.defaultVisibility
      },
      attachedAssets: [],
      mcp: {
        searchFeeds: async () => [],
        getFeedDetail: async () => null,
        publishContent: async () => ({ ok: true })
      },
      model: {
        generateStructuredText: async () => "",
        analyzeImageStyle: async () => "",
        generateImage: async () => ({ path: secondImage }),
        generateImageFromReference: async () => null
      }
    });

    const publish = await runAgentTurn({
      message: "use second image and schedule at 2099-05-22T20:00:00+08:00",
      conversationId: "chat-1",
      settings: defaultSettings,
      history: [],
      currentDraft: result.currentDraft,
      attachedAssets: [],
      mcp: {
        searchFeeds: async () => [],
        getFeedDetail: async () => null,
        publishContent: async () => {
          throw new Error("should not publish before review");
        }
      },
      model: {
        generateStructuredText: async () => "",
        analyzeImageStyle: async () => "",
        generateImage: async () => null,
        generateImageFromReference: async () => null
      }
    });

    expect(publish.workspace.publishPlan?.status).toBe("awaiting_approval");
    expect(publish.workspace.publishPlan?.scheduleAt).toBe("2099-05-22T20:00:00+08:00");
    expect(publish.workspace.publishPlan?.images).toEqual([secondImage]);
  });

  it("stores standalone image selection on workspace and PostProject", async () => {
    await resetPostProject({
      topic: "广州咖啡馆",
      generatedImages: [
        { id: "asset-1", assetId: "asset-1", createdAt: "2026-05-30T00:00:00.000Z" },
        { id: "asset-2", assetId: "asset-2", createdAt: "2026-05-30T00:00:00.000Z" }
      ],
      selectedImages: ["asset-1"],
      currentStage: "image_ready"
    });
    const { updateWorkspaceState } = await import("@/lib/agent/state");
    await updateWorkspaceState({ selectedImageIds: ["asset-1", "asset-2"] });

    const result = await runAgentTurn({
      message: "就用第二张图",
      conversationId: "chat-select-image",
      settings: defaultSettings,
      history: [],
      currentDraft: {
        id: "draft-1",
        updatedAt: "2026-05-30T00:00:00.000Z",
        draft: {
          title: "A useful title",
          content: "Original body content",
          tags: ["tag"],
          structure: [],
          imagePrompt: ""
        },
        images: [],
        visibility: defaultSettings.defaultVisibility
      },
      attachedAssets: [],
      mcp: {
        searchFeeds: async () => [],
        getFeedDetail: async () => null,
        publishContent: async () => ({ ok: true })
      },
      model: {
        generateStructuredText: async () => "",
        analyzeImageStyle: async () => "",
        generateImage: async () => null,
        generateImageFromReference: async () => null
      }
    });

    expect(result.intent).toBe("select_images");
    expect(result.workspace.selectedImageIds).toEqual(["asset-2"]);
    expect(result.postProject?.selectedImages).toEqual(["asset-2"]);
    expect(result.postProject?.generatedImages.find((image) => image.assetId === "asset-2")?.selected).toBe(true);
    expect(result.answer).toContain("已选择第 2 张图");
  });

  it("assembles the current draft and selected image into finalPost before publish confirmation", async () => {
    await resetPostProject({
      topic: "广州咖啡馆",
      evidencePack: {
        sampleIds: ["note-1"],
        insights: [{
          id: "insight-1",
          sourceType: "realtime",
          type: "copy",
          insight: "真实写排队、人均和适合人群",
          sourceSampleIds: ["note-1"],
          confidence: 0.8,
          createdAt: "2026-05-30T00:00:00.000Z"
        }]
      },
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
      currentStage: "image_ready"
    });
    const draft = {
      id: "draft-final",
      updatedAt: "2026-05-30T00:00:00.000Z",
      draft: {
        title: "广州咖啡周末指南",
        content: "这篇适合想周末找安静咖啡馆的人。先看人均和排队，再看座位光线，最后给适合人群和避峰建议。",
        tags: ["广州咖啡馆", "探店"],
        structure: ["适合谁", "体验", "避坑"],
        imagePrompt: "自然光咖啡馆",
        basedOnEvidenceIds: ["insight-1"]
      },
      images: [],
      visibility: defaultSettings.defaultVisibility
    };
    const { updateWorkspaceState } = await import("@/lib/agent/state");
    await updateWorkspaceState({ currentDraftId: draft.id, currentDraft: draft, selectedImageIds: ["asset-1"] });

    const result = await runAgentTurn({
      message: "把当前内容组合成最终帖子并进入发布检查",
      conversationId: "chat-quality",
      settings: defaultSettings,
      history: [],
      currentDraft: draft,
      attachedAssets: [],
      mcp: {
        searchFeeds: async () => [],
        getFeedDetail: async () => null,
        publishContent: async () => ({ ok: true })
      },
      model: {
        generateStructuredText: async () => "",
        analyzeImageStyle: async () => "",
        generateImage: async () => null,
        generateImageFromReference: async () => null
      }
    });

    expect(result.intent).toBe("quality_check");
    expect(result.postProject?.finalPost?.title).toBe("广州咖啡周末指南");
    expect(result.postProject?.finalPost?.imageIds).toEqual(["asset-1"]);
    expect(result.postProject?.qualityCheck).toBeTruthy();
    expect(result.cards.map((card) => card.type)).toContain("quality_check");
    expect(result.answer).toContain("Quality Gate");
  });

  it("requires a confirmation intent even when auto publish policy is enabled", async () => {
    let publishCalls = 0;
    const result = await runAgentTurn({
      message: "publish current draft",
      conversationId: "chat-1",
      settings: { ...defaultSettings, agentPublishPolicy: "auto_publish_allowed" },
      history: [],
      currentDraft: {
        id: "draft-1",
        updatedAt: "2026-05-21T00:00:00.000Z",
        draft: {
          title: "A useful title",
          content: "Original body content",
          tags: ["tag"],
          structure: [],
          imagePrompt: ""
        },
        images: [{ path: path.join(tempDir, "generated-assets", "generated", "draft.png") }],
        visibility: defaultSettings.defaultVisibility
      },
      attachedAssets: [],
      mcp: {
        searchFeeds: async () => [],
        getFeedDetail: async () => null,
        publishContent: async () => {
          publishCalls += 1;
          return { ok: true };
        }
      },
      model: {
        generateStructuredText: async () => "",
        analyzeImageStyle: async () => "",
        generateImage: async () => null,
        generateImageFromReference: async () => null
      }
    });

    expect(publishCalls).toBe(0);
    expect(result.workspace.publishPlan?.status).toBe("awaiting_approval");
  });
});
