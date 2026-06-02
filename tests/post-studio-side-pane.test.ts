import { createElement } from "react";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildPostSideDigest } from "@/app/components/post-side-digest";
import { buildStudioTabGroups } from "@/app/components/studio-tab-groups";
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
  it("renders the active insight tab and keeps advanced tools readable and folded", () => {
    const sideDigest = buildPostSideDigest({
      insightCount: 2,
      realtimeInsightCount: 2,
      viralInsightCount: 0,
      hasBrief: false,
      selectedImageCount: 0,
      generatedImageCount: 0,
      referenceImageCount: 1,
      publishReady: false,
      accountReady: true,
      qualityFresh: false,
      activeTab: "insights"
    });
    const props = {
      activeTab: "insights",
      sideDigest,
      studioTabGroups: buildStudioTabGroups("insights"),
      insights: {
        citationReport: null,
        creatorMemory: null,
        keyLearningInsights: [],
        onOpenViral: () => undefined,
        projectMemory: [],
        realtimeCount: 2,
        totalInsightCount: 2,
        viralCount: 0,
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

    expect(html).toContain("先处理：证据策略");
    expect(html).toContain("已有实时规律，下一步先补爆款库 RAG");
    expect(html).toContain("可学习结论");
    expect(html).toContain("爆款库证据");
    expect(html).toContain("高级 / 调试工具");
    expect(html).toContain("日常创作留在 Post Studio");
    expect(html).toContain("独立主题研究");
    expect(html).not.toMatch(/[�]|鐖|鍥剧|鏂囨|鍙戝|璇佹|鎼滅|寰呯/);
  });
});
