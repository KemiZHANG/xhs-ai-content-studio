import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RecentViralPanel, ViralStrategyCard, type RecentViralSummary } from "@/app/components/post-studio-viral-panels";
import type { ViralCase, WorkflowResult } from "@/app/types";

const viralCase: ViralCase = {
  id: "viral-1",
  platform: "xiaohongshu",
  sourceSampleId: "note-1",
  topic: "广州咖啡馆",
  category: "探店",
  title: "广州咖啡周末指南",
  bodyExcerpt: "原文摘要",
  tags: ["广州咖啡馆"],
  imageStyle: "自然光窗边",
  hookType: "适合谁前置",
  contentStructure: ["适合谁", "体验", "避坑"],
  painPoint: "怕踩雷",
  audience: "周末探店人群",
  emotionalTrigger: "真实避坑",
  metrics: { likes: 1200, collects: 900, comments: 88, shares: 24, score: 3200 },
  sourceUrl: "https://example.com/note",
  createdAt: "2026-05-31T00:00:00.000Z",
  embedding: [],
  extractedInsights: {
    titleHooks: ["标题先说适合谁"],
    copyStructures: ["先结论后细节"],
    tagPatterns: ["城市+场景"],
    visualPatterns: ["自然光"],
    audienceSignals: ["周末探店"],
    painPoints: ["怕踩雷"],
    emotionalTriggers: ["收藏"],
    commentConcerns: ["人均"],
    reusableRules: ["提炼结构，不复制原文"],
    avoidCopying: ["不要复用原句"]
  },
  creativeSafety: {
    summary: "只学习标题钩子和场景结构",
    reusablePatterns: ["适合谁前置"],
    doNotCopy: ["不要复用原句"],
    transformationGuidance: ["换成自己的产品场景"]
  },
  quality: { score: 0.86, structuredFieldCount: 7, reusableRuleCount: 4, safetyRuleCount: 4, warnings: [] },
  extraction: { sourceSampleId: "note-1", method: "model", extractedAt: "2026-05-31T00:00:00.000Z" }
};

describe("post studio viral panels", () => {
  it("renders compact RAG strategy evidence without expanding raw cases", () => {
    const viralPack: NonNullable<WorkflowResult["viralKnowledge"]> = {
      query: "广州咖啡馆",
      rewrittenQueries: ["广州咖啡馆 标题钩子"],
      sufficiency: { isEnough: true, realtimeCount: 4, viralCount: 1, missing: [], recommendation: "可以生成 Brief" },
      strategyReport: {
        summary: "综合实时研究和爆款库规律",
        titleMoves: ["适合谁前置"],
        structureMoves: ["先结论后细节"],
        visualMoves: ["自然光窗边"],
        audiencePainPoints: ["怕踩雷"],
        originalityRules: ["不复制原文"],
        recommendedAngles: ["真实避坑"],
        evidenceIds: ["viral-insight-1"]
      },
      insights: [],
      evidenceTrace: [{
        caseId: "viral-1",
        sourceSampleId: "note-1",
        sourceUrl: "https://example.com/note",
        score: 0.9,
        matchedQueries: ["广州咖啡馆 标题钩子"],
        reasons: ["RAG-Fusion query: 广州咖啡馆 标题钩子", "语义相似"],
        evidenceInsightIds: ["viral-insight-1", "viral-insight-visual"]
      }],
      results: [{ case: viralCase, score: 0.9, reasons: ["语义相似"], angleSummary: "适合谁前置 · 探店", matchedQueries: ["广州咖啡馆"] }]
    };

    const html = renderToStaticMarkup(<ViralStrategyCard viralPack={viralPack} />);

    expect(html).toContain("爆款策略摘要");
    expect(html).toContain("综合实时研究和爆款库规律");
    expect(html).toContain("适合谁前置");
    expect(html).toContain("原创边界");
    expect(html).toContain("来源追踪");
    expect(html).toContain("viral-1");
    expect(html).toContain("0.90");
    expect(html).toContain("广州咖啡馆 标题钩子");
    expect(html).toContain("进入 evidencePack：viral-insight-1 / viral-insight-visual");
  });

  it("renders recent viral summaries with a drawer handoff action", () => {
    const summaries: RecentViralSummary[] = [{
      item: viralCase,
      learnings: ["适合谁前置"],
      rewriteRules: ["换成自己的产品场景"]
    }];

    const html = renderToStaticMarkup(<RecentViralPanel summaries={summaries} onOpenCase={() => undefined} />);

    expect(html).toContain("最近入库提炼");
    expect(html).toContain("AI 提炼");
    expect(html).toContain("只学习标题钩子和场景结构");
    expect(html).toContain("查看");
  });
});
