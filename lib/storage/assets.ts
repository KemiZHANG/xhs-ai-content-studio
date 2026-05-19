import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export type AssetKind = "upload" | "generated";

export type AssetRecord = {
  id: string;
  kind: AssetKind;
  name: string;
  originalName: string;
  absolutePath: string;
  mimeType: string;
  size: number;
  createdAt: string;
  prompt?: string;
  sourceAssetIds?: string[];
};

const assetsPath = () => path.join(process.cwd(), "data", "assets.json");

export function createAssetRecord({
  kind,
  originalName,
  absolutePath,
  mimeType,
  size,
  prompt,
  sourceAssetIds
}: {
  kind: AssetKind;
  originalName: string;
  absolutePath: string;
  mimeType: string;
  size: number;
  prompt?: string;
  sourceAssetIds?: string[];
}): AssetRecord {
  const safeName = originalName.replace(/\.[^.]+$/, "").replace(/[^\w\u4e00-\u9fa5-]+/g, "-");
  return {
    id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    name: safeName || "asset",
    originalName,
    absolutePath,
    mimeType,
    size,
    createdAt: new Date().toISOString(),
    prompt,
    sourceAssetIds
  };
}

export function publicAssetUrl(asset: AssetRecord): string {
  return `/api/assets/file/${asset.id}`;
}

export async function listAssets(): Promise<AssetRecord[]> {
  try {
    const raw = await readFile(assetsPath(), "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as AssetRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function getAsset(id: string): Promise<AssetRecord | null> {
  const assets = await listAssets();
  return assets.find((asset) => asset.id === id) ?? null;
}

export async function saveAsset(asset: AssetRecord): Promise<AssetRecord> {
  const assets = await listAssets();
  const next = [asset, ...assets.filter((item) => item.id !== asset.id)].slice(0, 500);
  const filePath = assetsPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return asset;
}

export async function deleteAsset(id: string): Promise<boolean> {
  const assets = await listAssets();
  const target = assets.find((asset) => asset.id === id);
  if (!target) {
    return false;
  }

  const next = assets.filter((asset) => asset.id !== id);
  const filePath = assetsPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await unlink(target.absolutePath).catch(() => undefined);
  return true;
}

export function uploadDir(): string {
  return path.join(process.cwd(), "generated-assets", "uploads");
}

export function generatedDir(): string {
  return path.join(process.cwd(), "generated-assets", "generated");
}
