import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SampleEvidence } from "@/lib/workflows/one-click";

const MAX_IMAGES_PER_RUN = 24;

export function evidenceImageDir(): string {
  return path.join(process.cwd(), "generated-assets", "evidence");
}

export async function readEvidenceImage(fileName: string): Promise<{ bytes: Buffer; mimeType: string } | null> {
  if (!/^[a-f0-9]{64}\.(png|jpg|jpeg|webp|gif)$/i.test(fileName)) {
    return null;
  }

  const filePath = path.join(evidenceImageDir(), fileName);
  try {
    const bytes = await readFile(filePath);
    return { bytes, mimeType: mimeFromFileName(fileName) };
  } catch {
    return null;
  }
}

export async function cacheEvidenceImages(evidence: SampleEvidence[]): Promise<SampleEvidence[]> {
  if (process.env.NODE_ENV === "test") {
    return evidence.map((item) => ({ ...item, cachedImageUrls: item.cachedImageUrls ?? [] }));
  }

  let remaining = MAX_IMAGES_PER_RUN;

  return Promise.all(
    evidence.map(async (item) => {
      const cachedImageUrls: string[] = [];

      for (const sourceUrl of item.imageUrls.slice(0, 4)) {
        if (remaining <= 0) {
          break;
        }
        remaining -= 1;

        const cached = await cacheOneEvidenceImage(sourceUrl).catch(() => null);
        if (cached) {
          cachedImageUrls.push(cached);
        }
      }

      return { ...item, cachedImageUrls };
    })
  );
}

async function cacheOneEvidenceImage(sourceUrl: string): Promise<string | null> {
  if (!/^https?:\/\//i.test(sourceUrl)) {
    return null;
  }

  const hash = createHash("sha256").update(sourceUrl).digest("hex");
  const guessedExt = extensionFromUrl(sourceUrl);
  const initialFileName = `${hash}.${guessedExt}`;
  const initialPath = path.join(evidenceImageDir(), initialFileName);

  if (await exists(initialPath)) {
    return `/api/evidence-images/${initialFileName}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 XHS AI Content Studio Evidence Image Cache"
      }
    });
    if (!response.ok) {
      return null;
    }

    const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || mimeFromFileName(initialFileName);
    const ext = extensionFromMime(mimeType) || guessedExt;
    const fileName = `${hash}.${ext}`;
    const filePath = path.join(evidenceImageDir(), fileName);
    if (await exists(filePath)) {
      return `/api/evidence-images/${fileName}`;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 10 * 1024 * 1024) {
      return null;
    }

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, bytes);
    return `/api/evidence-images/${fileName}`;
  } finally {
    clearTimeout(timer);
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function extensionFromUrl(url: string): string {
  const match = url.toLowerCase().match(/\.(png|jpe?g|webp|gif)(?:\?|$)/);
  if (!match?.[1]) {
    return "jpg";
  }
  return match[1] === "jpeg" ? "jpg" : match[1];
}

function extensionFromMime(mimeType: string): string | null {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif"
  };
  return map[mimeType] ?? null;
}

function mimeFromFileName(fileName: string): string {
  if (fileName.endsWith(".png")) return "image/png";
  if (fileName.endsWith(".webp")) return "image/webp";
  if (fileName.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}
