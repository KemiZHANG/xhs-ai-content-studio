import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import type { PublishConfirmationItem, PublishDecision, PublishEvidenceCitationSummary, PublishIntent, PublishPolicy, PublishVersionSnapshot } from "@/lib/agent/types";
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
  evidenceCitationSummary?: PublishEvidenceCitationSummary;
  versionSnapshot?: PublishVersionSnapshot;
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
  const confirmationChecklist = buildPublishConfirmationChecklist({
    title: input.title,
    content: input.content,
    images: input.images,
    visibility: input.visibility,
    accountId: input.accountId,
    mcpUrl: input.mcpUrl,
    mode,
    scheduleAt: input.scheduleAt,
    confirmed: false,
    evidenceCitationSummary: input.evidenceCitationSummary,
    versionSnapshot: input.versionSnapshot
  }).map((item) =>
    item.id === "quality" && input.evidenceCitationSummary
      ? {
          ...item,
          detail: `${input.evidenceCitationSummary.summary} 缺失证据 ${input.evidenceCitationSummary.missingEvidenceIds.length} 个`
        }
      : item
  );

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
    confirmationChecklist,
    guardrailResults: [],
    evidenceCitationSummary: input.evidenceCitationSummary,
    versionSnapshot: input.versionSnapshot
  };
}

export function buildPublishConfirmationChecklist({
  title,
  content,
  images,
  visibility,
  accountId,
  mcpUrl,
  mode,
  scheduleAt,
  confirmed,
  evidenceCitationSummary,
  versionSnapshot
}: {
  title: string;
  content: string;
  images: string[];
  visibility: AppSettings["defaultVisibility"];
  accountId?: string;
  mcpUrl?: string;
  mode: PublishIntent["mode"];
  scheduleAt?: string;
  confirmed: boolean;
  evidenceCitationSummary?: PublishEvidenceCitationSummary;
  versionSnapshot?: PublishVersionSnapshot;
}): PublishConfirmationItem[] {
  const checklist: PublishConfirmationItem[] = [
    {
      id: "copy",
      label: "最终文案版本",
      required: true,
      confirmed,
      detail: versionSnapshot?.copyVersionId
        ? `${title.trim().length} 字标题，正文 ${content.trim().length} 字；文案版本 ${versionSnapshot.copyVersionId}`
        : `${title.trim().length} 字标题，正文 ${content.trim().length} 字`
    },
    {
      id: "images",
      label: "最终图片版本",
      required: true,
      confirmed,
      detail: versionSnapshot
        ? `${images.length} 张图片；选中版本 ${versionSnapshot.selectedImageIds.length} 张图`
        : `${images.length} 张图片`
    },
    {
      id: "visual",
      label: "图片方向 / Prompt",
      required: true,
      confirmed,
      detail: versionSnapshot
        ? `Prompt 版本 ${versionSnapshot.imagePromptVersionIds.length} 个；图片方向已和最终文案、CreativeBrief、证据包对齐`
        : "图片方向已和最终文案、CreativeBrief、证据包对齐"
    },
    {
      id: "account",
      label: "发布账号",
      required: true,
      confirmed,
      detail: accountId || mcpUrl || "使用当前 MCP 账号"
    },
    {
      id: "visibility",
      label: "可见范围",
      required: true,
      confirmed,
      detail: visibility
    },
    {
      id: "schedule",
      label: "发布时间与时区",
      required: mode === "scheduled",
      confirmed: mode === "scheduled" ? confirmed : true,
      detail: scheduleAt || "立即发布"
    },
    {
      id: "quality",
      label: "Quality Gate",
      required: true,
      confirmed,
      detail: "发布前质量检查已通过后才允许确认"
    }
  ];
  return evidenceCitationSummary
    ? checklist.map((item) =>
        item.id === "quality"
          ? {
              ...item,
              detail: `${evidenceCitationSummary.summary} 缺失证据 ${evidenceCitationSummary.missingEvidenceIds.length} 个`
            }
          : item
      )
    : checklist;
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
  errors.push(...validatePublishEvidenceCitations(intent.evidenceCitationSummary));
  errors.push(...validatePublishVersionSnapshot(intent.versionSnapshot));

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

function validatePublishVersionSnapshot(snapshot: PublishVersionSnapshot | undefined): string[] {
  if (!snapshot) return [];
  const errors: string[] = [];
  if (!snapshot.finalPostMatchesCanvas) {
    errors.push("final post version snapshot must match the current PostProject canvas");
  }
  if (!snapshot.qualityGateFresh || snapshot.qualityCanPublish !== true) {
    errors.push("quality gate must be fresh and publishable for the selected final post version");
  }
  if (snapshot.warnings.length) {
    errors.push("publish version snapshot has unresolved warnings");
  }
  if (!snapshot.selectedImageIds.length) {
    errors.push("publish version snapshot must include selected image ids");
  }
  if (!snapshot.finalPostEvidenceIds.length) {
    errors.push("publish version snapshot must include final post evidence ids");
  }
  return errors;
}

function validatePublishEvidenceCitations(summary: PublishEvidenceCitationSummary | undefined): string[] {
  if (!summary) return [];
  const errors: string[] = [];
  if (summary.missingEvidenceIds.length) {
    errors.push("evidence citations must reference the current evidencePack");
  }
  const missingFields = (["title", "content", "tags", "imagePrompt"] as const)
    .filter((field) => (summary.fieldCounts[field] ?? 0) <= 0);
  if (missingFields.length) {
    errors.push(`evidence citations must cover ${missingFields.join(", ")}`);
  }
  return errors;
}

export function authorizePublishIntent(intent: PublishIntent, policy: PublishPolicy): PublishDecision {
  if (policy.mode === "draft_only") {
    return {
      allowed: false,
      status: "blocked",
      reasons: ["draft only mode blocks external publishing"]
    };
  }

  const validationErrors = validatePublishIntent(intent);
  if (validationErrors.length && policy.confirmed) {
    return {
      allowed: false,
      status: "blocked",
      reasons: validationErrors
    };
  }

  switch (policy.mode) {
    case "review_required":
      if (!policy.confirmed) {
        return {
          allowed: false,
          status: "awaiting_approval",
          reasons: ["review required before external publishing", ...validationErrors]
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
          reasons: ["one-time confirmation required before external publishing", ...validationErrors]
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
