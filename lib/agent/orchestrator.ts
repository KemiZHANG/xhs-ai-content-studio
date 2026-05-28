import { runChatAgent, type ChatAgentResult } from "@/lib/chat/agent";
import { createAgentPlan } from "@/lib/agent/planner";
import { executeGuardedPublish } from "@/lib/agent/publishing";
import { inferAgentScheduleAt } from "@/lib/agent/schedule";
import { readWorkspaceState, updateWorkspaceState } from "@/lib/agent/state";
import { addTraceEvent, createAgentRun, createTrace, persistAgentTrace } from "@/lib/agent/trace";
import type { AgentRuntimeContext, AgentTurnResult } from "@/lib/agent/types";
import { renderXhsCardSet } from "@/lib/cards/renderer";
import type { ModelProvider } from "@/lib/models/provider";
import { createAssetRecord, saveAsset } from "@/lib/storage/assets";
import type { DraftRecord } from "@/lib/storage/drafts";
import type { XhsMcpWorkflowClient } from "@/lib/workflows/one-click";

export type RunAgentTurnInput = AgentRuntimeContext & {
  message: string;
  conversationId?: string | null;
  mcp: XhsMcpWorkflowClient;
  model: ModelProvider;
  runChatAgentImpl?: typeof runChatAgent;
};

export async function runAgentTurn(input: RunAgentTurnInput): Promise<AgentTurnResult> {
  const plan = createAgentPlan({
    message: input.message,
    hasCurrentDraft: Boolean(input.currentDraft),
    attachedAssetCount: input.attachedAssets.length
  });
  let agentRun = createAgentRun({
    message: input.message,
    conversationId: input.conversationId,
    plan
  });
  let trace = createTrace(agentRun.id);
  trace = addTraceEvent(trace, {
    type: "run_started",
    label: "Agent run started",
    detail: "Loaded chat message and runtime context."
  });
  trace = addTraceEvent(trace, {
    type: "plan_created",
    label: "Plan created",
    detail: `Intent: ${plan.intent}`,
    metadata: {
      steps: plan.steps.map((step) => step.action),
      topic: plan.topic
    }
  });

  try {
    const cardGenerationTurn = await maybeHandleCardGenerationTurn(input, plan);
    if (cardGenerationTurn) {
      trace = addTraceEvent(trace, {
        type: "tool_called",
        label: "image.generateCards",
        detail: "Rendered Xiaohongshu cover and content cards from the current draft.",
        metadata: {
          imageCount: cardGenerationTurn.currentDraft?.images.length ?? 0
        }
      });
      trace = addTraceEvent(trace, {
        type: "workspace_updated",
        label: "Workspace updated",
        detail: "Stored generated card images on the workspace canvas.",
        metadata: {
          selectedImageIds: cardGenerationTurn.workspace.selectedImageIds
        }
      });
      agentRun = {
        ...agentRun,
        status: "completed",
        updatedAt: new Date().toISOString()
      };
      trace = addTraceEvent(trace, {
        type: "run_completed",
        label: "Agent run completed",
        detail: "Agent turn completed after rendering card images."
      });
      await persistAgentTrace(trace);

      return {
        answer: cardGenerationTurn.answer,
        currentDraft: cardGenerationTurn.currentDraft,
        agentRun,
        trace,
        workspace: cardGenerationTurn.workspace
      };
    }

    const imageGenerationTurn = await maybeHandleImageGenerationTurn(input, plan);
    if (imageGenerationTurn) {
      trace = addTraceEvent(trace, {
        type: "tool_called",
        label: "workflow.generateImages",
        detail: "Generated a post image and attached it to the active workspace draft.",
        metadata: {
          imageCount: imageGenerationTurn.currentDraft?.images.length ?? 0
        }
      });
      trace = addTraceEvent(trace, {
        type: "workspace_updated",
        label: "Workspace updated",
        detail: "Stored generated image references on the workspace canvas.",
        metadata: {
          selectedImageIds: imageGenerationTurn.workspace.selectedImageIds
        }
      });
      agentRun = {
        ...agentRun,
        status: "completed",
        updatedAt: new Date().toISOString()
      };
      trace = addTraceEvent(trace, {
        type: "run_completed",
        label: "Agent run completed",
        detail: "Agent turn completed after generating images."
      });
      await persistAgentTrace(trace);

      return {
        answer: imageGenerationTurn.answer,
        currentDraft: imageGenerationTurn.currentDraft,
        agentRun,
        trace,
        workspace: imageGenerationTurn.workspace
      };
    }

    const guardedPublishTurn = await maybeHandleGuardedPublishTurn(input, plan);
    if (guardedPublishTurn) {
      trace = addTraceEvent(trace, {
        type: "tool_called",
        label: "publish.prepare",
        detail: "Created a guarded publish intent from the current workspace draft.",
        metadata: {
          publishStatus: guardedPublishTurn.workspace.publishPlan?.status
        }
      });
      trace = addTraceEvent(trace, {
        type: "workspace_updated",
        label: "Workspace updated",
        detail: "Stored the guarded publish intent on the workspace canvas.",
        metadata: {
          publishStatus: guardedPublishTurn.workspace.publishPlan?.status
        }
      });
      agentRun = {
        ...agentRun,
        status: "completed",
        updatedAt: new Date().toISOString()
      };
      trace = addTraceEvent(trace, {
        type: "run_completed",
        label: "Agent run completed",
        detail: "Agent turn completed after preparing a publish intent."
      });
      await persistAgentTrace(trace);

      return {
        answer: guardedPublishTurn.answer,
        currentDraft: guardedPublishTurn.currentDraft,
        agentRun,
        trace,
        workspace: guardedPublishTurn.workspace
      };
    }

    const legacyAgent = input.runChatAgentImpl ?? runChatAgent;
    trace = addTraceEvent(trace, {
      type: "legacy_chat_agent_called",
      label: "Legacy chat agent called",
      detail: "Preserving existing chat behavior while the Agent layer is introduced."
    });
    const legacyResult: ChatAgentResult = await legacyAgent({
      message: input.message,
      settings: input.settings,
      history: input.history,
      currentDraft: input.currentDraft,
      attachedAssets: input.attachedAssets,
      conversationMessages: input.conversationMessages,
      creatorMemory: input.creatorMemory,
      mcp: input.mcp,
      model: input.model
    });

    const workspace = await updateWorkspaceFromTurn({
      plan,
      currentDraft: input.currentDraft,
      result: legacyResult
    });
    trace = addTraceEvent(trace, {
      type: "workspace_updated",
      label: "Workspace updated",
      detail: "Updated current workspace pointers from the latest Agent turn.",
      metadata: {
        topic: workspace.topic,
        currentDraftId: workspace.currentDraftId
      }
    });

    agentRun = {
      ...agentRun,
      status: "completed",
      updatedAt: new Date().toISOString()
    };
    trace = addTraceEvent(trace, {
      type: "run_completed",
      label: "Agent run completed",
      detail: "Agent turn completed successfully."
    });
    await persistAgentTrace(trace);

    return {
      ...legacyResult,
      agentRun,
      trace,
      workspace
    };
  } catch (error) {
    agentRun = {
      ...agentRun,
      status: "failed",
      updatedAt: new Date().toISOString()
    };
    trace = addTraceEvent(trace, {
      type: "run_failed",
      label: "Agent run failed",
      detail: error instanceof Error ? error.message : "Unknown Agent error"
    });
    await persistAgentTrace(trace).catch(() => undefined);
    throw error;
  }
}

