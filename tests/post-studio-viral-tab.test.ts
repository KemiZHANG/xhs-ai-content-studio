import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ViralApplicationModel } from "@/app/components/viral-application";
import type { ViralEvidenceSummaryModel } from "@/app/components/viral-evidence-summary";
import type { ViralLibraryHealthModel } from "@/app/components/viral-library-health";
import { pickKeyViralInsights } from "@/app/components/post-studio-panel";
import { emptyViralSearchForm, PostStudioViralTab } from "@/app/components/post-studio-viral-tab";
import type { PostProject, ViralCase, WorkflowResult } from "@/app/types";

type EvidenceInsight = PostProject["evidencePack"]["insights"][number];
const mojibakePattern = /[�]|鈮|骞|鎺|涓|鐖|鍥剧|鏂囨|璇佹|鎼滅|寰呯|缁х/u;

const viralCase = {
  id: "viral-1",
  platform: "xiaohongshu",
  topic: "广州咖啡馆",
  category: "探店",
  title: "广州咖啡馆收藏清单",
  bodyExcerpt: "按路线和场景整理咖啡馆。",
  tags: ["广州探店"],
  imageStyle: "明亮真实",
  hookType: "清单型钩子",
  contentStructure: ["先给结论", "再按路线分段"],
  painPoint: "不知道周末去哪",
  audience: "广州女生",
  emotionalTrigger: "少踩雷",
  metrics: { likes: 1200, collects: 980, comments: 80, shares: 12, score: 88 },
  sourceUrl: "https://example.com/note",
  createdAt: "2026-06-02T08:00:00.000Z",
  extractedInsights: {
    reusableRules: ["标题明确城市和收益"],
    titleHooks: ["广州咖啡馆收藏清单"],
    copyStructures: ["路线 - 预算 - 适合人群"],
    tagPatterns: ["城市 + 探店 + 场景"],
    visualPatterns: ["门头 + 咖啡 + 座位"],
    avoidCopying: ["不要复制原文句式"]
  },
  extraction: { method: "model" },
  creativeSafety: {
    summary: "只学习结构，不复制原文原图。",
    reusablePatterns: ["清单结构"],
    transformationGuidance: ["换成自己的体验"],
    doNotCopy: ["不要复制原句"]
  },
  quality: { score: 0.86 }
} as unknown as ViralCase;

const insight: EvidenceInsight = {
  id: "viral-insight-1",
  sourceType: "viral_library",
  type: "hook",
  insight: "标题先给城市、场景和收藏价值。",
  sourceSampleIds: ["viral-1"],
  confidence: 0.91,
  createdAt: "2026-06-02T08:00:00.000Z"
};

const viralEvidenceSummary: ViralEvidenceSummaryModel = {
  hasEvidence: true,
  headline: "爆款库规律已接入",
  detail: "只复用结构和决策逻辑。",
  sourceLine: "爆款库 evidencePack 1 条",
  keyInsights: [{
    id: insight.id,
    type: insight.type,
    insight: insight.insight,
    confidence: insight.confidence,
    sourceSampleIds: insight.sourceSampleIds,
    isFocused: true,
    isCited: false
  }],
  coverage: [
    { id: "title", label: "标题", status: "ready", evidenceIds: [insight.id], line: "可用 1 条" },
    { id: "copy", label: "正文", status: "missing", evidenceIds: [], line: "缺少证据" },
    { id: "tag", label: "标签", status: "missing", evidenceIds: [], line: "缺少证据" },
    { id: "visual", label: "图片", status: "missing", evidenceIds: [], line: "缺少证据" }
  ],
  sourceCases: [],
  traceLine: "已进入 evidencePack"
};

const viralLibraryHealth: ViralLibraryHealthModel = {
  status: "ready",
  headline: "爆款库质量可用",
  detail: "当前样本可以参与策略创作。",
  stats: [{ label: "样本", value: "1", tone: "good" }],
  warnings: [],
  recommendations: ["继续沉淀不同角度"]
};

const viralApplication: ViralApplicationModel = {
  headline: "已选择本次重点爆款规律",
  detail: "后续生成会优先引用。",
  readinessGate: {
    status: "pending",
    label: "先应用到 CreativeBrief",
    detail: "RAG 证据足够，但还没有写入共享 Brief；先让文案和图片共用同一批证据。"
  },
  ragStatus: "enough",
  ragLine: "RAG 证据充足",
  missingEvidence: [],
  recommendation: "可以生成 CreativeBrief",
  evidenceCount: 1,
  focusedCount: 1,
  citedEvidenceIds: [],
  routes: [{
    id: "brief",
    label: "CreativeBrief",
    status: "pending",
    detail: "等待应用到 Brief。",
    evidenceIds: [insight.id]
  }],
  actions: [{ id: "apply-brief", label: "应用到 CreativeBrief", action: "create_creative_brief", primary: true }]
};

