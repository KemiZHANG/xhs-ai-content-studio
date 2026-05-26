import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ModelUsageKind = "text" | "image";

export type DailyModelUsage = {
  date: string;
  text: number;
  image: number;
};

const globalForModelUsage = globalThis as typeof globalThis & {
  xhsModelUsageWriteQueue?: Promise<unknown>;
};

export async function consumeModelUsage(kind: ModelUsageKind, limit: number): Promise<DailyModelUsage> {
  return queueUsageWrite(async () => {
    const usage = await readTodayModelUsage();
    if (limit > 0 && usage[kind] >= limit) {
      throw new Error(`Daily ${kind} model call limit reached (${limit}). Adjust limits in settings if needed.`);
    }

    const next = {
      ...usage,
      [kind]: usage[kind] + 1
    };
    await writeTodayModelUsage(next);
    return next;
  });
}

export async function readTodayModelUsage(): Promise<DailyModelUsage> {
  const today = todayKey();
  try {
    const raw = await readFile(usagePath(today), "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as Partial<DailyModelUsage>;
    return {
      date: today,
      text: Number(parsed.text ?? 0),
      image: Number(parsed.image ?? 0)
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { date: today, text: 0, image: 0 };
    }
    throw error;
  }
}

async function writeTodayModelUsage(usage: DailyModelUsage): Promise<void> {
  const filePath = usagePath(usage.date);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(usage, null, 2)}\n`, "utf8");
}

async function queueUsageWrite<T>(operation: () => Promise<T>): Promise<T> {
  const previous = globalForModelUsage.xhsModelUsageWriteQueue ?? Promise.resolve();
  const next = previous.then(operation, operation);
  globalForModelUsage.xhsModelUsageWriteQueue = next.catch(() => undefined);
  return next;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function usagePath(date: string): string {
  return path.join(process.cwd(), "data", "model-usage", `${date}.json`);
}