async function maybeHandleCardGenerationTurn(
  input: RunAgentTurnInput,
  plan: ReturnType<typeof createAgentPlan>
): Promise<Pick<AgentTurnResult, "answer" | "currentDraft" | "workspace"> | null> {
  if (plan.intent !== "generate_cards") {
    return null;
  }

  const existing = await readWorkspaceState();
  const currentDraft = input.currentDraft ?? existing.currentDraft ?? null;
  if (!currentDraft) {
    const workspace = await updateWorkspaceState({ lastUserIntent: plan.intent });
    return {
      answer: "我可以生成图文卡片，但当前还没有草稿。请先生成一篇笔记草稿。",
      currentDraft: undefined,
      workspace
    };
  }

  const rendered = await renderXhsCardSet({
    title: currentDraft.draft.title,
    subtitle: "小红书图文笔记",
    body: currentDraft.draft.content,
    tags: currentDraft.draft.tags,
    theme: "sketch",
    mode: "auto-split",
    width: 1080,
    height: 1440
  });
  const generatedAssets = [];
  for (const file of rendered.files) {
    generatedAssets.push(
      await saveAsset(
        createAssetRecord({
          kind: "generated",
          originalName: file.kind === "cover" ? "xhs-card-cover.png" : `xhs-card-${file.pageIndex}.png`,
          absolutePath: file.absolutePath,
          mimeType: file.mimeType,
          size: file.size,
          prompt: JSON.stringify({
            type: "agent-card-generation",
            draftId: currentDraft.id,
            theme: rendered.theme,
            mode: rendered.mode
          })
        })
      )
    );
  }

  const generatedImages = rendered.files.map((file) => ({ path: file.absolutePath }));
  const updatedDraft: DraftRecord = {
    ...currentDraft,
    updatedAt: new Date().toISOString(),
    images: [...currentDraft.images, ...generatedImages]
  };
  const workspace = await updateWorkspaceState({
    currentDraftId: updatedDraft.id,
    currentDraft: updatedDraft,
    selectedImageIds: uniqueIds([...existing.selectedImageIds, ...generatedAssets.map((asset) => asset.id)]),
    lastUserIntent: plan.intent
  });

  return {
    answer: `已把当前草稿渲染成 ${generatedAssets.length} 张小红书图文卡片，并放入成果画布。`,
    currentDraft: updatedDraft,
    workspace
  };
}

