import { NextResponse } from "next/server";
import { createModelProvider } from "@/lib/models/provider";
import { createXhsMcpClient } from "@/lib/mcp/xhs";
import { appendHistory } from "@/lib/storage/history";
import { createDraftRecord, writeCurrentDraft } from "@/lib/storage/drafts";
import { readSettings } from "@/lib/storage/settings";
import { runOneClickWorkflow, type OneClickInput, type PublishMode } from "@/lib/workflows/one-click";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const settings = await readSettings();
    const body = (await request.json()) as Partial<OneClickInput>;
    const input: OneClickInput = {
      topic: String(body.topic ?? "").trim(),
      contentType: String(body.contentType ?? "图文"),
      timeRange: String(body.timeRange ?? "一周内"),
      sampleCount: Number(body.sampleCount ?? 8),
      visibility: body.visibility ?? settings.defaultVisibility,
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
      extraImagePrompt: body.extraImagePrompt ? String(body.extraImagePrompt) : undefined
    };

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

    if (result.draft) {
      await writeCurrentDraft(
        createDraftRecord({
          draft: result.draft,
          images: result.images,
          visibility: input.visibility,
          input,
          runId: run.id
        })
      );
    }

    return NextResponse.json({ run, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "一键工作流执行失败" },
      { status: 500 }
    );
  }
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
