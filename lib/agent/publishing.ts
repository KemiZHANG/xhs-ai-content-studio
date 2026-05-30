import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { authorizePublishIntent, buildPublishConfirmationChecklist, createPublishIntent } from "@/lib/agent/guardrails";
import { updateWorkspaceState } from "@/lib/agent/state";
import type { PublishEvidenceCitationSummary, PublishIntent, PublishIntentStatus, PublishPolicy } from "@/lib/agent/types";
import { appendPublishAudit } from "@/lib/storage/publish-audit";
import type { AppSettings } from "@/lib/storage/settings";

const globalForPublishing = globalThis as typeof globalThis & {
  xhsPublishingKeys?: Set<string>;
  xhsPublishIntentWriteQueue?: Promise<unknown>;
};

export type GuardedPublishArgs = {
  title: string;
  content: string;
  tags: string[];
  images: string[];
  visibility: AppSettings["defaultVisibility"];
  scheduleAt?: string;
};

export type PublishAccountContext = {
  accountId?: string;
  mcpUrl?: string;
};

export type GuardedPublishResult = {
  status: PublishIntentStatus;
  reasons: string[];
  publishIntent: PublishIntent;
  publishResult?: unknown;
};

export async function executeGuardedPublish({
  args,
  requestedBy,
  policy,
  auditContext,
  publishContext,
  publish
}: {
  args: GuardedPublishArgs;
  requestedBy: PublishIntent["requestedBy"];
  policy: PublishPolicy;
  auditContext?: PublishAccountContext;
  publishContext?: {
    evidenceCitationSummary?: PublishEvidenceCitationSummary;
  };
  publish: (args: GuardedPublishArgs) => Promise<unknown>;
}): Promise<GuardedPublishResult> {
  let publishIntent = createPublishIntent({
    ...args,
    requestedBy,
    mode: args.scheduleAt ? "scheduled" : "manual",
    accountId: auditContext?.accountId,
    mcpUrl: auditContext?.mcpUrl,
    evidenceCitationSummary: publishContext?.evidenceCitationSummary
  });

  if (await hasSuccessfulPublish(publishIntent.idempotencyKey)) {
    publishIntent = {
      ...publishIntent,
      status: "blocked",
      guardrailResults: ["duplicate successful publish intent"]
    };
    await savePublishIntent(publishIntent);
    await auditPublishIntent(publishIntent, "blocked", auditContext);
    await updateWorkspaceState({ publishPlan: publishIntent });
    return {
      status: "blocked",
      reasons: publishIntent.guardrailResults,
      publishIntent
    };
  }

  const decision = authorizePublishIntent(publishIntent, policy);
  if (!decision.allowed) {
    publishIntent = {
      ...publishIntent,
      status: decision.status,
      confirmationChecklist: buildPublishConfirmationChecklist({
        ...publishIntent,
        confirmed: false
      }),
      guardrailResults: decision.reasons
    };
    await savePublishIntent(publishIntent);
    await auditPublishIntent(publishIntent, decision.status === "awaiting_approval" ? "awaiting_approval" : "blocked", auditContext);
    await updateWorkspaceState({ publishPlan: publishIntent });
    return {
      status: decision.status,
      reasons: decision.reasons,
      publishIntent
    };
  }

  if (isPublishInFlight(publishIntent.idempotencyKey)) {
    publishIntent = {
      ...publishIntent,
      status: "blocked",
      guardrailResults: ["duplicate publish is already in progress"]
    };
    await savePublishIntent(publishIntent);
    await auditPublishIntent(publishIntent, "blocked", auditContext);
    await updateWorkspaceState({ publishPlan: publishIntent });
    return {
      status: "blocked",
      reasons: publishIntent.guardrailResults,
      publishIntent
    };
  }

  publishIntent = {
    ...publishIntent,
    status: "publishing",
    confirmationChecklist: buildPublishConfirmationChecklist({
      ...publishIntent,
      confirmed: true
    }),
    guardrailResults: decision.reasons
  };
  markPublishInFlight(publishIntent.idempotencyKey);
  await savePublishIntent(publishIntent);
  await auditPublishIntent(publishIntent, "publishing", auditContext);
  await updateWorkspaceState({ publishPlan: publishIntent });

  try {
    const publishResult = await publish(args);
    publishIntent = {
      ...publishIntent,
      status: args.scheduleAt ? "scheduled" : "published",
      mcpResult: publishResult
    };
    await savePublishIntent(publishIntent);
    await auditPublishIntent(publishIntent, publishIntent.status === "scheduled" ? "scheduled" : "published", auditContext, publishResult);
    await updateWorkspaceState({ publishPlan: publishIntent });
    clearPublishInFlight(publishIntent.idempotencyKey);
    return {
      status: publishIntent.status,
      reasons: [],
      publishIntent,
      publishResult
    };
  } catch (error) {
    publishIntent = {
      ...publishIntent,
      status: "failed",
      guardrailResults: [error instanceof Error ? error.message : "publish failed"]
    };
    await savePublishIntent(publishIntent);
    await auditPublishIntent(publishIntent, "failed", auditContext, error);
    await updateWorkspaceState({ publishPlan: publishIntent });
    clearPublishInFlight(publishIntent.idempotencyKey);
    throw error;
  }
}

