import { NextResponse } from "next/server";
import {
  executeGuardedPublish,
  getPublishIntent,
  isPublishIntentConfirmable,
  type GuardedPublishArgs
} from "@/lib/agent/publishing";
import { createPublishIntent, validatePublishIntent } from "@/lib/agent/guardrails";
import { updateWorkspaceState } from "@/lib/agent/state";
import { isExplicitXhsLoggedInStatus, isExplicitXhsLoggedOutStatus } from "@/lib/mcp/login-status";
import { createXhsMcpClient, readMcpText } from "@/lib/mcp/xhs";
import { buildEvidenceCitationReport } from "@/lib/post-project/citations";
import { runPostQualityGate } from "@/lib/post-project/quality";
import { readPostProject, updatePostProject } from "@/lib/post-project/store";
import { buildPublishVersionSnapshot } from "@/lib/post-project/versioning";
import type { PublishEvidenceCitationSummary, PublishVersionSnapshot } from "@/lib/agent/types";
import type { PostProject, QualityCheck } from "@/lib/post-project/types";
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
    const qualityReview = await getQualityGateReview(publishArgs, body.assetIds ?? [], { dryRun: body.dryRun });

    if (body.dryRun) {
      const publishIntent = createPublishIntent({
        ...publishArgs,
        requestedBy: "manual",
        mode: publishArgs.scheduleAt ? "scheduled" : "manual",
        accountId: settings.activeAccountId,
        mcpUrl: settings.mcpUrl,
        evidenceCitationSummary: qualityReview.evidenceCitationSummary,
        versionSnapshot: qualityReview.versionSnapshot
      });
      const validationErrors = [...validatePublishIntent(publishIntent), ...qualityReview.reasons];
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
        evidenceCitationSummary: qualityReview.evidenceCitationSummary,
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

    if (qualityReview.qualityCheck) {
      await updatePostProject({
        qualityCheck: qualityReview.qualityCheck,
        auditStatus: qualityReview.qualityCheck.canPublish ? "passed" : "blocked"
      }).catch(() => undefined);
    }

    if (qualityReview.reasons.length) {
      return NextResponse.json(
        {
          error: qualityReview.reasons.join("；"),
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
      evidenceCitationSummary: qualityReview.evidenceCitationSummary,
      accountContext: {
        accountId: settings.activeAccountId,
        mcpUrl: settings.mcpUrl
      }
    });

    const mcpClient = createXhsMcpClient(settings);
    const loginError = await verifyActiveXhsLogin(mcpClient);
    if (loginError) {
      return NextResponse.json(
        {
          error: loginError,
          requiresConfirmation: false
        },
        { status: 400 }
      );
    }

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
      publishContext: {
        evidenceCitationSummary: qualityReview.evidenceCitationSummary,
        versionSnapshot: qualityReview.versionSnapshot
      },
      publish: (args) => mcpClient.publishContent(args)
    });

    if (guardedPublish.status === "awaiting_approval") {
      await updatePostProject({
        publishPlan: guardedPublish.publishIntent,
        auditStatus: "unchecked"
      }).catch(() => undefined);
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
      await updatePostProject({
        publishPlan: guardedPublish.publishIntent,
        auditStatus: "blocked"
      }).catch(() => undefined);
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

    const projectForDraft = await readPostProject().catch(() => null);
    const draftEvidenceIds =
      projectForDraft?.copyDraft?.draft.basedOnEvidenceIds?.length
        ? projectForDraft.copyDraft.draft.basedOnEvidenceIds
        : projectForDraft?.creativeBrief?.basedOnEvidenceIds ?? projectForDraft?.evidencePack.insights.map((insight) => insight.id) ?? [];
    const currentDraft = await writeCurrentDraft(
      createDraftRecord({
        draft: {
          title: publishArgs.title,
          content: publishArgs.content,
          tags: publishArgs.tags,
          structure: [],
          imagePrompt: body.imagePrompt ?? "",
          basedOnEvidenceIds: draftEvidenceIds.length ? draftEvidenceIds.slice(0, 8) : undefined
        },
        images: publishArgs.images.map((imagePath) => ({ path: imagePath })),
        visibility: publishArgs.visibility
      })
    );
    await updateWorkspaceState({
      currentDraftId: currentDraft?.id,
      currentDraft,
      selectedImageIds: body.assetIds ?? [],
      publishPlan: guardedPublish.publishIntent
    });
    await updatePostProject({
      publishPlan: guardedPublish.publishIntent,
      copyDraft: currentDraft,
      selectedImages: body.assetIds ?? [],
      auditStatus: guardedPublish.status === "published" || guardedPublish.status === "scheduled" ? "passed" : "unchecked"
    }).catch(() => undefined);

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

async function getQualityGateReview(
  publishArgs: GuardedPublishArgs,
  assetIds: string[],
  options: { dryRun?: boolean } = {}
): Promise<{
  qualityCheck?: QualityCheck;
  reasons: string[];
  evidenceCitationSummary?: PublishEvidenceCitationSummary;
  versionSnapshot?: PublishVersionSnapshot;
}> {
  try {
    const project = await readPostProject();
    const evidenceCitationSummary = buildPublishEvidenceCitationSummary(project);
    const versionSnapshot = buildPublishVersionSnapshot(project);
    if (!hasPostProjectPublishContext(project)) {
      return {
        reasons: options.dryRun
          ? []
          : ["真实发布必须先在 Post Studio 保存当前帖子项目并运行 Quality Gate，不能绕过 PostProject 发布检查。"],
        evidenceCitationSummary,
        versionSnapshot
      };
    }
    const snapshotMismatchReasons = getProjectSnapshotMismatchReasons(project, publishArgs, assetIds);
    if (snapshotMismatchReasons.length) {
      return { reasons: snapshotMismatchReasons, evidenceCitationSummary, versionSnapshot };
    }
    const qualityCheck = runPostQualityGate(buildProjectForPublishQualityGate(project, publishArgs, assetIds));
    if (qualityCheck.canPublish) {
      return { qualityCheck, reasons: [], evidenceCitationSummary, versionSnapshot };
    }
    return {
      qualityCheck,
      evidenceCitationSummary,
      versionSnapshot,
      reasons: [
      "当前发布内容未通过 Quality Gate",
      ...qualityCheck.issues.slice(0, 5)
      ]
    };
  } catch (error) {
    return {
      reasons: [
        error instanceof Error
          ? `无法完成 Quality Gate：${error.message}`
          : "无法完成 Quality Gate"
      ]
    };
  }
}

function buildProjectForPublishQualityGate(
  project: Awaited<ReturnType<typeof readPostProject>>,
  publishArgs: GuardedPublishArgs,
  assetIds: string[]
): Pick<PostProject, "finalPost" | "copyDraft" | "selectedImages" | "creativeBrief" | "visualDirection"> &
  Partial<Pick<PostProject, "selectedSamples" | "evidencePack" | "imagePrompts">> {
  const imageIds = assetIds.length ? assetIds : publishArgs.images;
  const evidenceIds = getPublishPayloadEvidenceIds(project);
  const now = new Date().toISOString();
  return {
    ...project,
    copyDraft: {
      id: project.copyDraft?.id ?? "publish-payload",
      updatedAt: project.copyDraft?.updatedAt ?? now,
      source: project.copyDraft?.source,
      draft: {
        title: publishArgs.title,
        content: publishArgs.content,
        tags: publishArgs.tags,
        structure: project.copyDraft?.draft.structure ?? [],
        imagePrompt: project.copyDraft?.draft.imagePrompt ?? project.imagePrompts?.at(-1)?.value.prompt ?? "",
        basedOnEvidenceIds: evidenceIds.length ? evidenceIds : undefined,
        evidenceReferences: project.copyDraft?.draft.evidenceReferences
      },
      images: project.copyDraft?.images ?? [],
      visibility: project.copyDraft?.visibility ?? publishArgs.visibility
    },
    finalPost: {
      title: publishArgs.title,
      content: publishArgs.content,
      tags: publishArgs.tags,
      imageIds,
      coverImageId: imageIds[0],
      copyVersionId: project.copyDraft ? `copy-${project.copyDraft.id}` : "copy-publish-payload",
      imagePromptVersionIds: (project.imagePrompts ?? []).map((prompt) => prompt.id)
    },
    selectedImages: imageIds
  };
}

function getPublishPayloadEvidenceIds(project: Awaited<ReturnType<typeof readPostProject>>): string[] {
  return uniqueStrings([
    ...(project.copyDraft?.draft.basedOnEvidenceIds ?? []),
    ...(project.creativeBrief?.basedOnEvidenceIds ?? []),
    ...(project.evidencePack?.insights ?? []).map((insight) => insight.id)
  ]).slice(0, 12);
}

function buildPublishEvidenceCitationSummary(
  project: Awaited<ReturnType<typeof readPostProject>>
): PublishEvidenceCitationSummary | undefined {
  const evidenceIds = project.copyDraft?.draft.basedOnEvidenceIds ?? project.creativeBrief?.basedOnEvidenceIds ?? [];
  if (!project.evidencePack?.insights?.length || !evidenceIds.length) {
    return undefined;
  }
  const report = buildEvidenceCitationReport(project, evidenceIds, project.copyDraft?.draft.evidenceReferences);
  return {
    summary: report.summary,
    missingEvidenceIds: report.missingEvidenceIds,
    warnings: report.warnings,
    sourceCounts: report.sourceCounts,
    fieldCounts: {
      title: report.sections.find((section) => section.field === "title")?.insights.length ?? 0,
      content: report.sections.find((section) => section.field === "content")?.insights.length ?? 0,
      tags: report.sections.find((section) => section.field === "tags")?.insights.length ?? 0,
      imagePrompt: report.sections.find((section) => section.field === "imagePrompt")?.insights.length ?? 0
    }
  };
}

function getProjectSnapshotMismatchReasons(
  project: Awaited<ReturnType<typeof readPostProject>>,
  publishArgs: GuardedPublishArgs,
  assetIds: string[]
): string[] {
  if (!hasPostProjectPublishContext(project)) {
    return [];
  }
  const reasons: string[] = [];
  const hasTextSnapshot = Boolean(project.copyDraft || project.finalPost);
  if (!hasTextSnapshot && (project.creativeBrief || project.evidencePack?.insights?.length)) {
    reasons.push("当前 PostProject 还没有保存的文案版本或最终帖子，请先在 Post Studio 保存画布并运行发布检查");
  }
  const matchesDraft = Boolean(
    project.copyDraft &&
      project.copyDraft.draft.title === publishArgs.title &&
      project.copyDraft.draft.content === publishArgs.content &&
      project.copyDraft.draft.tags.join("|") === publishArgs.tags.join("|")
  );
  const matchesFinalPost = Boolean(
    project.finalPost &&
      project.finalPost.title === publishArgs.title &&
      project.finalPost.content === publishArgs.content &&
      project.finalPost.tags.join("|") === publishArgs.tags.join("|")
  );
  if (hasTextSnapshot && !matchesDraft && !matchesFinalPost) {
    reasons.push("发布内容与当前 PostProject 草稿/最终帖子不一致，请先在 Post Studio 保存画布并重新运行 Quality Gate");
  }

  if (project.selectedImages?.length && assetIds.length && !sameStringSet(project.selectedImages, assetIds)) {
    reasons.push("发布图片与当前 PostProject 选中图片版本不一致，请重新选择图片并运行发布检查");
  }

  return reasons;
}

function hasPostProjectPublishContext(project: Awaited<ReturnType<typeof readPostProject>>): boolean {
  return Boolean(
    project.creativeBrief ||
      project.copyDraft ||
      project.finalPost ||
      project.evidencePack?.insights?.length ||
      project.selectedSamples?.length ||
      project.selectedImages?.length ||
      project.imagePrompts?.length
  );
}

function sameStringSet(left: string[], right: string[]): boolean {
  const leftSet = new Set(left.map(String).filter(Boolean));
  const rightSet = new Set(right.map(String).filter(Boolean));
  return leftSet.size === rightSet.size && [...leftSet].every((item) => rightSet.has(item));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map(String).map((value) => value.trim()).filter(Boolean))];
}

