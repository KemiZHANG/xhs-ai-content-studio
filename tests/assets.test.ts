import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAssetRecord, listAssets, publicAssetUrl, upsertGeneratedAssetPaths } from "@/lib/storage/assets";

let originalCwd: string;
let tempDir: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  tempDir = await mkdtemp(path.join(os.tmpdir(), "xhs-assets-"));
  process.chdir(tempDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

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

  it("upserts generated workflow images into the asset library by path", async () => {
    const imagePath = path.join(tempDir, "generated-assets", "generated", "workflow.png");
    await mkdir(path.dirname(imagePath), { recursive: true });
    await writeFile(imagePath, "image-bytes");

    const first = await upsertGeneratedAssetPaths([{ path: imagePath }], { prompt: "prompt" });
    const second = await upsertGeneratedAssetPaths([{ path: imagePath }], { prompt: "prompt" });
    const assets = await listAssets();

    expect(first).toHaveLength(1);
    expect(second[0].id).toBe(first[0].id);
    expect(assets).toHaveLength(1);
    expect(assets[0].absolutePath).toBe(path.resolve(imagePath));
  });
});
