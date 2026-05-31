import { describe, expect, it } from "vitest";
import { buildPostStudioStatusSummary } from "@/app/components/post-studio-status";
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
    expect(summary.riskLevel).toBe("warn");
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
    expect(summary.blockers.length).toBeLessThanOrEqual(3);
    expect(summary.blockers.join(" ")).toContain("账号");
    expect(summary.chips.find((item) => item.label === "研究")).toMatchObject({ value: "1 条证据", state: "ok" });
    expect(summary.chips.find((item) => item.label === "文案")).toMatchObject({ value: "待生成", state: "warn" });
  });
});
