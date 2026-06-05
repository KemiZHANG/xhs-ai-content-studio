import { describe, expect, it } from "vitest";
import { buildPostStudioStatusSummary } from "@/app/components/post-studio-status";
import { labelForPostAction } from "@/app/components/post-action-labels";
import { defaultSettings } from "@/app/config/default-settings";
import { createBlankPostProject } from "@/lib/post-project/store";

describe("post studio status summary", () => {
  it("summarizes an empty workspace with a clear first action", () => {
    const summary = buildPostStudioStatusSummary({
      project: null,
      workspace: null,
      settings: defaultSettings,
      health: null,
      evidenceCount: 0,
      hasDraft: false,
      selectedImageCount: 0,
      canvasDirty: false
    });

    expect(summary.headline).toContain("新建");
    expect(summary.primaryAction).toBe("search_research");
    expect(summary.primaryActionLabel).toBe("搜索笔记");
    expect(summary.riskLevel).toBe("warn");
    expect(summary.accountReady).toBe(false);
    expect(summary.progressPercent).toBe(0);
    expect(summary.stageLine).toBe("等待项目主题 · 完成度 0%");
    expect(summary.accountName).toBe(defaultSettings.accounts[0].displayName);
    expect(summary.accountMcpEndpoint).toBe("localhost:18060");
    expect(summary.accountCount).toBe(1);
    expect(summary.accountOptions[0]).toMatchObject({
      id: defaultSettings.activeAccountId,
      isActive: true,
      isReady: false
    });
    expect(summary.accountSwitchHint).toContain("添加更多账号");
    expect(summary.blockers).toEqual(expect.arrayContaining(["缺少项目主题"]));
    expect(summary.chips.map((item) => item.label)).toEqual(["项目", "账号"]);
  });

  it("compresses project blockers, account state, and canvas state for the header", () => {
    const project = createBlankPostProject({
      topic: "广州咖啡馆",
      evidencePack: {
        sampleIds: ["note-1"],
        insights: [{
          id: "insight-1",
          type: "title",
          insight: "标题先给结论",
          sourceSampleIds: ["note-1"],
          confidence: 0.8,
          createdAt: "2026-05-31T00:00:00.000Z"
        }]
      },
      currentStage: "evidence_ready"
    });

    const summary = buildPostStudioStatusSummary({
      project,
      workspace: null,
      settings: defaultSettings,
      health: {
        ok: false,
        reachable: false,
        loggedIn: false,
        message: "not logged in",
        mcpUrl: defaultSettings.mcpUrl
      },
      evidenceCount: 1,
      hasDraft: false,
      selectedImageCount: 0,
      canvasDirty: true
    });

    expect(summary.headline).toBe("下一步已经明确");
    expect(summary.riskLevel).toBe("warn");
    expect(summary.accountReady).toBe(false);
    expect(summary.progressPercent).toBeGreaterThan(0);
    expect(summary.stageLine).toContain("证据已就绪");
    expect(summary.stageLine).toContain(`${summary.progressPercent}%`);
    expect(summary.primaryActionLabel).toBeTruthy();
    expect(summary.accountLoginName).toBeUndefined();
    expect(summary.blockers.length).toBeLessThanOrEqual(3);
    expect(summary.blockers.join(" ")).toContain("账号");
    expect(summary.chips.find((item) => item.label === "研究")).toMatchObject({ value: "1 条证据", state: "ok" });
    expect(summary.chips.find((item) => item.label === "RAG")).toMatchObject({ value: "待检索", state: "neutral" });
    expect(summary.chips.find((item) => item.label === "文案")).toMatchObject({ value: "待生成", state: "warn" });
  });

  it("surfaces viral-library RAG evidence and product references in the project header", () => {
    const project = createBlankPostProject({
      topic: "广州咖啡馆",
      productInfo: { name: "咖啡豆", referenceAssetIds: ["asset-1", "asset-2"] },
      evidencePack: {
        sampleIds: ["viral-case-1"],
        insights: [{
          id: "viral-insight-1",
          type: "hook",
          sourceType: "viral_library",
          insight: "爆款标题先给可收藏结论，再说明适用场景",
          sourceSampleIds: ["viral-case-1"],
          confidence: 0.86,
          createdAt: "2026-05-31T00:00:00.000Z"
        }]
      },
      currentStage: "evidence_ready"
    });

    const summary = buildPostStudioStatusSummary({
      project,
      workspace: null,
      settings: defaultSettings,
      health: {
        ok: true,
        reachable: true,
        loggedIn: true,
        message: "ok",
        mcpUrl: defaultSettings.mcpUrl
      },
      evidenceCount: 1,
      hasDraft: false,
      selectedImageCount: 0,
      canvasDirty: false
    });

    expect(summary.chips.find((item) => item.label === "RAG")).toMatchObject({ value: "1 条爆款库", state: "ok" });
    expect(summary.chips.find((item) => item.label === "产品图")).toMatchObject({ value: "2 张", state: "ok" });
    expect(summary.stageLine).toContain("证据已就绪");
  });

  it("routes the header status recommendation back to viral RAG when creative evidence is weak", () => {
    const summary = buildPostStudioStatusSummary({
      project: createBlankPostProject({
        topic: "广州咖啡馆",
        currentStage: "brief_ready",
        allowedActions: ["generate_copy", "plan_visuals", "retrieve_viral_knowledge"],
        creativeBrief: {
          audience: "周末探店人群",
          painPoint: "怕踩雷",
          contentAngle: "真实避坑探店",
          emotionalHook: "先给结论",
          proofPoints: ["排队", "人均"],
          tone: "真实分享",
          visualMood: "自然光",
          imageMustHave: ["店内空间"],
          imageMustAvoid: ["虚假 logo"],
          platformStyle: "小红书图文",
          tabooWords: [],
          complianceNotes: [],
          basedOnEvidenceIds: ["viral-insight-1"]
        }
      }),
      workspace: null,
      settings: defaultSettings,
      health: null,
      evidenceCount: 1,
      hasDraft: false,
      selectedImageCount: 0,
      canvasDirty: false,
      ragCreativeBlocked: true
    });

    expect(summary.primaryAction).toBe("retrieve_viral_knowledge");
    expect(summary.primaryActionLabel).toBe("刷新爆款库 RAG");
    expect(summary.detail).toContain("爆款库 RAG 证据还不足");
  });

  it("exposes active account metadata for the Post Studio header controls", () => {
    const settings = {
      ...defaultSettings,
      activeAccountId: "account-b",
      mcpUrl: "http://localhost:18061/mcp",
      accounts: [
        {
          id: "account-a",
          displayName: "主账号",
          mcpUrl: "http://localhost:18060/mcp",
          status: "unknown" as const,
          createdAt: "2026-05-31T00:00:00.000Z",
          updatedAt: "2026-05-31T00:00:00.000Z"
        },
        {
          id: "account-b",
          displayName: "探店账号",
          mcpUrl: "http://localhost:18061/mcp",
          status: "unknown" as const,
          createdAt: "2026-05-31T00:00:00.000Z",
          updatedAt: "2026-05-31T00:00:00.000Z"
        }
      ]
    };
    const summary = buildPostStudioStatusSummary({
      project: createBlankPostProject({ topic: "广州咖啡馆" }),
      workspace: null,
      settings,
      health: {
        ok: true,
        reachable: true,
        loggedIn: true,
        message: "已登录",
        mcpUrl: "http://localhost:18061/mcp",
        activeAccount: {
          ...settings.accounts[1],
          loginName: "xhs-cafe"
        }
      },
      evidenceCount: 0,
      hasDraft: false,
      selectedImageCount: 0,
      canvasDirty: false
    });

    expect(summary.accountReady).toBe(true);
    expect(summary.accountName).toBe("探店账号");
    expect(summary.accountLoginName).toBe("xhs-cafe");
    expect(summary.accountMcpEndpoint).toBe("localhost:18061");
    expect(summary.accountCount).toBe(2);
    expect(summary.accountOptions).toEqual([
      expect.objectContaining({
        id: "account-a",
        label: "主账号 · localhost:18060",
        detail: expect.stringContaining("可切换账号"),
        isActive: false,
        isReady: false
      }),
      expect.objectContaining({
        id: "account-b",
        label: "探店账号 · localhost:18061",
        detail: expect.stringContaining("已登录 · xhs-cafe"),
        isActive: true,
        isReady: true
      })
    ]);
    expect(summary.accountSwitchHint).toContain("重新检测");
    expect(summary.accountLine).toContain("探店账号");
    expect(summary.accountLine).toContain("xhs-cafe");
  });
});

describe("post action labels", () => {
  it("keeps next action buttons readable", () => {
    expect(labelForPostAction("search_research")).toBe("搜索笔记");
    expect(labelForPostAction("create_creative_brief")).toBe("生成创作简报");
    expect(labelForPostAction("request_publish_confirmation")).toBe("生成发布确认单");
  });
});
