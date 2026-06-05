import { describe, expect, it } from "vitest";
import { buildEvidencePanelModel, pickEvidenceHighlights, summarizeEvidenceSample, truncateEvidenceText } from "@/app/components/evidence-display";
import type { SampleEvidence } from "@/app/types";

const sample = (id: string, overrides: Partial<SampleEvidence> = {}): SampleEvidence => ({
  id,
  title: `sample ${id}`,
  author: "author",
  likes: overrides.likes ?? 0,
  collects: overrides.collects ?? 0,
  comments: overrides.comments ?? 0,
  shares: 0,
  score: 0,
  url: "",
  imageUrls: [],
  cachedImageUrls: [],
  reasonHighlights: [],
  detailText: "",
  commentSnippets: [],
  ...overrides
});

describe("evidence display helpers", () => {
  it("picks only the highest-value evidence summaries for the main panel", () => {
    const samples = [
      sample("low", { likes: 10, collects: 1, comments: 0 }),
      sample("high-save", { likes: 20, collects: 50, comments: 3 }),
      sample("discussion", { likes: 30, collects: 4, comments: 40 }),
      sample("middle", { likes: 25, collects: 8, comments: 3 })
    ];

    expect(pickEvidenceHighlights(samples, 3).map((item) => item.id)).toEqual([
      "high-save",
      "discussion",
      "middle"
    ]);
  });

  it("builds a compact panel model with hidden-count detail instead of exposing every sample", () => {
    const samples = [
      sample("a", { collects: 10 }),
      sample("b", { collects: 9 }),
      sample("c", { collects: 8 }),
      sample("d", { collects: 7 })
    ];

    const panel = buildEvidencePanelModel(samples, 3);

    expect(panel.visibleSamples).toHaveLength(3);
    expect(panel.hiddenCount).toBe(1);
    expect(panel.totalCount).toBe(4);
    expect(panel.visibleCount).toBe(3);
    expect(panel.inlineTitle).toBe("高价值摘要 3/4");
    expect(panel.primaryActionLabel).toBe("打开完整证据目录");
    expect(panel.stats).toEqual([
      { label: "摘要", value: "3" },
      { label: "全部", value: "4" },
      { label: "折叠", value: "1" }
    ]);
    expect(panel.summary).toContain("已压缩展示 3 条");
    expect(panel.detailHint).toContain("还有 1 条");
    expect(panel.compressionLine).toContain("最多保留 3 条高价值摘要");
    expect(panel.compressionLine).toContain("证据详情");
  });

  it("keeps empty research panels action-oriented without showing raw slots", () => {
    const panel = buildEvidencePanelModel([], 3);

    expect(panel.visibleSamples).toEqual([]);
    expect(panel.inlineTitle).toBe("等待研究证据");
    expect(panel.summary).toContain("这里只显示 3 条高价值摘要");
    expect(panel.compressionLine).toContain("最多保留 3 条摘要");
    expect(panel.primaryActionLabel).toBe("开始主题研究");
  });

  it("caps main-panel evidence summaries at five even when callers request more", () => {
    const samples = Array.from({ length: 8 }, (_, index) => sample(String(index), { collects: index + 1 }));

    const panel = buildEvidencePanelModel(samples, 12);

    expect(panel.visibleSamples).toHaveLength(5);
    expect(panel.hiddenCount).toBe(3);
    expect(panel.summary).toContain("已压缩展示 5 条");
    expect(panel.compressionLine).toContain("最多保留 5 条高价值摘要");
  });

  it("summarizes missing body text as an interaction/image-style hint", () => {
    const text = summarizeEvidenceSample(sample("metrics", { likes: 12, collects: 8, comments: 4 }));

    expect(text).toContain("互动");
    expect(text.length).toBeLessThanOrEqual(120);
  });

  it("uses concise insight highlights before raw detail text", () => {
    const text = summarizeEvidenceSample(sample("highlight", {
      detailText: "这是一段非常长的原始正文，不应该直接铺在主界面里。",
      reasonHighlights: ["标题钩子清晰，先给结论再补场景。"]
    }));

    expect(text).toBe("标题钩子清晰，先给结论再补场景。");
  });

  it("compresses raw detail text instead of exposing it directly in the main panel", () => {
    const text = "用户评价和正文内容".repeat(20);
    const summary = summarizeEvidenceSample(sample("raw", { detailText: text }), 30);

    expect(summary.length).toBeLessThanOrEqual(30);
    expect(summary.endsWith("…")).toBe(true);
    expect(summary).toContain("正文摘要已压缩");
    expect(summary).not.toBe(text.slice(0, 30));
  });

  it("normalizes whitespace before truncating", () => {
    expect(truncateEvidenceText("  标题\n\n结构   清晰  ", 20)).toBe("标题 结构 清晰");
  });
});
