import { beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { defaultSettings } from "@/lib/storage/settings";

const jsonRequest = (body: unknown) =>
  new Request("http://localhost/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

describe("API route contracts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doMock("@/lib/security/action-token", () => ({
      attachActionToken: vi.fn(async (payload: object) => ({ ...payload, actionToken: "test-action-token" })),
      requireLocalActionToken: vi.fn(async () => null)
    }));
    vi.doMock("@/lib/storage/publish-audit", () => ({
      appendPublishAudit: vi.fn(async (input: object) => ({ id: "audit-1", createdAt: "", ...input })),
      listPublishAudit: vi.fn(async () => [])
    }));
  });

  it("returns PostProject readiness with the project contract", async () => {
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: async () => ({
        schemaVersion: 1,
        id: "post-1",
        productInfo: { referenceAssetIds: [] },
        evidencePack: { sampleIds: [], insights: [] },
        selectedSamples: [],
        copyVersions: [],
        imagePrompts: [],
        generatedImages: [],
        selectedImages: [],
        agentMemory: [],
        currentStage: "empty",
        allowedActions: ["search_research"],
        updatedAt: "2026-05-31T00:00:00.000Z"
      }),
      updatePostProject: vi.fn()
    }));

    const { GET } = await import("@/app/api/post-project/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.project).toMatchObject({ id: "post-1", currentStage: "empty" });
    expect(payload.readiness).toMatchObject({
      progress: 0,
      nextAction: "search_research",
      canRequestPublish: false
    });
    expect(payload.readiness.blockers[0]).toMatchObject({ id: "evidence" });
    vi.doUnmock("@/lib/post-project/store");
  });

  it("clears the active PostProject when the workspace reset route starts a new project", async () => {
    const resetPostProject = vi.fn(async (seed) => ({
      id: seed.id,
      topic: seed.topic,
      currentStage: "empty"
    }));
    const resetWorkspaceState = vi.fn(async () => ({
      schemaVersion: 1,
      workspaceId: "workspace-clean",
      updatedAt: "2026-05-31T00:00:00.000Z",
      topic: "广州咖啡馆",
      selectedSamples: [],
      selectedImageIds: [],
      productImageIds: [],
      publishPlan: null,
      recentJobIds: []
    }));
    const writeCurrentDraft = vi.fn(async () => undefined);
    vi.doMock("@/lib/agent/state", () => ({ resetWorkspaceState }));
    vi.doMock("@/lib/post-project/store", () => ({ resetPostProject }));
    vi.doMock("@/lib/storage/drafts", () => ({ writeCurrentDraft }));

    const { POST } = await import("@/app/api/agent/workspace/reset/route");
    const response = await POST(jsonRequest({ topic: "广州咖啡馆", lastUserIntent: "start_new_project" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.workspace.workspaceId).toBe("workspace-clean");
    expect(payload.postProject).toEqual(expect.objectContaining({
      id: "post-clean",
      currentStage: "empty"
    }));
    expect(writeCurrentDraft).toHaveBeenCalledWith(null);
    expect(resetWorkspaceState).toHaveBeenCalledWith({
      topic: "广州咖啡馆",
      lastUserIntent: "start_new_project"
    });
    expect(resetPostProject).toHaveBeenCalledWith({
      id: "post-clean",
      topic: "广州咖啡馆"
    });
    vi.doUnmock("@/lib/agent/state");
    vi.doUnmock("@/lib/post-project/store");
    vi.doUnmock("@/lib/storage/drafts");
  });

  it("syncs workspace patches into PostProject so uploaded reference images are current", async () => {
    const workspace = {
      schemaVersion: 1,
      workspaceId: "workspace-ref",
      updatedAt: "",
      selectedSamples: [],
      selectedImageIds: [],
      productImageIds: ["asset-product-1"],
      recentJobIds: [],
      recentRunIds: [],
      recentConversationIds: []
    };
    const updateWorkspaceState = vi.fn(async () => workspace);
    const syncPostProjectFromWorkspace = vi.fn(async (input) => ({
      id: "post-ref",
      topic: input.topic,
      productInfo: { referenceAssetIds: input.productImageIds },
      currentStage: "briefing"
    }));

    vi.doMock("@/lib/agent/state", () => ({
      readWorkspaceState: vi.fn(),
      updateWorkspaceState
    }));
    vi.doMock("@/lib/post-project/store", () => ({
      syncPostProjectFromWorkspace
    }));

    const { PATCH } = await import("@/app/api/agent/workspace/route");
    const response = await PATCH(jsonRequest({
      productImageIds: ["asset-product-1"],
      lastUserIntent: "upload_product_images"
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(updateWorkspaceState).toHaveBeenCalledWith(expect.objectContaining({
      productImageIds: ["asset-product-1"],
      lastUserIntent: "upload_product_images"
    }));
    expect(syncPostProjectFromWorkspace).toHaveBeenCalledWith(workspace);
    expect(payload).toEqual({
      workspace,
      postProject: expect.objectContaining({
        id: "post-ref",
        productInfo: { referenceAssetIds: ["asset-product-1"] }
      })
    });
    vi.doUnmock("@/lib/agent/state");
    vi.doUnmock("@/lib/post-project/store");
  });

  it("returns a stable one-click validation error shape", async () => {
    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings,
      isPublishVisibility: (value: unknown) => typeof value === "string"
    }));
    vi.doMock("@/lib/workflows/one-click", () => ({
      runOneClickWorkflow: vi.fn()
    }));
    vi.doMock("@/lib/mcp/xhs", () => ({
      createXhsMcpClient: () => ({})
    }));
    vi.doMock("@/lib/models/provider", () => ({
      createModelProvider: () => ({})
    }));
    vi.doMock("@/lib/storage/history", () => ({
      appendHistory: vi.fn()
    }));
    vi.doMock("@/lib/storage/drafts", () => ({
      createDraftRecord: vi.fn(),
      writeCurrentDraft: vi.fn()
    }));

    const { POST } = await import("@/app/api/workflows/one-click/route");
    const response = await POST(jsonRequest({ topic: "   " }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: expect.any(String) });
  });

  it("normalizes one-click research input and forces it to stay non-publishing", async () => {
    const workflowResult = {
      status: "research_ready",
      steps: [],
      samples: [],
      evidence: [],
      researchSummary: null,
      report: "",
      imageStyleReport: "",
      draft: null,
      images: [],
      publishResult: { skipped: true }
    };
    const runOneClickWorkflow = vi.fn(async () => workflowResult);
    const appendHistory = vi.fn(async (input, result) => ({
      id: "run-1",
      createdAt: "2026-05-21T00:00:00.000Z",
      input,
      result
    }));
    const writeCurrentDraft = vi.fn();

    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => ({
        ...defaultSettings,
        defaultAutoPublish: false,
        defaultVisibility: "private"
      }),
      isPublishVisibility: (value: unknown) => typeof value === "string"
    }));
    vi.doMock("@/lib/workflows/one-click", () => ({
      runOneClickWorkflow
    }));
    vi.doMock("@/lib/mcp/xhs", () => ({
      createXhsMcpClient: () => ({ service: "mcp" })
    }));
    vi.doMock("@/lib/models/provider", () => ({
      createModelProvider: () => ({ service: "model" })
    }));
    vi.doMock("@/lib/storage/history", () => ({
      appendHistory
    }));
    vi.doMock("@/lib/storage/drafts", () => ({
      createDraftRecord: vi.fn(),
      writeCurrentDraft
    }));

    const { POST } = await import("@/app/api/workflows/one-click/route");
    const response = await POST(
      jsonRequest({
        topic: "coffee",
        workflowGoal: "research",
        publishMode: "schedule",
        autoPublish: true,
        generateImages: true,
        scheduleAt: "2026-05-21T20:00:00+08:00",
        sampleCount: "4",
        imageSource: "product",
        assetIds: [1, "asset-2"],
        productName: "beans",
        sellingPoints: "fresh",
        scene: "desk",
        style: "realistic",
        extraImagePrompt: "warm light"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ run: expect.objectContaining({ id: "run-1" }), result: workflowResult });
    expect(runOneClickWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          topic: "coffee",
          workflowGoal: "research",
          publishMode: "draft",
          autoPublish: false,
          generateImages: false,
          scheduleAt: undefined,
          sampleCount: 4,
          imageSource: "ai",
          assetIds: [],
          productName: "beans",
          sellingPoints: "fresh",
          scene: "desk",
          style: "realistic",
          extraImagePrompt: "warm light"
        })
      })
    );
    expect(appendHistory).toHaveBeenCalledWith(expect.objectContaining({ topic: "coffee" }), workflowResult);
    expect(writeCurrentDraft).not.toHaveBeenCalled();
  });

  it("redacts local absolute paths from the assets list route", async () => {
    vi.doMock("@/lib/storage/assets", () => ({
      toPublicAssetRecord: (asset: { id: string; kind: string; name: string; originalName: string; mimeType: string; size: number; createdAt: string; sourceAssetIds?: string[] }) => ({
        id: asset.id,
        kind: asset.kind,
        name: asset.name,
        originalName: asset.originalName,
        mimeType: asset.mimeType,
        size: asset.size,
        createdAt: asset.createdAt,
        sourceAssetIds: asset.sourceAssetIds,
        url: `/api/assets/file/${asset.id}`
      }),
      listAssets: vi.fn(async () => [
        {
          id: "asset-1",
          kind: "upload",
          name: "cover",
          originalName: "cover.png",
          absolutePath: "C:\\Users\\someone\\secret\\cover.png",
          mimeType: "image/png",
          size: 10,
          createdAt: "2026-05-21T00:00:00.000Z",
          prompt: "hidden internal prompt"
        }
      ]),
      createAssetRecord: vi.fn(),
      saveAsset: vi.fn(),
      uploadDir: vi.fn()
    }));

    const { GET } = await import("@/app/api/assets/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.assets[0]).toEqual(
      expect.objectContaining({
        id: "asset-1",
        url: "/api/assets/file/asset-1"
      })
    );
    expect(JSON.stringify(payload)).not.toContain("absolutePath");
    expect(JSON.stringify(payload)).not.toContain("C:\\Users");
  });

  it("returns a stable chat validation error shape", async () => {
    const { POST } = await import("@/app/api/chat/route");
    const response = await POST(jsonRequest({ message: "   " }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: expect.any(String) });
  });

  it("returns answer and conversation from the direct chat route branch", async () => {
    const conversation = { id: "chat-1", title: "hello", createdAt: "", updatedAt: "", messages: [] };
    const runAgentTurn = vi.fn(async () => ({ answer: "agent answer" }));
    const appendChatTurn = vi.fn(async () => conversation);

    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings,
      isPublishVisibility: (value: unknown) => typeof value === "string"
    }));
    vi.doMock("@/lib/storage/history", () => ({
      listHistory: async () => []
    }));
    const writeCurrentDraft = vi.fn();
    vi.doMock("@/lib/storage/drafts", () => ({
      readCurrentDraft: async () => null,
      writeCurrentDraft,
      createDraftRecord: vi.fn()
    }));
    vi.doMock("@/lib/storage/assets", () => ({
      getAsset: vi.fn()
    }));
    vi.doMock("@/lib/chat/router", () => ({
      classifyChatRequest: () => ({ kind: "direct" })
    }));
    vi.doMock("@/lib/agent/memory", () => ({
      readCreatorMemoryProfile: vi.fn(async () => null),
      updateCreatorMemoryFromTurn: vi.fn(async () => null)
    }));
    vi.doMock("@/lib/agent/orchestrator", () => ({
      runAgentTurn
    }));
    vi.doMock("@/lib/storage/chat", () => ({
      appendChatTurn,
      getChatConversation: vi.fn(async () => ({
        ...conversation,
        messages: [{ id: "msg-1", role: "user", content: "previous context", createdAt: "" }]
      }))
    }));
    vi.doMock("@/lib/mcp/xhs", () => ({
      createXhsMcpClient: () => ({})
    }));
    vi.doMock("@/lib/models/provider", () => ({
      createModelProvider: () => ({})
    }));
    vi.doMock("@/lib/workflows/one-click", () => ({
      runOneClickWorkflow: vi.fn()
    }));

    const { POST } = await import("@/app/api/chat/route");
    const response = await POST(jsonRequest({ message: "hello", conversationId: "chat-1" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ answer: "agent answer", conversation });
    expect(runAgentTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "hello",
        conversationId: "chat-1",
        conversationMessages: [expect.objectContaining({ content: "previous context" })]
      })
    );
    expect(appendChatTurn).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: "chat-1", userContent: "hello", assistantContent: "agent answer" })
    );
  });

  it("returns structured director-agent fields from the direct chat route branch", async () => {
    const conversation = { id: "chat-structured", title: "studio", createdAt: "", updatedAt: "", messages: [] };
    const cards = [
      { id: "card-brief", type: "creative_brief", title: "CreativeBrief", summary: "文案和图片共享同一份策略" },
      { id: "card-quality", type: "quality_check", title: "发布前检查", summary: "需要人工确认" }
    ];
    const quickActions = [
      { id: "qa-copy", label: "生成文案", action: "generate_copy" },
      { id: "qa-quality", label: "发布前检查", action: "run_quality_gate" }
    ];
    const toolTrace = [
      { id: "trace-plan", label: "project.createCreativeBrief", status: "completed", detail: "已生成 Brief", createdAt: "2026-06-01T00:00:00.000Z" }
    ];
    const runAgentTurn = vi.fn(async () => ({
      answer: "structured answer",
      reply: "structured answer",
      stage: "brief_ready",
      intent: "create_creative_brief",
      intentConfidence: 0.91,
      needsUserInput: false,
      questions: [],
      workspacePatch: { lastUserIntent: "create_creative_brief" },
      cards,
      quickActions,
      toolTrace
    }));
    const appendChatTurn = vi.fn(async () => conversation);

    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings,
      isPublishVisibility: (value: unknown) => typeof value === "string"
    }));
    vi.doMock("@/lib/storage/history", () => ({
      listHistory: async () => []
    }));
    vi.doMock("@/lib/storage/drafts", () => ({
      readCurrentDraft: async () => null,
      writeCurrentDraft: vi.fn(),
      createDraftRecord: vi.fn()
    }));
    vi.doMock("@/lib/storage/assets", () => ({
      getAsset: vi.fn()
    }));
    vi.doMock("@/lib/chat/router", () => ({
      classifyChatRequest: () => ({ kind: "direct" })
    }));
    vi.doMock("@/lib/agent/memory", () => ({
      readCreatorMemoryProfile: vi.fn(async () => null),
      updateCreatorMemoryFromTurn: vi.fn(async () => null)
    }));
    vi.doMock("@/lib/agent/orchestrator", () => ({
      runAgentTurn
    }));
    vi.doMock("@/lib/post-project/store", () => ({
      appendPostProjectMemoryFromTurn: vi.fn(async () => undefined)
    }));
    vi.doMock("@/lib/storage/chat", () => ({
      appendChatTurn,
      getChatConversation: vi.fn(async () => ({ ...conversation, messages: [] }))
    }));
    vi.doMock("@/lib/mcp/xhs", () => ({
      createXhsMcpClient: () => ({})
    }));
    vi.doMock("@/lib/models/provider", () => ({
      createModelProvider: () => ({})
    }));
    vi.doMock("@/lib/workflows/one-click", () => ({
      runOneClickWorkflow: vi.fn()
    }));

    const { POST } = await import("@/app/api/chat/route");
    const response = await POST(jsonRequest({ message: "生成 CreativeBrief", conversationId: "chat-structured" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      answer: "structured answer",
      reply: "structured answer",
      stage: "brief_ready",
      intent: "create_creative_brief",
      intentConfidence: 0.91,
      needsUserInput: false,
      questions: [],
      workspacePatch: { lastUserIntent: "create_creative_brief" },
      cards,
      quickActions,
      toolTrace,
      conversation
    });
    expect(appendChatTurn).toHaveBeenCalledWith(expect.objectContaining({
      assistantMeta: expect.objectContaining({
        cards,
        quickActions,
        toolTrace,
        intent: "create_creative_brief",
        intentConfidence: 0.91,
        needsUserInput: false,
        stage: "brief_ready"
      })
    }));
  });

  it("syncs direct chat workflow results into PostProject before returning the response", async () => {
    const conversation = { id: "chat-1", title: "coffee", createdAt: "", updatedAt: "", messages: [] };
    const draftRecord = {
      id: "draft-1",
      updatedAt: "2026-05-31T00:00:00.000Z",
      draft: {
        title: "Coffee guide",
        content: "Useful body",
        tags: ["coffee"],
        structure: [],
        imagePrompt: "warm cafe"
      },
      images: [{ path: path.join(process.cwd(), "generated-assets", "generated", "cover.png") }],
      visibility: defaultSettings.defaultVisibility
    };
    const workflowResult = {
      status: "draft",
      samples: [{ id: "sample-1" }],
      evidence: [{ id: "sample-1", title: "sample" }],
      researchSummary: {
        contentStrengths: ["标题前置可收藏场景"],
        learningsForContent: ["正文先讲场景再给标准"],
        imageStrengths: ["封面主体清晰"],
        learningsForImages: ["保留自然光"],
        nextQuestions: []
      },
      draft: draftRecord.draft,
      images: draftRecord.images,
      steps: []
    };
    const syncedPostProject = {
      id: "post-synced",
      currentStage: "brief_ready",
      evidencePack: {
        insights: [{ id: "insight-title-1", insight: "标题前置可收藏场景" }]
      }
    };
    const runAgentTurn = vi.fn(async () => ({
      answer: "agent workflow answer",
      workflowResult
    }));
    const appendChatTurn = vi.fn(async () => conversation);
    const appendHistory = vi.fn(async () => ({ id: "run-1" }));
    const writeCurrentDraft = vi.fn(async (record) => ({ ...draftRecord, ...record, id: record.id ?? "draft-1" }));
    const updateWorkspaceState = vi.fn(async (patch) => ({
      schemaVersion: 1,
      workspaceId: "workspace-chat",
      updatedAt: "2026-05-31T00:00:00.000Z",
      selectedSamples: [],
      selectedImageIds: [],
      productImageIds: [],
      recentJobIds: [],
      recentRunIds: [],
      recentConversationIds: [],
      ...patch
    }));
    const syncPostProjectFromWorkspace = vi.fn(async () => syncedPostProject);

    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings,
      isPublishVisibility: (value: unknown) => typeof value === "string"
    }));
    vi.doMock("@/lib/storage/history", () => ({
      listHistory: async () => [],
      appendHistory
    }));
    vi.doMock("@/lib/storage/drafts", () => ({
      readCurrentDraft: async () => null,
      writeCurrentDraft,
      createDraftRecord: vi.fn((input) => ({ id: "draft-1", updatedAt: "2026-05-31T00:00:00.000Z", ...input }))
    }));
    vi.doMock("@/lib/storage/assets", () => ({
      getAsset: vi.fn(),
      upsertGeneratedAssetPaths: vi.fn(async () => [{ id: "asset-1" }])
    }));
    vi.doMock("@/lib/agent/state", () => ({
      readWorkspaceState: vi.fn(async () => ({
        recentRunIds: [],
        recentConversationIds: [],
        selectedImageIds: [],
        productImageIds: [],
        recentJobIds: []
      })),
      updateWorkspaceState
    }));
    vi.doMock("@/lib/chat/router", () => ({
      classifyChatRequest: () => ({ kind: "direct" })
    }));
    vi.doMock("@/lib/agent/memory", () => ({
      readCreatorMemoryProfile: vi.fn(async () => null),
      updateCreatorMemoryFromTurn: vi.fn(async () => null)
    }));
    vi.doMock("@/lib/agent/orchestrator", () => ({
      runAgentTurn
    }));
    vi.doMock("@/lib/post-project/store", () => ({
      appendPostProjectMemoryFromTurn: vi.fn(async () => syncedPostProject),
      resetPostProject: vi.fn(),
      syncPostProjectFromWorkspace,
      updatePostProject: vi.fn()
    }));
    vi.doMock("@/lib/storage/chat", () => ({
      appendChatTurn,
      getChatConversation: vi.fn(async () => conversation)
    }));
    vi.doMock("@/lib/mcp/xhs", () => ({
      createXhsMcpClient: () => ({})
    }));
    vi.doMock("@/lib/models/provider", () => ({
      createModelProvider: () => ({})
    }));

    const { POST } = await import("@/app/api/chat/route");
    const response = await POST(jsonRequest({ message: "直接生成一篇咖啡笔记", conversationId: "chat-1" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(syncPostProjectFromWorkspace).toHaveBeenCalledWith(expect.objectContaining({
      topic: "Coffee guide",
      researchRunId: "run-1",
      currentDraftId: "draft-1",
      selectedImageIds: ["asset-1"]
    }));
    expect(payload.postProject).toEqual(expect.objectContaining({
      id: "post-synced",
      currentStage: "brief_ready"
    }));
    expect(appendChatTurn).toHaveBeenCalledWith(expect.objectContaining({
      assistantMeta: expect.objectContaining({
        postProjectId: "post-synced",
        postProjectStage: "brief_ready",
        evidenceIds: ["insight-title-1"]
      })
    }));
  });

  it("queues long chat workflow requests as background jobs", async () => {
    const conversation = { id: "chat-1", title: "coffee", createdAt: "", updatedAt: "", messages: [] };
    const enqueueWorkflow = vi.fn(async () => ({
      id: "job-1",
      type: "workflow",
      title: "research coffee",
      status: "queued",
      progress: 10,
      createdAt: "",
      updatedAt: "",
      input: {},
      steps: []
    }));
    const appendChatTurn = vi.fn(async () => conversation);
    const resetWorkspaceState = vi.fn(async (patch) => ({
      schemaVersion: 1,
      workspaceId: "workspace-test",
      updatedAt: "",
      selectedSamples: [],
      selectedImageIds: [],
      productImageIds: [],
      recentJobIds: [],
      recentRunIds: [],
      recentConversationIds: [],
      ...patch
    }));
    const updateWorkspaceState = vi.fn(async (patch) => ({
      schemaVersion: 1,
      workspaceId: "workspace-test",
      updatedAt: "",
      topic: "coffee",
      selectedSamples: [],
      selectedImageIds: [],
      productImageIds: [],
      recentRunIds: [],
      ...patch
    }));
    const resetPostProject = vi.fn(async (seed) => ({
      id: seed.id,
      topic: seed.topic,
      currentStage: seed.currentStage
    }));
    const updatePostProject = vi.fn(async (patch) => ({
      id: "post-test",
      topic: "coffee",
      currentStage: patch.currentStage
    }));

    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings,
      isPublishVisibility: (value: unknown) => typeof value === "string"
    }));
    vi.doMock("@/lib/storage/history", () => ({
      listHistory: async () => []
    }));
    const writeCurrentDraft = vi.fn();
    vi.doMock("@/lib/storage/drafts", () => ({
      readCurrentDraft: async () => null,
      writeCurrentDraft,
      createDraftRecord: vi.fn()
    }));
    vi.doMock("@/lib/storage/assets", () => ({
      getAsset: vi.fn()
    }));
    vi.doMock("@/lib/chat/router", () => ({
      classifyChatRequest: () => ({
        kind: "queue-workflow",
        topic: "coffee",
        contentType: "探店",
        timeRange: "一周内",
        sampleCount: 4,
        workflowGoal: "research",
        publishMode: "draft",
        analyzeImages: true,
        generateImages: false
      })
    }));
    vi.doMock("@/lib/agent/memory", () => ({
      readCreatorMemoryProfile: vi.fn(async () => null),
      updateCreatorMemoryFromTurn: vi.fn(async () => null)
    }));
    vi.doMock("@/lib/agent/state", () => ({
      readWorkspaceState: vi.fn(),
      resetWorkspaceState,
      updateWorkspaceState
    }));
    vi.doMock("@/lib/post-project/store", () => ({
      appendPostProjectMemoryFromTurn: vi.fn(),
      resetPostProject,
      updatePostProject
    }));
    vi.doMock("@/lib/jobs/runner", () => ({
      getJobRunner: () => ({ enqueueWorkflow })
    }));
    vi.doMock("@/lib/agent/orchestrator", () => ({
      runAgentTurn: vi.fn()
    }));
    vi.doMock("@/lib/storage/chat", () => ({
      appendChatTurn,
      getChatConversation: vi.fn(async () => conversation)
    }));
    vi.doMock("@/lib/mcp/xhs", () => ({
      createXhsMcpClient: () => ({})
    }));
    vi.doMock("@/lib/models/provider", () => ({
      createModelProvider: () => ({})
    }));
    vi.doMock("@/lib/workflows/one-click", () => ({
      runOneClickWorkflow: vi.fn()
    }));

    const { POST } = await import("@/app/api/chat/route");
    const response = await POST(jsonRequest({ message: "research coffee", conversationId: "chat-1" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      answer: expect.stringContaining("job-1"),
      reply: expect.stringContaining("job-1"),
      stage: "researching",
      intent: "research_only",
      intentConfidence: expect.any(Number),
      needsUserInput: false,
      questions: [],
      workspacePatch: expect.objectContaining({ topic: "coffee", recentJobIds: ["job-1"] }),
      cards: [
        expect.objectContaining({
          type: "director_summary",
          title: "后台研究已启动，我会先收集证据",
          data: expect.objectContaining({
            stage: "researching",
            intent: "research_only",
            nextAction: "open_jobs",
            evidenceCount: 0
          })
        }),
        expect.objectContaining({ type: "stage_guidance", title: "后台研究已启动" }),
        expect.objectContaining({ type: "evidence_summary", title: "证据等待生成" })
      ],
      quickActions: [
        expect.objectContaining({ action: "open_jobs" }),
        expect.objectContaining({ action: "recover" })
      ],
      toolTrace: [expect.objectContaining({ label: "workflow.runOneClick", status: "running" })],
      job: expect.objectContaining({ id: "job-1" }),
      jobId: "job-1",
      postProject: expect.objectContaining({ currentStage: "researching" }),
      conversation
    });
    expect(enqueueWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "coffee" }),
      expect.objectContaining({ workspaceId: "workspace-test", postProjectId: "post-test" })
    );
    expect(resetWorkspaceState).toHaveBeenCalledWith(expect.objectContaining({
      topic: "coffee",
      selectedSamples: [],
      currentDraft: null,
      selectedImageIds: [],
      publishPlan: null,
      lastUserIntent: "research_only"
    }));
    expect(writeCurrentDraft).toHaveBeenCalledWith(null);
    expect(resetPostProject).toHaveBeenCalledWith(expect.objectContaining({
      topic: "coffee",
      currentStage: "researching"
    }));
    expect(appendChatTurn).toHaveBeenCalledWith(expect.objectContaining({
      assistantMeta: expect.objectContaining({
        cards: expect.arrayContaining([
          expect.objectContaining({ type: "director_summary" })
        ]),
        quickActions: expect.arrayContaining([
          expect.objectContaining({ action: "open_jobs" })
        ]),
        toolTrace: expect.arrayContaining([
          expect.objectContaining({ label: "workflow.runOneClick", status: "running" })
        ]),
        postProjectId: "post-test",
        postProjectStage: "researching",
        evidenceIds: []
      })
    }));
  });

  it("does not infer job publishing from default auto-publish or legacy autoPublish flags", async () => {
    const enqueueWorkflow = vi.fn(async (input) => ({
      id: "job-1",
      type: "workflow",
      title: "research coffee",
      status: "queued",
      progress: 10,
      createdAt: "",
      updatedAt: "",
      input,
      steps: []
    }));
    const resetWorkspaceState = vi.fn(async (patch) => ({
      schemaVersion: 1,
      workspaceId: "workspace-job",
      updatedAt: "",
      selectedSamples: [],
      selectedImageIds: [],
      productImageIds: [],
      recentJobIds: [],
      recentRunIds: [],
      recentConversationIds: [],
      ...patch
    }));
    const resetPostProject = vi.fn(async (seed) => ({
      id: seed.id,
      topic: seed.topic,
      currentStage: seed.currentStage
    }));
    const writeCurrentDraft = vi.fn();

    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => ({
        ...defaultSettings,
        defaultAutoPublish: true,
        maxResearchSamples: 12
      }),
      isPublishVisibility: (value: unknown) => typeof value === "string"
    }));
    vi.doMock("@/lib/jobs/runner", () => ({
      getJobRunner: () => ({ enqueueWorkflow })
    }));
    vi.doMock("@/lib/agent/state", () => ({
      readWorkspaceState: vi.fn(),
      resetWorkspaceState
    }));
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: vi.fn(),
      resetPostProject
    }));
    vi.doMock("@/lib/storage/drafts", () => ({
      writeCurrentDraft
    }));

    const { POST } = await import("@/app/api/jobs/route");
    const response = await POST(jsonRequest({
      topic: "coffee",
      autoPublish: true,
      imageSource: "product",
      assetIds: ["asset-1"],
      productName: "咖啡豆"
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.job).toEqual(expect.objectContaining({ id: "job-1" }));
    expect(payload.workspace).toEqual(expect.objectContaining({
      topic: "coffee",
      lastUserIntent: "research_to_draft"
    }));
    expect(payload.postProject).toEqual(expect.objectContaining({
      topic: "coffee",
      currentStage: "researching"
    }));
    expect(enqueueWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "coffee",
        publishMode: "draft",
        autoPublish: false
      }),
      expect.objectContaining({ workspaceId: "workspace-job", postProjectId: "post-job" })
    );
    expect(resetWorkspaceState).toHaveBeenCalledWith(expect.objectContaining({
      topic: "coffee",
      currentDraft: null,
      selectedSamples: [],
      selectedImageIds: [],
      productImageIds: ["asset-1"],
      publishPlan: null,
      lastUserIntent: "research_to_draft"
    }));
    expect(writeCurrentDraft).toHaveBeenCalledWith(null);
    expect(resetPostProject).toHaveBeenCalledWith(expect.objectContaining({
      topic: "coffee",
      productInfo: expect.objectContaining({
        name: "咖啡豆",
        referenceAssetIds: ["asset-1"]
      }),
      currentStage: "researching"
    }));
  });

  it("returns published status and currentDraft from the publish route", async () => {
    const asset = {
      id: "asset-1",
      kind: "upload",
      name: "image",
      originalName: "image.png",
      absolutePath: path.join(process.cwd(), "generated-assets", "uploads", "image.png"),
      mimeType: "image/png",
      size: 10,
      createdAt: "2026-05-21T00:00:00.000Z"
    };
    const publishContent = vi.fn(async () => ({ ok: true }));
    const updatePostProject = vi.fn(async () => ({}));
    const currentDraft = {
      id: "draft-1",
      updatedAt: "2026-05-30T00:00:00.000Z",
      draft: {
        title: "title",
        content: "这是一段足够具体的发布正文，包含真实场景、体验细节、适用人群、注意事项和互动引导，用来通过发布前质量检查。",
        tags: ["tag"],
        structure: [],
        imagePrompt: ""
      },
      images: [],
      visibility: defaultSettings.defaultVisibility
    };

    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings,
      isPublishVisibility: (value: unknown) => typeof value === "string"
    }));
    vi.doMock("@/lib/storage/assets", () => ({
      getAsset: async () => asset
    }));
    vi.doMock("@/lib/mcp/xhs", () => ({
      createXhsMcpClient: () => ({ publishContent })
    }));
    vi.doMock("@/lib/agent/publishing", () => ({
      getPublishIntent: vi.fn(),
      publishIntentMatchesArgs: vi.fn(() => false),
      executeGuardedPublish: vi.fn(async ({ args, publish }) => ({
        status: "published",
        reasons: [],
        publishIntent: { status: "published" },
        publishResult: await publish(args)
      }))
    }));
    vi.doMock("@/lib/agent/state", () => ({
      updateWorkspaceState: vi.fn(async () => ({}))
    }));
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: async () => ({
        creativeBrief: {
          audience: "咖啡探店人群",
          painPoint: "不知道周末去哪坐一会儿",
          contentAngle: "真实探店体验",
          emotionalHook: "周末放松",
          proofPoints: ["自然光", "安静座位"],
          tone: "真实自然",
          visualMood: "暖光咖啡馆",
          imageMustHave: ["咖啡", "桌面"],
          imageMustAvoid: [],
          platformStyle: "小红书真实分享",
          tabooWords: [],
          complianceNotes: [],
          basedOnEvidenceIds: ["insight-title", "insight-copy", "insight-tag", "insight-visual"]
        },
        visualDirection: {
          mood: "真实自然",
          composition: "咖啡桌面近景",
          colorPalette: "暖色",
          mustHave: ["咖啡", "桌面"],
          mustAvoid: [],
          basedOnEvidenceIds: ["insight-visual"],
          confirmationStatus: "confirmed",
          confirmedAt: "2026-05-31T00:00:00.000Z",
          confirmedBy: "user"
        },
        copyDraft: {
          id: "draft-current",
          updatedAt: "now",
          draft: {
            title: "周末可以坐一下午的咖啡馆",
            content: "这家咖啡馆更适合想安静坐一会儿的人。下午自然光会落在靠窗位置，点单可以选拿铁和小甜品，适合聊天、短暂办公或者一个人放空。周末建议早点去，热门时段座位会紧张。",
            tags: ["咖啡", "探店"],
            structure: [],
            imagePrompt: "暖光咖啡馆桌面近景",
            basedOnEvidenceIds: []
          },
          images: [],
          visibility: defaultSettings.defaultVisibility
        },
        evidencePack: {
          insights: [
            {
              id: "insight-title",
              sourceType: "realtime",
              type: "title",
              insight: "标题前置周末场景和适合人群",
              sourceSampleIds: ["sample-1"],
              confidence: 0.9,
              createdAt: "2026-05-31T00:00:00.000Z"
            },
            {
              id: "insight-copy",
              sourceType: "realtime",
              type: "copy",
              insight: "用真实场景、人群和注意事项增强可信度",
              sourceSampleIds: ["sample-1"],
              confidence: 0.9,
              createdAt: "2026-05-31T00:00:00.000Z"
            },
            {
              id: "insight-tag",
              sourceType: "viral_library",
              type: "tag",
              insight: "标签组合覆盖城市、品类和使用场景",
              sourceSampleIds: ["viral-1"],
              confidence: 0.82,
              createdAt: "2026-05-31T00:00:00.000Z"
            },
            {
              id: "insight-visual",
              sourceType: "viral_library",
              type: "visual",
              insight: "封面突出自然光、桌面主体和咖啡细节",
              sourceSampleIds: ["viral-1"],
              confidence: 0.8,
              createdAt: "2026-05-31T00:00:00.000Z"
            }
          ]
        },
        selectedSamples: [],
        selectedImages: ["asset-1"],
        imagePrompts: [{ id: "prompt-1", value: { prompt: "暖光咖啡馆桌面近景" }, basedOnEvidenceIds: ["insight-1"] }]
      }),
      updatePostProject
    }));
    vi.doMock("@/lib/storage/drafts", () => ({
      createDraftRecord: vi.fn(() => currentDraft),
      writeCurrentDraft: vi.fn(async (draft) => draft)
    }));

    const { POST } = await import("@/app/api/publish/route");
    const response = await POST(
      jsonRequest({
        title: "周末可以坐一下午的咖啡馆",
        content: "这家咖啡馆更适合想安静坐一会儿的人。下午自然光会落在靠窗位置，点单可以选拿铁和小甜品，适合聊天、短暂办公或者一个人放空。周末建议早点去，热门时段座位会紧张。",
        tags: ["咖啡", "探店"],
        assetIds: ["asset-1"],
        confirmed: true
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ status: "published", publishResult: { ok: true }, currentDraft });
    expect(publishContent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "周末可以坐一下午的咖啡馆",
        content: "这家咖啡馆更适合想安静坐一会儿的人。下午自然光会落在靠窗位置，点单可以选拿铁和小甜品，适合聊天、短暂办公或者一个人放空。周末建议早点去，热门时段座位会紧张。",
        tags: ["咖啡", "探店"],
        images: [path.join(process.cwd(), "generated-assets", "uploads", "image.png")]
      })
    );
    expect(updatePostProject).toHaveBeenCalledWith(expect.objectContaining({
      publishPlan: expect.objectContaining({ status: "published" }),
      currentStage: "published",
      auditStatus: "passed"
    }));
  });

  it("marks the active PostProject failed when the publish route crashes", async () => {
    const updatePostProject = vi.fn(async () => ({}));
    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => {
        throw new Error("settings unavailable");
      },
      isPublishVisibility: (value: unknown) => typeof value === "string"
    }));
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: vi.fn(),
      updatePostProject
    }));

    const { POST } = await import("@/app/api/publish/route");
    const response = await POST(jsonRequest({
      title: "发布失败测试",
      content: "这是一段发布失败测试正文",
      tags: ["测试"],
      confirmed: true
    }));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe("settings unavailable");
    expect(updatePostProject).toHaveBeenCalledWith({
      currentStage: "failed",
      auditStatus: "blocked"
    });
  });

  it("blocks real publish calls without a saved PostProject quality context", async () => {
    const asset = {
      id: "asset-1",
      kind: "upload",
      name: "image",
      originalName: "image.png",
      absolutePath: path.join(process.cwd(), "generated-assets", "uploads", "image.png"),
      mimeType: "image/png",
      size: 10,
      createdAt: "2026-05-21T00:00:00.000Z"
    };
    const executeGuardedPublish = vi.fn();

    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings,
      isPublishVisibility: (value: unknown) => typeof value === "string"
    }));
    vi.doMock("@/lib/storage/assets", () => ({
      getAsset: async () => asset
    }));
    vi.doMock("@/lib/mcp/xhs", () => ({
      createXhsMcpClient: () => ({ publishContent: vi.fn() })
    }));
    vi.doMock("@/lib/agent/publishing", () => ({
      getPublishIntent: vi.fn(),
      publishIntentMatchesArgs: vi.fn(() => false),
      executeGuardedPublish
    }));
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: async () => ({
        creativeBrief: {
          audience: "咖啡探店人群",
          painPoint: "不知道周末去哪坐一会儿",
          contentAngle: "真实探店体验",
          emotionalHook: "周末放松",
          proofPoints: ["自然光", "安静座位"],
          tone: "真实自然",
          visualMood: "暖光咖啡馆",
          imageMustHave: ["咖啡", "桌面"],
          imageMustAvoid: [],
          platformStyle: "小红书真实分享",
          tabooWords: [],
          complianceNotes: [],
          basedOnEvidenceIds: ["insight-1"]
        },
        visualDirection: {
          mood: "真实自然",
          composition: "咖啡桌面近景",
          colorPalette: "暖色",
          mustHave: ["咖啡", "桌面"],
          mustAvoid: [],
          basedOnEvidenceIds: ["insight-1"]
        },
        copyDraft: {
          id: "draft-current",
          updatedAt: "now",
          draft: {
            title: "周末可以坐一下午的咖啡馆",
            content: "这家咖啡馆更适合想安静坐一会儿的人。下午自然光会落在靠窗位置，点单可以选拿铁和小甜品，适合聊天、短暂办公或者一个人放空。周末建议早点去，热门时段座位会紧张。",
            tags: ["咖啡", "探店"],
            structure: [],
            imagePrompt: "暖光咖啡馆桌面近景",
            basedOnEvidenceIds: ["insight-1"]
          },
          images: [],
          visibility: defaultSettings.defaultVisibility
        },
        evidencePack: {
          insights: [{
            id: "insight-1",
            type: "copy",
            insight: "用真实场景、人群和注意事项增强可信度",
            sourceSampleIds: ["sample-1"],
            confidence: 0.9,
            createdAt: "2026-05-31T00:00:00.000Z"
          }]
        },
        selectedSamples: [],
        selectedImages: ["asset-1"],
        imagePrompts: [{ id: "prompt-1", value: { prompt: "暖光咖啡馆桌面近景" }, basedOnEvidenceIds: ["insight-1"] }]
      }),
      updatePostProject: vi.fn(async () => ({}))
    }));
    vi.doMock("@/lib/storage/drafts", () => ({
      createDraftRecord: vi.fn(),
      writeCurrentDraft: vi.fn()
    }));

    const { POST } = await import("@/app/api/publish/route");
    const response = await POST(
      jsonRequest({
        title: "title",
        content: "content",
        tags: ["tag"],
        assetIds: ["asset-1"],
        confirmed: true
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Post Studio");
    expect(payload.error).toContain("Quality Gate");
    expect(executeGuardedPublish).not.toHaveBeenCalled();
  });

  it("returns a dry-run publish preview without calling MCP or writing a draft", async () => {
    const asset = {
      id: "asset-1",
      kind: "upload",
      name: "image",
      originalName: "image.png",
      absolutePath: path.join(process.cwd(), "generated-assets", "uploads", "image.png"),
      mimeType: "image/png",
      size: 10,
      createdAt: "2026-05-21T00:00:00.000Z"
    };
    const publishContent = vi.fn(async () => ({ ok: true }));
    const executeGuardedPublish = vi.fn();
    const writeCurrentDraft = vi.fn();

    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings,
      isPublishVisibility: (value: unknown) => typeof value === "string"
    }));
    vi.doMock("@/lib/storage/assets", () => ({
      getAsset: async () => asset
    }));
    vi.doMock("@/lib/mcp/xhs", () => ({
      createXhsMcpClient: () => ({ publishContent })
    }));
    vi.doMock("@/lib/agent/publishing", async () => {
      const actual = await vi.importActual<typeof import("@/lib/agent/publishing")>("@/lib/agent/publishing");
      return {
        ...actual,
        executeGuardedPublish
      };
    });
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: async () => ({
        creativeBrief: {
          audience: "咖啡探店人群",
          painPoint: "不知道周末去哪坐一会儿",
          contentAngle: "真实探店体验",
          emotionalHook: "周末放松",
          proofPoints: ["自然光", "安静座位"],
          tone: "真实自然",
          visualMood: "暖光咖啡馆",
          imageMustHave: ["咖啡", "桌面"],
          imageMustAvoid: [],
          platformStyle: "小红书真实分享",
          tabooWords: [],
          complianceNotes: [],
          basedOnEvidenceIds: ["insight-1"]
        },
        visualDirection: {
          mood: "真实自然",
          composition: "咖啡桌面近景",
          colorPalette: "暖色",
          mustHave: ["咖啡", "桌面"],
          mustAvoid: [],
          basedOnEvidenceIds: ["insight-1"]
        },
        copyDraft: {
          id: "draft-current",
          updatedAt: "now",
          draft: {
            title: "周末可以坐一下午的咖啡馆",
            content: "这家咖啡馆更适合想安静坐一会儿的人。下午自然光会落在靠窗位置，点单可以选拿铁和小甜品，适合聊天、短暂办公或者一个人放空。周末建议早点去，热门时段座位会紧张。",
            tags: ["咖啡", "探店"],
            structure: [],
            imagePrompt: "暖光咖啡馆桌面近景",
            basedOnEvidenceIds: ["insight-1"]
          },
          images: [],
          visibility: defaultSettings.defaultVisibility
        },
        evidencePack: {
          insights: [{
            id: "insight-1",
            type: "copy",
            insight: "用真实场景、人群和注意事项增强可信度",
            sourceSampleIds: ["sample-1"],
            confidence: 0.9,
            createdAt: "2026-05-31T00:00:00.000Z"
          }]
        },
        selectedSamples: [],
        selectedImages: ["asset-1"],
        imagePrompts: [{ id: "prompt-1", value: { prompt: "暖光咖啡馆桌面近景" }, basedOnEvidenceIds: ["insight-1"] }]
      }),
      updatePostProject: vi.fn(async () => ({}))
    }));
    vi.doMock("@/lib/storage/drafts", () => ({
      createDraftRecord: vi.fn(),
      writeCurrentDraft
    }));

    const { POST } = await import("@/app/api/publish/route");
    const response = await POST(
      jsonRequest({
        title: "title",
        content: "content",
        tags: ["tag"],
        assetIds: ["asset-1"],
        scheduleAt: "2099-05-31T20:00",
        dryRun: true
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        status: "preview",
        dryRun: true,
        publishIntent: expect.objectContaining({
          status: expect.stringMatching(/draft|blocked/),
          accountId: defaultSettings.activeAccountId,
          scheduleAt: "2099-05-31T20:00:00+08:00",
          scheduleTimezone: "+08:00",
          evidenceCitationSummary: expect.objectContaining({
            fieldCounts: expect.objectContaining({
              title: expect.any(Number),
              content: expect.any(Number),
              tags: expect.any(Number),
              imagePrompt: expect.any(Number)
            }),
            sourceCounts: expect.objectContaining({
              realtime: expect.any(Number),
              viral_library: expect.any(Number)
            })
          })
        }),
        preview: expect.objectContaining({
          risk: "external_write",
          requiresConfirmation: true,
          accountId: defaultSettings.activeAccountId,
          mcpUrl: defaultSettings.mcpUrl,
          scheduleAt: "2099-05-31T20:00:00+08:00",
          scheduleTimezone: "+08:00"
        })
      })
    );
    expect(payload.publishIntent.evidenceCitationSummary.fieldCounts.title).toBeGreaterThan(0);
    expect(payload.publishIntent.evidenceCitationSummary.fieldCounts.content).toBeGreaterThan(0);
    expect(payload.publishIntent.evidenceCitationSummary.fieldCounts.tags).toBeGreaterThan(0);
    expect(payload.publishIntent.evidenceCitationSummary.fieldCounts.imagePrompt).toBeGreaterThan(0);
    expect(executeGuardedPublish).not.toHaveBeenCalled();
    expect(publishContent).not.toHaveBeenCalled();
    expect(writeCurrentDraft).not.toHaveBeenCalled();
  });

  it("creates a server confirmation intent before review-required publish execution", async () => {
    const asset = {
      id: "asset-1",
      kind: "upload",
      name: "image",
      originalName: "image.png",
      absolutePath: "C:\\xhs\\generated-assets\\uploads\\image.png",
      mimeType: "image/png",
      size: 10,
      createdAt: "2026-05-21T00:00:00.000Z"
    };
    const publishContent = vi.fn(async () => ({ ok: true }));
    const updatePostProject = vi.fn(async () => ({}));
    const executeGuardedPublish = vi.fn(async ({ policy }) => ({
      status: policy.confirmed ? "published" : "awaiting_approval",
      reasons: policy.confirmed ? [] : ["review required before external publishing"],
      publishIntent: { id: "publish-1", status: policy.confirmed ? "published" : "awaiting_approval" },
      publishResult: policy.confirmed ? { ok: true } : undefined
    }));

    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings,
      isPublishVisibility: (value: unknown) => typeof value === "string"
    }));
    vi.doMock("@/lib/storage/assets", () => ({
      getAsset: async () => asset
    }));
    vi.doMock("@/lib/mcp/xhs", () => ({
      createXhsMcpClient: () => ({ publishContent })
    }));
    vi.doMock("@/lib/agent/publishing", () => ({
      getPublishIntent: vi.fn(),
      publishIntentMatchesArgs: vi.fn(() => false),
      executeGuardedPublish
    }));
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: async () => ({
        evidencePack: {
          insights: [{
            id: "insight-1",
            type: "copy",
            insight: "写清真实体验和适用人群",
            sourceSampleIds: ["sample-1"],
            confidence: 0.9,
            createdAt: "2026-05-31T00:00:00.000Z"
          }]
        },
        selectedSamples: [],
        creativeBrief: { basedOnEvidenceIds: ["insight-1"] },
        visualDirection: {
          mood: "真实",
          composition: "真实场景近景",
          colorPalette: "自然色",
          mustHave: ["主体清晰"],
          mustAvoid: ["广告海报感"],
          basedOnEvidenceIds: ["insight-1"],
          confirmationStatus: "confirmed",
          confirmedAt: "2026-05-31T00:00:00.000Z",
          confirmedBy: "user"
        },
        copyDraft: {
          id: "draft-current",
          updatedAt: "now",
          draft: {
            title: "title",
            content: "content content content content content content content content content content content content",
            tags: ["tag"],
            structure: [],
            imagePrompt: "真实场景图",
            basedOnEvidenceIds: ["insight-1"]
          },
          images: [],
          visibility: defaultSettings.defaultVisibility
        },
        selectedImages: ["asset-1"],
        imagePrompts: [{ id: "prompt-1", value: { prompt: "真实场景图" }, basedOnEvidenceIds: ["insight-1"] }]
      }),
      updatePostProject
    }));
    vi.doMock("@/lib/storage/drafts", () => ({
      createDraftRecord: vi.fn(),
      writeCurrentDraft: vi.fn()
    }));

    const { POST } = await import("@/app/api/publish/route");
    const response = await POST(
      jsonRequest({
        title: "title",
        content: "content content content content content content content content content content content content",
        tags: ["tag"],
        assetIds: ["asset-1"],
        confirmed: true
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload).toEqual(
      expect.objectContaining({
        requiresConfirmation: true,
        publishIntent: expect.objectContaining({ id: "publish-1" })
      })
    );
    expect(executeGuardedPublish).toHaveBeenCalledWith(expect.objectContaining({
      policy: expect.objectContaining({ confirmed: false }),
      publishContext: expect.objectContaining({
        versionSnapshot: expect.objectContaining({
          copyVersionId: "copy-draft-current",
          imagePromptVersionIds: ["prompt-1"],
          selectedImageIds: ["asset-1"],
          qualityGateFresh: true,
          qualityCanPublish: true,
          finalPostMatchesCanvas: true
        })
      })
    }));
    expect(updatePostProject).toHaveBeenCalledWith(expect.objectContaining({
      publishPlan: expect.objectContaining({ id: "publish-1" })
    }));
    expect(publishContent).not.toHaveBeenCalled();
  });

  it("blocks publish route calls when the publish policy is draft-only", async () => {
    const asset = {
      id: "asset-1",
      kind: "upload",
      name: "image",
      originalName: "image.png",
      absolutePath: "C:\\xhs\\generated-assets\\uploads\\image.png",
      mimeType: "image/png",
      size: 10,
      createdAt: "2026-05-21T00:00:00.000Z"
    };
    const publishContent = vi.fn(async () => ({ ok: true }));

    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings,
      isPublishVisibility: (value: unknown) => typeof value === "string"
    }));
    vi.doMock("@/lib/storage/assets", () => ({
      getAsset: async () => asset
    }));
    vi.doMock("@/lib/mcp/xhs", () => ({
      createXhsMcpClient: () => ({ publishContent })
    }));
    vi.doMock("@/lib/agent/publishing", () => ({
      getPublishIntent: vi.fn(),
      publishIntentMatchesArgs: vi.fn(() => false),
      executeGuardedPublish: vi.fn(async () => ({
        status: "blocked",
        reasons: ["draft only mode blocks external publishing"],
        publishIntent: { status: "blocked" }
      }))
    }));
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: async () => ({
        creativeBrief: {
          audience: "咖啡探店人群",
          painPoint: "不知道周末去哪坐一会儿",
          contentAngle: "真实探店体验",
          emotionalHook: "周末放松",
          proofPoints: ["自然光", "安静座位"],
          tone: "真实自然",
          visualMood: "暖光咖啡馆",
          imageMustHave: ["咖啡", "桌面"],
          imageMustAvoid: [],
          platformStyle: "小红书真实分享",
          tabooWords: [],
          complianceNotes: [],
          basedOnEvidenceIds: ["insight-1"]
        },
        visualDirection: {
          mood: "真实自然",
          composition: "咖啡桌面近景",
          colorPalette: "暖色",
          mustHave: ["咖啡", "桌面"],
          mustAvoid: [],
          basedOnEvidenceIds: ["insight-1"],
          confirmationStatus: "confirmed",
          confirmedAt: "2026-05-31T00:00:00.000Z",
          confirmedBy: "user"
        },
        copyDraft: {
          id: "draft-current",
          updatedAt: "now",
          draft: {
            title: "周末可以坐一下午的咖啡馆",
            content: "这家咖啡馆更适合想安静坐一会儿的人。下午自然光会落在靠窗位置，点单可以选拿铁和小甜品，适合聊天、短暂办公或者一个人放空。周末建议早点去，热门时段座位会紧张。",
            tags: ["咖啡", "探店"],
            structure: [],
            imagePrompt: "暖光咖啡馆桌面近景",
            basedOnEvidenceIds: ["insight-1"]
          },
          images: [],
          visibility: defaultSettings.defaultVisibility
        },
        evidencePack: {
          insights: [{
            id: "insight-1",
            type: "copy",
            insight: "用真实场景、人群和注意事项增强可信度",
            sourceSampleIds: ["sample-1"],
            confidence: 0.9,
            createdAt: "2026-05-31T00:00:00.000Z"
          }]
        },
        selectedSamples: [],
        selectedImages: ["asset-1"],
        imagePrompts: [{ id: "prompt-1", value: { prompt: "暖光咖啡馆桌面近景" }, basedOnEvidenceIds: ["insight-1"] }]
      }),
      updatePostProject: vi.fn(async () => ({}))
    }));
    vi.doMock("@/lib/storage/drafts", () => ({
      createDraftRecord: vi.fn(),
      writeCurrentDraft: vi.fn()
    }));

    const { POST } = await import("@/app/api/publish/route");
    const response = await POST(
      jsonRequest({
        title: "周末可以坐一下午的咖啡馆",
        content: "这家咖啡馆更适合想安静坐一会儿的人。下午自然光会落在靠窗位置，点单可以选拿铁和小甜品，适合聊天、短暂办公或者一个人放空。周末建议早点去，热门时段座位会紧张。",
        tags: ["咖啡", "探店"],
        assetIds: ["asset-1"],
        publishPolicy: "draft_only"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("draft"),
        requiresConfirmation: false
      })
    );
    expect(publishContent).not.toHaveBeenCalled();
  });

  it("blocks publish route calls when the active post project failed quality gate", async () => {
    const asset = {
      id: "asset-1",
      kind: "upload",
      name: "image",
      originalName: "image.png",
      absolutePath: "C:\\xhs\\generated-assets\\uploads\\image.png",
      mimeType: "image/png",
      size: 10,
      createdAt: "2026-05-21T00:00:00.000Z"
    };
    const publishContent = vi.fn(async () => ({ ok: true }));

    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings,
      isPublishVisibility: (value: unknown) => typeof value === "string"
    }));
    vi.doMock("@/lib/storage/assets", () => ({
      getAsset: async () => asset
    }));
    vi.doMock("@/lib/mcp/xhs", () => ({
      createXhsMcpClient: () => ({ publishContent })
    }));
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: async () => ({
        auditStatus: "blocked",
        creativeBrief: {
          audience: "探店人群",
          painPoint: "不知道去哪",
          contentAngle: "真实体验",
          emotionalHook: "周末可去",
          proofPoints: ["环境", "位置"],
          tone: "真实",
          visualMood: "自然光",
          imageMustHave: ["咖啡"],
          imageMustAvoid: [],
          platformStyle: "小红书",
          tabooWords: [],
          complianceNotes: [],
          basedOnEvidenceIds: ["insight-1"]
        },
        visualDirection: {
          mood: "自然光",
          composition: "桌面近景",
          colorPalette: "暖色",
          mustHave: ["咖啡"],
          mustAvoid: [],
          basedOnEvidenceIds: ["insight-1"]
        },
        finalPost: {
          title: "全网第一",
          content: "content",
          tags: ["tag"],
          imageIds: ["asset-1"],
          imagePromptVersionIds: ["prompt-1"],
          basedOnEvidenceIds: ["insight-1"]
        },
        selectedImages: ["asset-1"],
        evidencePack: {
          insights: [{
            id: "insight-1",
            type: "copy",
            insight: "用真实场景和适用人群增强可信度",
            sourceSampleIds: ["sample-1"],
            confidence: 0.9,
            createdAt: "2026-05-31T00:00:00.000Z"
          }]
        },
        imagePrompts: [{ id: "prompt-1", value: { prompt: "自然光咖啡馆桌面" }, basedOnEvidenceIds: ["insight-1"] }],
        qualityCheck: {
          issues: ["标题存在夸张词", "未选择合适图片"]
        }
      }),
      updatePostProject: vi.fn(async () => ({}))
    }));
    vi.doMock("@/lib/agent/publishing", () => ({
      getPublishIntent: vi.fn(),
      publishIntentMatchesArgs: vi.fn(() => false),
      executeGuardedPublish: vi.fn()
    }));
    vi.doMock("@/lib/storage/drafts", () => ({
      createDraftRecord: vi.fn(),
      writeCurrentDraft: vi.fn()
    }));

    const { POST } = await import("@/app/api/publish/route");
    const response = await POST(
      jsonRequest({
        title: "全网第一",
        content: "content",
        tags: ["tag"],
        assetIds: ["asset-1"],
        confirmed: true
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Quality Gate");
    expect(payload.error).toContain("夸张词");
    expect(publishContent).not.toHaveBeenCalled();
  });

  it("blocks publish when the publish payload no longer matches the active PostProject draft", async () => {
    const asset = {
      id: "asset-1",
      kind: "upload",
      name: "image",
      originalName: "image.png",
      absolutePath: "C:\\xhs\\generated-assets\\uploads\\image.png",
      mimeType: "image/png",
      size: 10,
      createdAt: "2026-05-21T00:00:00.000Z"
    };
    const publishContent = vi.fn(async () => ({ ok: true }));
    const executeGuardedPublish = vi.fn();

    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings,
      isPublishVisibility: (value: unknown) => typeof value === "string"
    }));
    vi.doMock("@/lib/storage/assets", () => ({
      getAsset: async () => asset
    }));
    vi.doMock("@/lib/mcp/xhs", () => ({
      createXhsMcpClient: () => ({ publishContent })
    }));
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: async () => ({
        copyDraft: {
          id: "draft-current",
          draft: {
            title: "当前标题",
            content: "当前正文",
            tags: ["当前标签"]
          }
        },
        selectedImages: ["asset-1"],
        evidencePack: { insights: [{ id: "insight-1" }] },
        imagePrompts: []
      }),
      updatePostProject: vi.fn(async () => ({}))
    }));
    vi.doMock("@/lib/agent/publishing", () => ({
      getPublishIntent: vi.fn(),
      publishIntentMatchesArgs: vi.fn(() => false),
      executeGuardedPublish
    }));
    vi.doMock("@/lib/storage/drafts", () => ({
      createDraftRecord: vi.fn(),
      writeCurrentDraft: vi.fn()
    }));

    const { POST } = await import("@/app/api/publish/route");
    const response = await POST(
      jsonRequest({
        title: "旧标题",
        content: "旧正文",
        tags: ["旧标签"],
        assetIds: ["asset-1"],
        confirmed: true
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("PostProject");
    expect(payload.error).toContain("Quality Gate");
    expect(executeGuardedPublish).not.toHaveBeenCalled();
    expect(publishContent).not.toHaveBeenCalled();
  });

  it("blocks publish when selected asset ids differ from the active PostProject image version", async () => {
    const asset = {
      id: "asset-2",
      kind: "upload",
      name: "image",
      originalName: "image.png",
      absolutePath: "C:\\xhs\\generated-assets\\uploads\\image.png",
      mimeType: "image/png",
      size: 10,
      createdAt: "2026-05-21T00:00:00.000Z"
    };
    const publishContent = vi.fn(async () => ({ ok: true }));
    const executeGuardedPublish = vi.fn();

    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings,
      isPublishVisibility: (value: unknown) => typeof value === "string"
    }));
    vi.doMock("@/lib/storage/assets", () => ({
      getAsset: async () => asset
    }));
    vi.doMock("@/lib/mcp/xhs", () => ({
      createXhsMcpClient: () => ({ publishContent })
    }));
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: async () => ({
        copyDraft: {
          id: "draft-current",
          draft: {
            title: "当前标题",
            content: "当前正文",
            tags: ["当前标签"]
          }
        },
        selectedImages: ["asset-1"],
        evidencePack: { insights: [{ id: "insight-1" }] },
        imagePrompts: []
      }),
      updatePostProject: vi.fn(async () => ({}))
    }));
    vi.doMock("@/lib/agent/publishing", () => ({
      getPublishIntent: vi.fn(),
      publishIntentMatchesArgs: vi.fn(() => false),
      executeGuardedPublish
    }));
    vi.doMock("@/lib/storage/drafts", () => ({
      createDraftRecord: vi.fn(),
      writeCurrentDraft: vi.fn()
    }));

    const { POST } = await import("@/app/api/publish/route");
    const response = await POST(
      jsonRequest({
        title: "当前标题",
        content: "当前正文",
        tags: ["当前标签"],
        assetIds: ["asset-2"],
        confirmed: true
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("发布图片与当前 PostProject");
    expect(executeGuardedPublish).not.toHaveBeenCalled();
    expect(publishContent).not.toHaveBeenCalled();
  });

  it("blocks publish when selected images have no traceable visual direction or prompt confirmation", async () => {
    const asset = {
      id: "asset-1",
      kind: "upload",
      name: "image",
      originalName: "image.png",
      absolutePath: "C:\\xhs\\generated-assets\\uploads\\image.png",
      mimeType: "image/png",
      size: 10,
      createdAt: "2026-05-21T00:00:00.000Z"
    };
    const publishContent = vi.fn(async () => ({ ok: true }));
    const executeGuardedPublish = vi.fn();

    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings,
      isPublishVisibility: (value: unknown) => typeof value === "string"
    }));
    vi.doMock("@/lib/storage/assets", () => ({
      getAsset: async () => asset
    }));
    vi.doMock("@/lib/mcp/xhs", () => ({
      createXhsMcpClient: () => ({ publishContent })
    }));
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: async () => ({
        copyDraft: {
          id: "draft-current",
          draft: {
            title: "当前标题",
            content: "当前正文足够长，描述真实场景和适合人群，避免夸张承诺，给出明确使用建议。",
            tags: ["当前标签"],
            basedOnEvidenceIds: ["insight-1"],
            evidenceReferences: {
              title: ["insight-1"],
              content: ["insight-1"],
              tags: ["insight-1"],
              imagePrompt: ["insight-1"]
            }
          }
        },
        creativeBrief: {
          basedOnEvidenceIds: ["insight-1"]
        },
        selectedImages: ["asset-1"],
        evidencePack: {
          insights: [{
            id: "insight-1",
            type: "copy",
            insight: "用真实场景和适用人群增强可信度",
            sourceSampleIds: ["sample-1"],
            confidence: 0.9,
            createdAt: "2026-05-31T00:00:00.000Z"
          }]
        },
        imagePrompts: []
      }),
      updatePostProject: vi.fn(async () => ({}))
    }));
    vi.doMock("@/lib/agent/publishing", () => ({
      getPublishIntent: vi.fn(),
      publishIntentMatchesArgs: vi.fn(() => false),
      executeGuardedPublish
    }));
    vi.doMock("@/lib/storage/drafts", () => ({
      createDraftRecord: vi.fn(),
      writeCurrentDraft: vi.fn()
    }));

    const { POST } = await import("@/app/api/publish/route");
    const response = await POST(
      jsonRequest({
        title: "当前标题",
        content: "当前正文足够长，描述真实场景和适合人群，避免夸张承诺，给出明确使用建议。",
        tags: ["当前标签"],
        assetIds: ["asset-1"],
        confirmed: true
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("图片方向 / Prompt");
    expect(executeGuardedPublish).not.toHaveBeenCalled();
    expect(publishContent).not.toHaveBeenCalled();
  });

  it("forces Quality Gate on matching publish payloads instead of trusting stale project status", async () => {
    const asset = {
      id: "asset-1",
      kind: "upload",
      name: "image",
      originalName: "image.png",
      absolutePath: "C:\\xhs\\generated-assets\\uploads\\image.png",
      mimeType: "image/png",
      size: 10,
      createdAt: "2026-05-21T00:00:00.000Z"
    };
    const executeGuardedPublish = vi.fn();

    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings,
      isPublishVisibility: (value: unknown) => typeof value === "string"
    }));
    vi.doMock("@/lib/storage/assets", () => ({
      getAsset: async () => asset
    }));
    vi.doMock("@/lib/mcp/xhs", () => ({
      createXhsMcpClient: () => ({ publishContent: vi.fn() })
    }));
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: async () => ({
        creativeBrief: {
          audience: "探店人群",
          painPoint: "不知道去哪",
          contentAngle: "真实体验",
          emotionalHook: "周末可去",
          proofPoints: ["环境", "位置"],
          tone: "真实",
          visualMood: "自然光",
          imageMustHave: ["咖啡"],
          imageMustAvoid: [],
          platformStyle: "小红书",
          tabooWords: [],
          complianceNotes: [],
          basedOnEvidenceIds: ["insight-1"]
        },
        visualDirection: {
          mood: "真实自然",
          composition: "桌面近景",
          colorPalette: "暖色",
          mustHave: ["咖啡"],
          mustAvoid: [],
          basedOnEvidenceIds: ["insight-1"]
        },
        copyDraft: {
          id: "draft-current",
          updatedAt: "now",
          draft: {
            title: "全网第一咖啡馆",
            content: "这里适合周末下午来坐一会儿，有自然光、安静座位和清晰的点单建议。适合想找地方聊天、办公或短暂停留的人。",
            tags: ["咖啡", "探店"],
            structure: [],
            imagePrompt: "自然光咖啡馆桌面",
            basedOnEvidenceIds: ["insight-1"]
          },
          images: [],
          visibility: defaultSettings.defaultVisibility
        },
        selectedImages: ["asset-1"],
        evidencePack: {
          insights: [{
            id: "insight-1",
            type: "copy",
            insight: "用真实场景和适用人群增强可信度",
            sourceSampleIds: ["sample-1"],
            confidence: 0.9,
            createdAt: "2026-05-31T00:00:00.000Z"
          }]
        },
        selectedSamples: [],
        imagePrompts: [{
          id: "prompt-1",
          value: { prompt: "自然光咖啡馆桌面" },
          basedOnEvidenceIds: ["insight-1"]
        }]
      }),
      updatePostProject: vi.fn(async () => ({}))
    }));
    vi.doMock("@/lib/agent/publishing", () => ({
      getPublishIntent: vi.fn(),
      publishIntentMatchesArgs: vi.fn(() => false),
      executeGuardedPublish
    }));
    vi.doMock("@/lib/storage/drafts", () => ({
      createDraftRecord: vi.fn(),
      writeCurrentDraft: vi.fn()
    }));

    const { POST } = await import("@/app/api/publish/route");
    const response = await POST(jsonRequest({
      title: "全网第一咖啡馆",
      content: "这里适合周末下午来坐一会儿，有自然光、安静座位和清晰的点单建议。适合想找地方聊天、办公或短暂停留的人。",
      tags: ["咖啡", "探店"],
      assetIds: ["asset-1"],
      confirmed: true
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Quality Gate");
    expect(payload.error).toContain("夸张词");
    expect(executeGuardedPublish).not.toHaveBeenCalled();
  });

  it("blocks publish when a project has evidence but no committed draft or final post", async () => {
    const asset = {
      id: "asset-1",
      kind: "upload",
      name: "image",
      originalName: "image.png",
      absolutePath: "C:\\xhs\\generated-assets\\uploads\\image.png",
      mimeType: "image/png",
      size: 10,
      createdAt: "2026-05-21T00:00:00.000Z"
    };
    const executeGuardedPublish = vi.fn();

    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings,
      isPublishVisibility: (value: unknown) => typeof value === "string"
    }));
    vi.doMock("@/lib/storage/assets", () => ({
      getAsset: async () => asset
    }));
    vi.doMock("@/lib/mcp/xhs", () => ({
      createXhsMcpClient: () => ({ publishContent: vi.fn() })
    }));
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: async () => ({
        creativeBrief: { basedOnEvidenceIds: ["insight-1"] },
        evidencePack: { insights: [{ id: "insight-1" }] },
        selectedImages: ["asset-1"],
        imagePrompts: []
      }),
      updatePostProject: vi.fn(async () => ({}))
    }));
    vi.doMock("@/lib/agent/publishing", () => ({
      getPublishIntent: vi.fn(),
      publishIntentMatchesArgs: vi.fn(() => false),
      executeGuardedPublish
    }));
    vi.doMock("@/lib/storage/drafts", () => ({
      createDraftRecord: vi.fn(),
      writeCurrentDraft: vi.fn()
    }));

    const { POST } = await import("@/app/api/publish/route");
    const response = await POST(jsonRequest({
      title: "标题",
      content: "正文内容足够长，描述真实体验、场景、人群和注意事项，避免空泛表达。",
      tags: ["咖啡"],
      assetIds: ["asset-1"],
      confirmed: true
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("还没有保存的文案版本");
    expect(executeGuardedPublish).not.toHaveBeenCalled();
  });

  it("preserves evidence references when committing the Post Studio canvas", async () => {
    const writeCurrentDraft = vi.fn(async (draft) => ({ id: "draft-committed", updatedAt: "now", ...draft }));
    const updateWorkspaceState = vi.fn();
    const project = {
      creativeBrief: { basedOnEvidenceIds: ["brief-insight"] },
      evidencePack: { insights: [{ id: "fallback-insight" }] },
      copyDraft: null
    };

    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings
    }));
    vi.doMock("@/lib/agent/state", () => ({
      updateWorkspaceState
    }));
    const updatePostProject = vi.fn(async (patch) => ({ id: "post-1", ...patch }));
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: async () => project,
      updatePostProject
    }));
    vi.doMock("@/lib/storage/drafts", () => ({
      createDraftRecord: vi.fn((input) => ({
        id: "draft-created",
        updatedAt: "now",
        draft: input.draft,
        images: input.images,
        visibility: input.visibility
      })),
      writeCurrentDraft
    }));

    const { PATCH } = await import("@/app/api/post-project/route");
    const response = await PATCH(jsonRequest({
      action: "commit_canvas",
      draft: {
        title: "标题",
        content: "正文",
        tags: ["咖啡"],
        structure: [],
        imagePrompt: "图片"
      },
      selectedImageIds: ["asset-1"]
    }));

    expect(response.status).toBe(200);
    expect(writeCurrentDraft).toHaveBeenCalledWith(expect.objectContaining({
      draft: expect.objectContaining({
        basedOnEvidenceIds: ["brief-insight"]
      })
    }));
    expect(updateWorkspaceState).toHaveBeenCalledWith(expect.objectContaining({
      selectedImageIds: ["asset-1"],
      publishPlan: null
    }));
    expect(updatePostProject).toHaveBeenCalledWith(expect.objectContaining({
      copyDraft: expect.objectContaining({ id: "draft-created" }),
      copyVersions: [expect.objectContaining({
        id: "copy-draft-created",
        basedOnEvidenceIds: ["brief-insight"]
      })],
      selectedImages: ["asset-1"],
      finalPost: undefined,
      publishPlan: null,
      qualityCheck: undefined,
      auditStatus: "unchecked",
      currentStage: "copy_ready"
    }));
  });

  it("assembles finalPost and runs Quality Gate from the Post Studio canvas", async () => {
    const writeCurrentDraft = vi.fn(async (draft) => ({ id: "draft-reviewed", updatedAt: "now", ...draft }));
    const updateWorkspaceState = vi.fn();
    const updatePostProject = vi.fn(async (patch) => ({ id: "post-1", ...patch }));
    const project = {
      creativeBrief: {
        audience: "广州探店用户",
        painPoint: "不知道周末去哪",
        contentAngle: "真实体验",
        emotionalHook: "周末安静去处",
        proofPoints: ["环境", "座位"],
        tone: "真实",
        visualMood: "自然光",
        imageMustHave: ["咖啡"],
        imageMustAvoid: [],
        platformStyle: "小红书",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["insight-1"]
      },
      visualDirection: {
        mood: "自然真实",
        composition: "桌面近景",
        colorPalette: "暖色",
        mustHave: ["咖啡"],
        mustAvoid: [],
        basedOnEvidenceIds: ["insight-1"]
      },
      evidencePack: {
        insights: [{
          id: "insight-1",
          type: "copy",
          insight: "用真实场景和适用人群增强可信度",
          sourceSampleIds: ["sample-1"],
          confidence: 0.9,
          createdAt: "2026-05-31T00:00:00.000Z"
        }]
      },
      copyDraft: null,
      copyVersions: [],
      selectedImages: [],
      imagePrompts: [{
        id: "prompt-1",
        value: { prompt: "自然光咖啡桌面" },
        basedOnEvidenceIds: ["insight-1"]
      }]
    };

    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings
    }));
    vi.doMock("@/lib/agent/state", () => ({
      updateWorkspaceState
    }));
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: async () => project,
      updatePostProject
    }));
    vi.doMock("@/lib/storage/drafts", () => ({
      createDraftRecord: vi.fn((input) => ({
        id: "draft-created",
        updatedAt: "now",
        draft: input.draft,
        images: input.images,
        visibility: input.visibility
      })),
      writeCurrentDraft
    }));

    const { PATCH } = await import("@/app/api/post-project/route");
    const response = await PATCH(jsonRequest({
      action: "run_quality_gate",
      draft: {
        title: "广州周末安静咖啡馆",
        content: "这家店适合周末下午想安静坐一会儿的人，光线舒服，座位不拥挤，点单也比较清楚。适合聊天、短时办公或一个人放空。",
        tags: ["广州咖啡", "周末去哪"],
        structure: [],
        imagePrompt: "自然光咖啡桌面"
      },
      selectedImageIds: ["asset-1"]
    }));

    expect(response.status).toBe(200);
    expect(updateWorkspaceState).toHaveBeenCalledWith(expect.objectContaining({
      currentDraftId: "draft-created",
      selectedImageIds: ["asset-1"],
      publishPlan: null
    }));
    expect(updatePostProject).toHaveBeenCalledWith(expect.objectContaining({
      finalPost: expect.objectContaining({
        title: "广州周末安静咖啡馆",
        imageIds: ["asset-1"],
        copyVersionId: "copy-draft-created"
      }),
      qualityCheck: expect.objectContaining({
        canPublish: expect.any(Boolean),
        evidenceReview: expect.objectContaining({
          referencedEvidenceIds: expect.arrayContaining(["insight-1"])
        })
      }),
      auditStatus: expect.stringMatching(/passed|blocked/),
      currentStage: "reviewing"
    }));
  });

  it("previews canvas Quality Gate without mutating PostProject when dryRun is requested", async () => {
    const writeCurrentDraft = vi.fn();
    const updateWorkspaceState = vi.fn();
    const updatePostProject = vi.fn();
    const project = {
      id: "post-1",
      creativeBrief: { basedOnEvidenceIds: ["insight-1"] },
      visualDirection: {
        mood: "自然真实",
        composition: "桌面近景",
        colorPalette: "暖色",
        mustHave: ["咖啡"],
        mustAvoid: [],
        basedOnEvidenceIds: ["insight-1"],
        confirmationStatus: "confirmed"
      },
      evidencePack: {
        sampleIds: ["sample-1"],
        insights: [{
          id: "insight-1",
          type: "copy",
          insight: "用真实场景和适用人群增强可信度",
          sourceSampleIds: ["sample-1"],
          confidence: 0.9,
          createdAt: "2026-05-31T00:00:00.000Z"
        }]
      },
      copyDraft: null,
      copyVersions: [],
      selectedImages: [],
      generatedImages: [{
        id: "asset-1",
        assetId: "asset-1",
        promptVersionId: "prompt-1",
        basedOnEvidenceIds: ["insight-1"],
        selected: true
      }],
      imagePrompts: [{
        id: "prompt-1",
        value: { prompt: "自然光咖啡桌面" },
        basedOnEvidenceIds: ["insight-1"]
      }],
      agentMemory: [],
      currentStage: "assembling",
      allowedActions: ["run_quality_gate"],
      updatedAt: "2026-05-31T00:00:00.000Z"
    };

    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings
    }));
    vi.doMock("@/lib/agent/state", () => ({
      updateWorkspaceState
    }));
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: async () => project,
      updatePostProject
    }));
    vi.doMock("@/lib/storage/drafts", () => ({
      createDraftRecord: vi.fn((input) => ({
        id: "draft-preview",
        updatedAt: "now",
        draft: input.draft,
        images: input.images,
        visibility: input.visibility
      })),
      writeCurrentDraft
    }));

    const { PATCH } = await import("@/app/api/post-project/route");
    const response = await PATCH(jsonRequest({
      action: "run_quality_gate",
      dryRun: true,
      draft: {
        title: "广州周末安静咖啡馆",
        content: "这家店适合周末下午想安静坐一会儿的人，光线舒服，座位不拥挤，点单也比较清楚。",
        tags: ["广州咖啡", "周末去哪"],
        structure: [],
        imagePrompt: "自然光咖啡桌面",
        basedOnEvidenceIds: ["insight-1"]
      },
      selectedImageIds: ["asset-1"]
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.dryRun).toBe(true);
    expect(payload.project.currentStage).toBe("reviewing");
    expect(payload.project.finalPost).toMatchObject({
      title: "广州周末安静咖啡馆",
      imageIds: ["asset-1"],
      copyVersionId: "copy-draft-preview"
    });
    expect(payload.project.qualityCheck).toMatchObject({
      canPublish: expect.any(Boolean)
    });
    expect(payload.readiness.items.map((item: { id: string }) => item.id)).toContain("quality");
    expect(writeCurrentDraft).not.toHaveBeenCalled();
    expect(updateWorkspaceState).not.toHaveBeenCalled();
    expect(updatePostProject).not.toHaveBeenCalled();
  });

  it("syncs selected images from Post Studio into PostProject and workspace", async () => {
    const updateWorkspaceState = vi.fn();
    const updatePostProject = vi.fn(async (patch) => ({ id: "post-1", ...patch }));

    vi.doMock("@/lib/agent/state", () => ({
      updateWorkspaceState
    }));
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: async () => ({
        selectedImages: [],
        generatedImages: [{
          id: "image-existing",
          assetId: "asset-1",
          promptVersionId: "prompt-existing",
          basedOnEvidenceIds: ["insight-existing"],
          sourceAssetIds: ["product-1"],
          createdAt: "2026-05-30T00:00:00.000Z",
          selected: false
        }],
        creativeBrief: { basedOnEvidenceIds: ["brief-insight"] },
        visualDirection: { basedOnEvidenceIds: ["visual-insight"] },
        imagePrompts: [{
          id: "prompt-v1",
          createdAt: "2026-05-31T00:00:00.000Z",
          label: "prompt",
          value: { prompt: "图像提示词" },
          basedOnEvidenceIds: ["visual-insight"]
        }],
        evidencePack: { insights: [{ id: "visual-insight" }] }
      }),
      updatePostProject
    }));
    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings
    }));
    vi.doMock("@/lib/storage/assets", () => ({
      getAsset: async (id: string) =>
        id === "asset-2"
          ? {
              id: "asset-2",
              kind: "generated",
              name: "generated-cover",
              originalName: "generated-cover.png",
              absolutePath: "C:\\Users\\someone\\xhs\\generated-assets\\generated\\generated-cover.png",
              mimeType: "image/png",
              size: 128,
              createdAt: "2026-05-31T00:00:00.000Z",
              promptVersionId: "prompt-asset",
              basedOnEvidenceIds: ["asset-visual-insight"],
              sourceAssetIds: ["product-asset"]
            }
          : null
    }));
    vi.doMock("@/lib/storage/drafts", () => ({
      createDraftRecord: vi.fn(),
      writeCurrentDraft: vi.fn()
    }));

    const { PATCH } = await import("@/app/api/post-project/route");
    const response = await PATCH(jsonRequest({
      action: "select_images",
      selectedImageIds: ["asset-1", "asset-2"]
    }));

    expect(response.status).toBe(200);
    expect(updateWorkspaceState).toHaveBeenCalledWith({ selectedImageIds: ["asset-1", "asset-2"], publishPlan: null });
    expect(updatePostProject).toHaveBeenCalledWith(expect.objectContaining({
      selectedImages: ["asset-1", "asset-2"],
      generatedImages: [
        expect.objectContaining({
          id: "image-existing",
          assetId: "asset-1",
          promptVersionId: "prompt-existing",
          basedOnEvidenceIds: ["insight-existing"],
          sourceAssetIds: ["product-1"],
          selected: true
        }),
        expect.objectContaining({
          id: "asset-2",
          assetId: "asset-2",
          path: "C:\\Users\\someone\\xhs\\generated-assets\\generated\\generated-cover.png",
          promptVersionId: "prompt-asset",
          basedOnEvidenceIds: ["asset-visual-insight"],
          sourceAssetIds: ["product-asset"],
          selected: true
        })
      ],
      publishPlan: null,
      finalPost: undefined,
      qualityCheck: undefined,
      auditStatus: "unchecked"
    }));
  });

  it("recovers a failed PostProject to the stage implied by its current canvas", async () => {
    const failedProject = {
      id: "post-failed",
      topic: "广州咖啡馆",
      currentStage: "failed",
      publishPlan: { status: "failed" },
      auditStatus: "blocked",
      copyDraft: {
        id: "draft-1",
        updatedAt: "2026-05-31T00:00:00.000Z",
        draft: {
          title: "咖啡馆标题",
          content: "咖啡馆正文",
          tags: ["咖啡"],
          structure: [],
          imagePrompt: "自然光咖啡馆"
        },
        images: [],
        visibility: defaultSettings.defaultVisibility
      },
      selectedImages: ["asset-1"],
      imagePrompts: [],
      evidencePack: { insights: [] },
      selectedSamples: [],
      copyVersions: [],
      generatedImages: [],
      agentMemory: []
    };
    const updatePostProject = vi.fn(async (patch) => ({ ...failedProject, ...patch }));

    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: async () => failedProject,
      updatePostProject
    }));

    const { PATCH } = await import("@/app/api/post-project/route");
    const response = await PATCH(jsonRequest({ action: "recover" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(updatePostProject).toHaveBeenCalledWith({
      publishPlan: null,
      auditStatus: "unchecked",
      currentStage: "image_ready"
    });
    expect(payload.project.currentStage).toBe("image_ready");
  });

  it("syncs uploaded reference assets into PostProject product info", async () => {
    const updateWorkspaceState = vi.fn();
    const updatePostProject = vi.fn(async (patch) => ({
      id: "post-1",
      productInfo: patch.productInfo,
      evidencePack: { insights: [] },
      selectedSamples: [],
      copyVersions: [],
      imagePrompts: [],
      generatedImages: [],
      selectedImages: [],
      agentMemory: [],
      currentStage: "briefing",
      allowedActions: []
    }));
    vi.doMock("@/lib/agent/state", () => ({ updateWorkspaceState }));
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: async () => ({
        id: "post-1",
        productInfo: {
          name: "咖啡豆",
          sellingPoints: "低酸",
          scene: "早餐桌",
          referenceAssetIds: ["asset-old"]
        },
        evidencePack: { insights: [] },
        selectedSamples: [],
        copyVersions: [],
        imagePrompts: [],
        generatedImages: [],
        selectedImages: [],
        agentMemory: [],
        currentStage: "briefing",
        allowedActions: []
      }),
      updatePostProject
    }));
    vi.doMock("@/lib/storage/drafts", () => ({
      createDraftRecord: vi.fn(),
      writeCurrentDraft: vi.fn()
    }));

    const { PATCH } = await import("@/app/api/post-project/route");
    const response = await PATCH(jsonRequest({
      action: "update_reference_assets",
      referenceAssetIds: ["asset-old", "asset-new", "asset-new"]
    }));

    expect(response.status).toBe(200);
    expect(updateWorkspaceState).toHaveBeenCalledWith({
      productImageIds: ["asset-old", "asset-new"],
      lastUserIntent: "upload_product_images"
    });
    expect(updatePostProject).toHaveBeenCalledWith(expect.objectContaining({
      productInfo: {
        name: "咖啡豆",
        sellingPoints: "低酸",
        scene: "早餐桌",
        referenceAssetIds: ["asset-old", "asset-new"]
      },
      finalPost: undefined,
      publishPlan: null,
      qualityCheck: undefined,
      auditStatus: "unchecked"
    }));
  });

  it("ignores externally patched PostProject safety fields", async () => {
    const updatePostProject = vi.fn(async (patch) => ({ id: "post-1", ...patch }));
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: async () => ({ id: "post-1", evidencePack: { insights: [] } }),
      updatePostProject
    }));

    const { PATCH } = await import("@/app/api/post-project/route");
    const response = await PATCH(jsonRequest({
      topic: "广州咖啡馆",
      auditStatus: "passed",
      qualityCheck: { canPublish: true },
      finalPost: { title: "绕过", content: "绕过", tags: [], imageIds: [] },
      publishPlan: { status: "approved" },
      currentStage: "published",
      allowedActions: ["publish_now"],
      id: "post-hacked"
    }));

    expect(response.status).toBe(200);
    expect(updatePostProject).toHaveBeenCalledWith({ topic: "广州咖啡馆" });
    vi.doUnmock("@/lib/post-project/store");
  });

  it("switches copy versions through PostProject and invalidates stale publish checks", async () => {
    const updateWorkspaceState = vi.fn();
    const updatePostProject = vi.fn(async (patch) => ({ id: "post-1", ...patch }));
    const currentProject = {
      selectedImages: ["asset-1"],
      copyDraft: {
        id: "draft-old",
        updatedAt: "old",
        draft: { title: "旧标题", content: "旧正文", tags: [], structure: [], imagePrompt: "" },
        images: [],
        visibility: defaultSettings.defaultVisibility
      },
      copyVersions: [{
        id: "copy-v1",
        createdAt: "then",
        label: "v1",
        value: { title: "新标题", content: "新正文", tags: ["咖啡"], structure: [], imagePrompt: "图" },
        basedOnEvidenceIds: ["insight-1"]
      }],
      imagePrompts: [],
      evidencePack: { insights: [{ id: "insight-1" }] }
    };

    vi.doMock("@/lib/agent/state", () => ({
      updateWorkspaceState
    }));
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: async () => currentProject,
      updatePostProject
    }));
    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings
    }));
    vi.doMock("@/lib/storage/drafts", () => ({
      createDraftRecord: vi.fn((input) => ({
        id: "draft-switched",
        updatedAt: "now",
        draft: input.draft,
        images: input.images,
        visibility: input.visibility
      })),
      writeCurrentDraft: vi.fn(async (draft) => draft)
    }));

    const { PATCH } = await import("@/app/api/post-project/route");
    const response = await PATCH(jsonRequest({
      action: "select_copy_version",
      versionId: "copy-v1"
    }));

    expect(response.status).toBe(200);
    expect(updateWorkspaceState).toHaveBeenCalledWith(expect.objectContaining({
      currentDraftId: "draft-switched",
      selectedImageIds: ["asset-1"],
      publishPlan: null
    }));
    expect(updatePostProject).toHaveBeenCalledWith(expect.objectContaining({
      copyDraft: expect.objectContaining({ id: "draft-switched" }),
      copyVersions: expect.arrayContaining([expect.objectContaining({
        id: "copy-draft-switched",
        basedOnEvidenceIds: ["insight-1"]
      })]),
      finalPost: undefined,
      publishPlan: null,
      qualityCheck: undefined,
      auditStatus: "unchecked",
      currentStage: "copy_ready"
    }));
  });

  it("switches image prompt versions through the current draft and invalidates stale publish checks", async () => {
    const updateWorkspaceState = vi.fn();
    const updatePostProject = vi.fn(async (patch) => ({ id: "post-1", ...patch }));
    const currentProject = {
      selectedImages: ["asset-1"],
      creativeBrief: { basedOnEvidenceIds: ["brief-insight"] },
      copyDraft: {
        id: "draft-old",
        updatedAt: "old",
        draft: { title: "标题", content: "正文", tags: ["咖啡"], structure: [], imagePrompt: "旧图" },
        images: [],
        visibility: defaultSettings.defaultVisibility
      },
      copyVersions: [],
      imagePrompts: [
        {
          id: "prompt-v1",
          createdAt: "then",
          label: "prompt",
          value: { prompt: "新图提示词", negativePrompt: "不要文字错误" },
          basedOnEvidenceIds: ["visual-insight"]
        },
        {
          id: "prompt-latest",
          createdAt: "later",
          label: "latest prompt",
          value: { prompt: "另一个当前 Prompt" },
          basedOnEvidenceIds: ["latest-visual-insight"]
        }
      ],
      evidencePack: { insights: [{ id: "fallback-insight" }] }
    };

    vi.doMock("@/lib/agent/state", () => ({
      updateWorkspaceState
    }));
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: async () => currentProject,
      updatePostProject
    }));
    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings
    }));
    vi.doMock("@/lib/storage/drafts", () => ({
      createDraftRecord: vi.fn(),
      writeCurrentDraft: vi.fn(async (draft) => draft)
    }));

    const { PATCH } = await import("@/app/api/post-project/route");
    const response = await PATCH(jsonRequest({
      action: "select_image_prompt_version",
      versionId: "prompt-v1"
    }));

    expect(response.status).toBe(200);
    expect(updateWorkspaceState).toHaveBeenCalledWith(expect.objectContaining({
      currentDraft: expect.objectContaining({
        draft: expect.objectContaining({ imagePrompt: "新图提示词" })
      }),
      selectedImageIds: ["asset-1"],
      publishPlan: null
    }));
    expect(updatePostProject).toHaveBeenCalledWith(expect.objectContaining({
      copyDraft: expect.objectContaining({
        draft: expect.objectContaining({ imagePrompt: "新图提示词" })
      }),
      copyVersions: [expect.objectContaining({
        basedOnEvidenceIds: ["brief-insight"]
      })],
      imagePrompts: [
        expect.objectContaining({ id: "prompt-latest" }),
        expect.objectContaining({ id: "prompt-v1" })
      ],
      finalPost: undefined,
      publishPlan: null,
      qualityCheck: undefined,
      auditStatus: "unchecked",
      currentStage: "image_prompt_ready"
    }));
  });

  it("blocks asset file reads outside workspace asset folders", async () => {
    vi.doMock("@/lib/storage/assets", () => ({
      getAsset: async () => ({
        id: "asset-1",
        kind: "upload",
        name: "settings",
        originalName: "settings.json",
        absolutePath: "C:\\outside\\settings.json",
        mimeType: "application/json",
        size: 10,
        createdAt: "2026-05-21T00:00:00.000Z"
      })
    }));

    const { GET } = await import("@/app/api/assets/file/[id]/route");
    const response = await GET(new Request("http://localhost/assets"), {
      params: Promise.resolve({ id: "asset-1" })
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: expect.any(String) });
  });

  it("restores a completed job result as the active PostProject only on explicit action", async () => {
    const job = {
      id: "job-old",
      type: "workflow",
      title: "research coffee",
      status: "completed",
      progress: 100,
      createdAt: "",
      updatedAt: "",
      workspaceId: "workspace-old",
      postProjectId: "post-old",
      input: { topic: "coffee" },
      steps: [],
      result: { status: "research_ready", evidence: [], researchSummary: null, draft: null, images: [] }
    };
    const restored = {
      workspace: {
        schemaVersion: 1,
        workspaceId: "workspace-restored",
        updatedAt: "",
        topic: "coffee",
        selectedSamples: [],
        selectedImageIds: [],
        productImageIds: [],
        recentJobIds: ["job-old"],
        recentRunIds: [],
        recentConversationIds: []
      },
      postProject: {
        schemaVersion: 1,
        id: "post-restored",
        topic: "coffee",
        currentStage: "evidence_ready",
        allowedActions: ["create_creative_brief"]
      },
      workflowResult: job.result
    };
    const restoreJobResultAsWorkspace = vi.fn(async () => restored);

    vi.doMock("@/lib/jobs/runner", () => ({
      getJobRunner: () => ({
        getJob: vi.fn(async () => job)
      })
    }));
    vi.doMock("@/lib/jobs/restore", () => ({ restoreJobResultAsWorkspace }));

    const { POST } = await import("@/app/api/jobs/[id]/route");
    const response = await POST(jsonRequest({ action: "restore" }), { params: Promise.resolve({ id: "job-old" }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(restoreJobResultAsWorkspace).toHaveBeenCalledWith(job);
    expect(payload).toEqual(expect.objectContaining({
      job: expect.objectContaining({ id: "job-old" }),
      workspace: expect.objectContaining({ workspaceId: "workspace-restored", recentJobIds: ["job-old"] }),
      postProject: expect.objectContaining({ id: "post-restored", currentStage: "evidence_ready" }),
      workflowResult: expect.objectContaining({ status: "research_ready" })
    }));
  });
});
