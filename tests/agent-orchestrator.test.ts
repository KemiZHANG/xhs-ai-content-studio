import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAgentTurn } from "@/lib/agent/orchestrator";
import { createPublishIntent } from "@/lib/agent/guardrails";
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
    expect(result.answer).toContain("你可以直接回复：主题：");
    expect(result.reply).toContain("信息还不够明确");
    expect(result.intent).toBe("ask");
    expect(result.intentConfidence).toBeLessThan(0.7);
    expect(result.needsUserInput).toBe(true);
    expect(result.questions.join(" ")).toContain("具体主题");
    expect(result.quickActions.map((action) => action.action)).toContain("search_research");
    expect(result.cards.find((card) => card.type === "director_summary")).toMatchObject({
      id: "card-director-summary",
      title: "我先帮你把信息补齐"
    });
    expect(result.cards.find((card) => card.type === "stage_guidance")).toMatchObject({
      id: "card-stage-guidance",
      type: "stage_guidance"
    });
    const clarifyCard = result.cards.find((card) => card.type === "clarify_next_steps");
    expect(clarifyCard).toMatchObject({
      id: "card-clarify-next-steps",
      title: "补充信息后再执行"
    });
    expect(clarifyCard?.summary).toContain("具体主题");
    expect(clarifyCard?.data).toMatchObject({
      stage: "empty",
      intent: "ask",
      safetyNote: "意图不清晰时不会调用搜索、生图、发布或定时工具。"
    });
    expect((clarifyCard?.data as { replyTemplate?: string }).replyTemplate).toContain("你可以直接回复");
    const stageCardData = result.cards.find((card) => card.type === "stage_guidance")?.data as
      | { stage?: string; readiness?: { progress?: number; nextAction?: string; blockers?: Array<{ id: string }> } }
      | undefined;
    expect(stageCardData?.stage).toBe("empty");
    expect(stageCardData?.readiness).toMatchObject({
      progress: 0
    });
    expect(stageCardData?.readiness?.blockers?.[0]).toMatchObject({ id: "evidence" });
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

  it("surfaces a compact Agent plan card for full research-to-post requests", async () => {
    const runChatAgent = vi.fn(async () => ({ answer: "legacy research flow" }));
    const result = await runAgentTurn({
      message: "帮我找最近一周广州咖啡馆高收藏笔记，分析标题和图片风格，再生成一篇适合探店账号的图文笔记",
      conversationId: "chat-plan-card",
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

    const planCard = result.cards.find((card) => card.type === "agent_plan");
    expect(planCard).toMatchObject({
      title: "Agent 执行计划",
      summary: expect.stringContaining("生成 CreativeBrief")
    });
    expect(planCard?.data).toMatchObject({
      intent: "research_to_draft",
      steps: expect.arrayContaining([
        expect.objectContaining({ action: "research", label: "搜索真实笔记" }),
        expect.objectContaining({ action: "retrieveViralKnowledge", label: "检索爆款库" }),
        expect.objectContaining({ action: "createCreativeBrief", label: "生成 CreativeBrief" }),
        expect.objectContaining({ action: "generateDraft", label: "生成文案" }),
        expect.objectContaining({ action: "planVisuals", label: "规划图片方向" })
      ])
    });
    expect(result.intent).toBe("research_to_draft");
    expect(result.toolTrace).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "project.createCreativeBrief",
        status: "planned"
      }),
      expect.objectContaining({
        label: "workflow.planVisuals",
        status: "planned"
      })
    ]));
  });

  it("asks stage-aware questions before drafting without evidence or CreativeBrief", async () => {
    await resetPostProject({ topic: "通勤包" });
    const result = await runAgentTurn({
      message: "帮我写一篇小红书笔记",
      conversationId: "chat-clarify-draft",
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

    expect(result.intent).toBe("ask");
    expect(result.needsUserInput).toBe(true);
    expect(result.questions.join(" ")).toContain("真实笔记研究");
    expect(result.questions.join(" ")).toContain("CreativeBrief");
    expect(result.questions.join(" ")).toContain("目标人群");
  });

  it("continues an evidence-ready PostProject without forcing the user to restate the next step", async () => {
    await resetPostProject({
      topic: "广州咖啡馆",
      targetAudience: "周末探店人群",
      goal: "生成真实探店笔记",
      tone: "真实分享",
      agentMemory: ["用户认可真实探店感", "避免广告腔"],
      evidencePack: {
        sampleIds: ["note-1"],
        insights: [
          {
            id: "insight-title",
            sourceType: "realtime",
            type: "title",
            insight: "标题先给城市、场景和收藏理由。",
            sourceSampleIds: ["note-1"],
            confidence: 0.86,
            createdAt: "2026-05-31T00:00:00.000Z"
          }
        ]
      }
    });

    const runChatAgent = vi.fn(async () => ({ answer: "legacy should not run" }));
    const result = await runAgentTurn({
      message: "继续",
      conversationId: "chat-stage-continue",
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

    expect(result.intent).toBe("retrieve_viral_knowledge");
    expect(result.needsUserInput).toBe(false);
    expect(result.answer).toContain("刷新爆款库 RAG");
    expect(result.cards.find((card) => card.type === "director_summary")?.summary).toContain("下一步：刷新爆款库 RAG");
    expect(result.cards.find((card) => card.type === "director_summary")?.data).toMatchObject({
      intent: "retrieve_viral_knowledge",
      stage: "evidence_ready",
      nextAction: "retrieve_viral_knowledge",
      memorySignalCount: 2,
      memoryHints: ["用户认可真实探店感", "避免广告腔"]
    });
    expect(result.quickActions.map((action) => action.action)).toContain("retrieve_viral_knowledge");
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

  it("surfaces blocked publish reasons and recovery actions when policy prevents publishing", async () => {
    let publishCalls = 0;
    const result = await runAgentTurn({
      message: "现在帮我发布",
      conversationId: "chat-blocked-publish",
      settings: { ...defaultSettings, agentPublishPolicy: "draft_only" },
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
    expect(result.workspace.publishPlan?.status).toBe("blocked");
    const publishCard = result.cards.find((card) => card.id === "card-publish-check");
    expect(publishCard?.title).toBe("发布准备被拦截");
    expect(publishCard?.summary).toContain("draft only mode blocks external publishing");
    expect(publishCard?.data).toMatchObject({
      blockers: expect.arrayContaining(["draft only mode blocks external publishing"]),
      nextActions: ["run_quality_gate", "revise_copy", "select_images"]
    });
    expect(result.quickActions.map((action) => action.action)).toEqual([
      "run_quality_gate",
      "revise_copy",
      "select_images"
    ]);
  });

  it.each(["确认发布，就这样发", "可以发了", "确认定时发布"])(
    "reviews an existing publish confirmation for %s instead of publishing from chat",
    async (message) => {
    const imagePath = path.join(tempDir, "generated-assets", "generated", "confirm.png");
    const publishIntent = {
      ...createPublishIntent({
        title: "广州周末咖啡馆",
        content: "适合周末收藏的咖啡馆真实分享。",
        tags: ["广州咖啡", "探店"],
        images: [imagePath],
        visibility: defaultSettings.defaultVisibility,
        requestedBy: "manual",
        accountId: defaultSettings.activeAccountId,
        mcpUrl: defaultSettings.mcpUrl
      }),
      status: "awaiting_approval" as const
    };
    await resetPostProject({
      topic: "广州咖啡馆",
      copyDraft: {
        id: "draft-confirm",
        updatedAt: "2026-05-31T00:00:00.000Z",
        draft: {
          title: publishIntent.title,
          content: publishIntent.content,
          tags: publishIntent.tags,
          structure: [],
          imagePrompt: ""
        },
        images: [{ path: imagePath }],
        visibility: defaultSettings.defaultVisibility
      },
      publishPlan: publishIntent,
      currentStage: "reviewing"
    });
    let publishCalls = 0;
    const result = await runAgentTurn({
      message,
      conversationId: `chat-review-confirmation-${message}`,
      settings: defaultSettings,
      history: [],
      currentDraft: null,
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

    expect(result.intent).toBe("review_publish_confirmation");
    expect(publishCalls).toBe(0);
    expect(result.answer).toContain("不会在聊天里直接调用小红书发布");
    expect(result.workspace.publishPlan?.id).toBe(publishIntent.id);
    expect(result.quickActions.map((action) => action.action)).toEqual([
      "review_publish_confirmation",
      "confirm_publish",
      "cancel_publish"
    ]);
    }
  );

  it("cancels an existing publish confirmation without external publishing", async () => {
    const publishIntent = {
      ...createPublishIntent({
        title: "广州周末咖啡馆",
        content: "适合周末收藏的咖啡馆真实分享。",
        tags: ["广州咖啡", "探店"],
        images: [path.join(tempDir, "generated-assets", "generated", "confirm.png")],
        visibility: defaultSettings.defaultVisibility,
        requestedBy: "manual",
        accountId: defaultSettings.activeAccountId,
        mcpUrl: defaultSettings.mcpUrl
      }),
      status: "awaiting_approval" as const
    };
    await resetPostProject({
      topic: "广州咖啡馆",
      publishPlan: publishIntent,
      currentStage: "reviewing"
    });
    const result = await runAgentTurn({
      message: "先别发了，取消确认单",
      conversationId: "chat-cancel-confirmation",
      settings: defaultSettings,
      history: [],
      currentDraft: null,
      attachedAssets: [],
      mcp: {
        searchFeeds: async () => [],
        getFeedDetail: async () => null,
        publishContent: async () => {
          throw new Error("should not publish when cancelling");
        }
      },
      model: {
        generateStructuredText: async () => "",
        analyzeImageStyle: async () => "",
        generateImage: async () => null,
        generateImageFromReference: async () => null
      }
    });

    expect(result.intent).toBe("cancel_publish_confirmation");
    expect(result.workspace.publishPlan).toBeNull();
    expect(result.postProject?.publishPlan).toBeNull();
    expect(result.answer).toContain("没有调用小红书发布");
  });

  it("asks for a draft instead of researching when publish is requested without a draft", async () => {
    const runChatAgent = vi.fn(async () => ({ answer: "legacy answer" }));
    await resetPostProject({
      topic: "广州咖啡馆",
      evidencePack: {
        sampleIds: ["sample-1"],
        insights: [{
          id: "insight-title-1",
          sourceType: "realtime",
          type: "title",
          insight: "标题用具体地点和收藏理由提高点击",
          sourceSampleIds: ["sample-1"],
          confidence: 0.8,
          createdAt: "2026-05-21T00:00:00.000Z"
        }]
      },
      currentStage: "evidence_ready"
    });
    const result = await runAgentTurn({
      message: "帮我发布到小红书",
      conversationId: "chat-1",
      settings: defaultSettings,
      history: [],
      currentDraft: null,
      attachedAssets: [],
      mcp: {
        searchFeeds: async () => {
          throw new Error("should not search");
        },
        getFeedDetail: async () => null,
        publishContent: async () => {
          throw new Error("should not publish");
        }
      },
      model: {
        generateStructuredText: async () => "",
        analyzeImageStyle: async () => "",
        generateImage: async () => null,
        generateImageFromReference: async () => null
      },
      runChatAgentImpl: runChatAgent
    });

    expect(result.intent).toBe("ask");
    expect(result.needsUserInput).toBe(true);
    expect(result.intentConfidence).toBeLessThan(0.7);
    expect(result.questions.join(" ")).toContain("还没有可发布的草稿");
    expect(result.answer).toContain("还没有可发布的草稿");
    expect(result.cards).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "card-publish-missing-draft",
        type: "publish_check",
        title: "发布前缺少草稿"
      })
    ]));
    expect(result.workspace.publishPlan).toBeNull();
    expect(result.quickActions.map((action) => action.action)).toEqual([
      "generate_copy",
      "select_images",
      "assemble_post"
    ]);
    expect(runChatAgent).not.toHaveBeenCalled();
  });

  it("asks which draft to revise instead of delegating vague revision when no draft exists", async () => {
    const runChatAgent = vi.fn(async () => ({ answer: "legacy answer" }));
    await resetPostProject({
      topic: "广州咖啡馆",
      creativeBrief: {
        audience: "周末探店人群",
        painPoint: "不知道去哪家咖啡馆",
        contentAngle: "真实探店建议",
        emotionalHook: "先给结论",
        proofPoints: ["位置", "氛围"],
        tone: "生活化",
        visualMood: "自然光",
        imageMustHave: ["咖啡", "空间"],
        imageMustAvoid: ["虚假 logo"],
        platformStyle: "小红书探店",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["insight-title-1"]
      },
      evidencePack: {
        sampleIds: ["sample-1"],
        insights: [{
          id: "insight-title-1",
          sourceType: "realtime",
          type: "title",
          insight: "标题用具体地点和收藏理由提高点击",
          sourceSampleIds: ["sample-1"],
          confidence: 0.8,
          createdAt: "2026-05-21T00:00:00.000Z"
        }]
      },
      currentStage: "brief_ready"
    });

    const result = await runAgentTurn({
      message: "把标题再优化一下，正文更生活化",
      conversationId: "chat-revise-missing-draft",
      settings: defaultSettings,
      history: [],
      currentDraft: null,
      attachedAssets: [],
      mcp: {
        searchFeeds: async () => {
          throw new Error("should not search");
        },
        getFeedDetail: async () => null,
        publishContent: async () => {
          throw new Error("should not publish");
        }
      },
      model: {
        generateStructuredText: async () => "",
        analyzeImageStyle: async () => "",
        generateImage: async () => null,
        generateImageFromReference: async () => null
      },
      runChatAgentImpl: runChatAgent
    });

    expect(result.intent).toBe("ask");
    expect(result.needsUserInput).toBe(true);
    expect(result.answer).toContain("还没有可修改的文案草稿");
    expect(result.questions.join(" ")).toContain("先基于现有证据生成一版");
    expect(result.quickActions.map((action) => action.action)).toEqual([
      "generate_copy",
      "select_images",
      "assemble_post"
    ]);
    expect(runChatAgent).not.toHaveBeenCalled();
  });

  it("generates images from the current draft inside the agent turn and updates workspace state", async () => {
    const imagePath = path.join(tempDir, "generated-assets", "generated", "agent-image.png");
    let prompt = "";
    await resetPostProject({
      topic: "coffee shop",
      creativeBrief: {
        audience: "coffee fans",
        painPoint: "need a calm place",
        contentAngle: "real visit",
        emotionalHook: "weekend save",
        proofPoints: ["light"],
        tone: "warm",
        visualMood: "warm coffee shop",
        imageMustHave: ["coffee"],
        imageMustAvoid: [],
        platformStyle: "xiaohongshu",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["insight-visual"]
      },
      visualDirection: {
        mood: "warm",
        composition: "coffee table",
        colorPalette: "warm neutral",
        mustHave: ["coffee"],
        mustAvoid: [],
        basedOnEvidenceIds: ["insight-visual"],
        confirmationStatus: "confirmed",
        confirmedAt: "2026-05-31T00:00:00.000Z",
        confirmedBy: "user"
      },
      evidencePack: {
        sampleIds: ["sample-1"],
        insights: [
          {
            id: "insight-visual",
            sourceType: "realtime",
            type: "visual",
            insight: "Use warm coffee table light",
            sourceSampleIds: ["sample-1"],
            confidence: 0.9,
            createdAt: "2026-05-31T00:00:00.000Z"
          },
          {
            id: "viral-insight-visual",
            sourceType: "viral_library",
            type: "visual",
            insight: "学习自然光和信息层级，但不要复刻原图构图",
            sourceSampleIds: ["viral-case-1"],
            confidence: 0.75,
            createdAt: "2026-05-31T00:00:00.000Z"
          }
        ],
        summary: {
          viralKnowledge: {
            results: [{
              case: {
                id: "viral-case-1",
                extractedInsights: { avoidCopying: ["不要盗用原图构图"] },
                creativeSafety: {
                  doNotCopy: ["不要复制竞品图片布局"],
                  transformationGuidance: ["只学习光线、信息层级和情绪氛围"]
                }
              }
            }]
          }
        }
      },
      imagePrompts: [{
        id: "prompt-v1",
        createdAt: "2026-05-31T00:00:00.000Z",
        label: "主图 Prompt",
        value: { prompt: "warm coffee shop cover image" },
        basedOnEvidenceIds: ["insight-visual"]
      }]
    });

    const result = await runAgentTurn({
      message: "请基于当前草稿生成配图",
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
    expect(prompt).toContain("Viral library originality boundaries");
    expect(prompt).toContain("不要复制竞品图片布局");
    expect(prompt).toContain("只学习光线");
    expect(result.answer).toContain("图片");
    expect(result.currentDraft?.images).toEqual([{ path: imagePath }]);
    expect(result.workspace.selectedImageIds.length).toBe(1);
    expect(result.postProject?.generatedImages).toHaveLength(1);
    expect(result.postProject?.generatedImages[0].assetId).toBe(result.workspace.selectedImageIds[0]);
    expect(result.postProject?.generatedImages[0].selected).toBe(true);
    expect(result.postProject?.generatedImages[0]).toMatchObject({
      promptVersionId: "prompt-v1",
      basedOnEvidenceIds: ["insight-visual"],
      sourceAssetIds: []
    });
    expect(result.postProject?.selectedImages).toEqual(result.workspace.selectedImageIds);
    expect(result.postProject?.publishPlan).toBeNull();
  });

  it("records explicit visual direction confirmation on the active PostProject", async () => {
    await resetPostProject({
      topic: "广州咖啡馆",
      visualDirection: {
        mood: "自然光探店感",
        composition: "桌面近景，咖啡在画面中心",
        colorPalette: "暖白和木色",
        mustHave: ["咖啡", "自然光"],
        mustAvoid: ["广告海报感"],
        basedOnEvidenceIds: ["insight-visual"],
        confirmationStatus: "pending"
      },
      imagePrompts: [{
        id: "prompt-confirm",
        createdAt: "2026-05-31T00:00:00.000Z",
        label: "主图 Prompt",
        value: { prompt: "自然光咖啡馆桌面近景" },
        basedOnEvidenceIds: ["insight-visual"]
      }],
      currentStage: "image_prompt_ready"
    });

    const result = await runAgentTurn({
      message: "确认图片方向，就按当前视觉方向继续",
      conversationId: "chat-confirm-visual",
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

    expect(result.postProject?.visualDirection?.confirmationStatus).toBe("confirmed");
    expect(result.postProject?.visualDirection?.confirmedBy).toBe("user");
    expect(result.postProject?.visualDirection?.confirmedAt).toBeTruthy();
    expect(result.answer).toContain("已确认当前图片方向");
    expect(result.quickActions.map((action) => action.action)).toContain("generate_images");
  });

  it("blocks image generation when the current visual direction is not confirmed", async () => {
    const generateImage = vi.fn(async () => ({ path: "should-not-be-used.png" }));
    await resetPostProject({
      topic: "广州咖啡馆",
      visualDirection: {
        mood: "自然光探店感",
        composition: "桌面近景，咖啡在画面中心",
        colorPalette: "暖白和木色",
        mustHave: ["咖啡", "自然光"],
        mustAvoid: ["广告海报感"],
        basedOnEvidenceIds: ["insight-visual"],
        confirmationStatus: "pending"
      },
      imagePrompts: [{
        id: "prompt-unconfirmed",
        createdAt: "2026-05-31T00:00:00.000Z",
        label: "主图 Prompt",
        value: { prompt: "自然光咖啡馆桌面近景" },
        basedOnEvidenceIds: ["insight-visual"]
      }],
      copyDraft: {
        id: "draft-unconfirmed",
        updatedAt: "2026-05-31T00:00:00.000Z",
        draft: {
          title: "广州周末安静咖啡馆",
          content: "适合坐一下午的真实探店清单。",
          tags: ["广州咖啡"],
          structure: [],
          imagePrompt: "自然光咖啡馆桌面近景",
          basedOnEvidenceIds: ["insight-visual"]
        },
        images: [],
        visibility: defaultSettings.defaultVisibility
      },
      currentStage: "image_prompt_ready"
    });

    const result = await runAgentTurn({
      message: "请基于当前草稿生成配图",
      conversationId: "chat-block-unconfirmed-image",
      settings: { ...defaultSettings, imageApiKey: "image-key" },
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
        generateImage,
        generateImageFromReference: async () => null
      }
    });

    expect(generateImage).not.toHaveBeenCalled();
    expect(result.answer).toContain("还没有人工确认");
    expect(result.postProject?.generatedImages).toEqual([]);
  });

  it("generates images from the active PostProject draft when chat input has no currentDraft", async () => {
    const imagePath = path.join(tempDir, "generated-assets", "generated", "project-draft-image.png");
    let prompt = "";
    await resetPostProject({
      topic: "广州咖啡馆",
      evidencePack: {
        sampleIds: ["sample-visual"],
        insights: [{
          id: "insight-visual",
          sourceType: "realtime",
          type: "visual",
          insight: "封面使用自然光桌面近景，主体要清楚",
          sourceSampleIds: ["sample-visual"],
          confidence: 0.9,
          createdAt: "2026-05-31T00:00:00.000Z"
        }]
      },
      creativeBrief: {
        audience: "周末探店用户",
        painPoint: "不知道去哪坐一下午",
        contentAngle: "安静咖啡馆真实分享",
        emotionalHook: "周末慢下来",
        proofPoints: ["真实体验"],
        tone: "生活化",
        visualMood: "自然光、安静、真实探店感",
        imageMustHave: ["咖啡", "自然光", "桌面细节"],
        imageMustAvoid: ["夸张广告感"],
        platformStyle: "xiaohongshu",
        tabooWords: [],
        complianceNotes: ["不要虚构认证或销量"],
        basedOnEvidenceIds: ["insight-visual"]
      },
      visualDirection: {
        mood: "自然光探店感",
        composition: "桌面近景，咖啡在画面中心",
        colorPalette: "暖白和木色",
        mustHave: ["咖啡", "自然光"],
        mustAvoid: ["广告海报感"],
        basedOnEvidenceIds: ["insight-visual"],
        confirmationStatus: "confirmed",
        confirmedAt: "2026-05-31T00:00:00.000Z",
        confirmedBy: "user"
      },
      imagePrompts: [{
        id: "prompt-project-v1",
        createdAt: "2026-05-31T00:00:00.000Z",
        label: "主图 Prompt",
        value: { prompt: "自然光咖啡馆桌面近景，小红书真实探店照片" },
        basedOnEvidenceIds: ["insight-visual"]
      }],
      copyDraft: {
        id: "draft-project",
        updatedAt: "2026-05-31T00:00:00.000Z",
        draft: {
          title: "广州周末安静咖啡馆",
          content: "这家适合周末坐一下午。",
          tags: ["广州咖啡馆", "周末探店"],
          structure: ["场景", "体验", "建议"],
          imagePrompt: "自然光咖啡馆桌面近景，小红书真实探店照片",
          basedOnEvidenceIds: ["insight-visual"]
        },
        images: [],
        visibility: defaultSettings.defaultVisibility
      }
    });

    const result = await runAgentTurn({
      message: "请给当前帖子生成一张配图",
      conversationId: "chat-project-image",
      settings: { ...defaultSettings, imageApiKey: "image-key" },
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
        generateImage: async (input) => {
          prompt = input;
          return { path: imagePath };
        },
        generateImageFromReference: async () => null
      }
    });

    expect(prompt).toContain("PostProject topic: 广州咖啡馆");
    expect(prompt).toContain("CreativeBrief");
    expect(prompt).toContain("insight-visual");
    expect(result.currentDraft?.id).toBe("draft-project");
    expect(result.currentDraft?.images).toEqual([{ path: imagePath }]);
    expect(result.answer).toContain("图片依据证据：insight-visual");
    expect(result.workspace.currentDraftId).toBe("draft-project");
    expect(result.postProject?.generatedImages[0]).toMatchObject({
      promptVersionId: "prompt-project-v1",
      basedOnEvidenceIds: ["insight-visual"],
      selected: true
    });
    expect(result.postProject?.selectedImages).toEqual(result.workspace.selectedImageIds);
  });

  it("prioritizes quick actions from PostProject readiness gaps", async () => {
    await resetPostProject({
      topic: "广州咖啡馆",
      evidencePack: {
        sampleIds: ["sample-1"],
        insights: [
          {
            id: "insight-title",
            sourceType: "realtime",
            type: "title",
            insight: "标题先给真实场景再给收藏理由",
            sourceSampleIds: ["sample-1"],
            confidence: 0.82,
            createdAt: "2026-05-31T00:00:00.000Z"
          }
        ]
      },
      selectedSamples: [{ id: "sample-1", title: "sample" }],
      creativeBrief: {
        audience: "周末探店用户",
        painPoint: "不知道去哪坐一下午",
        contentAngle: "安静咖啡馆清单",
        emotionalHook: "周末慢下来",
        proofPoints: ["真实体验"],
        tone: "生活化",
        visualMood: "自然光",
        imageMustHave: ["咖啡杯"],
        imageMustAvoid: ["夸张广告"],
        platformStyle: "小红书探店",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["insight-title"]
      },
      copyDraft: {
        id: "draft-1",
        updatedAt: "2026-05-31T00:00:00.000Z",
        draft: {
          title: "广州周末安静咖啡馆",
          content: "适合坐一下午的真实探店清单。",
          tags: ["广州咖啡"],
          structure: [],
          imagePrompt: "",
          basedOnEvidenceIds: ["insight-title"]
        },
        images: [],
        visibility: defaultSettings.defaultVisibility
      },
      currentStage: "copy_ready"
    });

    const result = await runAgentTurn({
      message: "继续下一步",
      conversationId: "chat-readiness-actions",
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
      runChatAgentImpl: vi.fn(async () => ({ answer: "legacy answer" }))
    });

    expect(result.quickActions.map((action) => action.action).slice(0, 2)).toEqual([
      "select_images",
      "revise_copy"
    ]);
    expect(result.quickActions.map((action) => action.action)).not.toContain("run_quality_gate");
    expect(result.quickActions.map((action) => action.action)).not.toContain("request_publish_confirmation");
    const stageCardData = result.cards.find((card) => card.type === "stage_guidance")?.data as
      | { readiness?: { nextAction?: string; blockers?: Array<{ id: string }> } }
      | undefined;
    expect(stageCardData?.readiness?.nextAction).toBe("select_images");
    expect(stageCardData?.readiness?.blockers?.map((item) => item.id)).toContain("images");
  });

  it("does not surface direct publish actions before a confirmation intent exists", async () => {
    await resetPostProject({
      topic: "广州咖啡馆",
      evidencePack: {
        sampleIds: ["note-1"],
        insights: [{
          id: "insight-title",
          sourceType: "realtime",
          type: "title",
          insight: "标题先给场景和收益",
          sourceSampleIds: ["note-1"],
          confidence: 0.8,
          createdAt: "2026-05-31T00:00:00.000Z"
        }]
      },
      creativeBrief: {
        audience: "探店账号粉丝",
        painPoint: "不知道周末去哪",
        contentAngle: "真实探店建议",
        emotionalHook: "周末避坑",
        proofPoints: ["真实体验"],
        tone: "生活化",
        visualMood: "自然光",
        imageMustHave: ["咖啡杯"],
        imageMustAvoid: ["广告感"],
        platformStyle: "小红书探店",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["insight-title"]
      },
      copyDraft: {
        id: "draft-ready",
        updatedAt: "2026-05-31T00:00:00.000Z",
        draft: {
          title: "广州周末安静咖啡馆",
          content: "适合坐一下午的真实探店清单。",
          tags: ["广州咖啡"],
          structure: [],
          imagePrompt: "自然光咖啡桌面",
          basedOnEvidenceIds: ["insight-title"]
        },
        images: [],
        visibility: defaultSettings.defaultVisibility
      },
      finalPost: {
        title: "广州周末安静咖啡馆",
        content: "适合坐一下午的真实探店清单。",
        tags: ["广州咖啡"],
        imageIds: ["asset-1"],
        coverImageId: "asset-1",
        copyVersionId: "copy-draft-ready",
        imagePromptVersionIds: ["prompt-ready"],
        basedOnEvidenceIds: ["insight-title"]
      },
      visualDirection: {
        mood: "自然光探店",
        composition: "咖啡桌面近景",
        colorPalette: "暖白木色",
        mustHave: ["咖啡"],
        mustAvoid: ["广告海报感"],
        basedOnEvidenceIds: ["insight-title"],
        confirmationStatus: "confirmed",
        confirmedAt: "2026-05-31T00:00:00.000Z",
        confirmedBy: "user"
      },
      imagePrompts: [{
        id: "prompt-ready",
        createdAt: "2026-05-31T00:00:00.000Z",
        label: "主图 Prompt",
        value: { prompt: "自然光咖啡桌面" },
        basedOnEvidenceIds: ["insight-title"]
      }],
      selectedImages: ["asset-1"],
      qualityCheck: {
        titleScore: 90,
        copyScore: 90,
        visualConsistencyScore: 90,
        platformFitScore: 90,
        complianceScore: 90,
        canPublish: true,
        issues: [],
        suggestions: [],
        checkedAt: "2026-05-31T00:00:00.000Z"
      },
      currentStage: "reviewing"
    });

    const result = await runAgentTurn({
      message: "继续下一步",
      conversationId: "chat-reviewing-actions",
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
      runChatAgentImpl: vi.fn(async () => ({ answer: "legacy answer" }))
    });

    const actions = result.quickActions.map((action) => action.action);
    expect(actions).toContain("request_publish_confirmation");
    expect(actions).not.toContain("schedule_publish");
    expect(actions).not.toContain("publish_now");
  });

  it("keeps a vague real Chinese next-step command behind publish confirmation", async () => {
    await resetPostProject({
      topic: "广州咖啡馆",
      evidencePack: {
        sampleIds: ["note-1"],
        insights: [{
          id: "insight-title",
          sourceType: "realtime",
          type: "title",
          insight: "标题先给场景和收益",
          sourceSampleIds: ["note-1"],
          confidence: 0.8,
          createdAt: "2026-05-31T00:00:00.000Z"
        }]
      },
      copyDraft: {
        id: "draft-ready",
        updatedAt: "2026-05-31T00:00:00.000Z",
        draft: {
          title: "广州周末安静咖啡馆",
          content: "适合坐一下午的真实探店清单。",
          tags: ["广州咖啡"],
          structure: [],
          imagePrompt: "自然光咖啡桌面",
          basedOnEvidenceIds: ["insight-title"]
        },
        images: [],
        visibility: defaultSettings.defaultVisibility
      },
      finalPost: {
        title: "广州周末安静咖啡馆",
        content: "适合坐一下午的真实探店清单。",
        tags: ["广州咖啡"],
        imageIds: ["asset-1"],
        coverImageId: "asset-1",
        copyVersionId: "copy-draft-ready",
        imagePromptVersionIds: ["prompt-ready"],
        basedOnEvidenceIds: ["insight-title"]
      },
      selectedImages: ["asset-1"],
      qualityCheck: {
        titleScore: 90,
        copyScore: 90,
        visualConsistencyScore: 90,
        platformFitScore: 90,
        complianceScore: 90,
        canPublish: true,
        issues: [],
        suggestions: [],
        checkedAt: "2026-05-31T00:00:00.000Z"
      },
      currentStage: "reviewing"
    });

    let publishCalls = 0;
    const result = await runAgentTurn({
      message: "下一步",
      conversationId: "chat-real-chinese-vague-next-step",
      settings: defaultSettings,
      history: [],
      currentDraft: null,
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
      },
      runChatAgentImpl: vi.fn(async () => ({ answer: "legacy answer" }))
    });

    const actions = result.quickActions.map((action) => action.action);
    expect(publishCalls).toBe(0);
    expect(result.intent).toBe("ask");
    expect(result.needsUserInput).toBe(true);
    expect(actions).toContain("search_research");
    expect(actions).not.toContain("publish_now");
    expect(actions).not.toContain("schedule_publish");
    expect(actions).not.toContain("request_publish_confirmation");
    expect(result.answer).toContain("信息还不够明确");
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
        }, {
          id: "viral-insight-cover",
          sourceType: "viral_library",
          type: "visual",
          insight: "封面使用近景主体加手写清单感，更适合收藏型探店笔记",
          sourceSampleIds: ["viral-case-cover"],
          confidence: 0.86,
          createdAt: "2026-05-30T00:00:00.000Z"
        }]
      },
      focusedEvidenceIds: ["viral-insight-cover"],
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
    expect(result.cards.find((card) => card.type === "creative_brief")?.data).toMatchObject({
      evidenceSummary: expect.objectContaining({
        insights: [expect.objectContaining({ id: "insight-visual" })]
      })
    });
    expect(result.cards.find((card) => card.type === "evidence_summary")).toMatchObject({
      summary: expect.stringContaining("可追溯结论"),
      data: expect.objectContaining({
        insightCount: 2,
        sourceCounts: expect.objectContaining({
          realtime: 1,
          viral_library: 1
        }),
        keyInsights: expect.arrayContaining([
          expect.objectContaining({ id: "insight-visual" }),
          expect.objectContaining({ id: "viral-insight-cover" })
        ])
      })
    });
    expect(result.cards.find((card) => card.type === "visual_direction")?.data).toMatchObject({
      evidenceSummary: expect.objectContaining({
        hasRealtimeEvidence: true
      })
    });
    expect(result.stage).toBe("image_prompt_ready");
    expect(result.quickActions.map((action) => action.action)).toContain("generate_images");
    expect(result.answer).toContain("参考证据");
    expect(result.answer).toContain("insight-visual");
    expect(result.answer).toContain("viral-insight-cover");
  });

  it("labels generated planning as non-research advice when the project has no traceable evidence", async () => {
    await resetPostProject({
      topic: "广州咖啡馆",
      creativeBrief: {
        audience: "广州咖啡爱好者",
        painPoint: "不知道哪家店适合安静办公",
        contentAngle: "真实探店避坑",
        emotionalHook: "先给适用人群",
        proofPoints: ["座位", "价格"],
        tone: "生活化",
        visualMood: "窗边自然光",
        imageMustHave: ["咖啡杯"],
        imageMustAvoid: ["夸张广告"],
        platformStyle: "小红书探店",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: []
      },
      evidencePack: { sampleIds: [], insights: [] },
      currentStage: "brief_ready"
    });

    const result = await runAgentTurn({
      message: "请基于当前 CreativeBrief 生成图片方向和图片提示词",
      conversationId: "chat-visual-no-evidence",
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
    expect(result.answer).toContain("证据状态");
    expect(result.answer).toContain("不能当作小红书研究结论");
    expect(result.postProject?.evidencePack.insights).toEqual([]);
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
    expect(result.postProject?.evidencePack.sampleIds).toContain("user-brief");
    expect(result.postProject?.evidencePack.insights.some((insight) => insight.sourceType === "user_input" && insight.type === "audience")).toBe(true);
    expect(result.postProject?.evidencePack.insights.some((insight) => insight.sourceType === "user_input" && insight.insight.includes("安静办公和自然光"))).toBe(true);
    expect(result.postProject?.creativeBrief?.basedOnEvidenceIds.some((id) => id.includes("audience"))).toBe(true);
    expect(result.stage).toBe("brief_ready");
    expect(result.workspace.topic).toBe("广州咖啡馆");
  });

  it("starts a clean PostProject without carrying old evidence, draft, images, or publish plan", async () => {
    await resetPostProject({
      topic: "旧咖啡馆主题",
      evidencePack: {
        sampleIds: ["old-note"],
        insights: [{
          id: "old-insight",
          sourceType: "realtime",
          type: "copy",
          insight: "旧证据",
          sourceSampleIds: ["old-note"],
          confidence: 0.8,
          createdAt: "2026-05-30T00:00:00.000Z"
        }]
      },
      copyDraft: {
        id: "old-draft",
        updatedAt: "2026-05-30T00:00:00.000Z",
        draft: {
          title: "旧草稿",
          content: "旧内容",
          tags: ["旧标签"],
          structure: [],
          imagePrompt: ""
        },
        images: [],
        visibility: defaultSettings.defaultVisibility
      },
      generatedImages: [{ id: "old-image", assetId: "old-image", selected: true, createdAt: "2026-05-30T00:00:00.000Z" }],
      selectedImages: ["old-image"],
      publishPlan: {
        id: "old-publish",
        mode: "manual",
        status: "awaiting_approval",
        title: "旧草稿",
        content: "旧内容",
        tags: ["旧标签"],
        images: ["old-image"],
        visibility: defaultSettings.defaultVisibility,
        requestedBy: "chat",
        requestedAt: "2026-05-30T00:00:00.000Z",
        idempotencyKey: "old-key",
        guardrailResults: []
      },
      currentStage: "reviewing"
    });
    const { resetWorkspaceState } = await import("@/lib/agent/state");
    await resetWorkspaceState({
      topic: "旧咖啡馆主题",
      selectedSamples: [{ id: "old-note" }],
      currentDraftId: "old-draft",
      selectedImageIds: ["old-image"],
      publishPlan: {
        id: "old-publish",
        mode: "manual",
        status: "awaiting_approval",
        title: "旧草稿",
        content: "旧内容",
        tags: ["旧标签"],
        images: ["old-image"],
        visibility: defaultSettings.defaultVisibility,
        requestedBy: "chat",
        requestedAt: "2026-05-30T00:00:00.000Z",
        idempotencyKey: "old-key",
        guardrailResults: []
      }
    });
    const runChatAgent = vi.fn(async () => ({ answer: "legacy answer" }));

    const result = await runAgentTurn({
      message: "新建一个帖子项目，主题是通勤包，目标人群是上班族，内容目标是生成真实通勤分享，语气希望生活化，产品信息是轻便托特包，卖点是大容量和不压肩",
      conversationId: "chat-new-project",
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
    expect(result.intent).toBe("start_project");
    expect(result.answer).toContain("已新建");
    expect(result.postProject?.topic).toBe("通勤包");
    expect(result.postProject?.targetAudience).toBe("上班族");
    expect(result.postProject?.goal).toBe("生成真实通勤分享");
    expect(result.postProject?.tone).toBe("生活化");
    expect(result.postProject?.productInfo.name).toBe("轻便托特包");
    expect(result.postProject?.productInfo.sellingPoints).toBe("大容量和不压肩");
    expect(result.postProject?.evidencePack.insights.some((insight) => insight.id === "old-insight")).toBe(false);
    expect(result.postProject?.evidencePack.insights.every((insight) => insight.sourceType === "user_input")).toBe(true);
    expect(result.postProject?.evidencePack.insights.map((insight) => insight.insight).join(" ")).toContain("用户指定主题：通勤包");
    expect(result.postProject?.selectedSamples).toEqual([]);
    expect(result.postProject?.copyDraft).toBeNull();
    expect(result.postProject?.selectedImages).toEqual([]);
    expect(result.postProject?.publishPlan).toBeNull();
    expect(result.workspace.topic).toBe("通勤包");
    expect(result.workspace.selectedSamples).toEqual([]);
    expect(result.workspace.currentDraft).toBeNull();
    expect(result.workspace.selectedImageIds).toEqual([]);
    expect(result.workspace.publishPlan).toBeNull();
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
    let writerPrompt = "";

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
        generateStructuredText: async (prompt) => {
          writerPrompt = prompt;
          return JSON.stringify({
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
          });
        },
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
    expect(result.answer).toContain("这版为什么这样写");
    expect(result.answer).toContain("文案直接引用的证据");
    expect(result.answer).toContain("实时研究");
    expect(result.answer).toContain("爆款库补充规律");
    expect(result.answer).toContain("创作依据");
    expect(result.answer).toContain("下一步建议");
    expect(result.answer).toContain("图片方向");
    expect(result.quickActions.map((action) => action.action)).toContain("plan_visuals");
    expect(result.cards.map((card) => card.type)).toContain("copy_draft");
    expect(result.cards.map((card) => card.type)).toContain("evidence_citations");
    expect(result.cards.map((card) => card.type)).toContain("creation_provenance");
    expect(result.cards.find((card) => card.type === "evidence_summary")).toMatchObject({
      summary: expect.stringContaining("爆款库"),
      data: expect.objectContaining({
        sourceCounts: expect.objectContaining({
          realtime: 1,
          viral_library: expect.any(Number)
        })
      })
    });
    expect(result.cards.find((card) => card.type === "evidence_citations")?.summary).toContain("实时研究");
    expect(writerPrompt).toContain("爆款库原创边界");
    expect(writerPrompt).toContain("本次重点规律");
    expect(writerPrompt).toContain("只学习规律");
    expect(writerPrompt).toContain("不要复制");
  });

  it("passes selected focus evidence into the Writer prompt", async () => {
    await resetPostProject({
      topic: "通勤包",
      evidencePack: {
        sampleIds: ["viral-case-bag"],
        insights: [{
          id: "viral-insight-focus",
          sourceType: "viral_library",
          type: "hook",
          insight: "标题用真实通勤场景加收纳痛点开头",
          sourceSampleIds: ["viral-case-bag"],
          confidence: 0.86,
          createdAt: "2026-05-31T00:00:00.000Z"
        }, {
          id: "viral-insight-extra",
          sourceType: "viral_library",
          type: "visual",
          insight: "图片使用桌面平铺展示容量",
          sourceSampleIds: ["viral-case-bag"],
          confidence: 0.78,
          createdAt: "2026-05-31T00:00:00.000Z"
        }]
      },
      focusedEvidenceIds: ["viral-insight-focus"],
      creativeBrief: {
        audience: "上班族",
        painPoint: "东西太多不好拿",
        contentAngle: "真实通勤收纳分享",
        emotionalHook: "早高峰不狼狈",
        proofPoints: ["容量", "重量"],
        tone: "真实生活化",
        visualMood: "干净桌面",
        imageMustHave: ["通勤包", "日常物品"],
        imageMustAvoid: ["夸张容量"],
        platformStyle: "xiaohongshu",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["viral-insight-focus"]
      },
      currentStage: "brief_ready"
    });
    let writerPrompt = "";

    const result = await runAgentTurn({
      message: "基于重点规律生成文案",
      conversationId: "chat-focused-evidence",
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
        generateStructuredText: async (prompt) => {
          writerPrompt = prompt;
          return JSON.stringify({
            title: "通勤包别再乱塞了",
            content: "这篇从早高峰真实场景写起，重点讲容量、取物和肩负担。",
            tags: ["通勤包", "上班族"],
            structure: ["场景", "痛点", "解决方式"],
            imagePrompt: "通勤包桌面平铺，展示日常物品收纳",
            basedOnEvidenceIds: ["viral-insight-focus"],
            evidenceReferences: {
              title: ["viral-insight-focus"],
              content: ["viral-insight-focus"],
              tags: ["viral-insight-focus"],
              imagePrompt: ["viral-insight-focus"]
            }
          });
        },
        analyzeImageStyle: async () => "",
        generateImage: async () => null,
        generateImageFromReference: async () => null
      }
    });

    expect(writerPrompt).toContain("本次重点规律");
    expect(writerPrompt).toContain("viral-insight-focus");
    expect(result.currentDraft?.draft.basedOnEvidenceIds).toEqual(["viral-insight-focus"]);
  });

  it("revises the active PostProject draft and invalidates stale publish checks", async () => {
    await resetPostProject({
      topic: "广州咖啡馆",
      targetAudience: "周末探店用户",
      goal: "生成真实探店笔记",
      tone: "生活化",
      evidencePack: {
        sampleIds: ["sample-1"],
        insights: [{
          id: "insight-title",
          sourceType: "realtime",
          type: "title",
          insight: "标题先给具体周末场景，再给收藏理由",
          sourceSampleIds: ["sample-1"],
          confidence: 0.88,
          createdAt: "2026-05-31T00:00:00.000Z"
        }]
      },
      creativeBrief: {
        audience: "周末探店用户",
        painPoint: "不知道去哪坐一下午",
        contentAngle: "安静咖啡馆真实分享",
        emotionalHook: "周末慢下来",
        proofPoints: ["真实体验"],
        tone: "生活化",
        visualMood: "自然光",
        imageMustHave: ["咖啡", "桌面"],
        imageMustAvoid: ["广告感"],
        platformStyle: "xiaohongshu",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["insight-title"]
      },
      copyDraft: {
        id: "draft-old",
        updatedAt: "2026-05-31T00:00:00.000Z",
        draft: {
          title: "广州咖啡馆推荐",
          content: "这里适合周末去坐一下午。",
          tags: ["广州咖啡馆"],
          structure: ["场景", "体验"],
          imagePrompt: "自然光咖啡馆桌面",
          basedOnEvidenceIds: ["insight-title"],
          evidenceReferences: {
            title: ["insight-title"],
            content: ["insight-title"],
            tags: ["insight-title"],
            imagePrompt: ["insight-title"]
          }
        },
        images: [{ path: path.join(tempDir, "generated-assets", "generated", "old.png") }],
        visibility: defaultSettings.defaultVisibility
      },
      selectedImages: ["asset-old"],
      finalPost: {
        title: "广州咖啡馆推荐",
        content: "这里适合周末去坐一下午。",
        tags: ["广州咖啡馆"],
        imageIds: ["asset-old"],
        imagePromptVersionIds: [],
        basedOnEvidenceIds: ["insight-title"]
      },
      publishPlan: {
        id: "publish-old",
        mode: "manual",
        status: "awaiting_approval",
        title: "广州咖啡馆推荐",
        content: "这里适合周末去坐一下午。",
        tags: ["广州咖啡馆"],
        images: ["asset-old"],
        visibility: defaultSettings.defaultVisibility,
        requestedBy: "chat",
        requestedAt: "2026-05-31T00:00:00.000Z",
        idempotencyKey: "old-key",
        confirmationChecklist: [],
        guardrailResults: []
      },
      qualityCheck: {
        titleScore: 90,
        copyScore: 90,
        visualConsistencyScore: 90,
        platformFitScore: 90,
        complianceScore: 90,
        canPublish: true,
        issues: [],
        suggestions: [],
        checkedAt: "2026-05-31T00:00:00.000Z"
      },
      currentStage: "reviewing"
    });

    const result = await runAgentTurn({
      message: "把标题和正文改得更生活化一点",
      conversationId: "chat-revise-project-draft",
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
          title: "周末想发呆就去这家咖啡馆",
          content: "这家不是那种很吵的打卡店，更适合点杯咖啡慢慢坐一下午。",
          tags: ["广州咖啡馆", "周末探店"],
          structure: ["周末场景", "真实体验", "适合人群"],
          imagePrompt: "自然光咖啡馆桌面近景",
          basedOnEvidenceIds: ["insight-title"],
          evidenceReferences: {
            title: ["insight-title"],
            content: ["insight-title"],
            tags: ["insight-title"],
            imagePrompt: ["insight-title"]
          }
        }),
        analyzeImageStyle: async () => "",
        generateImage: async () => null,
        generateImageFromReference: async () => null
      }
    });

    expect(result.intent).toBe("revise_draft");
    expect(result.currentDraft?.id).not.toBe("draft-old");
    expect(result.currentDraft?.draft.title).toBe("周末想发呆就去这家咖啡馆");
    expect(result.currentDraft?.images).toEqual([{ path: path.join(tempDir, "generated-assets", "generated", "old.png") }]);
    expect(result.currentDraft?.draft.basedOnEvidenceIds).toEqual(["insight-title"]);
    expect(result.postProject?.copyDraft?.id).toBe(result.currentDraft?.id);
    expect(result.postProject?.copyVersions.some((version) => version.id === `copy-${result.currentDraft?.id}`)).toBe(true);
    expect(result.postProject?.finalPost).toBeUndefined();
    expect(result.postProject?.publishPlan).toBeNull();
    expect(result.postProject?.qualityCheck).toBeUndefined();
    expect(result.postProject?.auditStatus).toBe("unchecked");
    expect(result.workspace.currentDraftId).toBe(result.currentDraft?.id);
    expect(result.workspace.publishPlan).toBeNull();
    expect(result.answer).toContain("新的文案版本");
    expect(result.answer).toContain("Quality Gate 已失效");
    expect(result.cards.map((card) => card.type)).toContain("copy_draft");
    expect(result.cards.map((card) => card.type)).toContain("evidence_citations");
  });

  it("saves current realtime research samples into the viral knowledge base from chat", async () => {
    const sample: SampleEvidence = {
      id: "note-save-viral-chat",
      title: "广州咖啡馆高收藏拍照座位",
      author: "author",
      likes: 1400,
      collects: 1800,
      comments: 96,
      shares: 24,
      score: 3200,
      url: "https://www.xiaohongshu.com/explore/note-save-viral-chat",
      imageUrls: ["https://example.com/save.jpg"],
      cachedImageUrls: [],
      detailText: "先讲适合人群，再写窗边座位、光线、人均和周末排队，最后给避峰建议。",
      commentSnippets: ["想知道哪张桌子出片", "人均多少"],
      reasonHighlights: []
    };
    await resetPostProject({
      topic: "广州咖啡馆",
      goal: "探店",
      evidencePack: {
        sampleIds: [sample.id],
        insights: [{
          id: "insight-save-title",
          sourceType: "realtime",
          type: "title",
          insight: "标题突出高收藏拍照座位和避峰信息",
          sourceSampleIds: [sample.id],
          confidence: 0.82,
          createdAt: "2026-05-30T00:00:00.000Z"
        }]
      },
      selectedSamples: [sample],
      currentStage: "evidence_ready"
    });

    const result = await runAgentTurn({
      message: "把这些高收藏样本保存到爆款库",
      conversationId: "chat-save-viral",
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

    expect(result.intent).toBe("save_viral_knowledge");
    expect(result.answer).toContain("保存进爆款库");
    expect(result.postProject?.evidencePack.insights.some((insight) => insight.sourceType === "viral_library")).toBe(true);
    expect(result.cards.map((card) => card.type)).toContain("viral_knowledge");
    expect(result.toolTrace).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "knowledge.saveViralCase",
        status: "running"
      })
    ]));
  });

  it("refreshes CreativeBrief as a first-class Agent action", async () => {
    await resetPostProject({
      topic: "广州咖啡馆",
      targetAudience: "探店账号粉丝",
      goal: "生成真实避坑探店笔记",
      tone: "生活化",
      evidencePack: {
        sampleIds: ["note-brief-live"],
        insights: [{
          id: "insight-brief-title",
          sourceType: "realtime",
          type: "title",
          insight: "标题先给适用人群，再给避坑收益",
          sourceSampleIds: ["note-brief-live"],
          confidence: 0.82,
          createdAt: "2026-05-30T00:00:00.000Z"
        }, {
          id: "viral-brief-visual",
          sourceType: "viral_library",
          type: "visual",
          insight: "封面用窗边自然光和座位信息，提升收藏动机",
          sourceSampleIds: ["viral-case-brief"],
          confidence: 0.84,
          createdAt: "2026-05-30T00:00:00.000Z"
        }]
      },
      selectedSamples: [],
      currentStage: "evidence_ready"
    });

    const result = await runAgentTurn({
      message: "请基于当前研究证据和爆款库规律，生成/刷新这个 PostProject 的 CreativeBrief，并说明参考了哪些证据。",
      conversationId: "chat-create-brief",
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

    expect(result.intent).toBe("create_creative_brief");
    expect(result.postProject?.currentStage).toBe("brief_ready");
    expect(result.postProject?.creativeBrief?.basedOnEvidenceIds).toEqual(expect.arrayContaining(["insight-brief-title", "viral-brief-visual"]));
    expect(result.cards.map((card) => card.type)).toContain("creative_brief");
    expect(result.answer).toContain("已刷新当前 PostProject 的 CreativeBrief");
    expect(result.answer).toContain("参考证据");
    expect(result.toolTrace).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "project.createCreativeBrief",
        status: "running"
      })
    ]));
  });

  it("applies planner RAG filters after legacy research workflows", async () => {
    const highSample: SampleEvidence = {
      id: "note-high-filtered",
      title: "广州咖啡馆高收藏拍照攻略",
      author: "author",
      likes: 1500,
      collects: 1800,
      comments: 90,
      shares: 35,
      score: 3300,
      url: "https://www.xiaohongshu.com/explore/note-high-filtered",
      imageUrls: ["https://example.com/high.jpg"],
      cachedImageUrls: [],
      detailText: "先讲拍照座位，再写人均、光线和周末排队，最后给避峰建议。",
      commentSnippets: ["想知道哪张桌子出片"],
      reasonHighlights: []
    };
    const lowSample: SampleEvidence = {
      ...highSample,
      id: "note-low-filtered",
      title: "广州咖啡馆普通记录",
      likes: 100,
      collects: 80,
      comments: 6,
      shares: 1,
      score: 160,
      url: "https://www.xiaohongshu.com/explore/note-low-filtered"
    };
    const highCase = await createViralCaseFromEvidence({
      sample: highSample,
      topic: "广州咖啡馆",
      category: "探店"
    });
    const lowCase = await createViralCaseFromEvidence({
      sample: lowSample,
      topic: "广州咖啡馆",
      category: "探店"
    });
    await upsertViralCases([highCase, lowCase]);
    const runChatAgent = vi.fn(async () => ({
      answer: "legacy research done",
      workflowResult: {
        status: "draft_ready" as const,
        steps: [],
        samples: [],
        evidence: [highSample],
        researchSummary: {
          contentStrengths: ["高收藏样本强调拍照座位和排队信息"],
          imageStrengths: [],
          learningsForContent: [],
          learningsForImages: [],
          nextQuestions: []
        },
        report: "",
        imageStyleReport: "",
        draft: null,
        images: [],
        publishResult: null
      }
    }));

    const result = await runAgentTurn({
      message: "帮我找最近一周广州咖啡馆收藏超过1000 分享20以上的高收藏笔记并生成文案",
      conversationId: "chat-filtered-rag",
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

    const viralSourceIds = result.postProject?.evidencePack.insights
      .filter((insight) => insight.sourceType === "viral_library")
      .flatMap((insight) => insight.sourceSampleIds) ?? [];

    expect(runChatAgent).toHaveBeenCalled();
    expect(result.intent).toBe("research_to_draft");
    expect(result.trace.events.some((event) => event.label === "knowledge.retrieveViralPatterns")).toBe(true);
    expect(result.trace.events.find((event) => event.label === "knowledge.retrieveViralPatterns")?.detail).toContain("收藏");
    expect(result.answer).toContain("爆款库筛选条件");
    expect(result.answer).toContain("收藏 ≥ 1000");
    expect(result.answer).toContain("分享 ≥ 20");
    expect(viralSourceIds).toContain(highCase.id);
    expect(viralSourceIds).not.toContain(lowCase.id);
  });

  it("refreshes viral-library evidence on the active PostProject without realtime research", async () => {
    const viralSample: SampleEvidence = {
      id: "note-viral-bag",
      title: "通勤包高收藏真实测评",
      author: "author",
      likes: 900,
      collects: 1300,
      comments: 80,
      shares: 12,
      score: 1900,
      url: "https://www.xiaohongshu.com/explore/note-viral-bag",
      imageUrls: ["https://example.com/bag.jpg"],
      cachedImageUrls: [],
      detailText: "先讲容量痛点，再拆分电脑位、肩带、通勤场景，最后给适合人群和避坑提醒。",
      commentSnippets: ["能不能放电脑", "肩带勒不勒"],
      reasonHighlights: []
    };
    const viralSampleTwo: SampleEvidence = {
      ...viralSample,
      id: "note-viral-bag-2",
      title: "通勤包封面清单式测评",
      url: "https://www.xiaohongshu.com/explore/note-viral-bag-2",
      detailText: "封面先列三类通勤场景，正文按容量、肩带、雨天材质和穿搭适配拆解。",
      commentSnippets: ["雨天会不会湿", "小个子背会不会压身高"]
    };
    await upsertViralCases([
      await createViralCaseFromEvidence({
        sample: viralSample,
        topic: "通勤包",
        category: "好物"
      }),
      await createViralCaseFromEvidence({
        sample: viralSampleTwo,
        topic: "通勤包",
        category: "好物"
      })
    ]);
    await resetPostProject({
      topic: "通勤包",
      targetAudience: "上班族",
      goal: "生成真实通勤包种草笔记",
      selectedSamples: [
        viralSample,
        viralSampleTwo,
        { ...viralSample, id: "note-live-bag-3", title: "通勤包真实使用一周反馈" }
      ],
      currentStage: "brief_ready"
    });
    const runChatAgent = vi.fn(async () => ({ answer: "legacy answer" }));

    const result = await runAgentTurn({
      message: "请刷新当前项目的爆款库 RAG 证据，不要重新搜索小红书",
      conversationId: "chat-viral-refresh",
      settings: defaultSettings,
      history: [],
      currentDraft: null,
      attachedAssets: [],
      mcp: {
        searchFeeds: vi.fn(async () => []),
        getFeedDetail: vi.fn(async () => null),
        publishContent: vi.fn(async () => ({ ok: true }))
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
    expect(result.intent).toBe("retrieve_viral_knowledge");
    expect(result.postProject?.evidencePack.insights.some((insight) => insight.sourceType === "viral_library")).toBe(true);
    expect(result.postProject?.creativeBrief?.basedOnEvidenceIds.some((id) => id.startsWith("viral-insight-"))).toBe(true);
    expect(result.cards.map((card) => card.type)).toContain("viral_knowledge");
    const viralCard = result.cards.find((card) => card.id === "card-viral-strategy");
    expect(viralCard?.summary).toContain("可复用策略");
    expect((viralCard?.data as { evidenceIds?: string[] } | undefined)?.evidenceIds?.length).toBeGreaterThan(0);
    expect(result.quickActions.map((action) => action.action)).toEqual([
      "generate_copy",
      "plan_visuals"
    ]);
    expect((viralCard?.data as { nextActions?: Array<{ action: string }> } | undefined)?.nextActions?.map((action) => action.action)).toEqual([
      "generate_copy",
      "plan_visuals"
    ]);
    expect(result.toolTrace.some((item) => item.label === "knowledge.retrieveViralPatterns" && item.status === "completed")).toBe(true);
    expect(result.trace.events.some((event) => event.type === "tool_completed" && event.label === "knowledge.retrieveViralPatterns")).toBe(true);
    expect(result.answer).toContain("爆款库");
  });

  it("surfaces insufficient viral RAG evidence instead of hiding the retrieval result", async () => {
    await resetPostProject({
      topic: "冷门香薰品牌",
      targetAudience: "小户型租房人群",
      goal: "生成一篇真实种草笔记",
      currentStage: "brief_ready"
    });

    const result = await runAgentTurn({
      message: "请刷新当前项目的爆款库 RAG 证据，不要重新搜索小红书",
      conversationId: "chat-viral-insufficient",
      settings: defaultSettings,
      history: [],
      currentDraft: null,
      attachedAssets: [],
      mcp: {
        searchFeeds: vi.fn(async () => []),
        getFeedDetail: vi.fn(async () => null),
        publishContent: vi.fn(async () => ({ ok: true }))
      },
      model: {
        generateStructuredText: async () => "",
        analyzeImageStyle: async () => "",
        generateImage: async () => null,
        generateImageFromReference: async () => null
      },
      runChatAgentImpl: vi.fn(async () => ({ answer: "legacy answer" }))
    });

    expect(result.intent).toBe("retrieve_viral_knowledge");
    expect(result.answer).toContain("RAG 证据还不够");
    expect(result.answer).toContain("缺口");
    const viralCard = result.cards.find((card) => card.id === "card-viral-knowledge");
    expect(viralCard?.summary).toContain("RAG 证据还不够");
    expect(viralCard?.data).toMatchObject({
      sufficiency: expect.objectContaining({
        isEnough: false,
        viralCount: 0
      })
    });
    expect(result.quickActions).toEqual([
      expect.objectContaining({ action: "search_research", label: "补搜真实笔记" }),
      expect.objectContaining({ action: "save_viral_knowledge", label: "保存优质样本入库", disabled: true }),
      expect.objectContaining({ action: "retrieve_viral_knowledge", label: "放宽筛选再检索" })
    ]);
    expect((viralCard?.data as { nextActions?: Array<{ action: string }> } | undefined)?.nextActions?.map((action) => action.action)).toEqual([
      "search_research",
      "save_viral_knowledge",
      "retrieve_viral_knowledge"
    ]);
    expect(result.postProject?.evidencePack.summary).toMatchObject({
      viralKnowledge: expect.objectContaining({
        sufficiency: expect.objectContaining({ isEnough: false })
      })
    });
  });

  it("explains explicit viral-library retrieval filters in the agent answer", async () => {
    const viralSample: SampleEvidence = {
      id: "note-viral-filtered-bag",
      title: "通勤包高收藏真实测评",
      author: "author",
      likes: 1200,
      collects: 2200,
      comments: 90,
      shares: 30,
      score: 3600,
      url: "https://www.xiaohongshu.com/explore/note-viral-filtered-bag",
      imageUrls: ["https://example.com/bag.jpg"],
      cachedImageUrls: [],
      detailText: "先讲适合人群，再拆容量、肩带、分区和通勤场景，最后给避坑建议。",
      commentSnippets: ["电脑能不能装", "肩带勒不勒"],
      reasonHighlights: []
    };
    await upsertViralCases([
      await createViralCaseFromEvidence({
        sample: viralSample,
        topic: "通勤包",
        category: "产品测评"
      })
    ]);
    await resetPostProject({
      topic: "通勤包",
      targetAudience: "上班族",
      goal: "生成真实通勤包种草笔记",
      currentStage: "brief_ready"
    });

    const result = await runAgentTurn({
      message: "检索爆款库里通勤包 #测评 收藏超过1000 分享20以上的高收藏案例",
      conversationId: "chat-viral-filter-summary",
      settings: defaultSettings,
      history: [],
      currentDraft: null,
      attachedAssets: [],
      mcp: {
        searchFeeds: vi.fn(async () => []),
        getFeedDetail: vi.fn(async () => null),
        publishContent: vi.fn(async () => ({ ok: true }))
      },
      model: {
        generateStructuredText: async () => "",
        analyzeImageStyle: async () => "",
        generateImage: async () => null,
        generateImageFromReference: async () => null
      },
      runChatAgentImpl: vi.fn(async () => ({ answer: "legacy answer" }))
    });

    expect(result.intent).toBe("retrieve_viral_knowledge");
    expect(result.answer).toContain("本次筛选条件");
    expect(result.answer).toContain("收藏 ≥ 1000");
    expect(result.answer).toContain("分享 ≥ 20");
    expect(result.answer).toContain("标签包含 测评");
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

  it("uses selected PostProject asset images when preparing publish from chat", async () => {
    const selectedImagePath = path.join(tempDir, "generated-assets", "uploads", "selected.png");
    await mkdir(path.join(tempDir, "data"), { recursive: true });
    await writeFile(
      path.join(tempDir, "data", "assets.json"),
      JSON.stringify([
        {
          id: "asset-selected",
          kind: "upload",
          name: "selected",
          originalName: "selected.png",
          absolutePath: selectedImagePath,
          mimeType: "image/png",
          size: 10,
          createdAt: "2026-05-30T00:00:00.000Z"
        }
      ])
    );
    await resetPostProject({
      topic: "广州咖啡馆",
      selectedImages: ["asset-selected"],
      currentStage: "image_ready"
    });
    const { updateWorkspaceState } = await import("@/lib/agent/state");
    const draft = {
      id: "draft-selected-asset",
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
    };
    await updateWorkspaceState({ currentDraftId: draft.id, currentDraft: draft, selectedImageIds: ["asset-selected"] });

    const result = await runAgentTurn({
      message: "schedule at 2099-05-22T20:00:00+08:00",
      conversationId: "chat-publish-selected-asset",
      settings: defaultSettings,
      history: [],
      currentDraft: draft,
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

    expect(result.intent).toBe("schedule_publish");
    expect(result.workspace.publishPlan?.status).toBe("awaiting_approval");
    expect(result.workspace.publishPlan?.scheduleAt).toBe("2099-05-22T20:00:00+08:00");
    expect(result.workspace.publishPlan?.images).toEqual([selectedImagePath]);
    expect(result.postProject?.publishPlan?.status).toBe("awaiting_approval");
    expect(result.postProject?.currentStage).toBe("reviewing");
  });

  it("prepares scheduled publish from the active PostProject draft when chat has no currentDraft", async () => {
    const selectedImagePath = path.join(tempDir, "generated-assets", "uploads", "project-selected.png");
    await mkdir(path.join(tempDir, "data"), { recursive: true });
    await writeFile(
      path.join(tempDir, "data", "assets.json"),
      JSON.stringify([
        {
          id: "asset-project-selected",
          kind: "upload",
          name: "project-selected",
          originalName: "project-selected.png",
          absolutePath: selectedImagePath,
          mimeType: "image/png",
          size: 10,
          createdAt: "2026-05-30T00:00:00.000Z"
        }
      ])
    );
    await resetPostProject({
      topic: "广州咖啡馆",
      copyDraft: {
        id: "draft-project-publish",
        updatedAt: "2026-05-30T00:00:00.000Z",
        draft: {
          title: "广州周末安静咖啡馆",
          content: "这家适合周末坐一下午。",
          tags: ["广州咖啡馆", "周末探店"],
          structure: ["场景", "体验", "建议"],
          imagePrompt: "自然光咖啡馆桌面",
          basedOnEvidenceIds: ["insight-1"],
          evidenceReferences: {
            title: ["insight-1"],
            content: ["insight-1"],
            tags: ["insight-1"],
            imagePrompt: ["insight-1"]
          }
        },
        images: [],
        visibility: defaultSettings.defaultVisibility
      },
      selectedImages: ["asset-project-selected"],
      currentStage: "image_ready"
    });

    const result = await runAgentTurn({
      message: "今晚八点发",
      conversationId: "chat-publish-project-draft",
      settings: defaultSettings,
      history: [],
      currentDraft: null,
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

    expect(result.intent).toBe("schedule_publish");
    expect(result.currentDraft?.id).toBe("draft-project-publish");
    expect(result.workspace.currentDraftId).toBe("draft-project-publish");
    expect(result.workspace.publishPlan?.status).toBe("awaiting_approval");
    expect(result.workspace.publishPlan?.title).toBe("广州周末安静咖啡馆");
    expect(result.workspace.publishPlan?.images).toEqual([selectedImagePath]);
    expect(result.workspace.publishPlan?.scheduleAt).toMatch(/T20:00:00\+08:00$/);
    expect(result.postProject?.publishPlan?.status).toBe("awaiting_approval");
    expect(result.postProject?.currentStage).toBe("reviewing");
    const publishCard = result.cards.find((card) => card.id === "card-publish-check");
    expect(publishCard?.title).toBe("发布确认待人工核对");
    expect(publishCard?.summary).toContain("人工确认：0/");
    expect(publishCard?.summary).toContain("待处理");
    expect(publishCard?.data).toMatchObject({
      publishPlan: expect.objectContaining({
        title: "广州周末安静咖啡馆",
        images: [selectedImagePath]
      }),
      confirmation: expect.objectContaining({
        confirmedCount: 0,
        pending: expect.arrayContaining([
          expect.objectContaining({ label: "最终文案版本" }),
          expect.objectContaining({ label: "最终图片版本" })
        ])
      }),
      selectedImages: ["asset-project-selected"],
      nextActions: ["review_publish_confirmation", "confirm_publish", "cancel_publish"]
    });
    expect(result.quickActions.map((action) => action.action)).toEqual([
      "review_publish_confirmation",
      "confirm_publish",
      "cancel_publish"
    ]);
    expect(result.quickActions[1].label).toBe("确认定时发布");
  });

  it("prepares scheduled publish from finalPost when no chat draft is active", async () => {
    const selectedImagePath = path.join(tempDir, "generated-assets", "uploads", "final-selected.png");
    await mkdir(path.join(tempDir, "data"), { recursive: true });
    await writeFile(
      path.join(tempDir, "data", "assets.json"),
      JSON.stringify([
        {
          id: "asset-final-selected",
          kind: "upload",
          name: "final-selected",
          originalName: "final-selected.png",
          absolutePath: selectedImagePath,
          mimeType: "image/png",
          size: 10,
          createdAt: "2026-05-30T00:00:00.000Z",
          promptVersionId: "prompt-final",
          basedOnEvidenceIds: ["insight-1"]
        }
      ])
    );
    await resetPostProject({
      topic: "Guangzhou coffee",
      evidencePack: {
        sampleIds: ["note-1"],
        insights: [{
          id: "insight-1",
          sourceType: "realtime",
          type: "copy",
          insight: "Open with a direct recommendation and include who it is for.",
          sourceSampleIds: ["note-1"],
          confidence: 0.82,
          createdAt: "2026-05-30T00:00:00.000Z"
        }]
      },
      creativeBrief: {
        audience: "coffee lovers",
        painPoint: "hard to pick a weekend cafe",
        contentAngle: "honest cafe guide",
        emotionalHook: "start with a clear verdict",
        proofPoints: ["queue", "budget"],
        tone: "warm and practical",
        visualMood: "natural light",
        imageMustHave: ["storefront"],
        imageMustAvoid: ["fake badges"],
        platformStyle: "xiaohongshu",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["insight-1"]
      },
      imagePrompts: [{
        id: "prompt-final",
        createdAt: "2026-05-30T00:00:00.000Z",
        label: "final prompt",
        value: {
          prompt: "Natural light cafe storefront with warm tabletop details"
        },
        basedOnEvidenceIds: ["insight-1"]
      }],
      generatedImages: [{
        id: "image-final",
        assetId: "asset-final-selected",
        promptVersionId: "prompt-final",
        basedOnEvidenceIds: ["insight-1"],
        createdAt: "2026-05-30T00:00:00.000Z",
        selected: true
      }],
      selectedImages: ["asset-final-selected"],
      finalPost: {
        title: "Guangzhou weekend coffee guide",
        content: "This is a useful guide for people choosing a quiet weekend cafe. It starts with the verdict, then explains budget, queue, seat comfort, and who should avoid it.",
        tags: ["GuangzhouCoffee", "CafeGuide"],
        imageIds: ["asset-final-selected"],
        imagePromptVersionIds: ["prompt-final"],
        basedOnEvidenceIds: ["insight-1"]
      },
      qualityCheck: {
        titleScore: 86,
        copyScore: 88,
        visualConsistencyScore: 90,
        platformFitScore: 87,
        complianceScore: 92,
        canPublish: true,
        issues: [],
        suggestions: [],
        evidenceReview: {
          referencedEvidenceIds: ["insight-1"],
          realtimeEvidenceIds: ["insight-1"],
          viralEvidenceIds: [],
          missingEvidenceIds: [],
          summary: "Evidence is covered."
        },
        evidenceAlignment: {
          copyEvidenceIds: ["insight-1"],
          visualEvidenceIds: ["insight-1"],
          sharedEvidenceIds: ["insight-1"],
          isAligned: true,
          summary: "Copy and visual direction are aligned."
        },
        originalityReview: {
          rules: [],
          sourceSampleIds: ["note-1"],
          riskSamples: [],
          isSafe: true,
          summary: "Safe."
        },
        checkedAt: "2026-05-30T00:00:00.000Z"
      },
      currentStage: "reviewing"
    });

    const result = await runAgentTurn({
      message: "schedule at 2099-05-22T20:00:00+08:00",
      conversationId: "chat-publish-final-post",
      settings: defaultSettings,
      history: [],
      currentDraft: null,
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

    expect(result.intent).toBe("schedule_publish");
    expect(result.currentDraft?.id).toMatch(/^draft-final-/);
    expect(result.currentDraft?.draft.title).toBe("Guangzhou weekend coffee guide");
    expect(result.workspace.publishPlan?.status).toBe("awaiting_approval");
    expect(result.workspace.publishPlan?.title).toBe("Guangzhou weekend coffee guide");
    expect(result.workspace.publishPlan?.images).toEqual([selectedImagePath]);
    expect(result.workspace.publishPlan?.scheduleAt).toBe("2099-05-22T20:00:00+08:00");
    expect(result.workspace.publishPlan?.versionSnapshot?.finalPostEvidenceIds).toEqual(["insight-1"]);
    expect(result.workspace.publishPlan?.versionSnapshot?.imagePromptVersionIds).toEqual(["prompt-final"]);
    expect(result.postProject?.publishPlan?.status).toBe("awaiting_approval");
    expect(result.postProject?.currentStage).toBe("reviewing");
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
    const draft = {
      id: "draft-final",
      updatedAt: "2026-05-30T00:00:00.000Z",
      draft: {
        title: "广州咖啡周末指南",
        content: "这篇适合想周末找安静咖啡馆的人。先看人均和排队，再看座位光线，最后给适合人群和避峰建议。",
        tags: ["广州咖啡馆", "探店"],
        structure: ["适合谁", "体验", "避坑"],
        imagePrompt: "自然光咖啡馆",
        basedOnEvidenceIds: ["insight-1", "viral-insight-1"],
        evidenceReferences: {
          title: ["insight-1"],
          content: ["insight-1"],
          tags: ["insight-1"],
          imagePrompt: ["viral-insight-1"]
        }
      },
      images: [],
      visibility: defaultSettings.defaultVisibility
    };
    await resetPostProject({
      topic: "广州咖啡馆",
      evidencePack: {
        sampleIds: ["note-1", "viral-1"],
        insights: [{
          id: "insight-1",
          sourceType: "realtime",
          type: "copy",
          insight: "真实写排队、人均和适合人群",
          sourceSampleIds: ["note-1"],
          confidence: 0.8,
          createdAt: "2026-05-30T00:00:00.000Z"
        }, {
          id: "viral-insight-1",
          sourceType: "viral_library",
          type: "visual",
          insight: "爆款封面使用自然光、窗边桌面和低饱和暖色来传达真实探店感",
          sourceSampleIds: ["viral-1"],
          confidence: 0.82,
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
      copyDraft: draft,
      selectedImages: ["asset-1"],
      currentStage: "image_ready"
    });
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
    expect(result.postProject?.qualityCheck?.evidenceReview?.summary).toContain("引用证据");
    expect(result.postProject?.qualityCheck?.evidenceAlignment?.summary).toBeTruthy();
    expect(result.postProject?.qualityCheck?.viralCoverage?.summary).toContain("爆款库覆盖");
    expect(result.answer).toContain("证据覆盖");
    expect(result.answer).toContain("图文证据");
    expect(result.answer).toContain("爆款库覆盖");
    expect(result.cards.map((card) => card.type)).toContain("quality_check");
    expect(result.cards.find((card) => card.type === "quality_check")?.summary).toContain("图文证据");
    expect(result.cards.find((card) => card.type === "quality_check")?.summary).toContain("爆款库覆盖");
    expect(result.answer).toContain("Quality Gate");
  });

  it("can assemble a final post preview without running Quality Gate", async () => {
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
      selectedImages: ["asset-1"],
      currentStage: "image_ready"
    });
    const draft = {
      id: "draft-preview",
      updatedAt: "2026-05-30T00:00:00.000Z",
      draft: {
        title: "广州咖啡周末指南",
        content: "这篇适合想周末找安静咖啡馆的人。",
        tags: ["广州咖啡馆", "探店"],
        structure: ["适合谁", "体验"],
        imagePrompt: "自然光咖啡馆",
        basedOnEvidenceIds: ["insight-1"]
      },
      images: [],
      visibility: defaultSettings.defaultVisibility
    };
    const { updateWorkspaceState } = await import("@/lib/agent/state");
    await updateWorkspaceState({ currentDraftId: draft.id, currentDraft: draft, selectedImageIds: ["asset-1"] });

    const result = await runAgentTurn({
      message: "把当前文案和图片组装成最终帖子",
      conversationId: "chat-assemble-preview",
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

    expect(result.intent).toBe("assemble_post");
    expect(result.postProject?.finalPost?.title).toBe("广州咖啡周末指南");
    expect(result.postProject?.finalPost?.imageIds).toEqual(["asset-1"]);
    expect(result.postProject?.qualityCheck).toBeUndefined();
    expect(result.postProject?.currentStage).toBe("assembling");
    expect(result.answer).toContain("尚未运行 Quality Gate");
    expect(result.quickActions.map((action) => action.action)).toContain("run_quality_gate");
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