async function maybeHandleImageGenerationTurn(
  input: RunAgentTurnInput,
  plan: ReturnType<typeof createAgentPlan>
): Promise<Pick<AgentTurnResult, "answer" | "currentDraft" | "workspace"> | null> {
  if (plan.intent !== "generate_images") {
    return null;
  }

  const existing = await readWorkspaceState();
  const currentDraft = input.currentDraft ?? existing.currentDraft ?? null;
  if (!currentDraft) {
    const workspace = await updateWorkspaceState({ lastUserIntent: plan.intent });
    return {
      answer: "我可以生成图片，但当前还没有草稿。请先生成一篇笔记草稿，或上传产品图并说明要生成的画面。",
      currentDraft: undefined,
      workspace
    };
  }

  if (!input.settings.imageApiKey.trim()) {
    const workspace = await updateWorkspaceState({
      currentDraftId: currentDraft.id,
      currentDraft,
      lastUserIntent: plan.intent
    });
    return {
      answer: "图片生成需要先在模型设置里配置图片模型 API Key。",
      currentDraft,
      workspace
    };
  }

  const prompt = buildAgentImagePrompt({
    message: input.message,
    draft: currentDraft,
    evidenceSummary: existing.evidenceSummary
  });
  const generatedImage = input.attachedAssets.length
    ? await input.model.generateImageFromReference(
        prompt,
        input.attachedAssets.map((asset) => asset.absolutePath)
      )
    : await input.model.generateImage(prompt);

  if (!generatedImage?.path && !generatedImage?.url) {
    const workspace = await updateWorkspaceState({
      currentDraftId: currentDraft.id,
      currentDraft,
      lastUserIntent: plan.intent
    });
    return {
      answer: "我尝试生成图片，但图片模型没有返回可用图片。请检查图片模型配置或换一个生成要求。",
      currentDraft,
      workspace
    };
  }

  const updatedDraft: DraftRecord = {
    ...currentDraft,
    updatedAt: new Date().toISOString(),
    images: [...currentDraft.images, generatedImage]
  };
  const generatedAsset =
    generatedImage.path
      ? await saveAsset(
          createAssetRecord({
            kind: "generated",
            originalName: "agent-generated-image.png",
            absolutePath: generatedImage.path,
            mimeType: "image/png",
            size: 0,
            prompt,
            sourceAssetIds: input.attachedAssets.map((asset) => asset.id)
          })
        )
      : null;

  const workspace = await updateWorkspaceState({
    currentDraftId: updatedDraft.id,
    currentDraft: updatedDraft,
    selectedImageIds: generatedAsset ? uniqueIds([...existing.selectedImageIds, generatedAsset.id]) : existing.selectedImageIds,
    productImageIds: input.attachedAssets.length
      ? uniqueIds([...existing.productImageIds, ...input.attachedAssets.map((asset) => asset.id)])
      : existing.productImageIds,
    lastUserIntent: plan.intent
  });

  return {
    answer: `已为当前草稿生成 1 张新图片，并放入成果画布。\n标题：${updatedDraft.draft.title}`,
    currentDraft: updatedDraft,
    workspace
  };
}

