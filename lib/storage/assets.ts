import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
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

export type PublicAssetRecord = Omit<AssetRecord, "absolutePath" | "prompt"> & {
  url: string;
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

export function toPublicAssetRecord(asset: AssetRecord): PublicAssetRecord {
  return {
    id: asset.id,
    kind: asset.kind,
    name: asset.name,
    originalName: asset.originalName,
    mimeType: asset.mimeType,
    size: asset.size,
    createdAt: asset.createdAt,
    sourceAssetIds: asset.sourceAssetIds,
    url: publicAssetUrl(asset)
  };
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

export async function upsertGeneratedAssetPaths(
  images: Array<{ path?: string; url?: string }>,
  options: { prompt?: string; sourceAssetIds?: string[] } = {}
): Promise<AssetRecord[]> {
  const paths = [...new Set(images.map((image) => image.path).filter((item): item is string => Boolean(item)))];
  if (!paths.length) {
    return [];
  }

  const current = await listAssets();
  const created: AssetRecord[] = [];
  let next = [...current];

  for (const imagePath of paths) {
    const absolutePath = path.resolve(imagePath);
    const existing = next.find((asset) => samePath(asset.absolutePath, absolutePath));
    if (existing) {
      created.push(existing);
      continue;
    }

    const fileStat = await stat(absolutePath).catch(() => null);
    const asset = createAssetRecord({
      kind: "generated",
      originalName: path.basename(absolutePath),
      absolutePath,
      mimeType: mimeFromPath(absolutePath),
      size: fileStat?.size ?? 0,
      prompt: options.prompt,
      sourceAssetIds: options.sourceAssetIds
    });
    next = [asset, ...next].slice(0, 500);
    created.push(asset);
  }

  if (created.length) {
    const filePath = assetsPath();
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  }

  return created;
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

function samePath(left: string, right: string): boolean {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}

function mimeFromPath(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/png";
}
