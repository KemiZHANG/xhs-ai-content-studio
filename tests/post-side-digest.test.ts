import { describe, expect, it } from "vitest";
import { buildPostSideDigest } from "@/app/components/post-side-digest";

describe("post side digest", () => {
  it("points a new project toward evidence instead of raw side tabs", () => {
    const digest = buildPostSideDigest({
      insightCount: 0,
      realtimeInsightCount: 0,
      viralInsightCount: 0,
      hasBrief: false,
      selectedImageCount: 0,
      generatedImageCount: 0,
      referenceImageCount: 0,
      publishReady: false,
      accountReady: false,
      qualityFresh: false,
      activeTab: "insights"
    });

    expect(digest.headline).toBe("先处理：证据策略");
    expect(digest.cards).toHaveLength(4);
    expect(digest.cards[0]).toMatchObject({
      label: "证据策略",
      value: "待研究",
      state: "warn",
      tab: "evidence"
    });
    expect(digest.cards[3].detail).toContain("默认收起");
  });

  it("summarizes evidence, assets, and publish readiness into clickable cards", () => {
    const digest = buildPostSideDigest({
      insightCount: 8,
      realtimeInsightCount: 5,
      viralInsightCount: 3,
      hasBrief: true,
      selectedImageCount: 2,
      generatedImageCount: 4,
      referenceImageCount: 1,
      publishReady: true,
      accountReady: true,
      qualityFresh: true,
      activeTab: "publish"
    });

    expect(digest.headline).toBe("右侧素材和证据已收口");
    expect(digest.cards.map((card) => card.state)).toEqual(["ready", "ready", "ready", "neutral"]);
    expect(digest.cards[0]).toMatchObject({
      value: "8 条规律",
      tab: "brief"
    });
    expect(digest.cards[1]).toMatchObject({
      value: "2 张已选",
      tab: "generated"
    });
    expect(digest.cards[2].detail).toContain("人工确认");
  });

  it("prioritizes generated images before reference uploads when no image is selected", () => {
    const digest = buildPostSideDigest({
      insightCount: 2,
      realtimeInsightCount: 2,
      viralInsightCount: 0,
      hasBrief: false,
      selectedImageCount: 0,
      generatedImageCount: 3,
      referenceImageCount: 5,
      publishReady: false,
      accountReady: true,
      qualityFresh: false,
      activeTab: "generated"
    });

    const assetCard = digest.cards.find((card) => card.id === "assets");
    expect(assetCard).toMatchObject({
      state: "neutral",
      tab: "generated"
    });
    expect(assetCard?.detail).toContain("3 张生成图");
  });
});