async function maybeHandleGuardedPublishTurn(
  input: RunAgentTurnInput,
  plan: ReturnType<typeof createAgentPlan>
): Promise<Pick<AgentTurnResult, "answer" | "currentDraft" | "workspace"> | null> {
  if (plan.intent !== "prepare_publish" && plan.intent !== "schedule_publish") {
    return null;
  }

  const existing = await readWorkspaceState();
  const currentDraft = input.currentDraft ?? existing.currentDraft ?? null;
  if (!currentDraft) {
    const workspace = await updateWorkspaceState({ lastUserIntent: plan.intent });
    return {
      answer: "当前没有可发布的草稿。请先生成或选择一篇草稿，再让我准备发布。",
      currentDraft: undefined,
      workspace
    };
  }

  const allImages = currentDraft.images.flatMap((image) => [image.path, image.url].filter(Boolean) as string[]);
  const selectedByIndex =
    plan.selectedImageIndex && plan.selectedImageIndex > 0 ? allImages[plan.selectedImageIndex - 1] : undefined;
  const images = selectedByIndex ? [selectedByIndex] : allImages;
  if (!images.length) {
    const workspace = await updateWorkspaceState({
      currentDraftId: currentDraft.id,
      currentDraft,
      lastUserIntent: plan.intent
    });
    return {
      answer: "当前草稿还没有发布图片。请先上传、选择或生成至少一张图片，再让我准备发布。",
      currentDraft,
      workspace
    };
  }

  const scheduleAt = plan.intent === "schedule_publish" ? inferAgentScheduleAt(input.message) : undefined;
  if (plan.intent === "schedule_publish" && !scheduleAt) {
    const workspace = await updateWorkspaceState({
      currentDraftId: currentDraft.id,
      currentDraft,
      lastUserIntent: plan.intent
    });
    return {
      answer: "可以定时发布，但我需要一个明确的未来时间，例如 2026-05-22T20:00:00+08:00。",
      currentDraft,
      workspace
    };
  }

  const guardedPublish = await executeGuardedPublish({
    args: {
      title: currentDraft.draft.title,
      content: currentDraft.draft.content,
      tags: currentDraft.draft.tags,
      images,
      visibility: currentDraft.visibility || input.settings.defaultVisibility,
      scheduleAt
    },
    requestedBy: "chat",
    policy: {
      mode: input.settings.agentPublishPolicy ?? "review_required",
      confirmed: false
    },
    auditContext: {
      accountId: input.settings.activeAccountId,
      mcpUrl: input.settings.mcpUrl
    },
    publish: (args) => input.mcp.publishContent(args)
  });
  const workspace = await updateWorkspaceState({
    currentDraftId: currentDraft.id,
    currentDraft,
    lastUserIntent: plan.intent,
    publishPlan: guardedPublish.publishIntent
  });

  return {
    answer:
      guardedPublish.status === "awaiting_approval"
        ? `已准备好发布确认单，但还没有真实发布。\n标题：${currentDraft.draft.title}\n发布策略：需要确认`
        : guardedPublish.status === "published"
          ? `已完成发布。\n标题：${currentDraft.draft.title}`
          : guardedPublish.status === "scheduled"
            ? `已提交定时发布。\n标题：${currentDraft.draft.title}\n时间：${scheduleAt}`
        : `发布准备未通过安全检查。\n标题：${currentDraft.draft.title}\n原因：${guardedPublish.reasons.join("；")}`,
    currentDraft,
    workspace
  };
}

async function updateWorkspaceFromTurn({
  plan,
  currentDraft,
  result
}: {
  plan: ReturnType<typeof createAgentPlan>;
  currentDraft?: DraftRecord | null;
  result: ChatAgentResult;
}) {
  const existing = await readWorkspaceState();
  const nextDraft = result.currentDraft ?? currentDraft ?? existing.currentDraft ?? null;
  const workflowResult = result.workflowResult;

  return updateWorkspaceState({
    topic: plan.topic ?? existing.topic ?? workflowResult?.draft?.title,
    evidenceSummary: workflowResult?.researchSummary ?? existing.evidenceSummary,
    selectedSamples: workflowResult?.evidence ?? existing.selectedSamples,
    currentDraftId: nextDraft?.id ?? existing.currentDraftId,
    currentDraft: nextDraft,
    selectedImageIds: existing.selectedImageIds,
    productImageIds: existing.productImageIds,
    publishPlan: existing.publishPlan,
    lastUserIntent: plan.intent
  });
}

function buildAgentImagePrompt({
  message,
  draft,
  evidenceSummary
}: {
  message: string;
  draft: DraftRecord;
  evidenceSummary: unknown;
}): string {
  return [
    "Generate an original Xiaohongshu-ready image for the current post.",
    `User request: ${message}`,
    `Draft title: ${draft.draft.title}`,
    `Draft image prompt: ${draft.draft.imagePrompt}`,
    `Tags: ${draft.draft.tags.join(", ")}`,
    evidenceSummary ? `Evidence summary: ${JSON.stringify(evidenceSummary).slice(0, 1600)}` : "",
    "Do not copy competitor images. If product reference images are provided, preserve the product subject, package shape, label position, color, and material. Do not invent unreadable brand text, false logos, certifications, or exaggerated claims."
  ]
    .filter(Boolean)
    .join("\n\n");
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}
