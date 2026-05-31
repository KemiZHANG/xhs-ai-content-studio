import { describe, expect, it } from "vitest";
import { buildGeneratedAssetSummary, buildReferenceAssetSummary } from "@/app/components/asset-panel-summary";
import type { AssetRecord } from "@/app/types";

function asset(id: string, kind: AssetRecord["kind"] = "generated"): AssetRecord {
  return {
    id,
    kind,
    name: `${id}.png`,
    originalName: `${id}.png`,
    mimeType: "image/png",
    size: 100,
    createdAt: "2026-05-31T00:00:00.000Z"
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
  });

  it("summarizes generated assets without filling the panel with history", () => {
    const summary = buildGeneratedAssetSummary({
      selectedAssets: [],
      generatedAssets: [asset("gen-1"), asset("gen-2"), asset("gen-3"), asset("gen-4"), asset("gen-5")],
      totalGeneratedCount: 5,
      limit: 4
    });

    expect(summary.previewAssets).toHaveLength(4);
    expect(summary.hiddenCount).toBe(1);
    expect(summary.state).toBe("needs_selection");
  });

  it("marks an empty generated panel as empty with a creation hint", () => {
    const summary = buildGeneratedAssetSummary({
      selectedAssets: [],
      generatedAssets: [],
      totalGeneratedCount: 0
    });

    expect(summary.state).toBe("empty");
    expect(summary.headline).toBe("还没有生成图");
    expect(summary.actionHint).toContain("Agent");
  });
});
