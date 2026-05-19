import { describe, expect, it } from "vitest";
import { createAssetRecord, publicAssetUrl } from "@/lib/storage/assets";

describe("asset records", () => {
  it("creates local asset metadata and preview URLs", () => {
    const asset = createAssetRecord({
      kind: "upload",
      originalName: "product.png",
      absolutePath: "C:\\xhs\\generated-assets\\uploads\\product.png",
      mimeType: "image/png",
      size: 1234
    });

    expect(asset.kind).toBe("upload");
    expect(asset.name).toContain("product");
    expect(publicAssetUrl(asset)).toBe(`/api/assets/file/${asset.id}`);
  });
});
