import { describe, expect, it } from "vitest";
import { buildPostProjectContextSummary } from "@/app/components/post-project-context";
import { defaultSettings } from "@/app/config/default-settings";
import { createBlankPostProject } from "@/lib/post-project/store";

describe("post project context summary", () => {
  it("makes a clean project boundary explicit", () => {
    const project = createBlankPostProject({
      id: "post-guangzhou-coffee",
      topic: "广州咖啡馆",
      currentStage: "evidence_ready",
      evidencePack: {
        sampleIds: ["sample-1"],
        insights: [{
          id: "insight-1",
          type: "title",
          insight: "标题要先给收藏理由",
          sourceSampleIds: ["sample-1"],
          confidence: 0.86,
          createdAt: "2026-05-31T00:00:00.000Z"
        }]
      },
      selectedSamples: [{ id: "sample-1", title: "咖啡馆合集" }]
    });

    const summary = buildPostProjectContextSummary({
      project,
      workspace: null,
      settings: defaultSettings,
      health: {
        ok: true,
        reachable: true,
        loggedIn: true,
        message: "ok",
        mcpUrl: defaultSettings.mcpUrl,
        activeAccount: {
          ...defaultSettings.accounts[0],
          loginName: "xhs-user",
          status: "logged_in"
        }
      },
      canvasDirty: false,
      pendingPublish: null,
      staleCanvasPublishPlan: false,
      staleAccountPublishPlan: false
    });

    expect(summary.title).toBe("广州咖啡馆");
    expect(summary.projectLine).toContain("证据就绪");
    expect(summary.accountLine).toContain("xhs-user");
    expect(summary.scopeLine).toContain("证据 1 条");
    expect(summary.state).toBe("clean");
    expect(summary.chips.find((item) => item.label === "保存")).toMatchObject({ value: "已同步", state: "ok" });
  });

  it("warns when the visible publish confirmation no longer matches the canvas", () => {
    const summary = buildPostProjectContextSummary({
      project: createBlankPostProject({
        topic: "通勤包",
        publishPlan: {
          id: "publish-1",
          mode: "manual",
          status: "awaiting_approval",
          title: "通勤包推荐",
          content: "通勤包真实分享",
          tags: ["通勤包"],
          images: ["asset-1"],
          visibility: "仅自己可见",
          requestedAt: "2026-05-31T00:00:00.000Z",
          requestedBy: "manual",
          idempotencyKey: "idem-1",
          guardrailResults: []
        }
      }),
      workspace: null,
      settings: defaultSettings,
      health: null,
      canvasDirty: true,
      pendingPublish: null,
      staleCanvasPublishPlan: true,
      staleAccountPublishPlan: false
    });

    expect(summary.state).toBe("dirty");
    expect(summary.publishLine).toBe("确认单已因画布修改失效");
    expect(summary.chips.find((item) => item.label === "确认单")).toMatchObject({ value: "需重建", state: "warn" });
  });

  it("shows an empty project as a new bounded workspace instead of old data", () => {
    const summary = buildPostProjectContextSummary({
      project: null,
      workspace: { workspaceId: "workspace-new", selectedSamples: [], selectedImageIds: [], productImageIds: [], recentJobIds: [], recentRunIds: [], recentConversationIds: [] },
      settings: defaultSettings,
      health: null,
      canvasDirty: false,
      pendingPublish: null,
      staleCanvasPublishPlan: false,
      staleAccountPublishPlan: false
    });

    expect(summary.title).toBe("未命名帖子项目");
    expect(summary.projectLine).toContain("workspace");
    expect(summary.boundaryLine).toContain("旧证据");
    expect(summary.boundaryLine).toContain("不会自动带入");
    expect(summary.boundaryChecklist).toEqual(["旧证据不带入", "旧草稿不带入", "旧图片不带入", "旧发布计划不带入"]);
    expect(summary.chips.find((item) => item.label === "项目边界")).toMatchObject({ value: "待创建", state: "warn" });
  });
});