export async function getPublishIntent(id: string): Promise<PublishIntent | null> {
  const intents = await readPublishIntents();
  return intents.find((intent) => intent.id === id) ?? null;
}

export function publishIntentMatchesArgs(
  intent: PublishIntent,
  args: GuardedPublishArgs,
  accountContext?: PublishAccountContext
): boolean {
  const context = accountContext ?? {
    accountId: intent.accountId,
    mcpUrl: intent.mcpUrl
  };
  const comparable = createPublishIntent({
    ...args,
    requestedBy: intent.requestedBy,
    mode: args.scheduleAt ? "scheduled" : "manual",
    accountId: context.accountId,
    mcpUrl: context.mcpUrl
  });
  return comparable.idempotencyKey === intent.idempotencyKey;
}

export function isPublishIntentConfirmable(
  intent: PublishIntent,
  args: GuardedPublishArgs,
  options: { now?: Date; maxAgeMinutes?: number; accountContext?: PublishAccountContext } = {}
): boolean {
  if (intent.status !== "awaiting_approval" || intent.requestedBy !== "manual") {
    return false;
  }
  if (!publishIntentMatchesArgs(intent, args, options.accountContext)) {
    return false;
  }

  const requestedAt = Date.parse(intent.requestedAt);
  if (!Number.isFinite(requestedAt)) {
    return false;
  }
  const now = options.now ?? new Date();
  const maxAgeMs = (options.maxAgeMinutes ?? 30) * 60 * 1000;
  return now.getTime() - requestedAt <= maxAgeMs;
}

export async function readPublishIntents(): Promise<PublishIntent[]> {
  try {
    const raw = await readFile(publishIntentsPath(), "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as PublishIntent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) {
      return [];
    }
    throw error;
  }
}

async function savePublishIntent(intent: PublishIntent): Promise<void> {
  return queuePublishIntentWrite(async () => savePublishIntentNow(intent));
}

async function savePublishIntentNow(intent: PublishIntent): Promise<void> {
  const intents = await readPublishIntents();
  const next = [intent, ...intents.filter((item) => item.id !== intent.id)].slice(0, 500);
  const filePath = publishIntentsPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

async function queuePublishIntentWrite<T>(operation: () => Promise<T>): Promise<T> {
  const previous = globalForPublishing.xhsPublishIntentWriteQueue ?? Promise.resolve();
  const next = previous.then(operation, operation);
  globalForPublishing.xhsPublishIntentWriteQueue = next.catch(() => undefined);
  return next;
}

async function hasSuccessfulPublish(idempotencyKey: string): Promise<boolean> {
  const intents = await readPublishIntents();
  return intents.some(
    (intent) =>
      intent.idempotencyKey === idempotencyKey &&
      (intent.status === "published" || intent.status === "scheduled")
  );
}

function publishIntentsPath(): string {
  return path.join(process.cwd(), "data", "publish-intents.json");
}

function publishingKeys(): Set<string> {
  if (!globalForPublishing.xhsPublishingKeys) {
    globalForPublishing.xhsPublishingKeys = new Set<string>();
  }
  return globalForPublishing.xhsPublishingKeys;
}

function isPublishInFlight(idempotencyKey: string): boolean {
  return publishingKeys().has(idempotencyKey);
}

function markPublishInFlight(idempotencyKey: string): void {
  publishingKeys().add(idempotencyKey);
}

function clearPublishInFlight(idempotencyKey: string): void {
  publishingKeys().delete(idempotencyKey);
}

async function auditPublishIntent(
  intent: PublishIntent,
  event: "awaiting_approval" | "blocked" | "publishing" | "published" | "scheduled" | "failed",
  auditContext?: PublishAccountContext,
  result?: unknown
): Promise<void> {
  await appendPublishAudit({
    event,
    status: intent.status,
    requestedBy: intent.requestedBy,
    title: intent.title,
    content: intent.content,
    tags: intent.tags,
    imageCount: intent.images.length,
    visibility: intent.visibility,
    scheduleAt: intent.scheduleAt,
    accountId: intent.accountId ?? auditContext?.accountId,
    mcpUrl: intent.mcpUrl ?? auditContext?.mcpUrl,
    publishIntentId: intent.id,
    idempotencyKeySuffix: intent.idempotencyKey.slice(-6),
    reasons: intent.guardrailResults,
    resultSummary: summarizeAuditResult(result ?? intent.mcpResult)
  });
}

function summarizeAuditResult(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value instanceof Error) {
    return value.message.slice(0, 240);
  }
  if (typeof value === "string") {
    return value.slice(0, 240);
  }
  try {
    return JSON.stringify(value).slice(0, 240);
  } catch {
    return String(value).slice(0, 240);
  }
}
