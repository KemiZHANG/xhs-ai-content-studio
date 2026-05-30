import { runChatAgent, type ChatAgentResult } from "@/lib/chat/agent";
import { createAgentPlan } from "@/lib/agent/planner";
import { executeGuardedPublish } from "@/lib/agent/publishing";
import { buildEvidencePackWithViralKnowledge } from "@/lib/agent/evidence-builder";
import { inferAgentScheduleAt } from "@/lib/agent/schedule";
import { readWorkspaceState, resetWorkspaceState, updateWorkspaceState } from "@/lib/agent/state";
import { createAgentToolRegistry } from "@/lib/agent/tools/registry";
import { addTraceEvent, createAgentRun, createTrace, persistAgentTrace } from "@/lib/agent/trace";
import type {
  AgentPlan,
  AgentQuickAction,
  AgentResponseCard,
  AgentRuntimeContext,
  AgentToolTraceItem,
  AgentTurnResult,
  WorkspaceState
} from "@/lib/agent/types";
import { readPostProject, resetPostProject, updatePostProject } from "@/lib/post-project/store";
import { copyVersionFromDraft, deriveCreativeBrief, deriveFinalPost, deriveImagePromptVersion, deriveVisualDirection } from "@/lib/post-project/brief";
import { buildEvidenceCitationReport, formatEvidenceCitationReport } from "@/lib/post-project/citations";
import { insightsFromUserBriefInput, mergeEvidenceInsights } from "@/lib/post-project/evidence";
import { getPostStageGuidance } from "@/lib/post-project/guidance";
import { buildPostReadinessReport } from "@/lib/post-project/readiness";
import { runPostQualityGate } from "@/lib/post-project/quality";
import type { PostAction, PostProject, ProductInfo } from "@/lib/post-project/types";
import { renderXhsCardSet } from "@/lib/cards/renderer";
import type { ModelProvider } from "@/lib/models/provider";
import { createAssetRecord, getAsset, saveAsset } from "@/lib/storage/assets";
import { createDraftRecord, type DraftRecord } from "@/lib/storage/drafts";
import { summarizeViralRetrievalFilters, type ViralKnowledgePack } from "@/lib/rag/viral";
import type { GeneratedDraft, XhsMcpWorkflowClient } from "@/lib/workflows/one-click";

export type RunAgentTurnInput = AgentRuntimeContext & {
  message: string;
  conversationId?: string | null;
  mcp: XhsMcpWorkflowClient;
  model: ModelProvider;
  runChatAgentImpl?: typeof runChatAgent;
};

