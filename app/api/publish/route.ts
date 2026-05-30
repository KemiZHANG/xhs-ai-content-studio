import { NextResponse } from "next/server";
import {
  executeGuardedPublish,
  getPublishIntent,
  isPublishIntentConfirmable,
  type GuardedPublishArgs
} from "@/lib/agent/publishing";
import { createPublishIntent, validatePublishIntent } from "@/lib/agent/guardrails";
import { createXhsMcpClient } from "@/lib/mcp/xhs";
import { readPostProject } from "@/lib/post-project/store";
import { buildPublishContentArgs, parseTagsText } from "@/lib/publishing/assembly";
import { requireLocalActionToken } from "@/lib/security/action-token";
import { getAsset, type AssetRecord } from "@/lib/storage/assets";
import { createDraftRecord, writeCurrentDraft } from "@/lib/storage/drafts";
import { appendPublishAudit } from "@/lib/storage/publish-audit";
import { isPublishVisibility, readSettings } from "@/lib/storage/settings";

export const runtime = "nodejs";

type PublishBody = {
  title?: string;
  content?: string;
  tags?: string[] | string;
  assetIds?: string[];
  visibility?: "公开可见" | "仅自己可见" | "仅互关好友可见";
  scheduleAt?: string;
  imagePrompt?: string;
  confirmed?: boolean;
  publishIntentId?: string;
  dryRun?: boolean;
};

export async function POST(request: Request) {
  try {
    const authError = await requireLocalActionToken(request);
    if (authError) return authError;

    const body = (await request.json()) as PublishBody;
    const settings = await readSettings();
    const assets = Array.isArray(body.assetIds)
      ? (await Promise.all(body.assetIds.map((id) => getAsset(String(id))))).filter(
          (asset): asset is AssetRecord => Boolean(asset)
        )
      : [];
    const tags = Array.isArray(body.tags) ? body.tags : parseTagsText(body.tags ?? "");
    const publishArgs = buildPublishContentArgs({
      title: body.title ?? "",
      content: body.content ?? "",
      tags,
      assets,
      visibility: isPublishVisibility(body.visibility) ? body.visibility : settings.defaultVisibility,
      scheduleAt: body.scheduleAt
    });
    const qualityBlockReasons = await getQualityGateBlockReasons(publishArgs);

    if (body.dryRun) {
      const publishIntent = createPublishIntent({
        ...publishArgs,
        requestedBy: "manual",
        mode: publishArgs.scheduleAt ? "scheduled" : "manual",
        accountId: settings.activeAccountId,
        mcpUrl: settings.mcpUrl
      });
      const validationErrors = [...validatePublishIntent(publishIntent), ...qualityBlockReasons];
      await appendPublishAudit({
        event: "preview",
        status: validationErrors.length ? "blocked" : "preview",
        requestedBy: "manual",
        title: publishArgs.title,
        content: publishArgs.content,
        tags: publishArgs.tags,
        imageCount: publishArgs.images.length,
        visibility: publishArgs.visibility,
        scheduleAt: publishArgs.scheduleAt,
        accountId: settings.activeAccountId,
        mcpUrl: settings.mcpUrl,
        publishIntentId: publishIntent.id,
        idempotencyKeySuffix: publishIntent.idempotencyKey.slice(-6),
        reasons: validationErrors
      });
      return NextResponse.json({
        status: "preview",
        dryRun: true,
        publishIntent: {
          ...publishIntent,
          status: validationErrors.length ? "blocked" : "draft",
          guardrailResults: validationErrors
        },
        preview: {
          profile: "creator_publish",
          risk: "external_write",
          requiresConfirmation: true,
          publishPolicy: settings.agentPublishPolicy,
          accountId: settings.activeAccountId,
          mcpUrl: settings.mcpUrl,
          visibility: publishArgs.visibility,
          scheduleAt: publishArgs.scheduleAt,
          imageCount: publishArgs.images.length,
          tagCount: publishArgs.tags.length,
          titleLength: publishArgs.title.trim().length,
          validationErrors,
          idempotencyKeySuffix: publishIntent.idempotencyKey.slice(-6)
        }
      });
    }

    if (qualityBlockReasons.length) {
      return NextResponse.json(
        {
          error: qualityBlockReasons.join("；"),
          requiresConfirmation: false
        },
        { status: 400 }
      );
    }

    const confirmed = await resolvePublishConfirmation({
      confirmed: body.confirmed,
      publishIntentId: body.publishIntentId,
      settingsPolicy: settings.agentPublishPolicy,
      publishArgs,
      accountContext: {
        accountId: settings.activeAccountId,
        mcpUrl: settings.mcpUrl
      }
    });

    const guardedPublish = await executeGuardedPublish({
      args: publishArgs,
      requestedBy: "manual",
      policy: {
        mode: settings.agentPublishPolicy,
        confirmed
      },
      auditContext: {
        accountId: settings.activeAccountId,
        mcpUrl: settings.mcpUrl
      },
      publish: (args) => createXhsMcpClient(settings).publishContent(args)
    });

    if (guardedPublish.status === "awaiting_approval") {
      return NextResponse.json(
        {
          error: guardedPublish.reasons.join("；") || "发布需要确认",
          requiresConfirmation: true,
          publishIntent: guardedPublish.publishIntent
        },
        { status: 202 }
      );
    }

    if (guardedPublish.status === "blocked") {
      return NextResponse.json(
        {
          error: guardedPublish.reasons.join("；") || "发布被安全规则阻止",
          requiresConfirmation: false,
          publishIntent: guardedPublish.publishIntent
        },
        { status: 400 }
      );
    }

    const legacyPublishStatus = guardedPublish.status as string;
    if (legacyPublishStatus === "blocked" || legacyPublishStatus === "awaiting_approval") {
      return NextResponse.json(
        { error: guardedPublish.reasons.join("；") || "发布需要确认" },
        { status: legacyPublishStatus === "awaiting_approval" ? 202 : 400 }
      );
    }

    const currentDraft = await writeCurrentDraft(
      createDraftRecord({
        draft: {
          title: publishArgs.title,
          content: publishArgs.content,
          tags: publishArgs.tags,
          structure: [],
          imagePrompt: body.imagePrompt ?? ""
        },
        images: publishArgs.images.map((imagePath) => ({ path: imagePath })),
        visibility: publishArgs.visibility
      })
    );

    return NextResponse.json({
      status: publishArgs.scheduleAt ? "scheduled" : "published",
      publishResult: guardedPublish.publishResult,
      currentDraft
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "发布失败" },
      { status: 500 }
    );
  }
}