async function verifyActiveXhsLogin(client: ReturnType<typeof createXhsMcpClient>): Promise<string | null> {
  if (typeof client.checkLoginStatus !== "function") {
    return null;
  }
  try {
    const result = await client.checkLoginStatus();
    const text = readMcpText(result);
    if (isExplicitXhsLoggedOutStatus(text) || !isExplicitXhsLoggedInStatus(text)) {
      return "当前小红书 MCP 未登录，请先完成登录后再发布。";
    }
    return null;
  } catch (error) {
    return error instanceof Error ? `无法确认小红书登录状态：${error.message}` : "无法确认小红书登录状态";
  }
}

async function resolvePublishConfirmation({
  confirmed,
  publishIntentId,
  settingsPolicy,
  publishArgs,
  evidenceCitationSummary,
  accountContext
}: {
  confirmed?: boolean;
  publishIntentId?: string;
  settingsPolicy: "draft_only" | "review_required" | "auto_publish_allowed";
  publishArgs: GuardedPublishArgs;
  evidenceCitationSummary?: PublishEvidenceCitationSummary;
  accountContext: { accountId?: string; mcpUrl?: string };
}): Promise<boolean> {
  if (settingsPolicy !== "review_required" && settingsPolicy !== "auto_publish_allowed") {
    return false;
  }

  if (confirmed !== true || !publishIntentId) {
    return false;
  }

  const intent = await getPublishIntent(publishIntentId);
  return Boolean(intent && isPublishIntentConfirmable(intent, publishArgs, { accountContext, evidenceCitationSummary }));
}
