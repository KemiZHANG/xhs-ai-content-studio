import { NextResponse } from "next/server";
import { runAgentTurn } from "@/lib/agent/orchestrator";
import { readCreatorMemoryProfile, updateCreatorMemoryFromTurn } from "@/lib/agent/memory";
import { readWorkspaceState, updateWorkspaceState } from "@/lib/agent/state";
import { classifyChatRequest } from "@/lib/chat/router";
import { getJobRunner } from "@/lib/jobs/runner";
import { createModelProvider } from "@/lib/models/provider";
import { createXhsMcpClient } from "@/lib/mcp/xhs";
import { appendPostProjectMemoryFromTurn } from "@/lib/post-project/store";
import { requireLocalActionToken } from "@/lib/security/action-token";
import { createDraftRecord, readCurrentDraft, writeCurrentDraft } from "@/lib/storage/drafts";
import { appendChatTurn, getChatConversation } from "@/lib/storage/chat";
import { appendHistory, listHistory } from "@/lib/storage/history";
import { getAsset, upsertGeneratedAssetPaths, type AssetRecord } from "@/lib/storage/assets";
import { readSettings } from "@/lib/storage/settings";
import type { OneClickInput, OneClickResult } from "@/lib/workflows/one-click";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const authError = await requireLocalActionToken(request);
    if (authError) return authError;

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
    const draftForTurn = conversationId ? currentDraft : null;
    const creatorMemory = await readCreatorMemoryProfile(settings.activeAccountId);
    const attachedAssets = Array.isArray(assetIds)
      ? (await Promise.all(assetIds.map((id) => getAsset(String(id))))).filter(
          (asset): asset is AssetRecord => Boolean(asset)
        )
      : [];
    const shouldStayInImageChat =
      attachedAssets.length > 0 && !/搜索|找|高收藏|爆款|竞品|小红书笔记|流量/.test(message);
    const routeDecision = shouldStayInImageChat ? { kind: "direct" as const } : classifyChatRequest(message, Boolean(draftForTurn));

    if (routeDecision.kind === "queue-workflow") {
      const input: OneClickInput = {
        topic: routeDecision.topic,
        contentType: routeDecision.contentType,
        timeRange: routeDecision.timeRange,
        sampleCount: Math.min(routeDecision.sampleCount, settings.maxResearchSamples),
        visibility: settings.defaultVisibility,
        workflowGoal: routeDecision.workflowGoal,
        publishMode: routeDecision.publishMode,
        analyzeImages: routeDecision.analyzeImages,
        generateImages: routeDecision.generateImages,
        scheduleAt: routeDecision.scheduleAt,
        imageSource: "ai",
        assetIds: [],
        useViralKnowledge: true,
        retrievalQuery: message,
        retrievalLimit: 8
      };
      const job = await getJobRunner().enqueueWorkflow(input);
      const answer = `已创建后台 Agent 任务 ${job.id}。你可以继续留在对话页，任务进度和结果会写入任务列表与成果画布。`;
      const conversation = await appendChatTurn({
        conversationId,
        userContent: message,
        assistantContent: answer
      });
      await updateCreatorMemoryFromTurn({
        accountId: settings.activeAccountId,
        message,
        assistantAnswer: answer,
        attachedAssets,
        conversationId: conversation.id
      }).catch(() => undefined);

      const intent = routeDecision.workflowGoal === "research" ? "research_only" : "research_to_draft";
      return NextResponse.json({
        answer,
        reply: answer,
        stage: "researching",
        intent,
        intentConfidence: 0.92,
        needsUserInput: false,
        questions: [],
        workspacePatch: {
          topic: routeDecision.topic,
          recentJobIds: [job.id],
          lastUserIntent: intent
        },
        cards: [],
        quickActions: [
          { id: "qa-view-job", label: "查看任务进度", action: "open_jobs" }
        ],
        toolTrace: [
          {
            id: `tool-${job.id}`,
            label: "workflow.runOneClick",
            status: "running",
            detail: "已进入后台任务队列，完成后会写入成果画布。",
            createdAt: new Date().toISOString()
          }
        ],
        job,
        jobId: job.id,
        conversation
      });
    }

    const result = await runAgentTurn({
      message,
      conversationId,
      settings,
      history,
      currentDraft: draftForTurn,
      attachedAssets,
      conversationMessages: conversationId
        ? ((await getChatConversation(String(conversationId)))?.messages ?? []).slice(-12)
        : [],
      creatorMemory,
      mcp: createXhsMcpClient(settings),
      model: createModelProvider(settings)
    });

    if (result.workflowResult?.draft) {
      const persisted = await persistWorkflowResult(
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
      if (persisted.currentDraft) {
        result.currentDraft = persisted.currentDraft;
      }
    }

    if (result.currentDraft) {
      const currentDraftRecord = await writeCurrentDraft(result.currentDraft);
      if (!currentDraftRecord) {
        throw new Error("Failed to persist current draft");
      }
      const registeredImages = await upsertGeneratedAssetPaths(currentDraftRecord.images, {
        prompt: currentDraftRecord.draft.imagePrompt
      });
      const workspace = await readWorkspaceState();
      await updateWorkspaceState({
        currentDraftId: currentDraftRecord.id,
        currentDraft: currentDraftRecord,
        selectedImageIds: registeredImages.length ? registeredImages.map((asset) => asset.id) : undefined,
        recentConversationIds: conversationId
          ? [conversationId, ...workspace.recentConversationIds.filter((id) => id !== conversationId)].slice(0, 20)
          : undefined
      });
    }

    const conversation = await appendChatTurn({
      conversationId,
      userContent: message,
      assistantContent: result.answer,
      workflowResult: result.workflowResult,
      assistantMeta: {
        cards: result.cards,
        quickActions: result.quickActions,
        toolTrace: result.toolTrace,
        questions: result.questions,
        intent: result.intent,
        stage: result.stage
      }
    });

    await updateCreatorMemoryFromTurn({
      accountId: settings.activeAccountId,
      message,
      assistantAnswer: result.answer,
      currentDraft: result.currentDraft,
      workflowResult: result.workflowResult,
      attachedAssets,
      conversationId: conversation.id
    }).catch(() => undefined);
    const shouldReturnPostProject = Boolean(result.postProject || result.currentDraft || result.workflowResult);
    const postProjectWithMemory = shouldReturnPostProject
      ? await appendPostProjectMemoryFromTurn({
          message,
          currentDraft: result.currentDraft
        }).catch(() => result.postProject)
      : undefined;

    return NextResponse.json({
      answer: result.answer,
      reply: result.reply,
      stage: result.stage,
      intent: result.intent,
      intentConfidence: result.intentConfidence,
      needsUserInput: result.needsUserInput,
      questions: result.questions,
      workspacePatch: result.workspacePatch,
      cards: result.cards,
      quickActions: result.quickActions,
      toolTrace: result.toolTrace,
      workflowResult: result.workflowResult,
      currentDraft: result.currentDraft,
      postProject: postProjectWithMemory ?? result.postProject,
      conversation
    });
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
): Promise<{ currentDraft: Awaited<ReturnType<typeof writeCurrentDraft>> | null }> {
  const run = await appendHistory(input, workflowResult);
  const registeredImages = await upsertGeneratedAssetPaths(workflowResult.images, {
    prompt: workflowResult.draft?.imagePrompt,
    sourceAssetIds: input.assetIds
  });

  if (workflowResult.draft) {
    const currentDraft = await writeCurrentDraft(
      createDraftRecord({
        draft: workflowResult.draft,
        images: workflowResult.images,
        visibility: input.visibility || settings.defaultVisibility,
        input,
        runId: run.id
      })
    );
    if (!currentDraft) {
      throw new Error("Failed to persist workflow draft");
    }
    const workspace = await readWorkspaceState();
    await updateWorkspaceState({
      topic: input.topic,
      researchRunId: run.id,
      evidenceSummary: workflowResult.researchSummary,
      selectedSamples: workflowResult.evidence,
      currentDraftId: currentDraft.id,
      currentDraft,
      selectedImageIds: registeredImages.length ? registeredImages.map((asset) => asset.id) : undefined,
      recentRunIds: [run.id, ...workspace.recentRunIds.filter((id) => id !== run.id)].slice(0, 20)
    });
    return { currentDraft };
  }

  const workspace = await readWorkspaceState();
  await updateWorkspaceState({
    topic: input.topic,
    researchRunId: run.id,
    evidenceSummary: workflowResult.researchSummary,
    selectedSamples: workflowResult.evidence,
    recentRunIds: [run.id, ...workspace.recentRunIds.filter((id) => id !== run.id)].slice(0, 20)
  });
  return { currentDraft: null };
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
