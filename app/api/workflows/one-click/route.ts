import { readWorkspaceState, updateWorkspaceState } from "@/lib/agent/state";
import { NextResponse } from "next/server";
import { createModelProvider } from "@/lib/models/provider";
import { createXhsMcpClient } from "@/lib/mcp/xhs";
import { requireLocalActionToken } from "@/lib/security/action-token";
import { appendHistory } from "@/lib/storage/history";
import { upsertGeneratedAssetPaths } from "@/lib/storage/assets";
import { createDraftRecord, writeCurrentDraft } from "@/lib/storage/drafts";
import { isPublishVisibility, readSettings } from "@/lib/storage/settings";
import { runOneClickWorkflow, type OneClickInput, type PublishMode } from "@/lib/workflows/one-click";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const authError = await requireLocalActionToken(request);
    if (authError) return authError;

    const settings = await readSettings();
    const body = (await request.json()) as Partial<OneClickInput>;
    const input: OneClickInput = sanitizeOneClickInput(
      {
      topic: String(body.topic ?? "").trim(),
      contentType: String(body.contentType ?? "图文"),
      timeRange: String(body.timeRange ?? "一周内"),
      sampleCount: Math.min(Number(body.sampleCount ?? 8), settings.maxResearchSamples),
      visibility: isPublishVisibility(body.visibility) ? body.visibility : settings.defaultVisibility,
      autoPublish: Boolean(body.autoPublish ?? settings.defaultAutoPublish),
      publishMode: normalizePublishMode(body.publishMode, body.autoPublish, settings.defaultAutoPublish),
      workflowGoal: body.workflowGoal === "research" ? "research" : "draft",
      analyzeImages: Boolean(body.analyzeImages ?? false),
      generateImages: Boolean(body.generateImages ?? false),
      scheduleAt: body.scheduleAt ? String(body.scheduleAt) : undefined,
      requirements: body.requirements ? String(body.requirements) : undefined,
      imageSource:
        body.imageSource === "product" || body.imageSource === "asset" || body.imageSource === "ai"
          ? body.imageSource
          : "ai",
      assetIds: Array.isArray(body.assetIds) ? body.assetIds.map(String) : [],
      productName: body.productName ? String(body.productName) : undefined,
      sellingPoints: body.sellingPoints ? String(body.sellingPoints) : undefined,
      scene: body.scene ? String(body.scene) : undefined,
      style: body.style ? String(body.style) : undefined,
      extraImagePrompt: body.extraImagePrompt ? String(body.extraImagePrompt) : undefined,
      useViralKnowledge: body.useViralKnowledge !== false,
      retrievalQuery: body.retrievalQuery ? String(body.retrievalQuery) : undefined,
      retrievalLimit: body.retrievalLimit ? Number(body.retrievalLimit) : undefined
      }
    );

    if (!input.topic) {
      return NextResponse.json({ error: "请输入主题" }, { status: 400 });
    }

    const result = await runOneClickWorkflow({
      input,
      settings,
      mcp: createXhsMcpClient(settings),
      model: createModelProvider(settings)
    });
    const run = await appendHistory(input, result);

    const registeredImages = await upsertGeneratedAssetPaths(result.images, {
      prompt: result.draft?.imagePrompt,
      sourceAssetIds: input.assetIds
    });
    const imageAssetIds = registeredImages.map((asset) => asset.id);
    const currentDraft = result.draft
      ? await writeCurrentDraft(
          createDraftRecord({
            draft: result.draft,
            images: result.images,
            visibility: input.visibility,
            input,
            runId: run.id
          })
        )
      : null;
    const workspace = await readWorkspaceState();
    await updateWorkspaceState({
      topic: input.topic,
      researchRunId: run.id,
      evidenceSummary: result.researchSummary
        ? { ...result.researchSummary, viralKnowledge: result.viralKnowledge ?? null }
        : result.researchSummary,
      selectedSamples: result.evidence,
      currentDraftId: currentDraft?.id,
      currentDraft: currentDraft ?? undefined,
      selectedImageIds: imageAssetIds.length
        ? imageAssetIds
        : input.imageSource === "asset" && input.assetIds?.length
          ? input.assetIds
          : undefined,
      productImageIds:
        input.imageSource === "product" && input.assetIds?.length
          ? [...new Set([...workspace.productImageIds, ...input.assetIds])]
          : undefined,
      recentRunIds: [run.id, ...workspace.recentRunIds.filter((id) => id !== run.id)].slice(0, 20)
    });

    return NextResponse.json({ run, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "一键工作流执行失败" },
      { status: 500 }
    );
  }
}

function sanitizeOneClickInput(input: OneClickInput): OneClickInput {
  if (input.workflowGoal !== "research") {
    return input;
  }

  return {
    ...input,
    autoPublish: false,
    publishMode: "draft",
    generateImages: false,
    scheduleAt: undefined,
    imageSource: "ai",
    assetIds: []
  };
}

function normalizePublishMode(
  value: unknown,
  autoPublish: unknown,
  defaultAutoPublish: boolean
): PublishMode {
  if (value === "draft" || value === "material" || value === "publish" || value === "schedule") {
    return value;
  }

  return Boolean(autoPublish ?? defaultAutoPublish) ? "publish" : "draft";
}