async function getQualityGateBlockReasons(publishArgs: GuardedPublishArgs): Promise<string[]> {
  try {
    const project = await readPostProject();
    if (!project.qualityCheck || project.auditStatus !== "blocked") {
      return [];
    }
    if (!project.finalPost || !samePublishCopy(project.finalPost, publishArgs)) {
      return [];
    }
    return [
      "当前 PostProject 未通过 Quality Gate",
      ...project.qualityCheck.issues.slice(0, 5)
    ];
  } catch {
    return [];
  }
}

function samePublishCopy(
  finalPost: { title: string; content: string; tags: string[] },
  publishArgs: GuardedPublishArgs
): boolean {
  return (
    finalPost.title.trim() === publishArgs.title.trim() &&
    finalPost.content.trim() === publishArgs.content.trim() &&
    normalizeTags(finalPost.tags).join("|") === normalizeTags(publishArgs.tags).join("|")
  );
}

function normalizeTags(tags: string[]): string[] {
  return tags.map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean).sort();
}

async function resolvePublishConfirmation({
  confirmed,
  publishIntentId,
  settingsPolicy,
  publishArgs,
  accountContext
}: {
  confirmed?: boolean;
  publishIntentId?: string;
  settingsPolicy: "draft_only" | "review_required" | "auto_publish_allowed";
  publishArgs: GuardedPublishArgs;
  accountContext: { accountId?: string; mcpUrl?: string };
}): Promise<boolean> {
  if (settingsPolicy !== "review_required" && settingsPolicy !== "auto_publish_allowed") {
    return false;
  }

  if (confirmed !== true || !publishIntentId) {
    return false;
  }

  const intent = await getPublishIntent(publishIntentId);
  return Boolean(intent && isPublishIntentConfirmable(intent, publishArgs, { accountContext }));
}
