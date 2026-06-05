import { runChatAgent, type ChatAgentResult } from "@/lib/chat/agent";
import { createAgentPlan } from "@/lib/agent/planner";
import { executeGuardedPublish } from "@/lib/agent/publishing";
import { buildEvidencePackWithViralKnowledge } from "@/lib/agent/evidence-builder";
import { inferAgentScheduleAt } from "@/lib/agent/schedule";
import { readWorkspaceState, resetWorkspaceState, updateWorkspaceState } from "@/lib/agent/state";
import { createAgentToolRegistry } from "@/lib/agent/tools/registry";
import { addTraceEvent, createAgentRun, createTrace, persistAgentTrace } from "@/lib/agent/trace";
import type {
  AgentAction,
  AgentPlan,
  AgentQuickAction,
  PublishEvidenceCitationSummary,
  AgentResponseCard,
  AgentRuntimeContext,
  AgentToolTraceItem,
  AgentTurnResult,
  WorkspaceState
} from "@/lib/agent/types";
import { readPostProject, resetPostProject, updatePostProject } from "@/lib/post-project/store";
import { copyVersionFromDraft, deriveCreativeBrief, deriveFinalPost, deriveImagePromptVersion, deriveVisualDirection } from "@/lib/post-project/brief";
import { buildEvidenceCitationReport, buildEvidenceReferenceSummary, formatEvidenceCitationReport } from "@/lib/post-project/citations";
import { buildEvidenceReferenceNote, labelForEvidenceSource } from "@/lib/post-project/evidence-note";
import { insightsFromUserBriefInput, mergeEvidenceInsights } from "@/lib/post-project/evidence";
import { getPostStageGuidance } from "@/lib/post-project/guidance";
import { inferPostStage } from "@/lib/post-project/stage-machine";
import { buildPostReadinessReport } from "@/lib/post-project/readiness";
import { buildCreationProvenanceSummary, formatCreationProvenanceForReply } from "@/lib/post-project/provenance";
import { runPostQualityGate } from "@/lib/post-project/quality";
import { buildPublishVersionSnapshot } from "@/lib/post-project/versioning";
import type { PostAction, PostProject, ProductInfo } from "@/lib/post-project/types";
import { renderXhsCardSet } from "@/lib/cards/renderer";
import type { ModelProvider } from "@/lib/models/provider";
import { createAssetRecord, getAsset, saveAsset } from "@/lib/storage/assets";
import { createDraftRecord, type DraftRecord } from "@/lib/storage/drafts";
import { summarizeViralRetrievalFilters, type RagSufficiency, type ViralKnowledgePack } from "@/lib/rag/viral";
import { reviewViralSaveCandidate } from "@/lib/viral-knowledge/store";
import type { GeneratedDraft, XhsMcpWorkflowClient } from "@/lib/workflows/one-click";
import type { SampleEvidence } from "@/lib/workflows/one-click";

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
    hasCurrentDraft: Boolean(input.currentDraft ?? initialPostProject.copyDraft ?? initialPostProject.finalPost),
    attachedAssetCount: input.attachedAssets.length,
    postStage: initialPostProject.currentStage,
    allowedActions: initialPostProject.allowedActions,
    hasEvidence: Boolean(initialPostProject.evidencePack.insights.length || initialPostProject.selectedSamples.length),
    hasCreativeBrief: Boolean(initialPostProject.creativeBrief),
    hasSelectedImages: Boolean(initialPostProject.selectedImages.length),
    hasPendingPublishConfirmation: initialPostProject.publishPlan?.status === "awaiting_approval"
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

    const recoveredTurn = await maybeHandleProjectRecoveryTurn(plan, initialPostProject);
    if (recoveredTurn) {
      trace = addTraceEvent(trace, {
        type: "tool_completed",
        label: "project.recover",
        detail: "Recovered the active PostProject from a failed or blocked state.",
        metadata: {
          stage: recoveredTurn.postProject.currentStage,
          auditStatus: recoveredTurn.postProject.auditStatus
        }
      });
      trace = addTraceEvent(trace, {
        type: "workspace_updated",
        label: "Workspace updated",
        detail: "Cleared failed publish state and returned the PostProject to a stage inferred from current canvas content."
      });
      agentRun = completeRun(agentRun);
      trace = addTraceEvent(trace, {
        type: "run_completed",
        label: "Agent run completed",
        detail: "Agent turn completed after recovering the PostProject."
      });
      await persistAgentTrace(trace);
      return buildAgentTurnResult({
        answer: recoveredTurn.answer,
        plan,
        workspace: recoveredTurn.workspace,
        currentDraft: input.currentDraft ?? recoveredTurn.postProject.copyDraft ?? undefined,
        agentRun,
        trace,
        postProject: recoveredTurn.postProject
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

    const viralKnowledgeSaveTurn = await maybeHandleViralKnowledgeSaveTurn(input, plan, initialPostProject);
    if (viralKnowledgeSaveTurn) {
      trace = addTraceEvent(trace, {
        type: "tool_called",
        label: "knowledge.saveViralCase",
        detail: "Saved selected realtime research samples as structured viral-library patterns.",
        metadata: {
          savedCount: viralKnowledgeSaveTurn.savedCount,
          skippedSampleIds: viralKnowledgeSaveTurn.skippedSampleIds,
          addedInsightIds: viralKnowledgeSaveTurn.addedInsightIds
        }
      });
      trace = addTraceEvent(trace, {
        type: "workspace_updated",
        label: "Workspace updated",
        detail: "Attached saved viral-library patterns to the active PostProject evidencePack."
      });
      agentRun = completeRun(agentRun);
      trace = addTraceEvent(trace, {
        type: "run_completed",
        label: "Agent run completed",
        detail: "Agent turn completed after saving viral-library knowledge."
      });
      await persistAgentTrace(trace);
      return buildAgentTurnResult({
        answer: viralKnowledgeSaveTurn.answer,
        plan,
        workspace: viralKnowledgeSaveTurn.workspace,
        currentDraft: input.currentDraft ?? undefined,
        agentRun,
        trace,
        postProject: viralKnowledgeSaveTurn.postProject
      });
    }

    const creativeBriefTurn = await maybeHandleCreativeBriefTurn(input, plan, initialPostProject);
    if (creativeBriefTurn) {
      trace = addTraceEvent(trace, {
        type: "tool_called",
        label: "project.createCreativeBrief",
        detail: "Refreshed the shared CreativeBrief from PostProject evidence and user inputs.",
        metadata: {
          stage: creativeBriefTurn.postProject.currentStage,
          basedOnEvidenceIds: creativeBriefTurn.postProject.creativeBrief?.basedOnEvidenceIds
        }
      });
      trace = addTraceEvent(trace, {
        type: "workspace_updated",
        label: "Workspace updated",
        detail: "Stored the refreshed CreativeBrief on the active PostProject."
      });
      agentRun = completeRun(agentRun);
      trace = addTraceEvent(trace, {
        type: "run_completed",
        label: "Agent run completed",
        detail: "Agent turn completed after refreshing CreativeBrief."
      });
      await persistAgentTrace(trace);
      return buildAgentTurnResult({
        answer: creativeBriefTurn.answer,
        plan,
        workspace: creativeBriefTurn.workspace,
        currentDraft: input.currentDraft ?? undefined,
        agentRun,
        trace,
        postProject: creativeBriefTurn.postProject
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

    const guardedPublishTurn = await maybeHandleGuardedPublishTurn(input, plan, initialPostProject);
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

    const visualDirectionConfirmationTurn = await maybeHandleVisualDirectionConfirmationTurn(input, plan, initialPostProject);
    if (visualDirectionConfirmationTurn) {
      trace = addTraceEvent(trace, {
        type: "tool_called",
        label: "project.confirmVisualDirection",
        detail: "Recorded explicit user confirmation for the active PostProject visual direction.",
        metadata: {
          confirmedAt: visualDirectionConfirmationTurn.postProject.visualDirection?.confirmedAt,
          stage: visualDirectionConfirmationTurn.postProject.currentStage
        }
      });
      trace = addTraceEvent(trace, {
        type: "workspace_updated",
        label: "Workspace updated",
        detail: "Marked the current visual direction as confirmed before image generation or publish checks."
      });
      agentRun = completeRun(agentRun);
      trace = addTraceEvent(trace, {
        type: "run_completed",
        label: "Agent run completed",
        detail: "Agent turn completed after confirming visual direction."
      });
      await persistAgentTrace(trace);
      return buildAgentTurnResult({
        answer: visualDirectionConfirmationTurn.answer,
        plan,
        workspace: visualDirectionConfirmationTurn.workspace,
        currentDraft: input.currentDraft ?? undefined,
        agentRun,
        trace,
        postProject: visualDirectionConfirmationTurn.postProject
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

    const publishConfirmationTurn = await maybeHandlePublishConfirmationTurn(input, plan, initialPostProject);
    if (publishConfirmationTurn) {
      trace = addTraceEvent(trace, {
        type: "tool_completed",
        label: plan.intent === "cancel_publish_confirmation" ? "publish.cancelConfirmation" : "publish.reviewConfirmation",
        detail: plan.intent === "cancel_publish_confirmation"
          ? "Cancelled the pending publish confirmation without external publishing."
          : "Returned the active publish confirmation for manual review."
      });
      trace = addTraceEvent(trace, {
        type: "workspace_updated",
        label: "Workspace updated",
        detail: "Synchronized publish confirmation state with the active PostProject."
      });
      agentRun = completeRun(agentRun);
      trace = addTraceEvent(trace, {
        type: "run_completed",
        label: "Agent run completed",
        detail: "Agent turn completed after handling publish confirmation context."
      });
      await persistAgentTrace(trace);

      return buildAgentTurnResult({
        answer: publishConfirmationTurn.answer,
        plan,
        workspace: publishConfirmationTurn.workspace,
        currentDraft: input.currentDraft ?? undefined,
        agentRun,
        trace,
        postProject: publishConfirmationTurn.postProject
      });
    }

    const draftRevisionTurn = await maybeHandleDraftRevisionTurn(input, plan, initialPostProject);
    if (draftRevisionTurn) {
      trace = addTraceEvent(trace, {
        type: "tool_called",
        label: "draft.reviseCurrent",
        detail: "Revised the active PostProject draft while preserving evidence citations.",
        metadata: {
          currentDraftId: draftRevisionTurn.currentDraft.id,
          basedOnEvidenceIds: draftRevisionTurn.currentDraft.draft.basedOnEvidenceIds
        }
      });
      trace = addTraceEvent(trace, {
        type: "workspace_updated",
        label: "Workspace updated",
        detail: "Stored the revised draft version on PostProject and workspace."
      });
      agentRun = completeRun(agentRun);
      trace = addTraceEvent(trace, {
        type: "run_completed",
        label: "Agent run completed",
        detail: "Agent turn completed after revising the current draft."
      });
      await persistAgentTrace(trace);
      return buildAgentTurnResult({
        answer: draftRevisionTurn.answer,
        plan,
        workspace: draftRevisionTurn.workspace,
        currentDraft: draftRevisionTurn.currentDraft,
        agentRun,
        trace,
        postProject: draftRevisionTurn.postProject
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
  const evidenceAwareAnswer = appendCreationProvenanceNote(
    appendEvidenceReferenceNote(answer, plan, postProject),
    plan,
    postProject,
    currentDraft ?? null
  );
  const structured = buildStructuredAgentResponse({
    answer: evidenceAwareAnswer,
    plan,
    workspace,
    postProject,
    cards,
    traceItems: buildToolTraceItems(trace, plan)
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
  const insights = postProject?.evidencePack.insights ?? [];
  if (!insights.length || answer.includes("参考证据")) {
    if (!insights.length && !answer.includes("证据状态")) {
      return `${answer}\n\n${buildEvidenceReferenceNote(insights)}`;
    }
    return answer;
  }
  return `${answer}\n\n${buildEvidenceReferenceNote(insights)}`;
}

function appendCreationProvenanceNote(
  answer: string,
  plan: AgentPlan,
  postProject?: PostProject | null,
  currentDraft?: DraftRecord | null
): string {
  if (!shouldAppendCreationProvenance(plan)) {
    return answer;
  }
  if (/创作依据：|为什么这样创作/.test(answer)) {
    return answer;
  }
  const provenance = buildCreationProvenanceSummary(postProject, currentDraft ?? postProject?.copyDraft ?? null);
  if (!provenance.canExplainCreation && answer.includes("证据状态")) {
    return answer;
  }
  return `${answer}\n\n${formatCreationProvenanceForReply(provenance)}`;
}

function shouldAppendCreationProvenance(plan: AgentPlan): boolean {
  return plan.steps.some((step) =>
    ["generateDraft", "reviseDraft", "planVisuals", "generateImages", "generateCards", "assemblePost", "runQualityGate"].includes(step.action)
  );
}

function shouldAppendEvidenceReference(plan: AgentPlan): boolean {
  if (plan.intent === "ask") {
    return false;
  }
  if (plan.intent !== "answer") {
    return true;
  }
  return plan.steps.some((step) => {
    if (["createCreativeBrief", "generateDraft", "planVisuals", "summarizeEvidence", "runQualityGate", "assemblePost", "generateImages", "generateCards"].includes(step.action)) {
      return true;
    }
    return /evidence|CreativeBrief|visual|image prompt|draft|quality gate|证据|图片方向|文案|草稿/i.test(step.reason);
  });
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
    stage: getActivePublishPlan(workspace, postProject) ? inferStageFromActiveState(workspace, postProject) : postProject?.currentStage ?? inferStageFromWorkspace(workspace),
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
      ...questions.map((question, index) => `${index + 1}. ${question}`),
      buildClarifyingReplyTemplate(questions)
    ].join("\n"),
    questions,
    workspace
  };
}

function buildClarifyingReplyTemplate(questions: string[]): string {
  const joined = questions.join(" ");
  const slots = [
    /主题|研究|创作/.test(joined) ? "主题：" : "",
    /目标人群|人群/.test(joined) ? "目标人群：" : "",
    /目标是什么|内容目标|发布前|发布/.test(joined) ? "内容目标：" : "",
    /卖点|体验点|语气|禁忌|产品|账号信息/.test(joined) ? "卖点/语气/禁忌：" : "",
    /图片|产品图|参考图|上传/.test(joined) ? "图片要求：" : ""
  ].filter(Boolean);
  const uniqueSlots = Array.from(new Set(slots));
  if (!uniqueSlots.length) {
    return "你可以直接回复：下一步我想做：继续研究 / 生成文案 / 规划图片 / 发布检查。";
  }
  return `你可以直接回复：${uniqueSlots.join("；")}。`;
}

function buildClarifyingQuestions(plan: AgentPlan, workspace: WorkspaceState, postProject?: PostProject | null): string[] {
  const questions: string[] = [];
  if (isRevisionWithoutDraftPlan(plan, workspace, postProject)) {
    questions.push("当前还没有可修改的文案草稿或最终帖子。你想先基于现有证据生成一版，还是重新做主题研究？");
    questions.push("如果你要修改某段已有内容，请把那段标题/正文/标签贴进来，或先在画布里选择要修改的草稿版本。");
    return questions;
  }
  if (isPublishWithoutDraftPlan(plan, workspace, postProject)) {
    questions.push("当前还没有可发布的草稿或最终帖子。请先生成文案并选择图片，或告诉我用哪一篇草稿发布。");
    questions.push("发布前你希望先做哪一步：生成文案、选择图片、组装最终帖子，还是重新研究主题？");
    return questions;
  }
  if (plan.requiresAssets) {
    questions.push("请先上传产品图/参考图，或说明可以不基于图片直接生成。");
  }
  if (isDraftRequestWithoutEvidence(plan, postProject)) {
    const evidenceCount = (postProject?.evidencePack?.insights?.length ?? 0) + (postProject?.selectedSamples?.length ?? 0);
    const hasBriefInputs = Boolean(
      postProject?.targetAudience ||
      postProject?.goal ||
      postProject?.tone ||
      postProject?.productInfo?.name
    );
    if (!evidenceCount) {
      questions.push("要先基于真实笔记研究，还是直接用你补充的产品/账号信息写？如果要研究，请告诉我主题、时间范围和样本数量。");
    }
    if (!postProject?.creativeBrief || (!evidenceCount && !hasBriefInputs)) {
      questions.push("这篇内容的目标人群、核心卖点/体验点、语气和禁忌点分别是什么？我会先整理 CreativeBrief 再写。");
    }
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

function isDraftRequestWithoutEvidence(plan: AgentPlan, postProject?: PostProject | null): boolean {
  return plan.intent === "ask" && plan.steps.some((step) =>
    step.action === "askClarifyingQuestion" && /draft creation|evidence|CreativeBrief/i.test(step.reason)
  ) && !postProject?.copyDraft;
}

function isPublishWithoutDraftPlan(plan: AgentPlan, workspace: WorkspaceState, postProject?: PostProject | null): boolean {
  const asksPublishWithoutDraft = plan.intent === "ask" && plan.steps.some((step) =>
    step.action === "askClarifyingQuestion" && /publish|assembled post/i.test(step.reason)
  );
  if (!asksPublishWithoutDraft) return false;
  return !workspace.currentDraft && !postProject?.copyDraft && !postProject?.finalPost;
}

function isRevisionWithoutDraftPlan(plan: AgentPlan, workspace: WorkspaceState, postProject?: PostProject | null): boolean {
  const asksRevisionWithoutDraft = plan.intent === "ask" && plan.steps.some((step) =>
    step.action === "askClarifyingQuestion" && /revise copy/i.test(step.reason)
  );
  if (!asksRevisionWithoutDraft) return false;
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

async function maybeHandleProjectRecoveryTurn(
  plan: ReturnType<typeof createAgentPlan>,
  postProject: PostProject
): Promise<{ answer: string; workspace: WorkspaceState; postProject: PostProject } | null> {
  if (plan.intent !== "recover_project") {
    return null;
  }
  const publishPlan = postProject.publishPlan?.status === "blocked" || postProject.publishPlan?.status === "failed"
    ? null
    : postProject.publishPlan;
  const auditStatus: PostProject["auditStatus"] = postProject.qualityCheck
    ? (postProject.qualityCheck.canPublish ? "passed" : "blocked")
    : "unchecked";
  const recoveredCandidate: PostProject = {
    ...postProject,
    publishPlan,
    auditStatus
  };
  const updatedProject = await updatePostProject({
    publishPlan,
    auditStatus,
    currentStage: inferPostStage(recoveredCandidate)
  });
  const workspace = await updateWorkspaceState({
    publishPlan,
    lastUserIntent: "recover_project"
  });
  const guidance = getPostStageGuidance(updatedProject.currentStage, updatedProject.allowedActions);
  return {
    answer: [
      "已恢复当前 PostProject，可以继续创作。",
      `当前阶段：${guidance.title}`,
      `建议下一步：${updatedProject.allowedActions.slice(0, 3).map((action) => postActionLabels[action] ?? action).join(" / ") || "等待补充信息"}`
    ].join("\n"),
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

async function maybeHandleCreativeBriefTurn(
  input: RunAgentTurnInput,
  plan: ReturnType<typeof createAgentPlan>,
  postProject: PostProject
): Promise<{ answer: string; workspace: WorkspaceState; postProject: PostProject } | null> {
  if (plan.intent !== "create_creative_brief") {
    return null;
  }

  const candidate: PostProject = {
    ...postProject,
    creativeBrief: undefined
  };
  const creativeBrief = deriveCreativeBrief(candidate);
  if (!creativeBrief) {
    const workspace = await updateWorkspaceState({ lastUserIntent: "create_creative_brief" });
    return {
      answer: [
        "当前还不能生成可靠的 CreativeBrief：PostProject 缺少主题、目标人群、内容目标、用户输入或可追溯研究证据。",
        "请先补充创作需求，或搜索真实小红书笔记后再生成 CreativeBrief。"
      ].join("\n"),
      workspace,
      postProject
    };
  }

  const updatedProject = await updatePostProject({
    creativeBrief,
    visualDirection: undefined,
    imagePrompts: [],
    finalPost: undefined,
    qualityCheck: undefined,
    auditStatus: "unchecked",
    currentStage: "brief_ready"
  });
  const referenceSummary = buildEvidenceReferenceSummary(updatedProject, creativeBrief.basedOnEvidenceIds);
  const workspace = await updateWorkspaceState({
    topic: updatedProject.topic,
    evidenceSummary: updatedProject.evidencePack.summary,
    selectedSamples: updatedProject.selectedSamples,
    lastUserIntent: "create_creative_brief"
  });
  return {
    answer: [
      "已刷新当前 PostProject 的 CreativeBrief。文案和图片方向都会基于这同一份 Brief 继续生成。",
      `目标人群：${creativeBrief.audience}`,
      `内容角度：${creativeBrief.contentAngle}`,
      `情绪钩子：${creativeBrief.emotionalHook}`,
      `视觉氛围：${creativeBrief.visualMood}`,
      referenceSummary.insights.length
        ? `参考证据：${referenceSummary.summary}\n${referenceSummary.insights.slice(0, 5).map((insight) => `- ${insight.id}｜${labelForEvidenceSource(insight.sourceType)}｜${insight.type}：${insight.insight}`).join("\n")}`
        : "证据状态：这份 Brief 主要来自用户输入，暂时不能当作小红书研究结论。",
      "下一步可以生成文案，或先生成图片方向让我确认。"
    ].join("\n"),
    workspace,
    postProject: updatedProject
  };
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
  const viralKnowledge = extractViralKnowledgeSummary(updatedProject.evidencePack.summary);
  const sufficiencyLine = formatRagSufficiencyForAnswer(viralKnowledge);
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
      sufficiencyLine,
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
  if (plan) {
    cards.push(buildDirectorSummaryCard({ workspace, currentDraft, postProject, plan }));
  }
  if (plan && shouldShowClarifyNextStepsCard(plan)) {
    cards.push(buildClarifyNextStepsCard({ plan, workspace, postProject }));
  }
  if (plan && shouldShowAgentPlanCard(plan)) {
    const plannedSteps = plan.steps.map((step, index) => ({
      index: index + 1,
      action: step.action,
      label: labelForAgentPlanAction(step.action),
      toolName: step.toolName,
      reason: step.reason
    }));
    cards.push({
      id: "card-agent-plan",
      type: "agent_plan",
      title: "Agent 执行计划",
      summary: `计划 ${plannedSteps.length} 步：${plannedSteps.slice(0, 5).map((item) => item.label).join(" → ")}${plannedSteps.length > 5 ? " → ..." : ""}`,
      data: {
        intent: plan.intent,
        intentConfidence: inferIntentConfidence(plan, workspace),
        topic: plan.topic,
        steps: plannedSteps,
        safetyNote: plan.steps.some((step) => step.action === "preparePublish" || step.action === "schedulePublish" || step.action === "runQualityGate")
          ? "涉及发布或发布检查时，仍需要人工确认后才会执行真实外部发布。"
          : "这只是当前对话的可解释计划，真实外部动作仍受工具和安全策略约束。"
      }
    });
  }
  if (postProject) {
    const guidance = getPostStageGuidance(postProject.currentStage, postProject.allowedActions);
    const readiness = buildPostReadinessReport(postProject);
    const weakViralRag = isWeakViralRagForCreativeOutput(postProject);
    const visibleAllowedActions = weakViralRag
      ? prioritizeRagRefreshActions(postProject.allowedActions)
      : postProject.allowedActions;
    const stagePrimaryAction = weakViralRag
      ? "retrieve_viral_knowledge"
      : readiness.nextAction ?? guidance.primaryAction;
    cards.push({
      id: "card-stage-guidance",
      type: "stage_guidance",
      title: guidance.title,
      summary: `${guidance.description} 下一步：${visibleAllowedActions.slice(0, 3).map((action) => postActionLabels[action] ?? action).join(" / ") || "等待补充信息"}`,
      data: {
        stage: postProject.currentStage,
        allowedActions: visibleAllowedActions,
        primaryAction: stagePrimaryAction,
        readiness
      }
    });
  }
  const projectInsights = postProject?.evidencePack.insights ?? [];
  const evidenceSampleCount = postProject?.selectedSamples.length ?? workspace.selectedSamples.length;
  const sourceCounts = countEvidenceSources(projectInsights);
  if (projectInsights.length || workspace.evidenceSummary || workspace.selectedSamples.length) {
    const evidenceSummary = postProject?.evidencePack.summary ?? workspace.evidenceSummary;
    const viralKnowledge = extractViralKnowledgeSummary(evidenceSummary);
    const sourceSummary = projectInsights.length
      ? `实时 ${sourceCounts.realtime} / 爆款库 ${sourceCounts.viral_library} / 用户输入 ${sourceCounts.user_input}`
      : `旧工作区样本 ${workspace.selectedSamples.length}`;
    cards.push({
      id: "card-evidence-summary",
      type: "evidence_summary",
      title: "研究证据摘要",
      summary: `已沉淀 ${evidenceSampleCount} 条样本、${projectInsights.length} 条可追溯结论。来源：${sourceSummary}。`,
      data: {
        summary: postProject?.evidencePack.summary ?? workspace.evidenceSummary,
        sampleIds: postProject?.evidencePack.sampleIds ?? [],
        insightCount: projectInsights.length,
        sourceCounts,
        keyInsights: projectInsights.slice(0, 5)
      }
    });
    if (viralKnowledge && hasViralKnowledgePayload(viralKnowledge)) {
      const ragNextActions = buildViralRagNextActions({ plan, workspace, postProject, viralKnowledge });
      cards.push({
        id: "card-viral-knowledge",
        type: "viral_knowledge",
        title: "爆款库规律",
        summary: formatViralKnowledgeCardSummary(viralKnowledge),
        data: {
          ...viralKnowledge,
          nextActions: ragNextActions
        }
      });
    }
  }
  const viralStrategy = extractViralStrategyReport(postProject?.evidencePack.summary ?? workspace.evidenceSummary);
  if (viralStrategy) {
    const viralKnowledge = extractViralKnowledgeSummary(postProject?.evidencePack.summary ?? workspace.evidenceSummary);
    cards.push({
      id: "card-viral-strategy",
      type: "viral_knowledge",
      title: "爆款策略",
      summary: viralStrategy.summary,
      data: {
        ...viralStrategy,
        nextActions: viralKnowledge
          ? buildViralRagNextActions({ plan, workspace, postProject, viralKnowledge })
          : []
      }
    });
  }
  if (postProject?.creativeBrief) {
    const referenceSummary = buildEvidenceReferenceSummary(postProject, postProject.creativeBrief.basedOnEvidenceIds);
    cards.push({
      id: "card-creative-brief",
      type: "creative_brief",
      title: "CreativeBrief",
      summary: `${postProject.creativeBrief.contentAngle} · ${postProject.creativeBrief.tone}`,
      data: {
        ...postProject.creativeBrief,
        evidenceSummary: referenceSummary
      }
    });
  }

  const draft = currentDraft ?? workspace.currentDraft;
  if (postProject?.creativeBrief || draft || postProject?.visualDirection || postProject?.imagePrompts.length) {
    const provenance = buildCreationProvenanceSummary(postProject, draft);
    cards.push({
      id: "card-creation-provenance",
      type: "creation_provenance",
      title: provenance.headline,
      summary: provenance.detail,
      data: provenance
    });
  }
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
    const referenceSummary = buildEvidenceReferenceSummary(postProject, postProject.visualDirection.basedOnEvidenceIds);
    const visualConfirmationLabel = postProject.visualDirection.confirmationStatus === "confirmed" || postProject.visualDirection.confirmedAt
      ? "已确认"
      : "待确认";
    cards.push({
      id: "card-visual-direction",
      type: "visual_direction",
      title: "视觉方向",
      summary: `${postProject.visualDirection.mood} · ${postProject.visualDirection.composition} · ${visualConfirmationLabel}`,
      data: {
        ...postProject.visualDirection,
        confirmationStatus: postProject.visualDirection.confirmationStatus ?? (postProject.visualDirection.confirmedAt ? "confirmed" : "pending"),
        evidenceSummary: referenceSummary
      }
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
  const activePublishPlan = getActivePublishPlan(workspace, postProject);
  if (activePublishPlan) {
    const publishCard = buildPublishCheckCard(activePublishPlan, postProject);
    cards.push({
      id: "card-publish-check",
      type: "publish_check",
      title: publishCard.title,
      summary: publishCard.summary,
      data: publishCard.data
    });
  }
  return cards;
}

function buildDirectorSummaryCard({
  workspace,
  currentDraft,
  postProject,
  plan
}: {
  workspace: WorkspaceState;
  currentDraft?: DraftRecord | null;
  postProject?: PostProject | null;
  plan: AgentPlan;
}): AgentResponseCard {
  const stage = postProject?.currentStage ?? inferStageFromWorkspace(workspace);
  const guidance = getPostStageGuidance(stage, postProject?.allowedActions ?? []);
  const readiness = postProject ? buildPostReadinessReport(postProject) : null;
  const primaryAction = readiness?.nextAction ?? guidance.primaryAction;
  const actionLabel = primaryAction ? postActionLabels[primaryAction] ?? primaryAction : "补充创作信息";
  const plannedActions = plan.steps.map((step) => labelForAgentPlanAction(step.action));
  const did = plannedActions.length ? plannedActions.slice(0, 3).join(" → ") : "理解当前需求";
  const why = buildDirectorReason({ plan, postProject, workspace, currentDraft });
  const summary = [
    `阶段：${guidance.title}`,
    `本轮：${did}`,
    `下一步：${actionLabel}`
  ].join(" · ");

  return {
    id: "card-director-summary",
    type: "director_summary",
    title: plan.intent === "ask" ? "我先帮你把信息补齐" : "我会按当前项目阶段推进",
    summary,
    data: {
      stage,
      stageTitle: guidance.title,
      stageDescription: guidance.description,
      intent: plan.intent,
      intentConfidence: inferIntentConfidence(plan, workspace),
      did: plannedActions,
      why,
      nextAction: primaryAction,
      nextActionLabel: actionLabel,
      needsUserInput: plan.intent === "ask" || plan.steps.some((step) => step.action === "askClarifyingQuestion"),
      progress: readiness?.progress,
      blockerCount: readiness?.blockers.length ?? 0,
      hasDraft: Boolean(currentDraft ?? workspace.currentDraft ?? postProject?.copyDraft ?? postProject?.finalPost),
      evidenceCount: postProject?.evidencePack.insights.length ?? 0,
      memoryHints: postProject?.agentMemory.slice(0, 3) ?? [],
      memorySignalCount: postProject?.agentMemory.length ?? 0
    }
  };
}

function shouldShowClarifyNextStepsCard(plan: AgentPlan): boolean {
  return plan.intent === "ask" || plan.steps.some((step) => step.action === "askClarifyingQuestion");
}

function buildClarifyNextStepsCard({
  plan,
  workspace,
  postProject
}: {
  plan: AgentPlan;
  workspace: WorkspaceState;
  postProject?: PostProject | null;
}): AgentResponseCard {
  const questions = buildClarifyingQuestions(plan, workspace, postProject);
  const quickActions = buildQuickActions(plan, workspace, postProject);
  const stage = postProject?.currentStage ?? inferStageFromWorkspace(workspace);
  const guidance = getPostStageGuidance(stage, postProject?.allowedActions ?? []);
  return {
    id: "card-clarify-next-steps",
    type: "clarify_next_steps",
    title: "补充信息后再执行",
    summary: questions.slice(0, 2).join("；") || guidance.description,
    data: {
      stage,
      stageTitle: guidance.title,
      intent: plan.intent,
      intentConfidence: inferIntentConfidence(plan, workspace),
      questions,
      replyTemplate: buildClarifyingReplyTemplate(questions),
      quickActions,
      safetyNote: "意图不清晰时不会调用搜索、生图、发布或定时工具。"
    }
  };
}

function buildDirectorReason({
  plan,
  postProject,
  workspace,
  currentDraft
}: {
  plan: AgentPlan;
  postProject?: PostProject | null;
  workspace: WorkspaceState;
  currentDraft?: DraftRecord | null;
}): string {
  if (plan.intent === "ask") {
    return "信息不足或意图置信度偏低，先澄清可以避免搜错主题、写偏文案或误触发发布。";
  }
  if (plan.steps.some((step) => step.action === "retrieveViralKnowledge")) {
    return "同时参考实时研究和爆款库规律，但只提取结构、钩子和风格，不复制原文或原图。";
  }
  if (plan.steps.some((step) => step.action === "preparePublish" || step.action === "schedulePublish")) {
    return "发布属于真实外部动作，必须先生成确认单并核对账号、版本、图片、可见范围和时间。";
  }
  if (plan.steps.some((step) => step.action === "generateDraft" || step.action === "planVisuals")) {
    return "文案和图片方向会共享同一个 CreativeBrief，并保留 basedOnEvidenceIds 方便追溯。";
  }
  if (plan.steps.some((step) => step.action === "runQualityGate")) {
    return "进入发布前先检查图文一致、证据引用、广告感、夸张功效和版本快照。";
  }
  if (postProject?.currentStage && postProject.currentStage !== "empty") {
    return "当前已经有 PostProject 上下文，所以可以沿着阶段继续推进，不需要你重复完整需求。";
  }
  if (currentDraft ?? workspace.currentDraft) {
    return "当前已有草稿上下文，后续修改会围绕这篇内容而不是另起一篇。";
  }
  return "我会先读取当前项目状态，再决定执行、追问或生成下一步计划。";
}

function shouldShowAgentPlanCard(plan: AgentPlan): boolean {
  if (plan.intent === "ask") return false;
  if (plan.steps.length >= 3) return true;
  return plan.steps.some((step) =>
    ["saveViralKnowledge", "createCreativeBrief", "planVisuals", "confirmVisualDirection", "assemblePost", "runQualityGate", "schedulePublish"].includes(step.action)
  );
}

function labelForAgentPlanAction(action: AgentAction): string {
  const labels: Record<AgentAction, string> = {
    startProject: "新建项目",
    research: "搜索真实笔记",
    retrieveViralKnowledge: "检索爆款库",
    saveViralKnowledge: "保存爆款规律",
    summarizeEvidence: "总结证据",
    createCreativeBrief: "生成 CreativeBrief",
    generateDraft: "生成文案",
    reviseDraft: "修改文案",
    planVisuals: "规划图片方向",
    confirmVisualDirection: "确认图片方向",
    generateImages: "生成图片",
    generateCards: "生成图文卡片",
    selectImages: "选择图片",
    assemblePost: "组装发布稿",
    runQualityGate: "发布前质检",
    recoverProject: "恢复项目",
    preparePublish: "准备发布确认",
    schedulePublish: "生成定时计划",
    reviewPublishConfirmation: "查看确认单",
    cancelPublishConfirmation: "取消确认单",
    askClarifyingQuestion: "补充信息",
    answer: "直接回答"
  };
  return labels[action];
}

function buildPublishCheckCard(
  publishPlan: NonNullable<WorkspaceState["publishPlan"]>,
  postProject?: PostProject | null
): { title: string; summary: string; data: Record<string, unknown> } {
  const checklist = publishPlan.confirmationChecklist ?? [];
  const required = checklist.filter((item) => item.required);
  const confirmed = required.filter((item) => item.confirmed);
  const versionSnapshot = publishPlan.versionSnapshot ?? (postProject ? buildPublishVersionSnapshot(postProject) : undefined);
  const evidenceSummary = publishPlan.evidenceCitationSummary?.summary;
  const guardrailBlockers = (publishPlan.guardrailResults ?? []).filter(Boolean);
  const blockers = [
    ...guardrailBlockers,
    ...checklist.filter((item) => item.required && !item.confirmed).map((item) => item.label),
    ...(versionSnapshot?.warnings ?? [])
  ].slice(0, 6);
  const isBlockedOrFailed = publishPlan.status === "blocked" || publishPlan.status === "failed";
  const summary = [
    `状态：${publishPlan.status}`,
    `人工确认：${confirmed.length}/${required.length}`,
    versionSnapshot?.qualityGateFresh ? "版本已锁定" : "版本需复核",
    evidenceSummary ? `证据：${evidenceSummary}` : "",
    blockers.length ? `待处理：${blockers.slice(0, 3).join("、")}` : ""
  ].filter(Boolean).join("；");
  return {
    title: publishPlan.status === "awaiting_approval"
      ? "发布确认待人工核对"
      : publishPlan.status === "blocked"
        ? "发布准备被拦截"
        : publishPlan.status === "failed"
          ? "发布失败待处理"
          : "发布确认",
    summary,
    data: {
      publishPlan,
      confirmation: {
        requiredCount: required.length,
        confirmedCount: confirmed.length,
        pending: checklist.filter((item) => item.required && !item.confirmed)
      },
      versionSnapshot,
      evidenceCitationSummary: publishPlan.evidenceCitationSummary,
      finalPost: postProject?.finalPost ?? null,
      selectedImages: postProject?.selectedImages.length
        ? postProject.selectedImages
        : versionSnapshot?.selectedImageIds.length
          ? versionSnapshot.selectedImageIds
          : publishPlan.images,
      blockers,
      nextActions: publishPlan.status === "awaiting_approval"
        ? ["review_publish_confirmation", "confirm_publish", "cancel_publish"]
        : isBlockedOrFailed
          ? ["run_quality_gate", "revise_copy", "select_images"]
          : ["review_publish_status"]
    }
  };
}

function countEvidenceSources(insights: PostProject["evidencePack"]["insights"]): Record<"realtime" | "viral_library" | "user_input", number> {
  return insights.reduce(
    (counts, insight) => {
      const source = insight.sourceType ?? "realtime";
      counts[source] += 1;
      return counts;
    },
    { realtime: 0, viral_library: 0, user_input: 0 }
  );
}

function extractViralKnowledgeSummary(summary: unknown): (Partial<ViralKnowledgePack> & Record<string, unknown>) | null {
  const viralKnowledge = isRecord(summary) ? summary.viralKnowledge : undefined;
  return isRecord(viralKnowledge) ? viralKnowledge as Partial<ViralKnowledgePack> & Record<string, unknown> : null;
}

function hasViralKnowledgePayload(viralKnowledge: Partial<ViralKnowledgePack> & Record<string, unknown>): boolean {
  return Boolean(
    (Array.isArray(viralKnowledge.results) && viralKnowledge.results.length) ||
    isRecord(viralKnowledge.sufficiency) ||
    isRecord(viralKnowledge.strategyReport)
  );
}

function isWeakViralRagForCreativeOutput(postProject: PostProject): boolean {
  const viralKnowledge = extractViralKnowledgeSummary(postProject.evidencePack.summary);
  const sufficiency = viralKnowledge && isRecord(viralKnowledge.sufficiency)
    ? viralKnowledge.sufficiency as Partial<RagSufficiency>
    : null;
  return sufficiency?.isEnough === false;
}

function prioritizeRagRefreshActions(actions: PostAction[]): PostAction[] {
  const blockedCreativeActions = new Set<PostAction>(["generate_copy", "plan_visuals"]);
  const safeActions = actions.filter((action) => !blockedCreativeActions.has(action));
  return safeActions.includes("retrieve_viral_knowledge")
    ? safeActions
    : ["retrieve_viral_knowledge", ...safeActions];
}

function formatViralKnowledgeCardSummary(viralKnowledge: Partial<ViralKnowledgePack> & Record<string, unknown>): string {
  const resultCount = Array.isArray(viralKnowledge.results) ? viralKnowledge.results.length : 0;
  const sufficiency = isRecord(viralKnowledge.sufficiency) ? viralKnowledge.sufficiency as Partial<RagSufficiency> : null;
  if (sufficiency && sufficiency.isEnough === false) {
    const missing = Array.isArray(sufficiency.missing) && sufficiency.missing.length
      ? `缺口：${sufficiency.missing.join("、")}。`
      : "";
    return `RAG 证据还不够，已检索 ${resultCount} 条历史规律。${sufficiency.recommendation ?? "建议补充实时研究或保存更多优秀样本。"}${missing}`;
  }
  if (sufficiency?.isEnough) {
    return `RAG 证据充足：实时 ${sufficiency.realtimeCount ?? 0} 条，爆款库 ${sufficiency.viralCount ?? resultCount} 条。`;
  }
  return `已检索 ${resultCount} 条历史爆款规律，用于补充实时证据。`;
}

function formatRagSufficiencyForAnswer(viralKnowledge: (Partial<ViralKnowledgePack> & Record<string, unknown>) | null): string {
  const sufficiency = viralKnowledge && isRecord(viralKnowledge.sufficiency)
    ? viralKnowledge.sufficiency as Partial<RagSufficiency>
    : null;
  if (!sufficiency) return "";
  const missing = Array.isArray(sufficiency.missing) && sufficiency.missing.length
    ? `缺口：${sufficiency.missing.join("、")}。`
    : "";
  if (sufficiency.isEnough === false) {
    return `RAG 证据还不够：${sufficiency.recommendation ?? "建议补充实时研究或保存更多优秀样本。"}${missing}`;
  }
  return `RAG 证据充足：实时 ${sufficiency.realtimeCount ?? 0} 条，爆款库 ${sufficiency.viralCount ?? 0} 条。`;
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
  const viralCoverageSummary = qualityCheck.viralCoverage
    ? `爆款库覆盖：${qualityCheck.viralCoverage.summary}`
    : "";
  const issueSummary = qualityCheck.issues.slice(0, 2).join("；");
  return [
    alignmentSummary,
    viralCoverageSummary,
    issueSummary || "发布前仍需人工确认账号、可见范围、图片版本和定时时间。"
  ].filter(Boolean).join("；");
}

const postActionLabels: Record<PostAction, string> = {
  start_brief: "补充创作信息",
  update_brief_inputs: "补充/修改需求",
  search_research: "搜索真实笔记",
  summarize_evidence: "总结证据优点",
  retrieve_viral_knowledge: "刷新爆款库 RAG",
  create_creative_brief: "生成创作 Brief",
  generate_copy: "生成文案",
  revise_copy: "修改当前文案",
  plan_visuals: "规划图片方向",
  confirm_visual_direction: "确认图片方向",
  generate_image_prompts: "生成图片提示词",
  generate_images: "生成配图",
  generate_cards: "生成图文卡片",
  select_images: "选择发布图片",
  assemble_post: "组装发布稿",
  run_quality_gate: "发布前检查",
  request_publish_confirmation: "生成发布确认单",
  schedule_publish: "生成定时发布确认单",
  publish_now: "生成立即发布确认单",
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
  const actions = uniquePostActions(preferred.length ? preferred : postProject.allowedActions)
    .filter((action) => canSurfacePostAction(action, readiness));
  return actions.slice(0, 4).map(actionToQuickAction);
}

function uniquePostActions(actions: PostAction[]): PostAction[] {
  return [...new Set(actions)];
}

function canSurfacePostAction(action: PostAction, readiness: ReturnType<typeof buildPostReadinessReport>): boolean {
  if (action === "run_quality_gate" || action === "request_publish_confirmation") {
    return readiness.items.some((item) => item.action === action);
  }
  if (action === "schedule_publish" || action === "publish_now") {
    return false;
  }
  return true;
}

function buildQuickActions(plan: AgentPlan, workspace: WorkspaceState, postProject?: PostProject | null) {
  const postProjectActions = buildPostProjectQuickActions(postProject);
  const activePublishPlan = getActivePublishPlan(workspace, postProject);
  if (activePublishPlan?.status === "awaiting_approval") {
    return [
      { id: "qa-review-publish-confirmation", label: "查看发布确认单", action: "review_publish_confirmation" },
      { id: "qa-confirm-publish", label: activePublishPlan.scheduleAt ? "确认定时发布" : "确认立即发布", action: "confirm_publish" },
      { id: "qa-cancel-publish", label: "取消确认单", action: "cancel_publish" }
    ];
  }
  if (activePublishPlan?.status === "blocked" || activePublishPlan?.status === "failed") {
    return [
      { id: "qa-run-quality-gate-after-block", label: "重新发布检查", action: "run_quality_gate" },
      { id: "qa-revise-copy-after-block", label: "修改当前文案", action: "revise_copy" },
      { id: "qa-select-images-after-block", label: "重新选图", action: "select_images" }
    ];
  }
  if (activePublishPlan?.status === "scheduled" || activePublishPlan?.status === "published") {
    return [
      { id: "qa-view-publish-status", label: "查看发布记录", action: "view_publish_history" },
      { id: "qa-start-next-project", label: "开始下一篇", action: "start_project" }
    ];
  }
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
  if (isRevisionWithoutDraftPlan(plan, workspace, postProject)) {
    const hasEvidenceOrBrief = Boolean(
      postProject?.creativeBrief ||
        postProject?.evidencePack.insights.length ||
        postProject?.selectedSamples.length ||
        workspace.evidenceSummary ||
        workspace.selectedSamples.length
    );
    return hasEvidenceOrBrief
      ? [
          { id: "qa-generate-copy-before-revise", label: "先生成一版草稿", action: "generate_copy" },
          { id: "qa-select-images-before-revise", label: "选择图片", action: "select_images" },
          { id: "qa-assemble-before-revise", label: "组装发布稿", action: "assemble_post" }
        ]
      : [
          { id: "qa-research-before-revise", label: "先搜索真实笔记", action: "search_research" },
          { id: "qa-add-brief-before-revise", label: "补充创作需求", action: "update_brief_inputs" }
        ];
  }
  const viralRagActions = buildViralRagNextActions({
    plan,
    workspace,
    postProject,
    viralKnowledge: extractViralKnowledgeSummary(postProject?.evidencePack.summary ?? workspace.evidenceSummary)
  });
  if (viralRagActions.length) {
    return viralRagActions;
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

function buildViralRagNextActions({
  plan,
  workspace,
  postProject,
  viralKnowledge
}: {
  plan?: AgentPlan;
  workspace: WorkspaceState;
  postProject?: PostProject | null;
  viralKnowledge?: (Partial<ViralKnowledgePack> & Record<string, unknown>) | null;
}): AgentQuickAction[] {
  if (plan?.intent !== "retrieve_viral_knowledge" || !viralKnowledge?.sufficiency) {
    return [];
  }
  const sufficiency = viralKnowledge.sufficiency;
  const hasSavedSamples = Boolean((postProject?.selectedSamples.length ?? 0) || workspace.selectedSamples.length);
  if (!sufficiency.isEnough) {
    return [
      { id: "qa-rag-search-realtime", label: "补搜真实笔记", action: "search_research" },
      { id: "qa-rag-save-samples", label: "保存优质样本入库", action: "save_viral_knowledge", disabled: !hasSavedSamples },
      { id: "qa-rag-refresh", label: "放宽筛选再检索", action: "retrieve_viral_knowledge" }
    ];
  }
  const actions: AgentQuickAction[] = [];
  if (!postProject?.creativeBrief) {
    actions.push({ id: "qa-rag-create-brief", label: "用 RAG 生成 Brief", action: "create_creative_brief" });
  }
  if (!postProject?.copyDraft && !workspace.currentDraft) {
    actions.push({ id: "qa-rag-generate-copy", label: "生成原创文案", action: "generate_copy" });
  } else {
    actions.push({ id: "qa-rag-revise-copy", label: "用规律优化文案", action: "revise_copy" });
  }
  if (!postProject?.visualDirection) {
    actions.push({ id: "qa-rag-plan-visuals", label: "生成图片方向", action: "plan_visuals" });
  } else if (!isVisualDirectionConfirmed(postProject.visualDirection)) {
    actions.push({ id: "qa-rag-confirm-visuals", label: "确认图片方向", action: "confirm_visual_direction" });
  } else {
    actions.push({ id: "qa-rag-assemble-post", label: "组装发布稿", action: "assemble_post" });
  }
  return actions.slice(0, 3);
}

function isVisualDirectionConfirmed(visualDirection: NonNullable<PostProject["visualDirection"]>): boolean {
  return visualDirection.confirmationStatus === "confirmed" || Boolean(visualDirection.confirmedAt);
}

function buildToolTraceItems(trace: ReturnType<typeof createTrace>, plan?: AgentPlan): AgentToolTraceItem[] {
  const eventLabels = new Set(trace.events.map((event) => event.label));
  const plannedAt = trace.events[0]?.createdAt ?? new Date().toISOString();
  const plannedItems: AgentToolTraceItem[] = plan?.steps
    .filter((step) => step.toolName && !eventLabels.has(step.toolName))
    .map((step, index) => ({
      id: `planned-${index + 1}-${step.action}`,
      label: step.toolName as string,
      status: "planned" as const,
      detail: step.reason,
      createdAt: plannedAt
    })) ?? [];
  const eventItems = trace.events.map((event) => ({
    id: event.id,
    label: event.label,
    status: statusForTraceEvent(event.type),
    detail: event.detail,
    createdAt: event.createdAt
  }));
  return [...plannedItems, ...eventItems];
}

function statusForTraceEvent(eventType: ReturnType<typeof createTrace>["events"][number]["type"]): AgentToolTraceItem["status"] {
  if (eventType === "run_failed") return "failed";
  if (eventType === "run_started" || eventType === "tool_called") return "running";
  return "completed";
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

function inferStageFromActiveState(workspace: WorkspaceState, postProject?: PostProject | null): AgentTurnResult["stage"] {
  const activePublishPlan = getActivePublishPlan(workspace, postProject);
  if (activePublishPlan?.status === "published") return "published";
  if (activePublishPlan?.status === "scheduled") return "scheduled";
  if (activePublishPlan) return "reviewing";
  return postProject?.currentStage ?? inferStageFromWorkspace(workspace);
}

function getActivePublishPlan(
  workspace: WorkspaceState,
  postProject?: PostProject | null
): WorkspaceState["publishPlan"] | NonNullable<PostProject["publishPlan"]> | null {
  return postProject?.publishPlan ?? workspace.publishPlan ?? null;
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
  const activeProject = await readPostProject();
  const currentDraft =
    input.currentDraft ??
    existing.currentDraft ??
    activeProject.copyDraft ??
    draftFromFinalPost(activeProject, input.settings.defaultVisibility) ??
    null;
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
    plan.steps.some((step) =>
      step.action === "planVisuals" ||
      (step.action === "answer" && /visual|image prompt|图片|Prompt/i.test(step.reason))
    );
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

  const derivedVisualDirection = deriveVisualDirection({
    creativeBrief,
    visualDirection: postProject.visualDirection
  });
  const visualDirection = derivedVisualDirection
    ? {
        ...derivedVisualDirection,
        confirmationStatus: "pending" as const,
        confirmedAt: undefined,
        confirmedBy: undefined
      }
    : undefined;
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
  const visualEvidenceIds = uniqueIds([
    ...getFocusedEvidenceIds(updatedProject),
    ...(updatedProject.visualDirection?.basedOnEvidenceIds ?? []),
    ...(imagePrompt?.basedOnEvidenceIds ?? [])
  ]);
  const visualEvidenceSummary = buildEvidenceReferenceSummary(updatedProject, visualEvidenceIds);
  const visualEvidenceLines = visualEvidenceSummary.insights
    .map((insight) => `- ${insight.id}｜${labelForEvidenceSource(insight.sourceType)}｜${insight.type}: ${insight.insight}`)
    .join("\n");
  const workspace = await updateWorkspaceState({ lastUserIntent: "plan_visuals" });
  return {
    answer: [
      "已基于当前 CreativeBrief 生成图片方向和图片提示词。",
      `视觉氛围：${updatedProject.visualDirection?.mood ?? creativeBrief.visualMood}`,
      `构图：${updatedProject.visualDirection?.composition ?? "封面突出主体，正文图递进展示细节"}`,
      imagePrompt ? `Prompt：${imagePrompt.value.prompt}` : "",
      visualEvidenceLines ? `参考证据：${visualEvidenceSummary.summary}\n${visualEvidenceLines}` : "",
      "下一步请先确认图片方向；确认后我再继续生成图片或进入发布检查。"
    ].filter(Boolean).join("\n"),
    workspace,
    postProject: updatedProject
  };
}

async function maybeHandleVisualDirectionConfirmationTurn(
  input: RunAgentTurnInput,
  plan: ReturnType<typeof createAgentPlan>,
  postProject: PostProject
): Promise<{ answer: string; workspace: WorkspaceState; postProject: PostProject } | null> {
  if (plan.intent !== "confirm_visual_direction") {
    return null;
  }

  if (!postProject.visualDirection) {
    const workspace = await updateWorkspaceState({ lastUserIntent: "confirm_visual_direction" });
    return {
      answer: "当前项目还没有图片方向可以确认。请先让我基于 CreativeBrief 规划图片方向，再确认是否采用。",
      workspace,
      postProject
    };
  }

  const confirmedAt = new Date().toISOString();
  const updatedProject = await updatePostProject({
    visualDirection: {
      ...postProject.visualDirection,
      confirmationStatus: "confirmed",
      confirmedAt,
      confirmedBy: "user"
    },
    auditStatus: "unchecked",
    qualityCheck: undefined,
    currentStage: postProject.imagePrompts.length ? "image_prompt_ready" : "visual_planning"
  });
  const workspace = await updateWorkspaceState({ lastUserIntent: "confirm_visual_direction" });
  return {
    answer: [
      "已确认当前图片方向，后续生图、选图和发布检查都会以这个方向作为人工确认版本。",
      `视觉氛围：${updatedProject.visualDirection?.mood}`,
      `构图：${updatedProject.visualDirection?.composition}`,
      updatedProject.imagePrompts.length
        ? "下一步可以生成配图或图文卡片。"
        : "下一步可以生成图片 Prompt。"
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
  const focusedEvidenceIds = getFocusedEvidenceIds(evidenceReadyProject);
  const prioritizedEvidenceIds = focusedEvidenceIds.length ? focusedEvidenceIds : evidenceIds;
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
  const focusedEvidenceForPrompt = focusedEvidenceIds
    .map((id) => evidenceReadyProject.evidencePack.insights.find((insight) => insight.id === id))
    .filter((insight): insight is NonNullable<typeof insight> => Boolean(insight))
    .map((insight) => ({
      id: insight.id,
      sourceType: insight.sourceType ?? "realtime",
      type: insight.type,
      insight: insight.insight,
      confidence: insight.confidence
    }));
  const viralSafetyContext = buildViralSafetyContextForPrompt(evidenceReadyProject);
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
    basedOnEvidenceIds: prioritizedEvidenceIds.slice(0, 8),
    evidenceReferences: {
      title: prioritizedEvidenceIds.slice(0, 3),
      content: prioritizedEvidenceIds.slice(0, 5),
      tags: prioritizedEvidenceIds.slice(0, 5),
      imagePrompt: prioritizedEvidenceIds.slice(0, 5)
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

本次重点规律（如果非空，标题、正文、标签、图片提示词必须优先围绕这些 id，并在 evidenceReferences 中至少引用 1 条）：
${JSON.stringify(focusedEvidenceForPrompt, null, 2)}

爆款库原创边界（生成时必须遵守；只学习规律，不复述来源表达）：
${JSON.stringify(viralSafetyContext, null, 2)}

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
    finalPost: undefined,
    publishPlan: null,
    qualityCheck: undefined,
    auditStatus: "unchecked",
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
  const nextStep = formatDraftNextStep(updatedProject);
  return {
    answer: [
      "已基于当前 PostProject、CreativeBrief、实时证据和爆款库规律生成原创草稿。",
      `标题：${draft.title}`,
      "",
      draft.content,
      "",
      `标签：${draft.tags.map((tag) => `#${tag}`).join(" ")}`,
      "",
      referenced,
      nextStep
    ].filter(Boolean).join("\n"),
    currentDraft: draftRecord,
    workspace,
    postProject: updatedProject
  };
}

function formatDraftNextStep(project: PostProject): string {
  const readiness = buildPostReadinessReport(project);
  const nextAction = readiness.nextAction;
  if (nextAction === "plan_visuals" || nextAction === "generate_image_prompts") {
    return "下一步建议：先生成图片方向和图片提示词，让配图继续沿用同一份 CreativeBrief。";
  }
  if (nextAction === "generate_images" || nextAction === "generate_cards" || nextAction === "select_images") {
    return "下一步建议：生成或选择发布图片，再把文案和图片装配成最终帖子。";
  }
  if (nextAction === "assemble_post") {
    return "下一步建议：把当前文案和选中图片组装成最终帖子，然后运行发布前检查。";
  }
  if (nextAction === "run_quality_gate") {
    return "下一步建议：运行 Quality Gate，检查图文一致、证据追溯和发布风险。";
  }
  return "下一步建议：在右侧成果画布确认当前文案版本，再继续图片方向、选图或发布检查。";
}

async function maybeHandleDraftRevisionTurn(
  input: RunAgentTurnInput,
  plan: ReturnType<typeof createAgentPlan>,
  postProject: PostProject
): Promise<{ answer: string; currentDraft: DraftRecord; workspace: WorkspaceState; postProject: PostProject } | null> {
  if (plan.intent !== "revise_draft") {
    return null;
  }

  const existing = await readWorkspaceState();
  const currentDraft = postProject.copyDraft ?? input.currentDraft ?? existing.currentDraft ?? null;
  if (!currentDraft) {
    const workspace = await updateWorkspaceState({ lastUserIntent: plan.intent });
    return {
      answer: "我可以修改文案，但当前 PostProject 还没有草稿。请先基于证据生成一版文案。",
      currentDraft: createDraftRecord({
        draft: {
          title: "等待生成草稿",
          content: "当前项目还没有可修改的草稿。",
          tags: [],
          structure: [],
          imagePrompt: "",
          basedOnEvidenceIds: postProject.evidencePack.insights.map((insight) => insight.id)
        },
        images: [],
        visibility: input.settings.defaultVisibility
      }),
      workspace,
      postProject
    };
  }

  if (!input.settings.textApiKey.trim()) {
    const workspace = await updateWorkspaceState({
      currentDraftId: currentDraft.id,
      currentDraft,
      lastUserIntent: plan.intent
    });
    return {
      answer: "修改当前文案需要文本模型 API Key。请先在设置页配置文本模型，再让我继续改稿。",
      currentDraft,
      workspace,
      postProject
    };
  }

  const evidenceIds = uniqueIds([
    ...(currentDraft.draft.basedOnEvidenceIds ?? []),
    ...(postProject.creativeBrief?.basedOnEvidenceIds ?? []),
    ...postProject.evidencePack.insights.map((insight) => insight.id)
  ]);
  const focusedEvidenceIds = getFocusedEvidenceIds(postProject);
  const prioritizedEvidenceIds = focusedEvidenceIds.length ? focusedEvidenceIds : evidenceIds;
  const evidenceForPrompt = postProject.evidencePack.insights
    .filter((insight) => evidenceIds.includes(insight.id))
    .slice(0, 12)
    .map((insight) => ({
      id: insight.id,
      sourceType: insight.sourceType ?? "realtime",
      type: insight.type,
      insight: insight.insight,
      confidence: insight.confidence
    }));
  const focusedEvidenceForPrompt = focusedEvidenceIds
    .map((id) => postProject.evidencePack.insights.find((insight) => insight.id === id))
    .filter((insight): insight is NonNullable<typeof insight> => Boolean(insight))
    .map((insight) => ({
      id: insight.id,
      sourceType: insight.sourceType ?? "realtime",
      type: insight.type,
      insight: insight.insight,
      confidence: insight.confidence
    }));
  const viralSafetyContext = buildViralSafetyContextForPrompt(postProject);
  const fallback: GeneratedDraft = {
    ...currentDraft.draft,
    basedOnEvidenceIds: (currentDraft.draft.basedOnEvidenceIds?.length ? currentDraft.draft.basedOnEvidenceIds : prioritizedEvidenceIds).slice(0, 8),
    evidenceReferences: currentDraft.draft.evidenceReferences ?? {
      title: prioritizedEvidenceIds.slice(0, 3),
      content: prioritizedEvidenceIds.slice(0, 5),
      tags: prioritizedEvidenceIds.slice(0, 5),
      imagePrompt: prioritizedEvidenceIds.slice(0, 5)
    }
  };
  const raw = await input.model.generateStructuredText(
    `你是小红书内容创作导演型 Agent 的 Editor。请在不丢失证据引用的前提下修改当前 PostProject 草稿。

用户修改要求：
${input.message}

当前草稿：
${JSON.stringify(currentDraft.draft, null, 2)}

PostProject：
${JSON.stringify({
  topic: postProject.topic,
  productInfo: postProject.productInfo,
  targetAudience: postProject.targetAudience,
  goal: postProject.goal,
  tone: postProject.tone,
  currentStage: postProject.currentStage
}, null, 2)}

CreativeBrief：
${JSON.stringify(postProject.creativeBrief ?? null, null, 2)}

可引用证据（只能引用这些 id；sourceType=viral_library 只能学习规律，不能复制原文）：
${JSON.stringify(evidenceForPrompt, null, 2)}

本次重点规律（如果非空，修改后的标题、正文、标签、图片提示词必须优先延续这些 id，并在 evidenceReferences 中至少引用 1 条）：
${JSON.stringify(focusedEvidenceForPrompt, null, 2)}

爆款库原创边界（修改时必须遵守；只学习规律，不复述来源表达）：
${JSON.stringify(viralSafetyContext, null, 2)}

要求：
1. 按用户要求修改标题、正文、标签、结构或图片提示词。
2. 保持原创，不能复制爆款样本原文，不能编造销量、认证、功效或官方背书。
3. 修改后的 title/content/tags/imagePrompt 必须继续记录 basedOnEvidenceIds 或 evidenceReferences。
4. 如果用户只要求改标题，也仍返回完整草稿 JSON。

请只返回 JSON：
{
  "title": "标题",
  "content": "正文",
  "tags": ["标签"],
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
    "Revise the current Xiaohongshu draft from PostProject evidence. Preserve citations and originality."
  );
  const revisedDraft = parseGeneratedDraft(raw, fallback, evidenceIds);
  const revisedRecord = createDraftRecord({
    draft: revisedDraft,
    images: currentDraft.images,
    visibility: currentDraft.visibility || input.settings.defaultVisibility,
    input: {
      topic: postProject.topic ?? revisedDraft.title,
      contentType: "Post Studio revision",
      timeRange: "当前项目",
      sampleCount: postProject.selectedSamples.length,
      visibility: currentDraft.visibility || input.settings.defaultVisibility,
      workflowGoal: "draft",
      publishMode: "draft",
      analyzeImages: true,
      generateImages: false,
      requirements: input.message,
      useViralKnowledge: true
    }
  });
  const copyVersion = copyVersionFromDraft(revisedRecord, revisedDraft.basedOnEvidenceIds ?? evidenceIds);
  const updatedProject = await updatePostProject({
    copyDraft: revisedRecord,
    copyVersions: [
      ...postProject.copyVersions.filter((version) => version.id !== copyVersion.id),
      copyVersion
    ],
    finalPost: undefined,
    publishPlan: null,
    qualityCheck: undefined,
    auditStatus: "unchecked",
    currentStage: "copy_ready"
  });
  const workspace = await updateWorkspaceState({
    topic: updatedProject.topic ?? revisedDraft.title,
    evidenceSummary: updatedProject.evidencePack.summary,
    selectedSamples: updatedProject.selectedSamples,
    currentDraftId: revisedRecord.id,
    currentDraft: revisedRecord,
    publishPlan: null,
    lastUserIntent: plan.intent
  });
  const referenced = summarizeEvidenceCitationReport(updatedProject, revisedDraft.basedOnEvidenceIds ?? evidenceIds, revisedDraft.evidenceReferences);
  return {
    answer: [
      "已按你的要求修改当前 PostProject 草稿，并保存为新的文案版本。",
      `标题：${revisedDraft.title}`,
      "",
      revisedDraft.content,
      "",
      `标签：${revisedDraft.tags.map((tag) => `#${tag}`).join(" ")}`,
      "",
      referenced,
      "旧的最终帖子、发布确认和 Quality Gate 已失效，需要重新组装并检查。"
    ].filter(Boolean).join("\n"),
    currentDraft: revisedRecord,
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
  if (plan.intent === "assemble_post") {
    const updatedProject = await updatePostProject({
      copyDraft: currentDraft,
      selectedImages,
      finalPost,
      qualityCheck: undefined,
      auditStatus: "unchecked",
      currentStage: "assembling"
    });
    const workspace = await updateWorkspaceState({
      currentDraftId: currentDraft.id,
      currentDraft,
      selectedImageIds: selectedImages,
      lastUserIntent: plan.intent
    });
    return {
      answer: [
        "已把当前文案和选中图片组装成最终发布预览，尚未运行 Quality Gate。",
        `标题：${currentDraft.draft.title}`,
        `图片：${selectedImages.length} 张`,
        "下一步建议：运行发布前检查，确认图文一致、证据追溯、夸张词和发布风险。"
      ].join("\n"),
      workspace,
      postProject: updatedProject
    };
  }

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
      qualityCheck.viralCoverage ? `爆款库覆盖：${qualityCheck.viralCoverage.summary}` : "",
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
  const activeProject = await readPostProject();
  const currentDraft =
    input.currentDraft ??
    existing.currentDraft ??
    activeProject.copyDraft ??
    draftFromFinalPost(activeProject, input.settings.defaultVisibility) ??
    null;
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

  if (activeProject.visualDirection && activeProject.visualDirection.confirmationStatus !== "confirmed" && !activeProject.visualDirection.confirmedAt) {
    const workspace = await updateWorkspaceState({
      currentDraftId: currentDraft.id,
      currentDraft,
      lastUserIntent: "generate_images"
    });
    return {
      answer: [
        "我先不直接生成图片：当前项目已有图片方向，但还没有人工确认。",
        `待确认方向：${activeProject.visualDirection.mood} · ${activeProject.visualDirection.composition}`,
        "请回复“确认图片方向”或在画布里点确认后，我再继续生成配图。"
      ].join("\n"),
      currentDraft,
      workspace
    };
  }

  const prompt = buildAgentImagePrompt({
    message: input.message,
    draft: currentDraft,
    evidenceSummary: activeProject.evidencePack.summary ?? existing.evidenceSummary,
    postProject: activeProject
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
  const activePromptVersion = activeProject.imagePrompts.at(-1);
  const imageEvidenceIds = getPrioritizedImageEvidenceIds(activeProject, 12);
  const sourceAssetIds = input.attachedAssets.map((asset) => asset.id);
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
            promptVersionId: activePromptVersion?.id,
            basedOnEvidenceIds: imageEvidenceIds,
            sourceAssetIds
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
    await appendGeneratedAssetsToPostProject({
      assetIds: [generatedAsset.id],
      promptId: activePromptVersion?.id,
      basedOnEvidenceIds: imageEvidenceIds,
      sourceAssetIds,
      select: true
    });
  }

  return {
    answer: [
      "已为当前 PostProject 草稿生成 1 张新图片，并放入成果画布。",
      `标题：${updatedDraft.draft.title}`,
      imageEvidenceIds.length ? `图片依据证据：${imageEvidenceIds.slice(0, 5).join("、")}` : "图片依据：当前草稿与用户最新需求，尚未绑定可追溯证据。",
      activePromptVersion ? `Prompt 版本：${activePromptVersion.id}` : ""
    ].filter(Boolean).join("\n"),
    currentDraft: updatedDraft,
    workspace
  };
}

async function maybeHandleGuardedPublishTurn(
  input: RunAgentTurnInput,
  plan: ReturnType<typeof createAgentPlan>,
  fallbackProject?: PostProject
): Promise<Pick<AgentTurnResult, "answer" | "currentDraft" | "workspace"> | null> {
  if (plan.intent !== "prepare_publish" && plan.intent !== "schedule_publish") {
    return null;
  }

  const existing = await readWorkspaceState();
  const activeProject = projectWithMorePublishContext(await readPostProject(), fallbackProject);
  const currentDraft =
    input.currentDraft ??
    existing.currentDraft ??
    activeProject.copyDraft ??
    draftFromFinalPost(activeProject, input.settings.defaultVisibility) ??
    null;
  if (!currentDraft) {
    const workspace = await updateWorkspaceState({ lastUserIntent: plan.intent });
    return {
      answer: "当前没有可发布的草稿。请先生成或选择一篇草稿，再让我准备发布。",
      currentDraft: undefined,
      workspace
    };
  }

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

  const projectForPublish = projectWithPublishDraft(activeProject, currentDraft);
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
      accountLabel: input.settings.accounts.find((account) => account.id === input.settings.activeAccountId)?.displayName,
      mcpUrl: input.settings.mcpUrl
    },
    publishContext: {
      evidenceCitationSummary: buildAgentPublishEvidenceCitationSummary(projectForPublish, currentDraft),
      versionSnapshot: buildPublishVersionSnapshot(projectForPublish)
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

async function maybeHandleViralKnowledgeSaveTurn(
  input: RunAgentTurnInput,
  plan: ReturnType<typeof createAgentPlan>,
  postProject: PostProject
): Promise<{
  answer: string;
  workspace: WorkspaceState;
  postProject: PostProject;
  savedCount: number;
  skippedSampleIds: string[];
  addedInsightIds: string[];
} | null> {
  if (plan.intent !== "save_viral_knowledge") {
    return null;
  }
  const samples = postProject.selectedSamples.filter(isSampleEvidenceLike) as SampleEvidence[];
  if (!samples.length) {
    const workspace = await updateWorkspaceState({ lastUserIntent: "save_viral_knowledge" });
    return {
      answer: "当前 PostProject 还没有可保存的实时研究样本。请先搜索/研究小红书笔记，拿到真实样本后再保存进爆款库。",
      workspace,
      postProject,
      savedCount: 0,
      skippedSampleIds: [],
      addedInsightIds: []
    };
  }

  const force = /强制|全部|低质量|也保存|force/i.test(input.message);
  const registry = createAgentToolRegistry();
  const candidates = samples
    .map((sample) => ({
      sample,
      review: reviewViralSaveCandidate(sample)
    }))
    .sort((a, b) => b.review.score - a.review.score)
    .slice(0, force ? 5 : 3);
  const results = [];
  const skippedSampleIds: string[] = [];

  for (const item of candidates) {
    try {
      const result = await registry.call("knowledge.saveViralCase", {
        sample: item.sample,
        topic: postProject.topic ?? plan.topic ?? item.sample.title,
        category: postProject.goal ?? "小红书图文",
        model: input.settings.textApiKey.trim() ? input.model : undefined,
        force
      });
      results.push(result);
      const skipped = isRecord(result) && isRecord(result.data) && Array.isArray(result.data.skippedSampleIds)
        ? result.data.skippedSampleIds.map(String)
        : [];
      skippedSampleIds.push(...skipped);
    } catch (error) {
      skippedSampleIds.push(item.sample.id);
    }
  }

  const savedResults = results.filter((result) => isRecord(result) && result.ok === true);
  const addedInsightIds = uniqueIds(savedResults.flatMap((result) =>
    isRecord(result) && isRecord(result.data) && Array.isArray(result.data.addedInsightIds)
      ? result.data.addedInsightIds.map(String)
      : []
  ));
  const updatedProject = await readPostProject();
  const workspace = await updateWorkspaceState({
    topic: updatedProject.topic,
    evidenceSummary: updatedProject.evidencePack.summary ?? postProject.evidencePack.summary,
    selectedSamples: updatedProject.selectedSamples.length ? updatedProject.selectedSamples : postProject.selectedSamples,
    lastUserIntent: "save_viral_knowledge"
  });
  const savedCount = savedResults.length;
  const reviewLines = candidates.slice(0, 5).map((item) =>
    `- ${item.sample.title}：质量分 ${item.review.score}/100；${item.review.reasons.slice(0, 2).join("；") || "可作为轻量参考"}`
  );
  return {
    answer: [
      savedCount
        ? `已把 ${savedCount} 条高价值研究样本保存进爆款库，并为当前 PostProject 增加 ${addedInsightIds.length} 条可追溯爆款库证据。`
        : "这批样本暂时没有达到爆款库入库门槛，所以没有写入长期爆款库。",
      "入库只保存标题钩子、正文结构、标签组合、图片风格、痛点和评论关注点等规律，不会把原文当作仿写素材。",
      reviewLines.length ? `样本评估：\n${reviewLines.join("\n")}` : "",
      skippedSampleIds.length ? `跳过样本：${uniqueIds(skippedSampleIds).join("、")}` : "",
      savedCount ? "下一步建议刷新 CreativeBrief，让文案和图片方向共享这些爆款库规律。" : "可以继续扩大样本数，或明确说“强制保存”把低分样本作为弱参考入库。"
    ].filter(Boolean).join("\n"),
    workspace,
    postProject: updatedProject,
    savedCount,
    skippedSampleIds: uniqueIds(skippedSampleIds),
    addedInsightIds
  };
}

function projectWithMorePublishContext(project: PostProject, fallbackProject?: PostProject): PostProject {
  if (!fallbackProject) {
    return project;
  }
  if (project.finalPost || !fallbackProject.finalPost) {
    return project;
  }
  return fallbackProject;
}

function projectWithPublishDraft(project: PostProject, draft: DraftRecord): PostProject {
  if (!project.finalPost) {
    return project;
  }
  const copyVersionId = `copy-${draft.id}`;
  return {
    ...project,
    copyDraft: draft,
    finalPost: {
      ...project.finalPost,
      copyVersionId
    }
  };
}

function draftFromFinalPost(project: PostProject, visibility: DraftRecord["visibility"]): DraftRecord | null {
  const finalPost = project.finalPost;
  if (!finalPost) {
    return null;
  }

  const matchingPrompt =
    project.imagePrompts.find((prompt) => finalPost.imagePromptVersionIds.includes(prompt.id)) ??
    project.imagePrompts.at(-1);
  const basedOnEvidenceIds = uniqueIds([
    ...(finalPost.basedOnEvidenceIds ?? []),
    ...(project.copyDraft?.draft.basedOnEvidenceIds ?? []),
    ...(project.creativeBrief?.basedOnEvidenceIds ?? [])
  ]);

  return {
    id: `draft-final-${project.id}`,
    updatedAt: project.updatedAt,
    draft: {
      title: finalPost.title,
      content: finalPost.content,
      tags: finalPost.tags,
      structure: project.copyDraft?.draft.structure ?? [],
      imagePrompt: matchingPrompt?.value.prompt ?? project.copyDraft?.draft.imagePrompt ?? "",
      basedOnEvidenceIds,
      evidenceReferences: project.copyDraft?.draft.evidenceReferences
    },
    images: [],
    visibility
  };
}

async function maybeHandlePublishConfirmationTurn(
  input: RunAgentTurnInput,
  plan: ReturnType<typeof createAgentPlan>,
  postProject: PostProject
): Promise<{ answer: string; workspace: WorkspaceState; postProject: PostProject } | null> {
  if (plan.intent !== "review_publish_confirmation" && plan.intent !== "cancel_publish_confirmation") {
    return null;
  }

  const workspace = await readWorkspaceState();
  const activePlan = postProject.publishPlan ?? workspace.publishPlan ?? null;
  if (!activePlan || activePlan.status !== "awaiting_approval") {
    const updatedWorkspace = await updateWorkspaceState({ lastUserIntent: plan.intent });
    return {
      answer: "当前没有待确认的发布单。请先在发布检查里生成确认单，系统不会因为一句模糊指令直接发布。",
      workspace: updatedWorkspace,
      postProject
    };
  }

  if (plan.intent === "cancel_publish_confirmation") {
    const updatedWorkspace = await updateWorkspaceState({
      lastUserIntent: plan.intent,
      publishPlan: null
    });
    const updatedProject = await updatePostProject({
      publishPlan: null,
      auditStatus: "unchecked",
      currentStage: "reviewing"
    });
    return {
      answer: "已取消当前发布确认单，没有调用小红书发布。文案、图片和 Quality Gate 结果仍保留在 Post Studio，可以修改后重新生成确认单。",
      workspace: updatedWorkspace,
      postProject: updatedProject
    };
  }

  const requiredItems = (activePlan.confirmationChecklist ?? []).filter((item) => item.required);
  const confirmedItems = requiredItems.filter((item) => item.confirmed);
  const updatedWorkspace = await updateWorkspaceState({
    lastUserIntent: plan.intent,
    publishPlan: activePlan
  });
  return {
    answer: [
      "当前已有待人工确认的发布单，我不会在聊天里直接调用小红书发布。",
      `标题：${activePlan.title}`,
      `图片：${activePlan.images.length} 张；标签：${activePlan.tags.length} 个；可见范围：${activePlan.visibility}`,
      activePlan.scheduleAt
        ? `定时时间：${activePlan.scheduleAt}${activePlan.scheduleTimezone ? `（时区 ${activePlan.scheduleTimezone}）` : ""}`
        : "发布时间：立即",
      `确认项：${confirmedItems.length}/${requiredItems.length}`,
      "请在 Post Studio 右侧发布检查里点击“确认发布/确认定时发布”按钮完成最后一步。"
    ].join("\n"),
    workspace: updatedWorkspace,
    postProject
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
  evidenceSummary,
  postProject
}: {
  message: string;
  draft: DraftRecord;
  evidenceSummary: unknown;
  postProject?: PostProject;
}): string {
  const viralSafetyContext = postProject ? buildViralSafetyContextForPrompt(postProject) : null;
  const keyInsights = postProject
    ? getPrioritizedImageEvidenceInsights(postProject, 8)
    .map((insight) => `${insight.id} [${insight.sourceType ?? "realtime"}/${insight.type}]: ${insight.insight}`)
    .join("\n")
    : "";
  return [
    "Generate an original Xiaohongshu-ready image for the current post.",
    `User request: ${message}`,
    postProject?.topic ? `PostProject topic: ${postProject.topic}` : "",
    postProject?.creativeBrief ? `CreativeBrief: ${JSON.stringify({
      audience: postProject.creativeBrief.audience,
      contentAngle: postProject.creativeBrief.contentAngle,
      visualMood: postProject.creativeBrief.visualMood,
      imageMustHave: postProject.creativeBrief.imageMustHave,
      imageMustAvoid: postProject.creativeBrief.imageMustAvoid,
      complianceNotes: postProject.creativeBrief.complianceNotes
    })}` : "",
    postProject?.visualDirection ? `Visual direction: ${JSON.stringify(postProject.visualDirection)}` : "",
    `Draft title: ${draft.draft.title}`,
    `Draft image prompt: ${draft.draft.imagePrompt}`,
    `Tags: ${draft.draft.tags.join(", ")}`,
    keyInsights ? `Traceable evidence insights:\n${keyInsights}` : "",
    viralSafetyContext ? `Viral library originality boundaries:\n${JSON.stringify(viralSafetyContext, null, 2)}` : "",
    evidenceSummary ? `Evidence summary: ${JSON.stringify(evidenceSummary).slice(0, 1600)}` : "",
    "Do not copy competitor images. If product reference images are provided, preserve the product subject, package shape, label position, color, and material. Do not invent unreadable brand text, false logos, certifications, or exaggerated claims."
  ]
    .filter(Boolean)
    .join("\n\n");
}

function getPrioritizedImageEvidenceInsights(project: PostProject, limit: number): PostProject["evidencePack"]["insights"] {
  const insightById = new Map(project.evidencePack.insights.map((insight) => [insight.id, insight]));
  const preferredIds = uniqueIds([
    ...(project.focusedEvidenceIds ?? []),
    ...(project.visualDirection?.basedOnEvidenceIds ?? []),
    ...project.imagePrompts.flatMap((prompt) => prompt.basedOnEvidenceIds ?? []),
    ...(project.creativeBrief?.basedOnEvidenceIds ?? [])
  ]);
  const preferred = preferredIds
    .map((id) => insightById.get(id))
    .filter((insight): insight is PostProject["evidencePack"]["insights"][number] => Boolean(insight));
  const preferredSet = new Set(preferred.map((insight) => insight.id));
  const remaining = project.evidencePack.insights.filter((insight) => !preferredSet.has(insight.id));
  return [...preferred, ...remaining].slice(0, limit);
}

function getPrioritizedImageEvidenceIds(project: PostProject, limit: number): string[] {
  return getPrioritizedImageEvidenceInsights(project, limit).map((insight) => insight.id);
}

async function ensureViralEvidenceForProject(
  project: PostProject,
  options: { force?: boolean; filters?: ReturnType<typeof createAgentPlan>["ragFilters"] } = {}
): Promise<PostProject> {
  const hasViralEvidence = project.evidencePack.insights.some((insight) => insight.sourceType === "viral_library");
  const retrievalSignature = buildViralRetrievalSignature(project, options.filters);
  const existingSignature = getStoredViralRetrievalSignature(project.evidencePack.summary);
  const shouldRefreshForContext = hasViralEvidence && existingSignature !== retrievalSignature;
  if ((hasViralEvidence && !options.force && !shouldRefreshForContext) || !project.topic) {
    return project;
  }

  const registry = createAgentToolRegistry();
  const query = buildViralRetrievalQuery(project);
  const toolResult = await registry.call("knowledge.retrieveViralPatterns", {
    query,
    topic: project.topic,
    ...options.filters,
    limit: 6,
    realtimeEvidenceCount: project.selectedSamples.length
  });
  const pack = parseViralKnowledgeToolPack(toolResult);
  if (!pack.insights.length && !pack.results.length) {
    return updatePostProject({
      evidencePack: {
        ...project.evidencePack,
        summary: mergeViralKnowledgeIntoSummary(project.evidencePack.summary, pack, retrievalSignature),
        updatedAt: new Date().toISOString()
      }
    });
  }

  const mergeProject = shouldRefreshForContext ? withoutViralLibraryEvidence(project) : project;
  const evidenceBuild = buildEvidencePackWithViralKnowledge(mergeProject, pack, { retrievalSignature });
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

function buildViralRetrievalQuery(project: PostProject): string {
  return [
    project.topic,
    project.productInfo.name,
    project.targetAudience,
    project.goal,
    project.tone
  ].filter(Boolean).join(" ");
}

function buildViralRetrievalSignature(
  project: PostProject,
  filters?: ReturnType<typeof createAgentPlan>["ragFilters"]
): string {
  return JSON.stringify({
    query: normalizeSignatureText(buildViralRetrievalQuery(project)),
    topic: normalizeSignatureText(project.topic ?? ""),
    filters: normalizeSignatureValue(filters ?? {})
  });
}

function getStoredViralRetrievalSignature(summary: unknown): string | null {
  const viralKnowledge = isRecord(summary) ? summary.viralKnowledge : undefined;
  return isRecord(viralKnowledge) && typeof viralKnowledge.retrievalSignature === "string"
    ? viralKnowledge.retrievalSignature
    : null;
}

function withoutViralLibraryEvidence(project: PostProject): PostProject {
  const staleViralInsights = project.evidencePack.insights.filter((insight) => insight.sourceType === "viral_library");
  const staleViralIds = new Set(staleViralInsights.map((insight) => insight.id));
  const staleViralSampleIds = new Set(staleViralInsights.flatMap((insight) => insight.sourceSampleIds));
  return {
    ...project,
    evidencePack: {
      ...project.evidencePack,
      insights: project.evidencePack.insights.filter((insight) => insight.sourceType !== "viral_library"),
      sampleIds: project.evidencePack.sampleIds.filter((id) => !staleViralSampleIds.has(id))
    },
    focusedEvidenceIds: (project.focusedEvidenceIds ?? []).filter((id) => !staleViralIds.has(id)),
    creativeBrief: project.creativeBrief
      ? {
          ...project.creativeBrief,
          basedOnEvidenceIds: project.creativeBrief.basedOnEvidenceIds.filter((id) => !staleViralIds.has(id))
        }
      : project.creativeBrief
  };
}

function normalizeSignatureText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeSignatureValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeSignatureValue);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalizeSignatureValue(value[key])])
    );
  }
  return typeof value === "string" ? normalizeSignatureText(value) : value;
}

function mergeViralKnowledgeIntoSummary(summary: unknown, pack: ViralKnowledgePack, retrievalSignature?: string): unknown {
  return {
    ...(isRecord(summary) ? summary : {}),
    viralKnowledge: {
      ...pack,
      ...(retrievalSignature ? { retrievalSignature } : {})
    }
  };
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

function buildAgentPublishEvidenceCitationSummary(
  project: PostProject,
  draft: DraftRecord
): PublishEvidenceCitationSummary | undefined {
  const evidenceIds = uniqueIds([
    ...(draft.draft.basedOnEvidenceIds ?? []),
    ...(project.finalPost?.basedOnEvidenceIds ?? []),
    ...(project.creativeBrief?.basedOnEvidenceIds ?? []),
    ...(project.visualDirection?.basedOnEvidenceIds ?? []),
    ...project.imagePrompts.flatMap((prompt) => prompt.basedOnEvidenceIds ?? []),
    ...project.generatedImages.flatMap((image) => image.basedOnEvidenceIds ?? [])
  ]).slice(0, 12);
  if (!project.evidencePack.insights.length || !evidenceIds.length) {
    return undefined;
  }
  const report = buildEvidenceCitationReport(project, evidenceIds, draft.draft.evidenceReferences);
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

function buildViralSafetyContextForPrompt(project: PostProject) {
  const summary = isRecord(project.evidencePack.summary) ? project.evidencePack.summary : {};
  const viralKnowledge = isRecord(summary.viralKnowledge) ? summary.viralKnowledge : {};
  const strategyReport = isRecord(viralKnowledge.strategyReport) ? viralKnowledge.strategyReport : {};
  const results = Array.isArray(viralKnowledge.results) ? viralKnowledge.results : [];
  const caseRules = results.flatMap((item) => {
    if (!isRecord(item) || !isRecord(item.case)) return [];
    const id = typeof item.case.id === "string" ? item.case.id : "viral-case";
    const extractedInsights = isRecord(item.case.extractedInsights) ? item.case.extractedInsights : {};
    const creativeSafety = isRecord(item.case.creativeSafety) ? item.case.creativeSafety : {};
    return compactStrings([
      ...unknownStringArray(extractedInsights.avoidCopying).map((rule) => `${id}: ${rule}`),
      ...unknownStringArray(creativeSafety.doNotCopy).map((rule) => `${id}: ${rule}`),
      ...unknownStringArray(creativeSafety.transformationGuidance).map((rule) => `${id}: ${rule}`)
    ]);
  });
  const strategyRules = unknownStringArray(strategyReport.originalityRules);
  const insightRules = project.evidencePack.insights
    .filter((insight) => insight.sourceType === "viral_library")
    .slice(0, 8)
    .map((insight) => `${insight.id}: ${insight.type} 只可作为规律引用，不可复述来源样本表达`);
  return {
    source: "viral_library_safety",
    rules: uniqueIds([...strategyRules, ...caseRules, ...insightRules]).slice(0, 12),
    fallbackRule: "如果爆款库证据不足，只能使用 CreativeBrief 和用户输入生成原创内容，不要假装已有研究结论。"
  };
}

function getFocusedEvidenceIds(project: PostProject): string[] {
  const validIds = new Set(project.evidencePack.insights.map((insight) => insight.id));
  return uniqueIds(project.focusedEvidenceIds ?? []).filter((id) => validIds.has(id));
}

function unknownStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? compactStrings(value.map((item) => String(item)))
    : [];
}

function compactStrings(values: string[]): string[] {
  return values.map((value) => value.replace(/\s+/g, " ").trim()).filter(Boolean);
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
  basedOnEvidenceIds,
  sourceAssetIds,
  select
}: {
  assetIds: string[];
  promptId?: string | null;
  basedOnEvidenceIds?: string[];
  sourceAssetIds?: string[];
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
        promptVersionId: promptId ?? undefined,
        basedOnEvidenceIds: basedOnEvidenceIds ?? [],
        sourceAssetIds: sourceAssetIds ?? [],
        createdAt: new Date().toISOString(),
        selected: select
      }))
  ].map((image) => {
    const identity = image.assetId ?? image.id;
    const isIncoming = ids.includes(identity);
    const enrichedImage = isIncoming
      ? {
          ...image,
          promptId: image.promptId ?? promptId ?? undefined,
          promptVersionId: image.promptVersionId ?? image.promptId ?? promptId ?? undefined,
          basedOnEvidenceIds: image.basedOnEvidenceIds?.length ? image.basedOnEvidenceIds : (basedOnEvidenceIds ?? []),
          sourceAssetIds: image.sourceAssetIds ?? sourceAssetIds ?? []
        }
      : image;
    return ids.includes(identity)
      ? { ...enrichedImage, selected: select }
      : select
        ? { ...enrichedImage, selected: false }
        : enrichedImage;
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

function isSampleEvidenceLike(value: unknown): value is SampleEvidence {
  return isRecord(value) && typeof value.id === "string" && typeof value.title === "string";
}
