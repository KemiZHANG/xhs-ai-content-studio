import { describe, expect, it } from "vitest";
import { buildQualityViralCoverageView } from "@/app/components/quality-viral-coverage";

describe("quality viral coverage view", () => {
  it("summarizes field-level viral coverage for Quality Gate UI", () => {
    const view = buildQualityViralCoverageView({
      summary: "爆款库覆盖 2/4 项，缺少：正文、标签",
      missingFields: ["正文", "标签"],
      fields: [
        {
          field: "title",
          viralEvidenceIds: ["viral-title"],
          realtimeEvidenceIds: ["live-title"],
          status: "covered"
        },
        {
          field: "content",
          viralEvidenceIds: [],
          realtimeEvidenceIds: ["live-copy"],
          status: "missing"
        },
        {
          field: "tags",
          viralEvidenceIds: [],
          realtimeEvidenceIds: [],
          status: "missing"
        },
        {
          field: "imagePrompt",
          viralEvidenceIds: ["viral-visual"],
          realtimeEvidenceIds: [],
          status: "covered"
        }
      ]
    });

    expect(view.hasCoverage).toBe(true);
    expect(view.headline).toBe("爆款库覆盖 2/4");
    expect(view.detail).toContain("缺少：正文、标签");
    expect(view.items).toEqual([
      expect.objectContaining({ field: "title", label: "标题", status: "covered", line: "爆款库 1 条 · 实时 1 条" }),
      expect.objectContaining({ field: "content", label: "正文", status: "missing", line: "缺爆款库 · 实时 1 条" }),
      expect.objectContaining({ field: "tags", label: "标签", status: "missing", line: "缺爆款库 · 实时 0 条" }),
      expect.objectContaining({ field: "imagePrompt", label: "图片方向", status: "covered", line: "爆款库 1 条 · 实时 0 条" })
    ]);
  });

  it("stays hidden before Quality Gate creates viral coverage", () => {
    const view = buildQualityViralCoverageView(undefined);

    expect(view.hasCoverage).toBe(false);
    expect(view.items).toEqual([]);
    expect(view.detail).toContain("运行 Quality Gate");
  });
});
