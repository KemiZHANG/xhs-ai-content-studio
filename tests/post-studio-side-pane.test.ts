import { createElement } from "react";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildPostSideDigest } from "@/app/components/post-side-digest";
import { buildStudioTabGroups } from "@/app/components/studio-tab-groups";
import { PostStudioSidePane } from "@/app/components/post-studio-side-pane";
import { emptyViralSearchForm } from "@/app/components/post-studio-viral-tab";

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

  it("renders the active viral tab with RAG sufficiency and application routes", () => {
    const sideDigest = buildPostSideDigest({
      insightCount: 5,
      realtimeInsightCount: 3,
      viralInsightCount: 2,
      hasBrief: true,
      selectedImageCount: 0,
      generatedImageCount: 0,
      referenceImageCount: 0,
      publishReady: false,
      accountReady: true,
      qualityFresh: false,
      activeTab: "viral"
    });
    const props = {
      activeTab: "viral",
      sideDigest,
      studioTabGroups: buildStudioTabGroups("viral"),
      insights: {},
      brief: { summary: baseSummary, brief: null, onQuickAction: () => undefined },
      evidence: {},
      viral: {
        viralCases: [],
        viralLibraryHealth: {
          status: "ready",
          headline: "爆款库质量可用",
          detail: "当前规律可以进入创作链路。",
          stats: [{ label: "样本", value: "2", tone: "good" }],
          warnings: [],
          recommendations: []
        },
        viralEvidenceSummary: {
          hasEvidence: true,
          headline: "重点爆款规律",
          detail: "只学习结构、钩子和图片风格。",
          sourceLine: "爆款库 evidencePack 2 条",
          keyInsights: [],
          coverage: [],
          sourceCases: [],
          traceLine: "已进入 evidencePack"
        },
        viralSearchForm: emptyViralSearchForm,
        viralPack: {
          sufficiency: {
            isEnough: true,
            realtimeCount: 3,
            viralCount: 2,
            missing: [],
            recommendation: "证据足够进入 CreativeBrief、文案和图片方向生成。"
          },
          filterSummary: "类目 探店",
          rewrittenQueries: ["广州咖啡馆 标题钩子", "广州咖啡馆 图片风格"]
        },
        viralApplication: {
          headline: "爆款库规律已接入创作链路",
          detail: "Brief、文案和图片方向会共享这些规律。",
          ragStatus: "enough",
          ragLine: "RAG 证据充足：实时 3 条，爆款库 2 条。",
          missingEvidence: [],
          recommendation: "可以继续生成。",
          evidenceCount: 2,
          focusedCount: 1,
          citedEvidenceIds: ["viral-insight-hook"],
          routes: [
            {
              id: "brief",
              label: "CreativeBrief",
              status: "pending",
              detail: "等待应用到 Brief。",
              evidenceIds: ["viral-insight-hook"]
            },
            {
              id: "copy",
              label: "标题/正文/标签",
              status: "pending",
              detail: "等待生成文案。",
              evidenceIds: ["viral-insight-hook"]
            },
            {
              id: "visual",
              label: "图片方向/提示词",
              status: "pending",
              detail: "等待生成图片方向。",
              evidenceIds: ["viral-insight-visual"]
            }
          ],
          actions: [{ id: "apply-brief", label: "应用到 CreativeBrief", action: "create_creative_brief", primary: true }]
        },
        latestViralSummaries: [],
        viralInsights: [],
        keyViralInsights: [],
        focusedEvidenceIds: ["viral-insight-hook"],
        viralCaseById: new Map(),
        onSearchFormChange: () => undefined,
        onSearchViralLibrary: () => undefined,
        onResetSearch: () => undefined,
        onQuickAction: () => undefined,
        onFocusEvidenceIds: () => undefined,
        onOpenViralCase: () => undefined,
        onRefreshViralEvidence: () => undefined,
        onReloadViralLibrary: () => undefined
      },
      references: {},
      generated: {},
      publish: {},
      onNavigate: () => undefined,
      onSelectTab: () => undefined
    } as unknown as SidePaneProps;

    const html = renderToStaticMarkup(createElement(PostStudioSidePane, props));

    expect(html).toContain("爆款库证据");
    expect(html).toContain("RAG 证据充足");
    expect(html).toContain("爆款库应用进度");
    expect(html).toContain("CreativeBrief");
    expect(html).toContain("标题/正文/标签");
    expect(html).toContain("图片方向/提示词");
    expect(html).toContain("应用到 CreativeBrief");
    expect(html).toContain("爆款库工具与检索");
    expect(html).not.toMatch(/[�]|鐖|鍥剧|鏂囨|鍙戝|璇佹|鎼滅|寰呯/);
  });
});
