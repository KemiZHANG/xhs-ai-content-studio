import { NextResponse } from "next/server";
import { resetWorkspaceState } from "@/lib/agent/state";
import { getJobRunner } from "@/lib/jobs/runner";
import { resetPostProject } from "@/lib/post-project/store";
import { requireLocalActionToken } from "@/lib/security/action-token";
import { isPublishVisibility, readSettings } from "@/lib/storage/settings";
import type { OneClickInput, PublishMode } from "@/lib/workflows/one-click";

export const runtime = "nodejs";

export async function GET() {
  const jobs = await getJobRunner().listJobs();
  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  try {
    const authError = await requireLocalActionToken(request);
    if (authError) return authError;

    const settings = await readSettings();
    const body = (await request.json()) as Partial<OneClickInput>;
    const input: OneClickInput = sanitizeOneClickInput({
      topic: String(body.topic ?? "").trim(),
      contentType: String(body.contentType ?? "图文"),
      timeRange: String(body.timeRange ?? "一周内"),
      sampleCount: Math.min(Number(body.sampleCount ?? 8), settings.maxResearchSamples),
      visibility: isPublishVisibility(body.visibility) ? body.visibility : settings.defaultVisibility,
      autoPublish: body.publishMode === "publish" || body.publishMode === "schedule" ? Boolean(body.autoPublish) : false,
      publishMode: normalizePublishMode(body.publishMode),
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
    });

    if (!input.topic) {
      return NextResponse.json({ error: "请输入主题" }, { status: 400 });
    }

    const referenceAssetIds = input.imageSource === "product" || input.imageSource === "asset" ? input.assetIds ?? [] : [];
    const initialWorkspace = await resetWorkspaceState({
      topic: input.topic,
      selectedSamples: [],
      evidenceSummary: undefined,
      currentDraftId: undefined,
      currentDraft: null,
      selectedImageIds: [],
      productImageIds: referenceAssetIds,
      publishPlan: null,
      lastUserIntent: input.workflowGoal === "research" ? "research_only" : "research_to_draft"
    });
    await resetPostProject({
      id: initialWorkspace.workspaceId === "local-default"
        ? "post-local-default"
        : initialWorkspace.workspaceId.replace(/^workspace-/, "post-"),
      topic: input.topic,
      productInfo: {
        name: input.productName,
        sellingPoints: input.sellingPoints,
        scene: input.scene,
        referenceAssetIds
      },
      goal: input.requirements,
      auditStatus: "unchecked",
      currentStage: "researching"
    });

    const job = await getJobRunner().enqueueWorkflow(input);
    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建任务失败" },
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

function normalizePublishMode(value: unknown): PublishMode {
  if (value === "draft" || value === "material" || value === "publish" || value === "schedule") {
    return value;
  }

  return "draft";
}
