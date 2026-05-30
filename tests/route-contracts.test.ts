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
    vi.doMock("@/lib/storage/drafts", () => ({
      readCurrentDraft: async () => null,
      writeCurrentDraft: vi.fn(),
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
      cards: [],
      quickActions: [expect.objectContaining({ action: "open_jobs" })],
      toolTrace: [expect.objectContaining({ label: "workflow.runOneClick", status: "running" })],
      job: expect.objectContaining({ id: "job-1" }),
      jobId: "job-1",
      postProject: expect.objectContaining({ currentStage: "researching" }),
      conversation
    });
    expect(enqueueWorkflow).toHaveBeenCalledWith(expect.objectContaining({ topic: "coffee" }));
    expect(resetWorkspaceState).toHaveBeenCalledWith(expect.objectContaining({
      topic: "coffee",
      selectedSamples: [],
      currentDraft: null,
      selectedImageIds: [],
      publishPlan: null,
      lastUserIntent: "research_only"
    }));
    expect(resetPostProject).toHaveBeenCalledWith(expect.objectContaining({
      topic: "coffee",
      currentStage: "researching"
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

    const { POST } = await import("@/app/api/jobs/route");
    const response = await POST(jsonRequest({ topic: "coffee", autoPublish: true }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.job).toEqual(expect.objectContaining({ id: "job-1" }));
    expect(enqueueWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "coffee",
        publishMode: "draft",
        autoPublish: false
      })
    );
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
        evidencePack: { insights: [] },
        selectedSamples: [],
        selectedImages: [],
        imagePrompts: []
      }),
      updatePostProject: vi.fn(async () => ({}))
    }));
    vi.doMock("@/lib/storage/drafts", () => ({
      createDraftRecord: vi.fn(() => currentDraft),
      writeCurrentDraft: vi.fn(async (draft) => draft)
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

    expect(response.status).toBe(200);
    expect(payload).toEqual({ status: "published", publishResult: { ok: true }, currentDraft });
    expect(publishContent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "title",
        content: "content",
        tags: ["tag"],
        images: [path.join(process.cwd(), "generated-assets", "uploads", "image.png")]
      })
    );
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
        evidencePack: { insights: [] },
        selectedSamples: [],
        selectedImages: [],
        imagePrompts: []
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
        dryRun: true
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        status: "preview",
        dryRun: true,
        publishIntent: expect.objectContaining({ status: "draft", accountId: defaultSettings.activeAccountId }),
        preview: expect.objectContaining({
          risk: "external_write",
          requiresConfirmation: true,
          accountId: defaultSettings.activeAccountId,
          mcpUrl: defaultSettings.mcpUrl
        })
      })
    );
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
        evidencePack: { insights: [{ id: "insight-1" }] },
        selectedSamples: [],
        creativeBrief: { basedOnEvidenceIds: ["insight-1"] },
        visualDirection: { mood: "真实" },
        copyDraft: null,
        imagePrompts: []
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
        content: "content",
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
    expect(executeGuardedPublish).toHaveBeenCalledWith(expect.objectContaining({ policy: expect.objectContaining({ confirmed: false }) }));
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
        evidencePack: { insights: [] },
        selectedSamples: [],
        selectedImages: [],
        imagePrompts: []
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
        finalPost: {
          title: "全网第一",
          content: "content",
          tags: ["tag"]
        },
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

  it("syncs selected images from Post Studio into PostProject and workspace", async () => {
    const updateWorkspaceState = vi.fn();
    const updatePostProject = vi.fn(async (patch) => ({ id: "post-1", ...patch }));

    vi.doMock("@/lib/agent/state", () => ({
      updateWorkspaceState
    }));
    vi.doMock("@/lib/post-project/store", () => ({
      readPostProject: async () => ({
        selectedImages: [],
        generatedImages: [],
        imagePrompts: [],
        evidencePack: { insights: [] }
      }),
      updatePostProject
    }));
    vi.doMock("@/lib/storage/settings", () => ({
      readSettings: async () => defaultSettings
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
      publishPlan: null,
      finalPost: undefined,
      qualityCheck: undefined,
      auditStatus: "unchecked"
    }));
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
      imagePrompts: [{
        id: "prompt-v1",
        createdAt: "then",
        label: "prompt",
        value: { prompt: "新图提示词", negativePrompt: "不要文字错误" },
        basedOnEvidenceIds: ["visual-insight"]
      }],
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
      finalPost: undefined,
      publishPlan: null,
      qualityCheck: undefined,
      auditStatus: "unchecked",
      currentStage: "copy_ready"
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
});
