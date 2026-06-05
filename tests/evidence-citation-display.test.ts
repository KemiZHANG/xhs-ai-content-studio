import { describe, expect, it } from "vitest";
import { citationFieldBadges, formatCitationStripSummary } from "@/app/components/evidence-citation-display";
import type { EvidenceCitationReport } from "@/lib/post-project/citations";

describe("evidence citation display", () => {
  it("summarizes field coverage and evidence source mix for Post Studio", () => {
    const report = makeReport({
      sourceCounts: { realtime: 2, viral_library: 1, user_input: 1 },
      sections: [
        section("title", 1),
        section("content", 2),
        section("tags", 1),
        section("imagePrompt", 0)
      ]
    });

    const summary = formatCitationStripSummary(report);

    expect(summary).toContain("字段 3/4 已绑定");
    expect(summary).toContain("实时研究 2");
    expect(summary).toContain("爆款库 1");
    expect(summary).toContain("用户输入 1");
    expect(summary).toContain("缺 图片方向");
  });

  it("separates weak viral references in the strip summary", () => {
    const summary = formatCitationStripSummary(makeReport({
      sourceCounts: { realtime: 1, viral_library: 1, user_input: 0 },
      weakViralEvidenceCount: 1
    }));

    expect(summary).toContain("爆款库 1（弱参考 1）");
  });

  it("marks fields with missing or empty citations as warnings", () => {
    const badges = citationFieldBadges(makeReport({
      sections: [
        section("title", 1),
        section("content", 0),
        { ...section("tags", 1), missingEvidenceIds: ["missing-id"] },
        section("imagePrompt", 1)
      ]
    }));

    expect(badges).toEqual([
      { label: "标题", status: "ok", count: 1 },
      { label: "正文", status: "warn", count: 0 },
      { label: "标签", status: "warn", count: 1 },
      { label: "图片方向", status: "ok", count: 1 }
    ]);
  });
});

function section(field: EvidenceCitationReport["sections"][number]["field"], count: number): EvidenceCitationReport["sections"][number] {
  return {
    field,
    evidenceIds: Array.from({ length: count }, (_, index) => `${field}-${index}`),
    insights: Array.from({ length: count }, (_, index) => ({
      id: `${field}-${index}`,
      sourceType: index % 2 ? "viral_library" : "realtime",
      type: field === "imagePrompt" ? "visual" : "copy",
      insight: `${field} insight`,
      sourceSampleIds: [],
      confidence: 0.8,
      createdAt: "2026-05-31T00:00:00.000Z"
    })),
    missingEvidenceIds: [],
    sourceCounts: { realtime: count, viral_library: 0, user_input: 0 }
  };
}

function makeReport(overrides: Partial<EvidenceCitationReport> = {}): EvidenceCitationReport {
  const sections = overrides.sections ?? [section("title", 1), section("content", 1), section("tags", 1), section("imagePrompt", 1)];
  return {
    sections,
    allEvidenceIds: sections.flatMap((item) => item.evidenceIds),
    missingEvidenceIds: sections.flatMap((item) => item.missingEvidenceIds),
    sourceCounts: { realtime: 1, viral_library: 0, user_input: 0 },
    weakViralEvidenceCount: 0,
    hasRealtimeEvidence: true,
    hasViralEvidence: false,
    hasUserInputEvidence: false,
    warnings: [],
    summary: "参考证据：实时研究 1 条。",
    ...overrides
  };
}
