import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GeneratedImage } from "@/lib/models/provider";
import type { AppSettings } from "@/lib/storage/settings";
import type { GeneratedDraft, OneClickInput } from "@/lib/workflows/one-click";

export type DraftRecord = {
  id: string;
  updatedAt: string;
  source?: {
    input?: OneClickInput;
    runId?: string;
  };
  draft: GeneratedDraft;
  images: GeneratedImage[];
  visibility: AppSettings["defaultVisibility"];
};

const draftsPath = () => path.join(process.cwd(), "data", "drafts.json");

export async function readCurrentDraft(): Promise<DraftRecord | null> {
  try {
    const raw = await readFile(draftsPath(), "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as { currentDraft?: DraftRecord | null };
    return parsed.currentDraft ?? null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function writeCurrentDraft(draft: DraftRecord | null): Promise<DraftRecord | null> {
  const filePath = draftsPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify({ currentDraft: draft }, null, 2)}\n`, "utf8");
  return draft;
}

export function createDraftRecord({
  draft,
  images,
  visibility,
  input,
  runId
}: {
  draft: GeneratedDraft;
  images: GeneratedImage[];
  visibility: AppSettings["defaultVisibility"];
  input?: OneClickInput;
  runId?: string;
}): DraftRecord {
  return {
    id: `draft-${Date.now()}`,
    updatedAt: new Date().toISOString(),
    source: { input, runId },
    draft,
    images,
    visibility
  };
}
