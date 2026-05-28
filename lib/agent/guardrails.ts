import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import type { PublishDecision, PublishIntent, PublishPolicy } from "@/lib/agent/types";
import { isPublishVisibility, type AppSettings } from "@/lib/storage/settings";

export type CreatePublishIntentInput = {
  title: string;
  content: string;
  tags: string[];
  images: string[];
  visibility: AppSettings["defaultVisibility"];
  accountId?: string;
  mcpUrl?: string;
  requestedBy: PublishIntent["requestedBy"];
  mode?: PublishIntent["mode"];
  scheduleAt?: string;
};

export function createPublishIntent(input: CreatePublishIntentInput): PublishIntent {
  const requestedAt = new Date().toISOString();
  const mode = input.mode ?? (input.scheduleAt ? "scheduled" : "manual");
  const idempotencySource = JSON.stringify({
    title: input.title,
    content: input.content,
    tags: input.tags,
    images: input.images,
    visibility: input.visibility,
    accountId: input.accountId,
    mcpUrl: input.mcpUrl,
    mode,
    scheduleAt: input.scheduleAt
  });

  return {
    id: `publish-${Date.now()}-${randomUUID().slice(0, 8)}`,
    mode,
    status: "draft",
    title: input.title,
    content: input.content,
    tags: input.tags,
    images: input.images,
    visibility: input.visibility,
    accountId: input.accountId,
    mcpUrl: input.mcpUrl,
    requestedBy: input.requestedBy,
    requestedAt,
    scheduleAt: input.scheduleAt,
    idempotencyKey: createHash("sha256").update(idempotencySource).digest("hex"),
    guardrailResults: []
  };
}

export function validatePublishIntent(
  intent: PublishIntent,
  options: { now?: Date; minDelayMinutes?: number } = {}
): string[] {
  const errors: string[] = [];
  if (!intent.title.trim()) errors.push("title is required");
  if (!intent.content.trim()) errors.push("content is required");
  if (!intent.tags.map((tag) => tag.trim()).filter(Boolean).length) errors.push("tag is required");
  if (!intent.images.length) errors.push("image is required");
  if (!isPublishVisibility(intent.visibility)) errors.push("visibility is invalid");
  if (intent.images.some((image) => !isSafePublishImagePath(image))) {
    errors.push("image path must come from the workspace asset folders");
  }

  if (intent.mode === "scheduled") {
    if (!intent.scheduleAt) {
      errors.push("future schedule time is required");
    } else {
      const scheduleTime = Date.parse(intent.scheduleAt);
      const now = options.now ?? new Date();
      const minDelayMs = (options.minDelayMinutes ?? 5) * 60 * 1000;
      if (!Number.isFinite(scheduleTime) || scheduleTime <= now.getTime() + minDelayMs) {
        errors.push("future schedule time is required");
      }
      if (!/[zZ]$|[+-]\d{2}:\d{2}$/.test(intent.scheduleAt)) {
        errors.push("schedule time must include a timezone");
      }
    }
  }

  return errors;
}

export function authorizePublishIntent(intent: PublishIntent, policy: PublishPolicy): PublishDecision {
  const validationErrors = validatePublishIntent(intent);
  if (validationErrors.length) {
    return {
      allowed: false,
      status: "blocked",
      reasons: validationErrors
    };
  }

  switch (policy.mode) {
    case "draft_only":
      return {
        allowed: false,
        status: "blocked",
        reasons: ["draft only mode blocks external publishing"]
      };
    case "review_required":
      if (!policy.confirmed) {
        return {
          allowed: false,
          status: "awaiting_approval",
          reasons: ["review required before external publishing"]
        };
      }
      return {
        allowed: true,
        status: "approved",
        reasons: []
      };
    case "auto_publish_allowed":
      if (!policy.confirmed) {
        return {
          allowed: false,
          status: "awaiting_approval",
          reasons: ["one-time confirmation required before external publishing"]
        };
      }
      return {
        allowed: true,
        status: "approved",
        reasons: []
      };
    default:
      return {
        allowed: false,
        status: "blocked",
        reasons: ["invalid publish policy"]
      };
  }
}

export function isSafePublishImagePath(imagePath: string): boolean {
  const trimmed = imagePath.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.includes("\0")) {
    return false;
  }

  const normalized = trimmed.replace(/\\/g, "/").split("/").filter(Boolean);
  if (normalized.includes("..")) {
    return false;
  }

  const candidate = path.resolve(trimmed);
  const roots = [
    path.resolve(process.cwd(), "generated-assets", "uploads"),
    path.resolve(process.cwd(), "generated-assets", "generated")
  ];
  return roots.some((root) => candidate === root || candidate.startsWith(`${root}${path.sep}`));
}
