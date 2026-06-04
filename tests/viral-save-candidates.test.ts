import { describe, expect, it } from "vitest";
import { buildViralSaveCandidateModel, reviewViralCandidateForUi } from "@/app/components/viral-save-candidates";
import type { SampleEvidence } from "@/app/types";

const makeSample = (id: string, overrides: Partial<SampleEvidence> = {}): SampleEvidence => ({
  id,
  title: `sample ${id}`,
  author: "author",
  likes: 0,
  collects: 0,
  comments: 0,
  shares: 0,
  score: 0,
  url: "",
  imageUrls: [],
  cachedImageUrls: [],
  detailText: "",
  commentSnippets: [],
  reasonHighlights: [],
  ...overrides
});

describe("viral save candidates", () => {
  it("keeps strong evidence as a viral-library save candidate", () => {
    const strong = makeSample("strong", {
      likes: 620,
      collects: 430,
      comments: 28,
      score: 1800,
      detailText: "这是一段足够长的正文证据，用来说明标题钩子、正文结构、场景描述、用户痛点、互动引导和可复用的内容规律。".repeat(2),
      commentSnippets: ["想知道价格", "适合周末去吗"],
      imageUrls: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
      reasonHighlights: ["收藏高，适合沉淀结构"]
    });

    const candidate = reviewViralCandidateForUi(strong);

    expect(candidate.shouldSave).toBe(true);
    expect(candidate.score).toBeGreaterThanOrEqual(45);
    expect(candidate.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it("filters weak samples out of the one-click save list", () => {
    const weak = makeSample("weak", {
      likes: 2,
      collects: 1,
      comments: 0,
      detailText: "短"
    });
    const strong = makeSample("strong", {
      likes: 500,
      collects: 420,
      comments: 25,
      score: 1600,
      detailText: "这是一段足够长的正文证据，用来提取结构、痛点、场景、标签、互动和图片风格。".repeat(3),
      commentSnippets: ["在哪里", "多少钱"],
      imageUrls: ["https://example.com/a.jpg", "https://example.com/b.jpg"]
    });

    const model = buildViralSaveCandidateModel([weak, strong], 3);

    expect(model.candidates.map((item) => item.sample.id)).toEqual(["strong"]);
    expect(model.rejectedCount).toBe(1);
    expect(model.rejectedSamples.map((item) => item.sample.id)).toEqual(["weak"]);
    expect(model.rejectedSamples[0].warnings.length).toBeGreaterThan(0);
    expect(model.actionLabel).toBe("一键沉淀 1 条候选");
  });

  it("separates hidden qualified candidates from rejected weak samples", () => {
    const strongSamples = Array.from({ length: 4 }, (_, index) => makeSample(`strong-${index + 1}`, {
      likes: 600 + index,
      collects: 400 + index,
      comments: 20,
      score: 1600 + index,
      detailText: "这是一段足够长的正文证据，用来提取结构、痛点、场景、标签、互动和图片风格。".repeat(3),
      commentSnippets: ["在哪里", "多少钱"],
      imageUrls: ["https://example.com/a.jpg", "https://example.com/b.jpg"]
    }));
    const weak = makeSample("weak", {
      likes: 1,
      collects: 0,
      detailText: "短"
    });

    const model = buildViralSaveCandidateModel([...strongSamples, weak], 3);

    expect(model.candidates).toHaveLength(3);
    expect(model.hiddenCandidateCount).toBe(1);
    expect(model.rejectedCount).toBe(1);
    expect(model.rejectedSamples.map((item) => item.sample.id)).toEqual(["weak"]);
  });

  it("keeps empty state action-oriented instead of pretending every sample is useful", () => {
    const model = buildViralSaveCandidateModel([], 3);

    expect(model.candidates).toEqual([]);
    expect(model.rejectedSamples).toEqual([]);
    expect(model.hiddenCandidateCount).toBe(0);
    expect(model.headline).toBe("等待研究样本");
    expect(model.actionLabel).toBe("先继续研究");
  });
});
