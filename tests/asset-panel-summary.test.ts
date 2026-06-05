import { describe, expect, it } from "vitest";
import { buildGeneratedAssetSummary, buildReferenceAssetSummary } from "@/app/components/asset-panel-summary";
import type { AssetRecord } from "@/app/types";

function asset(id: string, kind: AssetRecord["kind"] = "generated", createdAt = "2026-05-31T00:00:00.000Z"): AssetRecord {
  return {
    id,
    kind,
    name: `${id}.png`,
    originalName: `${id}.png`,
    mimeType: "image/png",
    size: 100,
    createdAt
  };
}

describe("asset panel summary", () => {
  it("keeps selected reference images first and hides the long tail", () => {
    const selected = [asset("asset-selected", "upload")];
    const summary = buildReferenceAssetSummary({
      selectedAssets: selected,
      referenceAssets: [asset("asset-a", "upload"), ...selected, asset("asset-b", "upload"), asset("asset-c", "upload"), asset("asset-d", "upload")],
      totalUploadCount: 6,
      limit: 3
    });

    expect(summary.previewAssets.map((item) => item.id)).toEqual(["asset-selected", "asset-a", "asset-b"]);
    expect(summary.hiddenCount).toBe(3);
    expect(summary.state).toBe("ready");
    expect(summary.actionHint).toContain("Assets");
    expect(summary.compressionLine).toContain("最多显示 3 张参考/发布候选图");
    expect(summary.compressionLine).toContain("Assets");
  });

  it("summarizes generated assets without filling the panel with history", () => {
    const summary = buildGeneratedAssetSummary({
      selectedAssets: [],
      generatedAssets: [asset("gen-1"), asset("gen-2"), asset("gen-3"), asset("gen-4"), asset("gen-5")],
      totalGeneratedCount: 5,
      limit: 4
    });

    expect(summary.previewAssets).toHaveLength(3);
    expect(summary.hiddenCount).toBe(2);
    expect(summary.state).toBe("needs_selection");
    expect(summary.compressionLine).toContain("最多显示 3 张生成结果");
  });

  it("keeps selected images first and otherwise shows the newest generated assets", () => {
    const selected = [asset("selected", "generated", "2026-05-01T00:00:00.000Z")];
    const summary = buildGeneratedAssetSummary({
      selectedAssets: selected,
      generatedAssets: [
        asset("old", "generated", "2026-05-02T00:00:00.000Z"),
        asset("newest", "generated", "2026-05-05T00:00:00.000Z"),
        asset("middle", "generated", "2026-05-03T00:00:00.000Z"),
        selected[0]
      ],
      totalGeneratedCount: 4
    });

    expect(summary.previewAssets.map((item) => item.id)).toEqual(["selected", "newest", "middle"]);
    expect(summary.detail).toContain("已选图片会固定优先展示");
  });

  it("caps image previews at three even when callers request a larger limit", () => {
    const summary = buildReferenceAssetSummary({
      selectedAssets: [],
      referenceAssets: [asset("a", "upload"), asset("b", "upload"), asset("c", "upload"), asset("d", "upload")],
      totalUploadCount: 4,
      limit: 10
    });

    expect(summary.previewAssets.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(summary.hiddenCount).toBe(1);
    expect(summary.compressionLine).toContain("最多显示 3 张");
  });

  it("marks an empty generated panel as empty with a creation hint", () => {
    const summary = buildGeneratedAssetSummary({
      selectedAssets: [],
      generatedAssets: [],
      totalGeneratedCount: 0
    });

    expect(summary.state).toBe("empty");
    expect(summary.headline).toBe("还没有生成图");
    expect(summary.compressionLine).toContain("最多显示 3 张生成结果");
    expect(summary.actionHint).toContain("Agent");
  });
});
