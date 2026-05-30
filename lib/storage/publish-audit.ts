import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PublishIntentStatus } from "@/lib/agent/types";

export type PublishAuditRecord = {
  id: string;
  createdAt: string;
  event: "preview" | "awaiting_approval" | "blocked" | "publishing" | "published" | "scheduled" | "failed";
  status: PublishIntentStatus | "preview";
  requestedBy: "chat" | "workflow" | "manual" | "job";
  title: string;
  contentHash: string;
  tags: string[];
  imageCount: number;
  visibility: string;
  scheduleAt?: string;
  accountId?: string;
  mcpUrl?: string;
  publishIntentId?: string;
  idempotencyKeySuffix?: string;
  reasons: string[];
  resultSummary?: string;
};

export type PublishAuditInput = Omit<PublishAuditRecord, "id" | "createdAt" | "contentHash"> & {
  content?: string;
};

const auditPath = () => path.join(process.cwd(), "data", "publish-audit.json");
const globalForPublishAudit = globalThis as typeof globalThis & {
  xhsPublishAuditWriteQueue?: Promise<unknown>;
};

export async function appendPublishAudit(input: PublishAuditInput): Promise<PublishAuditRecord> {
  return queuePublishAuditWrite(async () => appendPublishAuditNow(input));
}

async function appendPublishAuditNow(input: PublishAuditInput): Promise<PublishAuditRecord> {
  const { content, ...safeInput } = input;
  const record: PublishAuditRecord = {
    ...safeInput,
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    title: input.title.slice(0, 120),
    contentHash: hashContent(content ?? ""),
    reasons: input.reasons.slice(0, 8)
  };
  const current = await listPublishAudit();
  const next = [record, ...current].slice(0, 500);
  const filePath = auditPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
  return record;
}

async function queuePublishAuditWrite<T>(operation: () => Promise<T>): Promise<T> {
  const previous = globalForPublishAudit.xhsPublishAuditWriteQueue ?? Promise.resolve();
  const next = previous.then(operation, operation);
  globalForPublishAudit.xhsPublishAuditWriteQueue = next.catch(() => undefined);
  return next;
}

export async function listPublishAudit(): Promise<PublishAuditRecord[]> {
  try {
    const raw = await readFile(auditPath(), "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as PublishAuditRecord[];
    return Array.isArray(parsed) ? parsed.map(sanitizeAuditRecord) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function sanitizeAuditRecord(record: PublishAuditRecord & { content?: string }): PublishAuditRecord {
  const { content: _content, ...safeRecord } = record;
  return {
    ...safeRecord,
    title: safeRecord.title.slice(0, 120),
    reasons: Array.isArray(safeRecord.reasons) ? safeRecord.reasons.slice(0, 8) : []
  };
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}
