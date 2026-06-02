import { createElement } from "react";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PostStudioSidePane } from "@/app/components/post-studio-side-pane";

type SidePaneProps = ComponentProps<typeof PostStudioSidePane>;

const baseSummary = {
  headline: "准备就绪",
  detail: "可以继续下一步。",
  state: "ready",
  primaryActionLabel: "继续",
  primaryAction: "generate_copy"
};

describe("post studio side pane", () => {
  it("renders the active insight tab and keeps advanced tools folded", () => {
    const props = {
      activeTab: "insights",
      sideDigest: {
        headline: "右侧工作区",
        detail: "聚焦证据和素材。",
        primaryTab: "brief",
        primaryLabel: "下一步",
        primaryReason: "生成 Brief",
        cards: [{ id: "brief", tab: "brief", label: "Brief", value: "ready", detail: "已准备", state: "ready" }]
      },
      studioTabGroups: [{
        id: "evidence",
        label: "证据",
        detail: "研究结论",
        active: true,
        tabs: [{ id: "insights", label: "可学习结论", active: true }]
      }],
      insights: {
        citationReport: null,
        creatorMemory: null,
        keyLearningInsights: [],
        onOpenViral: () => undefined,
        projectMemory: [],
        realtimeCount: 2,
        totalInsightCount: 2,
        viralCount: 1,
        viralEvidenceSummary: {
          hasEvidence: false,
          headline: "爆款库证据",
          detail: "等待接入。",
          sourceLine: "0 条",
          keyInsights: [],
          coverage: [],
          sourceCases: [],
          traceLine: "未引用"
        }
      },
      brief: { summary: baseSummary, brief: null, onQuickAction: () => undefined },
      evidence: {},
      viral: {},
      references: {},
      generated: {},
      publish: {},
      onNavigate: () => undefined,
      onSelectTab: () => undefined
    } as unknown as SidePaneProps;

    const html = renderToStaticMarkup(createElement(PostStudioSidePane, props));

    expect(html).toContain("右侧工作区");
    expect(html).toContain("可学习结论");
    expect(html).toContain("爆款库证据");
    expect(html).toContain("高级/调试工具");
  });
});
