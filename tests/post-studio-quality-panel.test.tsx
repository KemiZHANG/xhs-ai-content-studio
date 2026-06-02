import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildQualityViralCoverageView } from "@/app/components/quality-viral-coverage";
import { PostStudioQualityPanel } from "@/app/components/post-studio-quality-panel";
import type { PostProject } from "@/app/types";
import type { EvidenceCitationReport } from "@/lib/post-project/citations";

const quality: NonNullable<PostProject["qualityCheck"]> = {
  titleScore: 82,
  copyScore: 76,
  visualConsistencyScore: 88,
  platformFitScore: 91,
  complianceScore: 93,
  canPublish: false,
  issues: ["标题有些夸张", "图片方向缺少产品约束"],
  suggestions: ["降低广告感", "补充真实场景细节"],
  evidenceReview: {
    referencedEvidenceIds: ["insight-live", "viral-style"],
    realtimeEvidenceIds: ["insight-live"],
    viralEvidenceIds: ["viral-style"],
    missingEvidenceIds: [],
    summary: "引用证据 2 条；实时研究 1 条；爆款库 1 条"
  },
  evidenceAlignment: {
    copyEvidenceIds: ["insight-live"],
    visualEvidenceIds: ["viral-style"],
    sharedEvidenceIds: [],
    isAligned: false,
    summary: "文案和图片引用了不同证据"
  },
  originalityReview: {
    rules: ["只学习结构"],
    sourceSampleIds: ["viral-1"],
    riskSamples: [],
    isSafe: true,
    summary: "原创边界清晰"
  },
  viralCoverage: {
    fields: [
      { field: "title", viralEvidenceIds: ["viral-title"], realtimeEvidenceIds: [], status: "covered" },
      { field: "content", viralEvidenceIds: [], realtimeEvidenceIds: ["insight-live"], status: "missing" }
    ],
    missingFields: ["正文"],
    summary: "爆款库覆盖 1/2 项，缺少：正文"
  },
  checkedAt: "2026-06-01T00:00:00.000Z"
};

const citationReport: EvidenceCitationReport = {
  sections: [
    {
      field: "title",
      evidenceIds: ["viral-title"],
      insights: [{
        id: "viral-title",
        sourceType: "viral_library",
        type: "hook",
        insight: "标题先说适合谁",
        sourceSampleIds: ["viral-1"],
        confidence: 0.82,
        createdAt: "2026-06-01T00:00:00.000Z"
      }],
      missingEvidenceIds: [],
      sourceCounts: { realtime: 0, viral_library: 1, user_input: 0 }
    }
  ],
  allEvidenceIds: ["viral-title"],
  missingEvidenceIds: [],
  sourceCounts: { realtime: 0, viral_library: 1, user_input: 0 },
  hasRealtimeEvidence: false,
  hasViralEvidence: true,
  hasUserInputEvidence: false,
  warnings: [],
  summary: "字段级引用 1 条"
};

describe("post studio quality panel", () => {
  it("renders Quality Gate scores, citation trace, originality and viral coverage", () => {
    const html = renderToStaticMarkup(
      <PostStudioQualityPanel
        quality={quality}
        qualityViralCoverage={buildQualityViralCoverageView(quality.viralCoverage)}
        citationReport={citationReport}
        citationTraceReady
      />
    );

    expect(html).toContain("质量检查需处理");
    expect(html).toContain("标题 82");
    expect(html).toContain("阻塞项");
    expect(html).toContain("证据覆盖");
    expect(html).toContain("爆款库覆盖");
    expect(html).toContain("字段级证据追踪");
    expect(html).toContain("原创边界");
    expect(html).toContain("文案和图片引用了不同证据");
  });

  it("stays hidden before Quality Gate runs", () => {
    const html = renderToStaticMarkup(
      <PostStudioQualityPanel
        quality={undefined}
        qualityViralCoverage={buildQualityViralCoverageView(undefined)}
        citationReport={null}
        citationTraceReady={false}
      />
    );

    expect(html).toBe("");
  });
});
