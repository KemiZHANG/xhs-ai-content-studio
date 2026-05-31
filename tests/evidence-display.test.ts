import { describe, expect, it } from "vitest";
import { pickEvidenceHighlights, summarizeEvidenceSample, truncateEvidenceText } from "@/app/components/evidence-display";
import type { SampleEvidence } from "@/app/types";

describe("evidence display helpers", () => {
  it("prioritizes the strongest evidence instead of the original order", () => {
    const samples = [
      makeSample("low", { likes: 10, collects: 1, comments: 0 }),
      makeSample("high", { likes: 20, collects: 30, comments: 10 }),
      makeSample("mid", { likes: 25, collects: 4, comments: 1 }),
    ];

    expect(pickEvidenceHighlights(samples, 2).map((sample) => sample.id)).toEqual(["high", "mid"]);
  });

  it("uses concise insight highlights before raw detail text", () => {
    const sample = makeSample("sample", {
      detailText: "这是一段非常长的原始正文，不应该直接铺在主界面里。",
      reasonHighlights: ["标题钩子清晰，先给结论再补场景。"],
    });

    expect(summarizeEvidenceSample(sample)).toBe("标题钩子清晰，先给结论再补场景。");
  });

  it("falls back to a short metric summary when no insight exists", () => {
    const sample = makeSample("sample", {
      likes: 80,
      collects: 40,
      comments: 12,
      reasonHighlights: [],
      detailText: "完整正文只应该进入详情抽屉。",
    });

    expect(summarizeEvidenceSample(sample)).toContain("收藏 40");
    expect(summarizeEvidenceSample(sample)).not.toContain("完整正文");
  });

  it("truncates long raw text if it is the only available signal", () => {
    const text = "用户评价和正文内容".repeat(20);
    const sample = makeSample("sample", {
      likes: 0,
      collects: 0,
      comments: 0,
      reasonHighlights: [],
      detailText: text,
    });

    const summary = summarizeEvidenceSample(sample, 30);

    expect(summary.length).toBeLessThanOrEqual(30);
    expect(summary.endsWith("…")).toBe(true);
  });

  it("normalizes whitespace before truncating", () => {
    expect(truncateEvidenceText("  标题\n\n结构   清晰  ", 20)).toBe("标题 结构 清晰");
  });
});

function makeSample(id: string, overrides: Partial<SampleEvidence> = {}): SampleEvidence {
  return {
    id,
    title: `${id} title`,
    author: "author",
    likes: 0,
    collects: 0,
    comments: 0,
    shares: 0,
    score: 0,
    url: `https://example.com/${id}`,
    imageUrls: [],
    detailText: "",
    commentSnippets: [],
    reasonHighlights: [],
    ...overrides,
  };
}