export async function runAgentTurn(input: RunAgentTurnInput): Promise<AgentTurnResult> {
  const initialPostProject = await readPostProject();
  const plan = createAgentPlan({
    message: input.message,
    hasCurrentDraft: Boolean(input.currentDraft),
    attachedAssetCount: input.attachedAssets.length,
    postStage: initialPostProject.currentStage,
    allowedActions: initialPostProject.allowedActions,
    hasEvidence: Boolean(initialPostProject.evidencePack.insights.length || initialPostProject.selectedSamples.length),
    hasCreativeBrief: Boolean(initialPostProject.creativeBrief),
    hasSelectedImages: Boolean(initialPostProject.selectedImages.length)
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
    const newProjectTurn = await maybeHandleNewProjectTurn(input, plan, initialPostProject);
    if (newProjectTurn) {
      trace = addTraceEvent(trace, {
        type: "tool_called",
        label: "project.startProject",
        detail: "Reset the active PostProject and workspace before starting a new post.",
        metadata: {
          stage: newProjectTurn.postProject.currentStage,
          topic: newProjectTurn.postProject.topic
        }
      });
      trace = addTraceEvent(trace, {
        type: "workspace_updated",
        label: "Workspace reset",
        detail: "Cleared previous evidence, draft, images, and publish plan for a clean project."
      });
      agentRun = completeRun(agentRun);
      trace = addTraceEvent(trace, {
        type: "run_completed",
        label: "Agent run completed",
        detail: "Agent turn completed after starting a clean PostProject."
      });
      await persistAgentTrace(trace);
      return buildAgentTurnResult({
        answer: newProjectTurn.answer,
        plan,
        workspace: newProjectTurn.workspace,
        currentDraft: undefined,
        agentRun,
        trace,
        postProject: newProjectTurn.postProject
      });
    }

    const briefUpdateTurn = await maybeHandleBriefUpdateTurn(input, plan, initialPostProject);
    if (briefUpdateTurn) {
      trace = addTraceEvent(trace, {
        type: "tool_called",
        label: "postProject.updateBriefInputs",
        detail: "Extracted project brief fields from the user's natural-language message.",
        metadata: {
          stage: briefUpdateTurn.postProject.currentStage,
          topic: briefUpdateTurn.postProject.topic
        }
      });
      trace = addTraceEvent(trace, {
        type: "workspace_updated",
        label: "Workspace updated",
        detail: "Updated the active PostProject brief slots and workspace topic."
      });
      agentRun = completeRun(agentRun);
      trace = addTraceEvent(trace, {
        type: "run_completed",
        label: "Agent run completed",
        detail: "Agent turn completed after updating project brief inputs."
      });
      await persistAgentTrace(trace);
      return buildAgentTurnResult({
        answer: briefUpdateTurn.answer,
        plan,
        workspace: briefUpdateTurn.workspace,
        currentDraft: input.currentDraft ?? undefined,
        agentRun,
        trace,
        postProject: briefUpdateTurn.postProject
      });
    }

    const clarifyingTurn = await maybeHandleClarifyingTurn(input, plan);
    if (clarifyingTurn) {
      trace = addTraceEvent(trace, {
        type: "tool_completed",
        label: "agent.askClarifyingQuestion",
        detail: "Stopped before tool execution because the request needs clearer project input.",
        metadata: {
          questions: clarifyingTurn.questions
        }
      });
      agentRun = completeRun(agentRun);
      trace = addTraceEvent(trace, {
        type: "run_completed",
        label: "Agent run completed",
        detail: "Agent turn completed after asking clarifying questions."
      });
      await persistAgentTrace(trace);
      const postProject = await readPostProject();

      return buildAgentTurnResult({
        answer: clarifyingTurn.answer,
        plan,
        workspace: clarifyingTurn.workspace,
        currentDraft: input.currentDraft ?? undefined,
        agentRun,
        trace,
        postProject
      });
    }

    const viralKnowledgeTurn = await maybeHandleViralKnowledgeTurn(input, plan, initialPostProject);
    if (viralKnowledgeTurn) {
      trace = addTraceEvent(trace, {
        type: "tool_called",
        label: "knowledge.retrieveViralPatterns",
        detail: "Retrieved reusable viral-library patterns and merged them into the active PostProject evidencePack.",
        metadata: {
          viralInsightCount: viralKnowledgeTurn.postProject.evidencePack.insights.filter((insight) => insight.sourceType === "viral_library").length
        }
      });
      trace = addTraceEvent(trace, {
        type: "tool_completed",
        label: "knowledge.retrieveViralPatterns",
        detail: "Viral-library RAG retrieval completed with source-tagged evidence insights.",
        metadata: {
          viralInsightIds: viralKnowledgeTurn.postProject.evidencePack.insights
            .filter((insight) => insight.sourceType === "viral_library")
            .map((insight) => insight.id)
            .slice(0, 8)
        }
      });
      trace = addTraceEvent(trace, {
        type: "workspace_updated",
        label: "Workspace updated",
        detail: "Stored viral-library RAG evidence on the active workspace canvas."
      });
      agentRun = completeRun(agentRun);
      trace = addTraceEvent(trace, {
        type: "run_completed",
        label: "Agent run completed",
        detail: "Agent turn completed after refreshing viral-library evidence."
      });
      await persistAgentTrace(trace);
      return buildAgentTurnResult({
        answer: viralKnowledgeTurn.answer,
        plan,
        workspace: viralKnowledgeTurn.workspace,
        currentDraft: input.currentDraft ?? undefined,
        agentRun,
        trace,
        postProject: viralKnowledgeTurn.postProject
      });
    }

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
      agentRun = completeRun(agentRun);
      trace = addTraceEvent(trace, {
        type: "run_completed",
        label: "Agent run completed",
        detail: "Agent turn completed after rendering card images."
      });
      await persistAgentTrace(trace);
      const postProject = await readPostProject();

      return buildAgentTurnResult({
        answer: cardGenerationTurn.answer,
        plan,
        workspace: cardGenerationTurn.workspace,
        currentDraft: cardGenerationTurn.currentDraft,
        agentRun,
        trace,
        postProject
      });
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
      agentRun = completeRun(agentRun);
      trace = addTraceEvent(trace, {
        type: "run_completed",
        label: "Agent run completed",
        detail: "Agent turn completed after generating images."
      });
      await persistAgentTrace(trace);
      const postProject = await readPostProject();

      return buildAgentTurnResult({
        answer: imageGenerationTurn.answer,
        plan,
        workspace: imageGenerationTurn.workspace,
        currentDraft: imageGenerationTurn.currentDraft,
        agentRun,
        trace,
        postProject
      });
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
      agentRun = completeRun(agentRun);
      trace = addTraceEvent(trace, {
        type: "run_completed",
        label: "Agent run completed",
        detail: "Agent turn completed after preparing a publish intent."
      });
      await persistAgentTrace(trace);
      const postProject = await readPostProject();

      return buildAgentTurnResult({
        answer: guardedPublishTurn.answer,
        plan,
        workspace: guardedPublishTurn.workspace,
        currentDraft: guardedPublishTurn.currentDraft,
        agentRun,
        trace,
        postProject
      });
    }

    const imageSelectionTurn = await maybeHandleImageSelectionTurn(input, plan, initialPostProject);
    if (imageSelectionTurn) {
      trace = addTraceEvent(trace, {
        type: "tool_called",
        label: "project.selectImages",
        detail: "Selected image candidates on the active PostProject canvas.",
        metadata: {
          selectedImageIds: imageSelectionTurn.workspace.selectedImageIds
        }
      });
      trace = addTraceEvent(trace, {
        type: "workspace_updated",
        label: "Workspace updated",
        detail: "Stored selected image ids on workspace and PostProject."
      });
      agentRun = completeRun(agentRun);
      trace = addTraceEvent(trace, {
        type: "run_completed",
        label: "Agent run completed",
        detail: "Agent turn completed after selecting images."
      });
      await persistAgentTrace(trace);
      return buildAgentTurnResult({
        answer: imageSelectionTurn.answer,
        plan,
        workspace: imageSelectionTurn.workspace,
        currentDraft: input.currentDraft ?? imageSelectionTurn.workspace.currentDraft ?? undefined,
        agentRun,
        trace,
        postProject: imageSelectionTurn.postProject
      });
    }

    const qualityCheckTurn = await maybeHandleQualityCheckTurn(input, plan, initialPostProject);
    if (qualityCheckTurn) {
      trace = addTraceEvent(trace, {
        type: "tool_called",
        label: "project.runQualityGate",
        detail: "Assembled the active PostProject final post and ran Quality Gate.",
        metadata: {
          canPublish: qualityCheckTurn.postProject.qualityCheck?.canPublish,
          issues: qualityCheckTurn.postProject.qualityCheck?.issues
        }
      });
      trace = addTraceEvent(trace, {
        type: "workspace_updated",
        label: "Workspace updated",
        detail: "Stored finalPost and qualityCheck on the active PostProject."
      });
      agentRun = completeRun(agentRun);
      trace = addTraceEvent(trace, {
        type: "run_completed",
        label: "Agent run completed",
        detail: "Agent turn completed after Quality Gate."
      });
      await persistAgentTrace(trace);
      return buildAgentTurnResult({
        answer: qualityCheckTurn.answer,
        plan,
        workspace: qualityCheckTurn.workspace,
        currentDraft: qualityCheckTurn.postProject.copyDraft ?? input.currentDraft ?? undefined,
        agentRun,
        trace,
        postProject: qualityCheckTurn.postProject
      });
    }

    const draftFromProjectTurn = await maybeHandleDraftFromProjectTurn(input, plan, initialPostProject);
    if (draftFromProjectTurn) {
      trace = addTraceEvent(trace, {
        type: "tool_called",
        label: "draft.createFromEvidence",
        detail: "Generated a copy draft from the active PostProject, CreativeBrief, and evidencePack.",
        metadata: {
          stage: draftFromProjectTurn.postProject.currentStage,
          basedOnEvidenceIds: draftFromProjectTurn.currentDraft?.draft.basedOnEvidenceIds
        }
      });
      trace = addTraceEvent(trace, {
        type: "workspace_updated",
        label: "Workspace updated",
        detail: "Stored the generated draft on the active PostProject and workspace canvas.",
        metadata: {
          currentDraftId: draftFromProjectTurn.workspace.currentDraftId
        }
      });
      agentRun = completeRun(agentRun);
      trace = addTraceEvent(trace, {
        type: "run_completed",
        label: "Agent run completed",
        detail: "Agent turn completed after generating a PostProject draft."
      });
      await persistAgentTrace(trace);
      return buildAgentTurnResult({
        answer: draftFromProjectTurn.answer,
        plan,
        workspace: draftFromProjectTurn.workspace,
        currentDraft: draftFromProjectTurn.currentDraft,
        agentRun,
        trace,
        postProject: draftFromProjectTurn.postProject
      });
    }

    const visualPlanningTurn = await maybeHandleVisualPlanningTurn(input, plan, initialPostProject);
    if (visualPlanningTurn) {
      trace = addTraceEvent(trace, {
        type: "tool_called",
        label: "workflow.planVisuals",
        detail: "Planned image direction from the active PostProject CreativeBrief.",
        metadata: {
          stage: visualPlanningTurn.postProject.currentStage
        }
      });
      agentRun = completeRun(agentRun);
      trace = addTraceEvent(trace, {
        type: "run_completed",
        label: "Agent run completed",
        detail: "Agent turn completed after visual planning."
      });
      await persistAgentTrace(trace);
      return buildAgentTurnResult({
        answer: visualPlanningTurn.answer,
        plan,
        workspace: visualPlanningTurn.workspace,
        currentDraft: input.currentDraft ?? undefined,
        agentRun,
        trace,
        postProject: visualPlanningTurn.postProject
      });
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

    let postProject = await readPostProject();
    if (plan.steps.some((step) => step.action === "retrieveViralKnowledge")) {
      const ragFilterSummary = formatRagFiltersSummary(plan.ragFilters);
      postProject = await ensureViralEvidenceForProject(postProject, {
        force: Boolean(plan.ragFilters),
        filters: plan.ragFilters
      });
      trace = addTraceEvent(trace, {
        type: "tool_called",
        label: "knowledge.retrieveViralPatterns",
        detail: [
          "Refreshed viral-library RAG evidence after the legacy research workflow.",
          ragFilterSummary ? `Filters: ${ragFilterSummary}` : ""
        ].filter(Boolean).join(" "),
        metadata: {
          filters: plan.ragFilters,
          viralInsightCount: postProject.evidencePack.insights.filter((insight) => insight.sourceType === "viral_library").length
        }
      });
    }
    agentRun = completeRun(agentRun);
    trace = addTraceEvent(trace, {
      type: "run_completed",
      label: "Agent run completed",
      detail: "Agent turn completed successfully."
    });
    await persistAgentTrace(trace);

    return {
      ...legacyResult,
      ...buildAgentTurnResult({
        answer: appendRagFilterSummaryToAnswer(legacyResult.answer, plan.ragFilters),
        plan,
        workspace,
        currentDraft: legacyResult.currentDraft ?? input.currentDraft ?? undefined,
        agentRun,
        trace,
        postProject
      })
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

function completeRun<T extends { status: string; updatedAt: string }>(run: T): T {
  return {
    ...run,
    status: "completed",
    updatedAt: new Date().toISOString()
  };
}

function buildAgentTurnResult({
  answer,
  plan,
  workspace,
  currentDraft,
  agentRun,
  trace,
  postProject
}: {
  answer: string;
  plan: AgentPlan;
  workspace: WorkspaceState;
  currentDraft?: DraftRecord | null;
  agentRun: AgentTurnResult["agentRun"];
  trace: AgentTurnResult["trace"];
  postProject?: PostProject | null;
}): AgentTurnResult {
  const cards = buildCardsFromTurn(workspace, currentDraft, postProject, plan);
  const evidenceAwareAnswer = appendEvidenceReferenceNote(answer, plan, postProject);
  const structured = buildStructuredAgentResponse({
    answer: evidenceAwareAnswer,
    plan,
    workspace,
    postProject,
    cards,
    traceItems: buildToolTraceItems(trace)
  });
  return {
    ...structured,
    currentDraft: currentDraft ?? undefined,
    agentRun,
    trace,
    workspace,
    postProject: postProject ?? undefined
  };
}

function appendEvidenceReferenceNote(answer: string, plan: AgentPlan, postProject?: PostProject | null): string {
  if (!shouldAppendEvidenceReference(plan)) {
    return answer;
  }
  const insights = (postProject?.evidencePack.insights ?? [])
    .filter((insight) => insight.insight.trim())
    .slice(0, 5);
  if (!insights.length || answer.includes("参考证据")) {
    return answer;
  }
  const note = insights
    .map((insight) => `- ${insight.id}｜${labelForEvidenceSource(insight.sourceType)}｜${insight.type}: ${insight.insight}`)
    .join("\n");
  return `${answer}\n\n参考证据：\n${note}`;
}

function shouldAppendEvidenceReference(plan: AgentPlan): boolean {
  if (plan.intent === "ask") {
    return false;
  }
  if (plan.intent !== "answer") {
    return true;
  }
  return plan.steps.some((step) => {
    if (["generateDraft", "summarizeEvidence", "runQualityGate", "assemblePost", "generateImages", "generateCards"].includes(step.action)) {
      return true;
    }
    return /evidence|CreativeBrief|visual|image prompt|draft|quality gate|证据|图片方向|文案|草稿/i.test(step.reason);
  });
}

function labelForEvidenceSource(sourceType?: string): string {
  if (sourceType === "viral_library") return "爆款库";
  if (sourceType === "user_input") return "用户输入";
  return "实时研究";
}

function buildStructuredAgentResponse({
  answer,
  plan,
  workspace,
  postProject,
  cards,
  traceItems
}: {
  answer: string;
  plan: AgentPlan;
  workspace: WorkspaceState;
  postProject?: PostProject | null;
  cards: AgentResponseCard[];
  traceItems: AgentToolTraceItem[];
}): Pick<
  AgentTurnResult,
  "answer" | "reply" | "stage" | "intent" | "intentConfidence" | "needsUserInput" | "questions" | "workspacePatch" | "cards" | "quickActions" | "toolTrace"
> {
  const needsUserInput = plan.intent === "ask" || plan.steps.some((step) => step.action === "askClarifyingQuestion");
  const questions = needsUserInput ? buildClarifyingQuestions(plan, workspace, postProject) : [];

  return {
    answer,
    reply: answer,
    stage: workspace.publishPlan ? inferStageFromWorkspace(workspace) : postProject?.currentStage ?? inferStageFromWorkspace(workspace),
    intent: plan.intent,
    intentConfidence: inferIntentConfidence(plan, workspace),
    needsUserInput,
    questions,
    workspacePatch: {
      topic: workspace.topic,
      researchRunId: workspace.researchRunId,
      currentDraftId: workspace.currentDraftId,
      selectedImageIds: workspace.selectedImageIds,
      lastUserIntent: plan.intent
    },
    cards,
    quickActions: buildQuickActions(plan, workspace, postProject),
    toolTrace: traceItems
  };
}

async function maybeHandleClarifyingTurn(
  input: RunAgentTurnInput,
  plan: ReturnType<typeof createAgentPlan>
): Promise<{ answer: string; questions: string[]; workspace: WorkspaceState } | null> {
  if (plan.intent !== "ask" && !plan.steps.some((step) => step.action === "askClarifyingQuestion")) {
    return null;
  }

  const workspace = await updateWorkspaceState({
    topic: plan.topic,
    lastUserIntent: plan.intent
  });
  const postProject = await readPostProject();
  const questions = buildClarifyingQuestions(plan, workspace, postProject);
  return {
    answer: [
      "我先不急着执行工具，当前信息还不够明确。",
      "为了避免搜错主题、生成跑偏，先补充下面这些信息即可：",
      ...questions.map((question, index) => `${index + 1}. ${question}`)
    ].join("\n"),
    questions,
    workspace
  };
}

function buildClarifyingQuestions(plan: AgentPlan, workspace: WorkspaceState, postProject?: PostProject | null): string[] {
  const questions: string[] = [];
  if (isPublishWithoutDraftPlan(plan, workspace, postProject)) {
    questions.push("当前还没有可发布的草稿或最终帖子。请先生成文案并选择图片，或告诉我用哪一篇草稿发布。");
    questions.push("发布前你希望先做哪一步：生成文案、选择图片、组装最终帖子，还是重新研究主题？");
    return questions;
  }
  if (plan.requiresAssets) {
    questions.push("请先上传产品图/参考图，或说明可以不基于图片直接生成。");
  }
  if (!plan.topic && !workspace.topic && !postProject?.topic) {
    questions.push("这次要研究或创作的具体主题是什么？例如：广州咖啡馆、通勤包、护肤新品。");
  }
  if (!postProject?.targetAudience && !workspace.currentDraft) {
    questions.push("目标人群是谁？例如：探店账号粉丝、上班族、新手妈妈、学生党。");
  }
  if (!postProject?.goal && !workspace.currentDraft) {
    questions.push("这篇笔记的目标是什么？例如：探店种草、产品介绍、避坑清单、引导咨询。");
  }
  if (!questions.length) {
    questions.push("你希望我下一步做什么：继续研究、生成文案、规划图片，还是进入发布检查？");
  }
  return questions.slice(0, 4);
}

function isPublishWithoutDraftPlan(plan: AgentPlan, workspace: WorkspaceState, postProject?: PostProject | null): boolean {
  const asksPublishWithoutDraft = plan.intent === "ask" && plan.steps.some((step) =>
    step.action === "askClarifyingQuestion" && /publish|current draft|assembled post/i.test(step.reason)
  );
  if (!asksPublishWithoutDraft) return false;
  return !workspace.currentDraft && !postProject?.copyDraft && !postProject?.finalPost;
}

async function maybeHandleNewProjectTurn(
  input: RunAgentTurnInput,
  plan: ReturnType<typeof createAgentPlan>,
  postProject: PostProject
): Promise<{ answer: string; workspace: WorkspaceState; postProject: PostProject } | null> {
  if (plan.intent !== "start_project") {
    return null;
  }

  const patch = parseBriefPatch(input.message, postProject);
  const referenceAssetIds = input.attachedAssets.map((asset) => asset.id);
  const productInfo: ProductInfo = {
    referenceAssetIds,
    name: patch.productInfo?.name,
    sellingPoints: patch.productInfo?.sellingPoints,
    scene: patch.productInfo?.scene
  };
  const userInsights = insightsFromUserBriefInput({
    topic: patch.topic ?? plan.topic,
    targetAudience: patch.targetAudience,
    goal: patch.goal,
    tone: patch.tone,
    productInfo
  });
  const projectCandidate = await resetPostProject({
    topic: patch.topic ?? plan.topic,
    targetAudience: patch.targetAudience,
    goal: patch.goal,
    tone: patch.tone,
    productInfo,
    evidencePack: {
      sampleIds: userInsights.length ? ["user-brief"] : [],
      insights: userInsights,
      updatedAt: new Date().toISOString()
    },
    selectedSamples: [],
    copyDraft: null,
    copyVersions: [],
    generatedImages: [],
    selectedImages: [],
    publishPlan: null,
    auditStatus: "unchecked",
    currentStage: "briefing"
  });
  const creativeBrief = deriveCreativeBrief(projectCandidate);
  const updatedProject = await updatePostProject({
    creativeBrief,
    currentStage: creativeBrief ? "brief_ready" : "briefing",
    visualDirection: undefined,
    imagePrompts: [],
    finalPost: undefined,
    qualityCheck: undefined,
    auditStatus: "unchecked"
  });
  const workspace = await resetWorkspaceState({
    topic: updatedProject.topic,
    productImageIds: referenceAssetIds,
    selectedImageIds: [],
    selectedSamples: [],
    currentDraft: null,
    publishPlan: null,
    lastUserIntent: plan.intent
  });
  const missing = buildMissingBriefSlots(updatedProject);
  return {
    answer: [
      "已新建一个干净的 PostProject，并清空上一轮的证据、草稿、图片选择和发布计划。",
      formatBriefPatchSummary(updatedProject),
      referenceAssetIds.length ? `已带入 ${referenceAssetIds.length} 张上传图片作为产品/参考图。` : "",
      missing.length ? `下一步建议补充：${missing.join("、")}。` : "当前信息已经可以继续做实时研究、爆款库检索、文案生成或图片规划。",
      "你现在可以直接说：按这个主题找最近一周高收藏笔记，或基于当前信息生成文案。"
    ].filter(Boolean).join("\n"),
    workspace,
    postProject: updatedProject
  };
}

async function maybeHandleBriefUpdateTurn(
  input: RunAgentTurnInput,
  plan: ReturnType<typeof createAgentPlan>,
  postProject: PostProject
): Promise<{ answer: string; workspace: WorkspaceState; postProject: PostProject } | null> {
  const patch = parseBriefPatch(input.message, postProject);
  if (!patch.hasUpdate) {
    return null;
  }

  const nextProjectCandidate: PostProject = {
    ...postProject,
    topic: patch.topic ?? postProject.topic,
    targetAudience: patch.targetAudience ?? postProject.targetAudience,
    goal: patch.goal ?? postProject.goal,
    tone: patch.tone ?? postProject.tone,
    productInfo: patch.productInfo ?? postProject.productInfo,
    evidencePack: {
      ...postProject.evidencePack,
      sampleIds: postProject.evidencePack.sampleIds.includes("user-brief")
        ? postProject.evidencePack.sampleIds
        : [...postProject.evidencePack.sampleIds, "user-brief"],
      insights: mergeEvidenceInsights(postProject.evidencePack.insights.filter((insight) => insight.sourceType !== "user_input"), insightsFromUserBriefInput({
        topic: patch.topic ?? postProject.topic,
        targetAudience: patch.targetAudience ?? postProject.targetAudience,
        goal: patch.goal ?? postProject.goal,
        tone: patch.tone ?? postProject.tone,
        productInfo: patch.productInfo ?? postProject.productInfo
      })),
      updatedAt: new Date().toISOString()
    },
    creativeBrief: undefined,
    visualDirection: undefined,
    qualityCheck: undefined,
    auditStatus: "unchecked",
    currentStage: "briefing"
  };
  const creativeBrief = deriveCreativeBrief(nextProjectCandidate);
  const updatedProject = await updatePostProject({
    topic: nextProjectCandidate.topic,
    targetAudience: nextProjectCandidate.targetAudience,
    goal: nextProjectCandidate.goal,
    tone: nextProjectCandidate.tone,
    productInfo: nextProjectCandidate.productInfo,
    evidencePack: nextProjectCandidate.evidencePack,
    creativeBrief,
    visualDirection: undefined,
    imagePrompts: [],
    finalPost: undefined,
    qualityCheck: undefined,
    auditStatus: "unchecked",
    currentStage: creativeBrief ? "brief_ready" : "briefing"
  });
  const workspace = await updateWorkspaceState({
    topic: updatedProject.topic,
    productImageIds: updatedProject.productInfo.referenceAssetIds,
    lastUserIntent: "update_brief_inputs"
  });
  const missing = buildMissingBriefSlots(updatedProject);
  return {
    answer: [
      "已把你的补充需求写入当前 PostProject，并刷新 CreativeBrief。",
      formatBriefPatchSummary(updatedProject),
      missing.length ? `还建议补充：${missing.join("、")}。` : "需求信息已经足够进入研究、文案生成或图片方向规划。",
      creativeBrief ? `当前内容角度：${creativeBrief.contentAngle}` : ""
    ].filter(Boolean).join("\n"),
    workspace,
    postProject: updatedProject
  };
}

function parseBriefPatch(message: string, current: PostProject): {
  hasUpdate: boolean;
  topic?: string;
  targetAudience?: string;
  goal?: string;
  tone?: string;
  productInfo?: ProductInfo;
} {
  const topic = cleanSlotValue(
    extractSlot(message, ["主题", "选题", "帖子主题", "笔记主题"]) ??
      (/新建|开始|做一个|做一篇|我要写|我想写/.test(message) ? inferLooseTopic(message) : undefined)
  );
  const targetAudience = cleanSlotValue(extractSlot(message, ["目标人群", "受众", "面向人群", "适合人群", "用户人群"]));
  const goal = cleanSlotValue(extractSlot(message, ["内容目标", "目标", "目的", "创作目标", "发布目标"]));
  const tone = cleanSlotValue(extractSlot(message, ["语气", "风格", "调性", "口吻", "表达"]));
  const product = cleanSlotValue(extractSlot(message, ["产品", "产品信息", "店铺", "店铺信息", "品牌", "商品"]));
  const sellingPoints = cleanSlotValue(extractSlot(message, ["卖点", "核心卖点", "优势", "亮点"]));
  const scene = cleanSlotValue(extractSlot(message, ["场景", "使用场景", "拍摄场景", "应用场景"]));
  const hasProductUpdate = Boolean(product || sellingPoints || scene);
  const productInfo = hasProductUpdate
    ? {
        ...current.productInfo,
        name: product ?? current.productInfo.name,
        sellingPoints: sellingPoints ?? current.productInfo.sellingPoints,
        scene: scene ?? current.productInfo.scene,
        referenceAssetIds: current.productInfo.referenceAssetIds
      }
    : undefined;
  const hasExplicitBriefKeyword = /主题|选题|目标人群|受众|内容目标|创作目标|语气|风格|调性|产品|店铺|卖点|场景/.test(message);
  const hasUpdate = Boolean(hasExplicitBriefKeyword && (topic || targetAudience || goal || tone || productInfo));
  return {
    hasUpdate,
    topic,
    targetAudience,
    goal,
    tone,
    productInfo
  };
}

function extractSlot(message: string, labels: string[]): string | undefined {
  for (const label of [...labels].sort((a, b) => b.length - a.length)) {
    const pattern = new RegExp(`${label}\\s*(?:希望|想要|是|为|:|：)?\\s*([^。！？!?\n；;]+)`);
    const match = message.match(pattern);
    if (match?.[1]) {
      return stopAtNextSlot(match[1]);
    }
  }
  return undefined;
}

function stopAtNextSlot(value: string): string {
  const nextSlot = value.search(/(?:主题|选题|目标人群|受众|内容目标|创作目标|语气|风格|调性|产品|店铺|卖点|场景)\s*(?:希望|想要|是|为|:|：)?/);
  return (nextSlot > 0 ? value.slice(0, nextSlot) : value).trim();
}

function inferLooseTopic(message: string): string | undefined {
  const match = message.match(/(?:我要写|我想写|新建|开始|做一个|做一篇)\s*([^，。！？!?；;\n]{2,28})(?:笔记|帖子|图文|内容|项目)?/);
  return match?.[1];
}

function cleanSlotValue(value?: string): string | undefined {
  const cleaned = value
    ?.replace(/^(一个|一篇|关于|小红书|笔记|帖子|图文)/, "")
    .replace(/[，,、]+$/, "")
    .trim();
  return cleaned || undefined;
}

function buildMissingBriefSlots(project: PostProject): string[] {
  const missing: string[] = [];
  if (!project.topic) missing.push("主题");
  if (!project.targetAudience) missing.push("目标人群");
  if (!project.goal) missing.push("内容目标");
  if (!project.tone) missing.push("语气风格");
  if (!project.productInfo.name && !project.productInfo.sellingPoints) missing.push("产品/店铺信息");
  return missing.slice(0, 4);
}

function formatBriefPatchSummary(project: PostProject): string {
  return [
    `主题：${project.topic ?? "未填写"}`,
    `人群：${project.targetAudience ?? "未填写"}`,
    `目标：${project.goal ?? "未填写"}`,
    `语气：${project.tone ?? "未填写"}`,
    project.productInfo.name ? `产品/店铺：${project.productInfo.name}` : ""
  ].filter(Boolean).join("\n");
}

async function maybeHandleViralKnowledgeTurn(
  input: RunAgentTurnInput,
  plan: ReturnType<typeof createAgentPlan>,
  postProject: PostProject
): Promise<{ answer: string; workspace: WorkspaceState; postProject: PostProject } | null> {
  if (plan.intent !== "retrieve_viral_knowledge") {
    return null;
  }
  const topic = postProject.topic ?? plan.topic;
  if (!topic) {
    const workspace = await updateWorkspaceState({ lastUserIntent: "retrieve_viral_knowledge" });
    return {
      answer: "我可以检索爆款库，但当前 PostProject 还没有主题。请先告诉我这篇笔记的主题、产品或目标人群，再刷新爆款库证据。",
      workspace,
      postProject
    };
  }

  const seededProject = postProject.topic ? postProject : await updatePostProject({ topic });
  const updatedProject = await ensureViralEvidenceForProject(seededProject, { force: true, filters: plan.ragFilters });
  const viralInsights = updatedProject.evidencePack.insights.filter((insight) => insight.sourceType === "viral_library");
  const topInsights = viralInsights.slice(0, 5);
  const workspace = await updateWorkspaceState({
    topic: updatedProject.topic,
    evidenceSummary: updatedProject.evidencePack.summary,
    selectedSamples: updatedProject.selectedSamples,
    lastUserIntent: "retrieve_viral_knowledge"
  });

  return {
    answer: [
      `已基于「${topic}」刷新爆款库 RAG 证据，并合入当前 PostProject。`,
      plan.ragFilters ? `本次筛选条件：${formatRagFiltersSummary(plan.ragFilters)}` : "",
      viralInsights.length
        ? `当前共有 ${viralInsights.length} 条爆款库规律，可用于 CreativeBrief、文案和图片方向。`
        : "暂时没有检索到足够匹配的历史爆款规律，可以继续做实时小红书研究，或先把优秀样本保存进爆款库。",
      ...topInsights.map((insight, index) => `${index + 1}. ${insight.type}｜${insight.insight}（${insight.id}）`),
      updatedProject.creativeBrief ? `CreativeBrief 已同步参考这些证据：${updatedProject.creativeBrief.basedOnEvidenceIds.slice(0, 5).join("、")}` : ""
    ].filter(Boolean).join("\n"),
    workspace,
    postProject: updatedProject
  };
}

function appendRagFilterSummaryToAnswer(answer: string, filters: ReturnType<typeof createAgentPlan>["ragFilters"]): string {
  const summary = formatRagFiltersSummary(filters);
  if (!summary || answer.includes("爆款库筛选条件")) {
    return answer;
  }
  return `${answer}\n\n爆款库筛选条件：${summary}`;
}

function formatRagFiltersSummary(filters: ReturnType<typeof createAgentPlan>["ragFilters"]): string {
  return summarizeViralRetrievalFilters(filters);
}

function buildCardsFromTurn(
  workspace: WorkspaceState,
  currentDraft?: DraftRecord | null,
  postProject?: PostProject | null,
  plan?: AgentPlan
): AgentResponseCard[] {
  const cards: AgentResponseCard[] = [];
  if (postProject) {
    const guidance = getPostStageGuidance(postProject.currentStage, postProject.allowedActions);
    const readiness = buildPostReadinessReport(postProject);
    cards.push({
      id: "card-stage-guidance",
      type: "stage_guidance",
      title: guidance.title,
      summary: `${guidance.description} 下一步：${postProject.allowedActions.slice(0, 3).map((action) => postActionLabels[action] ?? action).join(" / ") || "等待补充信息"}`,
      data: {
        stage: postProject.currentStage,
        allowedActions: postProject.allowedActions,
        primaryAction: readiness.nextAction ?? guidance.primaryAction,
        readiness
      }
    });
  }
  if (workspace.evidenceSummary || workspace.selectedSamples.length) {
    const viralKnowledge = isRecord(workspace.evidenceSummary) ? workspace.evidenceSummary.viralKnowledge : undefined;
    cards.push({
      id: "card-evidence-summary",
      type: "evidence_summary",
      title: "研究证据摘要",
      summary: `已沉淀 ${workspace.selectedSamples.length} 条样本和研究结论。`,
      data: workspace.evidenceSummary
    });
    if (isRecord(viralKnowledge) && Array.isArray(viralKnowledge.results) && viralKnowledge.results.length) {
      cards.push({
        id: "card-viral-knowledge",
        type: "viral_knowledge",
        title: "爆款库规律",
        summary: `已检索 ${viralKnowledge.results.length} 条历史爆款规律，用于补充实时证据。`,
        data: viralKnowledge
      });
    }
  }
  const viralStrategy = extractViralStrategyReport(workspace.evidenceSummary);
  if (viralStrategy) {
    cards.push({
      id: "card-viral-strategy",
      type: "viral_knowledge",
      title: "爆款策略",
      summary: viralStrategy.summary,
      data: viralStrategy
    });
  }
  if (postProject?.creativeBrief) {
    cards.push({
      id: "card-creative-brief",
      type: "creative_brief",
      title: "CreativeBrief",
      summary: `${postProject.creativeBrief.contentAngle} · ${postProject.creativeBrief.tone}`,
      data: postProject.creativeBrief
    });
  }

  const draft = currentDraft ?? workspace.currentDraft;
  if (draft) {
    const citationReport =
      postProject
        ? buildEvidenceCitationReport(postProject, draft.draft.basedOnEvidenceIds ?? postProject.creativeBrief?.basedOnEvidenceIds ?? [], draft.draft.evidenceReferences)
        : null;
    cards.push({
      id: "card-copy-draft",
      type: "copy_draft",
      title: draft.draft.title,
      summary: draft.draft.content.slice(0, 160),
      data: draft.draft
    });
    if (citationReport?.allEvidenceIds.length) {
      cards.push({
        id: "card-evidence-citations",
        type: "evidence_citations",
        title: "证据引用",
        summary: citationReport.summary,
        data: citationReport
      });
    }
    const imagePrompt = postProject?.imagePrompts.at(-1)?.value.prompt ?? draft.draft.imagePrompt;
    if (imagePrompt) {
      cards.push({
        id: "card-image-prompt",
        type: "image_prompt",
        title: "图片提示词",
        summary: imagePrompt,
        data: { imagePrompt }
      });
    }
  }
  if (postProject?.visualDirection) {
    cards.push({
      id: "card-visual-direction",
      type: "visual_direction",
      title: "视觉方向",
      summary: `${postProject.visualDirection.mood} · ${postProject.visualDirection.composition}`,
      data: postProject.visualDirection
    });
  }
  if (postProject?.qualityCheck) {
    cards.push({
      id: "card-quality-check",
      type: "quality_check",
      title: postProject.qualityCheck.canPublish ? "质量检查通过" : "质量检查需处理",
      summary: formatQualityCardSummary(postProject.qualityCheck),
      data: postProject.qualityCheck
    });
  }
  if (plan && isPublishWithoutDraftPlan(plan, workspace, postProject)) {
    cards.push({
      id: "card-publish-missing-draft",
      type: "publish_check",
      title: "发布前缺少草稿",
      summary: "当前还没有可发布的草稿或最终帖子。请先生成文案、选择图片并组装发布稿。",
      data: {
        blocked: true,
        missing: ["copyDraft", "finalPost"],
        nextActions: ["generate_copy", "select_images", "assemble_post"]
      }
    });
  }
  if (workspace.publishPlan) {
    cards.push({
      id: "card-publish-check",
      type: "publish_check",
      title: "发布确认",
      summary: `发布状态：${workspace.publishPlan.status}`,
      data: workspace.publishPlan
    });
  }
  return cards;
}

function extractViralStrategyReport(summary: unknown): {
  summary: string;
  recommendedAngles: string[];
  evidenceIds: string[];
} | null {
  const viralKnowledge = isRecord(summary) ? summary.viralKnowledge : undefined;
  const strategyReport = isRecord(viralKnowledge) ? viralKnowledge.strategyReport : undefined;
  if (!isRecord(strategyReport) || typeof strategyReport.summary !== "string") {
    return null;
  }
  return {
    summary: strategyReport.summary,
    recommendedAngles: stringArrayFromUnknown(strategyReport.recommendedAngles),
    evidenceIds: stringArrayFromUnknown(strategyReport.evidenceIds)
  };
}

function stringArrayFromUnknown(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
    : [];
}

function formatQualityCardSummary(qualityCheck: NonNullable<PostProject["qualityCheck"]>): string {
  const alignmentSummary = qualityCheck.evidenceAlignment
    ? `图文证据：${qualityCheck.evidenceAlignment.summary}`
    : "";
  const issueSummary = qualityCheck.issues.slice(0, 2).join("；");
  return [
    alignmentSummary,
    issueSummary || "发布前仍需人工确认账号、可见范围、图片版本和定时时间。"
  ].filter(Boolean).join("；");
}

const postActionLabels: Record<PostAction, string> = {
  start_brief: "补充创作信息",
  update_brief_inputs: "补充/修改需求",
  search_research: "搜索真实笔记",
  summarize_evidence: "总结证据优点",
  create_creative_brief: "生成创作 Brief",
  generate_copy: "生成文案",
  revise_copy: "修改当前文案",
  plan_visuals: "规划图片方向",
  generate_image_prompts: "生成图片提示词",
  generate_images: "生成配图",
  generate_cards: "生成图文卡片",
  select_images: "选择发布图片",
  assemble_post: "组装发布稿",
  run_quality_gate: "发布前检查",
  request_publish_confirmation: "确认发布",
  schedule_publish: "定时发布",
  publish_now: "立即发布",
  recover: "修复当前项目"
};

function actionToQuickAction(action: PostAction): AgentQuickAction {
  return {
    id: `qa-${action.replace(/_/g, "-")}`,
    label: postActionLabels[action],
    action
  };
}

function buildPostProjectQuickActions(postProject?: PostProject | null): AgentQuickAction[] {
  if (!postProject || postProject.currentStage === "empty") {
    return [];
  }
  const readiness = buildPostReadinessReport(postProject);
  const readinessActions = [
    readiness.nextAction,
    ...readiness.blockers.map((item) => item.action)
  ].filter((action): action is PostAction => Boolean(action));
  const preferred = [
    ...readinessActions,
    ...postProject.allowedActions.filter((action) => action !== "recover")
  ];
  const actions = uniquePostActions(preferred.length ? preferred : postProject.allowedActions);
  return actions.slice(0, 4).map(actionToQuickAction);
}

function uniquePostActions(actions: PostAction[]): PostAction[] {
  return [...new Set(actions)];
}

function buildQuickActions(plan: AgentPlan, workspace: WorkspaceState, postProject?: PostProject | null) {
  const postProjectActions = buildPostProjectQuickActions(postProject);
  if (isPublishWithoutDraftPlan(plan, workspace, postProject)) {
    const hasEvidenceOrBrief = Boolean(
      postProject?.creativeBrief ||
        postProject?.evidencePack.insights.length ||
        postProject?.selectedSamples.length ||
        workspace.evidenceSummary ||
        workspace.selectedSamples.length
    );
    return hasEvidenceOrBrief
      ? [
          { id: "qa-generate-copy-before-publish", label: "先生成发布文案", action: "generate_copy" },
          { id: "qa-select-images-before-publish", label: "选择发布图片", action: "select_images" },
          { id: "qa-assemble-before-publish", label: "组装发布稿", action: "assemble_post" }
        ]
      : [
          { id: "qa-research-before-publish", label: "先搜索真实笔记", action: "search_research" },
          { id: "qa-add-brief-before-publish", label: "补充创作需求", action: "update_brief_inputs" }
        ];
  }
  if (plan.intent !== "ask" && postProjectActions.length) {
    return postProjectActions;
  }
  if (plan.intent === "research_only" || workspace.selectedSamples.length) {
    return [
      { id: "qa-generate-copy", label: "基于证据生成文案", action: "generate_copy" },
      { id: "qa-plan-visual", label: "生成图片方向", action: "plan_visuals" }
    ];
  }
  if (workspace.currentDraft) {
    return [
      { id: "qa-revise-copy", label: "修改当前文案", action: "revise_copy" },
      { id: "qa-generate-images", label: "生成配图", action: "generate_images" },
      { id: "qa-publish-check", label: "进入发布检查", action: "run_quality_gate" }
    ];
  }
  return [
    { id: "qa-start-research", label: "先搜索真实笔记", action: "search_research" },
    { id: "qa-add-brief", label: "补充创作需求", action: "update_brief_inputs" }
  ];
}

function buildToolTraceItems(trace: ReturnType<typeof createTrace>): AgentToolTraceItem[] {
  return trace.events.map((event) => ({
    id: event.id,
    label: event.label,
    status: event.type === "run_failed" ? "failed" : event.type === "run_started" ? "running" : "completed",
    detail: event.detail,
    createdAt: event.createdAt
  }));
}

function inferStageFromWorkspace(workspace: WorkspaceState): AgentTurnResult["stage"] {
  if (workspace.publishPlan?.status === "published") return "published";
  if (workspace.publishPlan?.status === "scheduled") return "scheduled";
  if (workspace.publishPlan) return "reviewing";
  if (workspace.selectedImageIds.length) return "image_ready";
  if (workspace.currentDraft) return "copy_ready";
  if (workspace.evidenceSummary || workspace.selectedSamples.length) return "evidence_ready";
  if (workspace.topic) return "briefing";
  return "empty";
}

function inferIntentConfidence(plan: AgentPlan, workspace: WorkspaceState): number {
  if (plan.intent === "answer" && !workspace.topic) return 0.62;
  if (plan.intent === "ask") return 0.66;
  if (plan.topic || workspace.topic || workspace.currentDraft) return 0.86;
  return 0.74;
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
  const generatedImageIds = generatedAssets.map((asset) => asset.id);
  await appendGeneratedAssetsToPostProject({
    assetIds: generatedImageIds,
    promptId: null,
    select: true
  });

  return {
    answer: `已把当前草稿渲染成 ${generatedAssets.length} 张小红书图文卡片，并放入成果画布。`,
    currentDraft: updatedDraft,
    workspace
  };
}

async function maybeHandleVisualPlanningTurn(
  input: RunAgentTurnInput,
  plan: ReturnType<typeof createAgentPlan>,
  postProject: PostProject
): Promise<{ answer: string; workspace: WorkspaceState; postProject: PostProject } | null> {
  const wantsVisualPlan =
    plan.intent === "answer" &&
    plan.steps.some((step) => step.action === "answer" && /visual|image prompt|图片|Prompt/i.test(step.reason));
  if (!wantsVisualPlan) {
    return null;
  }
  const creativeBrief = postProject.creativeBrief;
  if (!creativeBrief) {
    const workspace = await updateWorkspaceState({ lastUserIntent: "plan_visuals" });
    return {
      answer: "我可以规划图片方向，但当前项目还没有 CreativeBrief。请先完成主题研究，或补充产品、人群、语气和目标后再生成图片方向。",
      workspace,
      postProject
    };
  }

  const visualDirection = deriveVisualDirection({
    creativeBrief,
    visualDirection: postProject.visualDirection
  });
  const imagePrompt = visualDirection
    ? deriveImagePromptVersion({
        ...postProject,
        visualDirection,
        imagePrompts: []
      })
    : undefined;
  const updatedProject = await updatePostProject({
    visualDirection,
    imagePrompts: imagePrompt
      ? [...postProject.imagePrompts.filter((item) => item.value.prompt !== imagePrompt.value.prompt), imagePrompt]
      : postProject.imagePrompts,
    currentStage: imagePrompt ? "image_prompt_ready" : "visual_planning"
  });
  const workspace = await updateWorkspaceState({ lastUserIntent: "plan_visuals" });
  return {
    answer: [
      "已基于当前 CreativeBrief 生成图片方向和图片提示词。",
      `视觉氛围：${updatedProject.visualDirection?.mood ?? creativeBrief.visualMood}`,
      `构图：${updatedProject.visualDirection?.composition ?? "封面突出主体，正文图递进展示细节"}`,
      imagePrompt ? `Prompt：${imagePrompt.value.prompt}` : "",
      "发布前仍需要你确认图片方向和最终选图。"
    ].filter(Boolean).join("\n"),
    workspace,
    postProject: updatedProject
  };
}

async function maybeHandleDraftFromProjectTurn(
  input: RunAgentTurnInput,
  plan: ReturnType<typeof createAgentPlan>,
  postProject: PostProject
): Promise<{ answer: string; currentDraft: DraftRecord; workspace: WorkspaceState; postProject: PostProject } | null> {
  const wantsProjectDraft =
    plan.steps.some((step) => step.action === "generateDraft") &&
    plan.intent !== "research_to_draft" &&
    (postProject.evidencePack.insights.length || postProject.creativeBrief);
  if (!wantsProjectDraft) {
    return null;
  }

  if (!input.settings.textApiKey.trim()) {
    const workspace = await updateWorkspaceState({ lastUserIntent: "generate_copy" });
    const fallbackDraft = createDraftRecord({
      draft: {
        title: postProject.topic?.slice(0, 20) || "小红书原创笔记",
        content: "基于当前证据生成文案需要先在设置页配置文本模型 API Key。",
        tags: [postProject.topic?.replace(/\s+/g, "") || "小红书"],
        structure: ["补充模型配置", "基于证据生成"],
        imagePrompt: "请先配置文本模型后再生成完整图片方向",
        basedOnEvidenceIds: postProject.evidencePack.insights.map((insight) => insight.id)
      },
      images: [],
      visibility: input.settings.defaultVisibility
    });
    return {
      answer: "基于当前 PostProject 生成原创文案需要文本模型 API Key，请先在设置页配置。",
      currentDraft: fallbackDraft,
      workspace,
      postProject
    };
  }

  const evidenceReadyProject = await ensureViralEvidenceForProject(postProject);
  const brief = evidenceReadyProject.creativeBrief ?? deriveCreativeBrief(evidenceReadyProject);
  if (!brief) {
    const workspace = await updateWorkspaceState({ lastUserIntent: "generate_copy" });
    const fallbackDraft = createDraftRecord({
      draft: {
        title: evidenceReadyProject.topic?.slice(0, 20) || "小红书原创笔记",
        content: "当前项目还缺少 CreativeBrief。请先补充目标人群、内容目标、产品信息或完成主题研究。",
        tags: [evidenceReadyProject.topic?.replace(/\s+/g, "") || "小红书"],
        structure: ["补充 Brief", "再生成文案"],
        imagePrompt: "等待 CreativeBrief 生成后再规划图片",
        basedOnEvidenceIds: evidenceReadyProject.evidencePack.insights.map((insight) => insight.id)
      },
      images: [],
      visibility: input.settings.defaultVisibility
    });
    return {
      answer: "我还不能直接写草稿：当前项目缺少 CreativeBrief。请先补充目标人群、内容目标、产品信息，或运行一次主题研究。",
      currentDraft: fallbackDraft,
      workspace,
      postProject: evidenceReadyProject
    };
  }

  const evidenceIds = evidenceReadyProject.evidencePack.insights.map((insight) => insight.id);
  const evidenceForPrompt = evidenceReadyProject.evidencePack.insights
    .filter((insight) => insight.insight.trim())
    .slice(0, 12)
    .map((insight) => ({
      id: insight.id,
      sourceType: insight.sourceType ?? "realtime",
      type: insight.type,
      insight: insight.insight,
      confidence: insight.confidence
    }));
  const selectedSamples = evidenceReadyProject.selectedSamples.slice(0, 5).map((sample) => {
    if (!isRecord(sample)) return sample;
    return {
      id: typeof sample.id === "string" ? sample.id : undefined,
      title: typeof sample.title === "string" ? sample.title : undefined,
      metrics: {
        likes: typeof sample.likes === "number" ? sample.likes : 0,
        collects: typeof sample.collects === "number" ? sample.collects : 0,
        comments: typeof sample.comments === "number" ? sample.comments : 0
      }
    };
  });

  const fallback: GeneratedDraft = {
    title: evidenceReadyProject.topic?.slice(0, 20) || "小红书原创笔记",
    content: `围绕${evidenceReadyProject.topic ?? "当前主题"}，用真实、生活化、不夸张的方式写一篇原创笔记。`,
    tags: [evidenceReadyProject.topic?.replace(/\s+/g, "") || "小红书"],
    structure: ["标题钩子", "场景引入", "正文价值点", "结尾互动"],
    imagePrompt: brief.visualMood || "真实小红书风格图片，自然光，主体清晰，不复制参考图",
    basedOnEvidenceIds: evidenceIds.slice(0, 8),
    evidenceReferences: {
      title: evidenceIds.slice(0, 3),
      content: evidenceIds.slice(0, 5),
      tags: evidenceIds.slice(0, 5),
      imagePrompt: evidenceIds.slice(0, 5)
    }
  };

  const raw = await input.model.generateStructuredText(
    `你是小红书内容创作导演型 Agent 的 Writer。请基于当前 PostProject、CreativeBrief 和 evidencePack 生成原创草稿。

用户最新需求：
${input.message}

PostProject：
${JSON.stringify({
  topic: evidenceReadyProject.topic,
  productInfo: evidenceReadyProject.productInfo,
  targetAudience: evidenceReadyProject.targetAudience,
  goal: evidenceReadyProject.goal,
  tone: evidenceReadyProject.tone,
  currentStage: evidenceReadyProject.currentStage
}, null, 2)}

CreativeBrief：
${JSON.stringify(brief, null, 2)}

可引用证据（只能引用这些 id；sourceType=viral_library 只能学习规律，不能复制原文）：
${JSON.stringify(evidenceForPrompt, null, 2)}

实时样本摘要（仅用于理解热度和角度，不要复制标题正文）：
${JSON.stringify(selectedSamples, null, 2)}

要求：
1. 生成原创标题、正文、标签和图片提示词，不复制任何样本标题/正文。
2. 内容必须能追溯到 evidencePack，title/content/tags/imagePrompt 都要记录 basedOnEvidenceIds 或 evidenceReferences。
3. 不要虚构销量、认证、功效、价格、官方背书。
4. 风格要符合 CreativeBrief，文案和图片方向必须一致。

请只返回 JSON：
{
  "title": "20字以内标题",
  "content": "原创正文，不包含#标签",
  "tags": ["标签1"],
  "structure": ["结构步骤"],
  "imagePrompt": "图片提示词",
  "basedOnEvidenceIds": ["证据ID"],
  "evidenceReferences": {
    "title": ["证据ID"],
    "content": ["证据ID"],
    "tags": ["证据ID"],
    "imagePrompt": ["证据ID"]
  }
}`,
    "Generate traceable original Xiaohongshu copy from PostProject evidence. Do not copy source samples."
  );
  const draft = parseGeneratedDraft(raw, fallback, evidenceIds);
  const draftRecord = createDraftRecord({
    draft,
    images: [],
    visibility: input.settings.defaultVisibility,
    input: {
      topic: evidenceReadyProject.topic ?? draft.title,
      contentType: "Post Studio",
      timeRange: "当前项目",
      sampleCount: evidenceReadyProject.selectedSamples.length,
      visibility: input.settings.defaultVisibility,
      workflowGoal: "draft",
      publishMode: "draft",
      analyzeImages: true,
      generateImages: false,
      requirements: input.message,
      useViralKnowledge: true
    }
  });
  const copyVersion = copyVersionFromDraft(draftRecord, draft.basedOnEvidenceIds ?? evidenceIds);
  const updatedProject = await updatePostProject({
    creativeBrief: brief,
    copyDraft: draftRecord,
    copyVersions: [
      ...evidenceReadyProject.copyVersions.filter((version) => version.id !== copyVersion.id),
      copyVersion
    ],
    currentStage: "copy_ready"
  });
  const workspace = await updateWorkspaceState({
    topic: updatedProject.topic ?? draft.title,
    evidenceSummary: updatedProject.evidencePack.summary,
    selectedSamples: updatedProject.selectedSamples,
    currentDraftId: draftRecord.id,
    currentDraft: draftRecord,
    lastUserIntent: "generate_copy"
  });

  const referenced = summarizeEvidenceCitationReport(updatedProject, draft.basedOnEvidenceIds ?? evidenceIds, draft.evidenceReferences);
  return {
    answer: [
      "已基于当前 PostProject、CreativeBrief、实时证据和爆款库规律生成原创草稿。",
      `标题：${draft.title}`,
      "",
      draft.content,
      "",
      `标签：${draft.tags.map((tag) => `#${tag}`).join(" ")}`,
      "",
      referenced
    ].filter(Boolean).join("\n"),
    currentDraft: draftRecord,
    workspace,
    postProject: updatedProject
  };
}

async function maybeHandleImageSelectionTurn(
  input: RunAgentTurnInput,
  plan: ReturnType<typeof createAgentPlan>,
  postProject: PostProject
): Promise<{ answer: string; workspace: WorkspaceState; postProject: PostProject } | null> {
  if (plan.intent !== "select_images") {
    return null;
  }

  const existing = await readWorkspaceState();
  const candidates = uniqueIds([
    ...existing.selectedImageIds,
    ...postProject.selectedImages,
    ...postProject.generatedImages.flatMap((image) => [image.assetId, image.id].filter(Boolean) as string[])
  ]);
  if (!candidates.length) {
    const workspace = await updateWorkspaceState({ lastUserIntent: plan.intent });
    return {
      answer: "当前成果画布里还没有可选择的图片。请先上传图片、生成配图或生成图文卡片。",
      workspace,
      postProject
    };
  }

  const selectedIndex = plan.selectedImageIndex && plan.selectedImageIndex > 0 ? plan.selectedImageIndex - 1 : 0;
  const selected = candidates[selectedIndex];
  if (!selected) {
    const workspace = await updateWorkspaceState({ lastUserIntent: plan.intent });
    return {
      answer: `当前只有 ${candidates.length} 张候选图，找不到第 ${plan.selectedImageIndex} 张。你可以说“用第一张图”。`,
      workspace,
      postProject
    };
  }

  const selectedImageIds = [selected];
  const updatedProject = await updatePostProject({
    selectedImages: selectedImageIds,
    generatedImages: mergeSelectedGeneratedImages(postProject, candidates, selected),
    finalPost: undefined,
    qualityCheck: undefined,
    auditStatus: "unchecked",
    currentStage: "image_ready"
  });
  const workspace = await updateWorkspaceState({
    selectedImageIds,
    lastUserIntent: plan.intent
  });

  return {
    answer: `已选择第 ${selectedIndex + 1} 张图作为当前发布图片。下一步可以继续生成/修改文案，或进入发布检查。`,
    workspace,
    postProject: updatedProject
  };
}

async function maybeHandleQualityCheckTurn(
  input: RunAgentTurnInput,
  plan: ReturnType<typeof createAgentPlan>,
  postProject: PostProject
): Promise<{ answer: string; workspace: WorkspaceState; postProject: PostProject } | null> {
  if (plan.intent !== "assemble_post" && plan.intent !== "quality_check") {
    return null;
  }

  const existing = await readWorkspaceState();
  const currentDraft = postProject.copyDraft ?? input.currentDraft ?? existing.currentDraft ?? null;
  const selectedImages = postProject.selectedImages.length ? postProject.selectedImages : existing.selectedImageIds;
  if (!currentDraft) {
    const workspace = await updateWorkspaceState({ lastUserIntent: plan.intent });
    return {
      answer: "还不能进入发布检查：当前项目没有草稿。请先基于证据生成文案。",
      workspace,
      postProject
    };
  }
  if (!selectedImages.length) {
    const workspace = await updateWorkspaceState({
      currentDraftId: currentDraft.id,
      currentDraft,
      lastUserIntent: plan.intent
    });
    return {
      answer: "还不能进入发布检查：当前项目还没有选中发布图片。请先上传、生成或选择至少一张图片。",
      workspace,
      postProject
    };
  }

  const finalPost = deriveFinalPost({
    copyDraft: currentDraft,
    selectedImages,
    imagePrompts: postProject.imagePrompts,
    finalPost: undefined
  });
  const qualityCheck = runPostQualityGate({
    ...postProject,
    copyDraft: currentDraft,
    selectedImages,
    finalPost
  });
  const updatedProject = await updatePostProject({
    copyDraft: currentDraft,
    selectedImages,
    finalPost,
    qualityCheck,
    auditStatus: qualityCheck.canPublish ? "passed" : "blocked",
    currentStage: "reviewing"
  });
  const workspace = await updateWorkspaceState({
    currentDraftId: currentDraft.id,
    currentDraft,
    selectedImageIds: selectedImages,
    lastUserIntent: plan.intent
  });
  return {
    answer: [
      "已把当前文案和选中图片组装成最终帖子，并完成发布前 Quality Gate。",
      `标题：${currentDraft.draft.title}`,
      `图片：${selectedImages.length} 张`,
      qualityCheck.canPublish ? "结果：通过，可以进入人工发布确认。" : "结果：暂不建议发布，需要先处理风险。",
      qualityCheck.evidenceReview ? `证据覆盖：${qualityCheck.evidenceReview.summary}` : "",
      qualityCheck.evidenceAlignment ? `图文证据：${qualityCheck.evidenceAlignment.summary}` : "",
      qualityCheck.issues.length ? `主要问题：${qualityCheck.issues.slice(0, 4).join("；")}` : "",
      qualityCheck.suggestions.length ? `建议：${qualityCheck.suggestions.slice(0, 3).join("；")}` : ""
    ].filter(Boolean).join("\n"),
    workspace,
    postProject: updatedProject
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
  if (generatedAsset) {
    const activeProject = await readPostProject();
    await appendGeneratedAssetsToPostProject({
      assetIds: [generatedAsset.id],
      promptId: activeProject.imagePrompts.at(-1)?.id,
      select: true
    });
  }

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

  const activeProject = await readPostProject();
  const selectedAssetIds = activeProject.selectedImages.length ? activeProject.selectedImages : existing.selectedImageIds;
  const selectedAssetImages = await resolveSelectedPublishImages(selectedAssetIds);
  const draftImages = currentDraft.images.flatMap((image) => [image.path, image.url].filter(Boolean) as string[]);
  const allImages = selectedAssetImages.length ? selectedAssetImages : draftImages;
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
  await updatePostProject({
    publishPlan: guardedPublish.publishIntent,
    auditStatus: guardedPublish.status === "blocked" || guardedPublish.status === "failed" ? "blocked" : "unchecked",
    currentStage: guardedPublish.status === "scheduled"
      ? "scheduled"
      : guardedPublish.status === "published"
        ? "published"
        : guardedPublish.status === "failed"
          ? "failed"
          : "reviewing"
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

async function ensureViralEvidenceForProject(
  project: PostProject,
  options: { force?: boolean; filters?: ReturnType<typeof createAgentPlan>["ragFilters"] } = {}
): Promise<PostProject> {
  const hasViralEvidence = project.evidencePack.insights.some((insight) => insight.sourceType === "viral_library");
  if ((hasViralEvidence && !options.force) || !project.topic) {
    return project;
  }

  const registry = createAgentToolRegistry();
  const toolResult = await registry.call("knowledge.retrieveViralPatterns", {
    query: [
      project.topic,
      project.productInfo.name,
      project.targetAudience,
      project.goal,
      project.tone
    ].filter(Boolean).join(" "),
    topic: project.topic,
    ...options.filters,
    limit: 6,
    realtimeEvidenceCount: project.selectedSamples.length
  });
  const pack = parseViralKnowledgeToolPack(toolResult);
  if (!pack.insights.length && !pack.results.length) {
    return project;
  }

  const evidenceBuild = buildEvidencePackWithViralKnowledge(project, pack);
  const nextProject = {
    ...project,
    evidencePack: evidenceBuild.evidencePack
  };
  const refreshedBrief = evidenceBuild.shouldRefreshCreativeBrief
    ? deriveCreativeBrief({ ...nextProject, creativeBrief: undefined })
    : project.creativeBrief;

  return updatePostProject({
    evidencePack: nextProject.evidencePack,
    creativeBrief: refreshedBrief,
    currentStage: refreshedBrief ? "brief_ready" : project.currentStage
  });
}

function parseViralKnowledgeToolPack(result: unknown): ViralKnowledgePack {
  if (!isRecord(result) || !isRecord(result.data)) {
    throw new Error("爆款库工具没有返回有效 RAG 结果");
  }
  return result.data as ViralKnowledgePack;
}

function parseGeneratedDraft(raw: string, fallback: GeneratedDraft, allowedEvidenceIds: string[]): GeneratedDraft {
  try {
    const text = raw.trim().startsWith("{")
      ? raw.trim()
      : raw.trim().match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim();
    if (!text) return fallback;
    const parsed = JSON.parse(text) as Partial<GeneratedDraft>;
    const basedOnEvidenceIds = safeEvidenceIds(parsed.basedOnEvidenceIds, allowedEvidenceIds, fallback.basedOnEvidenceIds);
    return {
      ...fallback,
      ...parsed,
      tags: stringArray(parsed.tags, fallback.tags).slice(0, 8),
      structure: stringArray(parsed.structure, fallback.structure).slice(0, 8),
      basedOnEvidenceIds,
      evidenceReferences: normalizeEvidenceReferences(parsed.evidenceReferences, allowedEvidenceIds, fallback.evidenceReferences)
    };
  } catch {
    return fallback;
  }
}

function normalizeEvidenceReferences(
  value: GeneratedDraft["evidenceReferences"] | undefined,
  allowedEvidenceIds: string[],
  fallback: GeneratedDraft["evidenceReferences"]
): GeneratedDraft["evidenceReferences"] {
  return {
    title: safeEvidenceIds(value?.title, allowedEvidenceIds, fallback?.title),
    content: safeEvidenceIds(value?.content, allowedEvidenceIds, fallback?.content),
    tags: safeEvidenceIds(value?.tags, allowedEvidenceIds, fallback?.tags),
    imagePrompt: safeEvidenceIds(value?.imagePrompt, allowedEvidenceIds, fallback?.imagePrompt)
  };
}

function safeEvidenceIds(value: unknown, allowedEvidenceIds: string[], fallback: string[] = []): string[] {
  const allowed = new Set(allowedEvidenceIds);
  const ids = Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
  const safe = ids.filter((id) => allowed.has(id));
  return uniqueIds(safe.length ? safe : fallback.filter((id) => allowed.has(id))).slice(0, 8);
}

function stringArray(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : fallback;
}

function summarizeReferencedEvidence(
  project: PostProject,
  evidenceIds: string[],
  evidenceReferences?: GeneratedDraft["evidenceReferences"]
): string {
  const directIds = uniqueIds([
    ...evidenceIds,
    ...(evidenceReferences?.title ?? []),
    ...(evidenceReferences?.content ?? []),
    ...(evidenceReferences?.tags ?? []),
    ...(evidenceReferences?.imagePrompt ?? [])
  ]);
  const briefIds = project.creativeBrief?.basedOnEvidenceIds ?? [];
  const ids = new Set([...directIds, ...briefIds]);
  const insights = project.evidencePack.insights.filter((insight) => ids.has(insight.id));
  if (!insights.length) {
    return "";
  }

  const directInsights = insights.filter((insight) => directIds.includes(insight.id)).slice(0, 4);
  const viralInsights = insights
    .filter((insight) => insight.sourceType === "viral_library" && !directIds.includes(insight.id))
    .slice(0, 3);
  const realtimeInsights = insights
    .filter((insight) => (insight.sourceType ?? "realtime") === "realtime" && !directIds.includes(insight.id))
    .slice(0, 3);

  const sections = [
    formatEvidenceSection("文案直接引用的证据", directInsights),
    formatEvidenceSection("爆款库补充规律", viralInsights),
    formatEvidenceSection("实时研究补充结论", realtimeInsights)
  ].filter(Boolean);

  return sections.length ? `这版为什么这样写：\n${sections.join("\n")}` : "";
}

function formatEvidenceSection(title: string, insights: PostProject["evidencePack"]["insights"]): string {
  if (!insights.length) {
    return "";
  }
  const items = insights.map((insight) => `- ${insight.id}｜${labelForEvidenceSource(insight.sourceType)}｜${insight.type}：${insight.insight}`);
  return `${title}：\n${items.join("\n")}`;
}

function summarizeEvidenceCitationReport(
  project: PostProject,
  evidenceIds: string[],
  evidenceReferences?: GeneratedDraft["evidenceReferences"]
): string {
  const report = buildEvidenceCitationReport(project, evidenceIds, evidenceReferences);
  return report.allEvidenceIds.length ? formatEvidenceCitationReport(report) : "";
}

function mergeSelectedGeneratedImages(project: PostProject, candidates: string[], selected: string) {
  const existingIds = new Set(project.generatedImages.map((image) => image.assetId ?? image.id));
  const synthetic = candidates
    .filter((id) => !existingIds.has(id))
    .map((id) => ({
      id,
      assetId: id,
      createdAt: new Date().toISOString()
    }));
  return [...project.generatedImages, ...synthetic].map((image) => {
    const identity = image.assetId ?? image.id;
    return {
      ...image,
      selected: identity === selected
    };
  });
}

async function appendGeneratedAssetsToPostProject({
  assetIds,
  promptId,
  select
}: {
  assetIds: string[];
  promptId?: string | null;
  select: boolean;
}): Promise<PostProject> {
  const ids = uniqueIds(assetIds);
  const project = await readPostProject();
  if (!ids.length) {
    return project;
  }
  const existingIds = new Set(project.generatedImages.map((image) => image.assetId ?? image.id));
  const generatedImages = [
    ...project.generatedImages,
    ...ids
      .filter((id) => !existingIds.has(id))
      .map((id) => ({
        id,
        assetId: id,
        promptId: promptId ?? undefined,
        createdAt: new Date().toISOString(),
        selected: select
      }))
  ].map((image) => {
    const identity = image.assetId ?? image.id;
    return ids.includes(identity)
      ? { ...image, selected: select }
      : select
        ? { ...image, selected: false }
        : image;
  });
  const selectedImages = select ? ids : project.selectedImages;
  return updatePostProject({
    generatedImages,
    selectedImages,
    finalPost: undefined,
    publishPlan: null,
    qualityCheck: undefined,
    auditStatus: "unchecked",
    currentStage: select ? "image_ready" : "image_generating"
  });
}

async function resolveSelectedPublishImages(assetIds: string[]): Promise<string[]> {
  const resolved = await Promise.all(
    uniqueIds(assetIds).map(async (id) => {
      const asset = await getAsset(id).catch(() => null);
      return asset?.absolutePath;
    })
  );
  return resolved.filter((item): item is string => Boolean(item));
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
