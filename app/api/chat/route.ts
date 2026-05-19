import { NextResponse } from "next/server";
import { runChatAgent } from "@/lib/chat/agent";
import { classifyChatRequest } from "@/lib/chat/router";
import { createModelProvider } from "@/lib/models/provider";
import { createXhsMcpClient } from "@/lib/mcp/xhs";
import { createDraftRecord, readCurrentDraft, writeCurrentDraft } from "@/lib/storage/drafts";
import { appendChatTurn } from "@/lib/storage/chat";
import { appendHistory, listHistory } from "@/lib/storage/history";
import { getAsset, type AssetRecord } from "@/lib/storage/assets";
import { readSettings } from "@/lib/storage/settings";
import { runOneClickWorkflow, type OneClickInput, type OneClickResult } from "@/lib/workflows/one-click";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { message, conversationId, assetIds } = (await request.json()) as {
      message?: string;
      conversationId?: string | null;
      assetIds?: string[];
    };
    if (!message?.trim()) {
      return NextResponse.json({ error: "请输入问题" }, { status: 400 });
    }

    const settings = await readSettings();
    const history = await listHistory();
    const currentDraft = await readCurrentDraft();
    const attachedAssets = Array.isArray(assetIds)
      ? (await Promise.all(assetIds.map((id) => getAsset(String(id))))).filter(
          (asset): asset is AssetRecord => Boolean(asset)
        )
      : [];
    const shouldStayInImageChat =
      attachedAssets.length > 0 && !/搜索|找|高收藏|爆款|竞品|小红书笔记|流量/.test(message);
    const routeDecision = shouldStayInImageChat ? { kind: "direct" as const } : classifyChatRequest(message, Boolean(currentDraft));

    if (routeDecision.kind === "queue-workflow") {
      const input: OneClickInput = {
        topic: routeDecision.topic,
        contentType: routeDecision.contentType,
        timeRange: routeDecision.timeRange,
        sampleCount: routeDecision.sampleCount,
        visibility: settings.defaultVisibility,
        workflowGoal: routeDecision.workflowGoal,
        publishMode: routeDecision.publishMode,
        analyzeImages: routeDecision.analyzeImages,
        generateImages: routeDecision.generateImages,
        scheduleAt: routeDecision.scheduleAt,
        imageSource: "ai",
        assetIds: []
      };
      const workflowResult = await runOneClickWorkflow({
        input,
        settings,
        mcp: createXhsMcpClient(settings),
        model: createModelProvider(settings)
      });
      await persistWorkflowResult(input, workflowResult, settings);

      const answer = summarizeWorkflowForChat(workflowResult);
      const conversation = await appendChatTurn({
        conversationId,
        userContent: message,
        assistantContent: answer,
        workflowResult
      });

      return NextResponse.json({
        answer,
        workflowResult,
        conversation
      });
    }

    const result = await runChatAgent({
      message,
      settings,
      history,
      currentDraft,
      attachedAssets,
      mcp: createXhsMcpClient(settings),
      model: createModelProvider(settings)
    });

    if (result.workflowResult?.draft) {
      await persistWorkflowResult(
        {
          topic: result.workflowResult.draft.title,
          contentType: "自然语言",
          timeRange: "一周内",
          sampleCount: result.workflowResult.samples.length,
          visibility: settings.defaultVisibility,
          autoPublish: result.workflowResult.status === "published",
          publishMode:
            result.workflowResult.status === "published"
              ? "publish"
              : result.workflowResult.status === "scheduled"
                ? "schedule"
                : result.workflowResult.status === "material_ready"
                  ? "material"
                  : "draft",
          analyzeImages: true,
          generateImages: result.workflowResult.images.length > 0
        },
        result.workflowResult,
        settings
      );
    }

    if (result.currentDraft) {
      await writeCurrentDraft(result.currentDraft);
    }

    const conversation = await appendChatTurn({
      conversationId,
      userContent: message,
      assistantContent: result.answer,
      workflowResult: result.workflowResult
    });

    return NextResponse.json({ ...result, conversation });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "对话执行失败" },
      { status: 500 }
    );
  }
}

async function persistWorkflowResult(
  input: OneClickInput,
  workflowResult: OneClickResult,
  settings: Awaited<ReturnType<typeof readSettings>>
): Promise<void> {
  const run = await appendHistory(input, workflowResult);

  if (workflowResult.draft) {
    await writeCurrentDraft(
      createDraftRecord({
        draft: workflowResult.draft,
        images: workflowResult.images,
        visibility: input.visibility || settings.defaultVisibility,
        input,
        runId: run.id
      })
    );
  }
}

function summarizeWorkflowForChat(result: OneClickResult): string {
  const title = result.draft?.title ? `\n生成标题：${result.draft.title}` : "";
  const researchLine =
    result.status === "research_ready"
      ? "\n已先完成选题研究：下面会展示真实笔记、正文/图片证据、优点总结和下一步需要补充的问题。"
      : "";
  const evidenceLine = `已整理 ${result.evidence.length} 条真实样本证据，可在下方查看标题、作者、互动数、图片和分析依据。`;
  return `工作流状态：${result.status}${title}${researchLine}\n${evidenceLine}\n\n${result.steps
    .map((step) => `- ${step.label}：${step.detail}`)
    .join("\n")}`;
}
