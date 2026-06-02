import { describe, expect, it } from "vitest";
import { buildPostSideDigest } from "@/app/components/post-side-digest";
import { buildStudioTabGroups } from "@/app/components/studio-tab-groups";

describe("post side digest", () => {
  it("focuses the side pane on the single most important blocker", () => {
    const digest = buildPostSideDigest({
      insightCount: 2,
      realtimeInsightCount: 2,
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
    expect(digest.primaryTab).toBe("viral");
    expect(digest.primaryLabel).toBe("去处理：证据策略");
    expect(digest.cards).toHaveLength(4);
    expect(digest.cards.map((card) => card.label)).toEqual(["证据策略", "图片素材", "发布安全", "当前面板"]);
    expect(digest.detail).toContain("爆款库 RAG");
    expect(JSON.stringify(digest)).not.toMatch(/[�]|鐖|鍥剧|鏂囨|鍙戝|璇佹|鎼滅|寰呯/);
  });

  it("keeps studio tab groups readable and compact", () => {
    const groups = buildStudioTabGroups("generated");

    expect(groups.map((group) => group.label)).toEqual(["需求与证据", "文案与图片", "发布检查"]);
    expect(groups[1]).toMatchObject({
      active: true,
      detail: "参考图、生成图"
    });
    expect(groups[1].tabs.map((tab) => tab.label)).toEqual(["参考图", "生成图"]);
  });
});
