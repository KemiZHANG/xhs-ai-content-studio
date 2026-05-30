import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAgentTurn } from "@/lib/agent/orchestrator";
import { resetPostProject } from "@/lib/post-project/store";
import { defaultSettings } from "@/lib/storage/settings";

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