const viralPack = {
  query: "广州咖啡馆",
  rewrittenQueries: ["广州咖啡馆 收藏"],
  results: [],
  sufficiency: {
    isEnough: true,
    recommendation: "证据足够",
    missing: [],
    realtimeCount: 4,
    viralCount: 1
  },
  filterSummary: "按收藏排序"
} as unknown as NonNullable<WorkflowResult["viralKnowledge"]>;

function renderViralTab(overrides: Partial<Parameters<typeof PostStudioViralTab>[0]> = {}) {
  return renderToStaticMarkup(createElement(PostStudioViralTab, {
    viralCases: [viralCase],
    viralLibraryHealth,
    viralEvidenceSummary,
    viralSearchForm: emptyViralSearchForm,
    viralPack,
    viralApplication,
    latestViralSummaries: [{ item: viralCase, learnings: ["清单结构"], rewriteRules: ["换成自己的体验"] }],
    viralInsights: [insight],
    keyViralInsights: [insight],
    focusedEvidenceIds: [insight.id],
    viralCaseById: new Map([[viralCase.id, viralCase]]),
    onSearchFormChange: () => undefined,
    onSearchViralLibrary: () => undefined,
    onResetSearch: () => undefined,
    onQuickAction: () => undefined,
    onFocusEvidenceIds: () => undefined,
    onOpenViralCase: () => undefined,
    onRefreshViralEvidence: () => undefined,
    onReloadViralLibrary: () => undefined,
    ...overrides
  }));
}

describe("post studio viral tab", () => {
  it("renders compressed RAG evidence, search controls, and focus actions", () => {
    const html = renderViralTab();

    expect(html).toContain("爆款库证据");
    expect(html).toContain("默认只看当前帖子可用的重点规律和应用建议");
    expect(html).toContain("爆款库工具与检索");
    expect(html).toContain("检索 / 过滤爆款库");
    expect(html).toContain("RAG 证据充足");
    expect(html).toContain("先应用到 CreativeBrief");
    expect(html).toContain("先让文案和图片共用同一批证据");
    expect(html).toContain("爆款库应用进度");
    expect(html).toContain("0/1 已应用");
    expect(html).toContain("先应用到 Brief，再带到文案和图片方向");
    expect(html).toContain("应用到 CreativeBrief");
    expect(html).toContain("取消重点");
    expect(html).toContain("刷新当前项目 RAG 证据");
    expect(html).not.toMatch(mojibakePattern);
  });

  it("renders readable active filters in the viral-library search drawer", () => {
    const html = renderViralTab({
      viralSearchForm: {
        ...emptyViralSearchForm,
        query: "广州咖啡馆",
        category: "探店",
        audience: "上班族",
        painPoint: "不知道怎么选",
        minCollects: "300"
      }
    });

    expect(html).toContain("当前筛选");
    expect(html).toContain("关键词：广州咖啡馆");
    expect(html).toContain("类目：探店");
    expect(html).toContain("人群：上班族");
    expect(html).toContain("痛点：不知道怎么选");
    expect(html).toContain("收藏 ≥ 300");
  });

  it("keeps focused viral evidence visible before filling the compressed list", () => {
    const items: EvidenceInsight[] = [
      { ...insight, id: "viral-hook", type: "hook", insight: "标题先给收藏价值。", confidence: 0.98 },
      { ...insight, id: "viral-structure", type: "structure", insight: "正文按路线分段。", confidence: 0.96 },
      { ...insight, id: "viral-copy", type: "copy", insight: "正文先说适合谁。", confidence: 0.95 },
      { ...insight, id: "viral-tag", type: "tag", insight: "标签组合城市和场景。", confidence: 0.94 },
      { ...insight, id: "viral-visual", type: "visual", insight: "封面用自然光门头。", confidence: 0.93 },
      { ...insight, id: "viral-focused", type: "comment", insight: "评论最关心排队和地址。", confidence: 0.5 }
    ];

    const selected = pickKeyViralInsights(items, ["viral-focused"]);

    expect(selected.map((item) => item.id)).toEqual([
      "viral-focused",
      "viral-hook",
      "viral-structure",
      "viral-copy",
      "viral-tag"
    ]);
  });
});
