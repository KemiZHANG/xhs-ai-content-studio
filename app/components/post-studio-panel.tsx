"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Rocket } from "lucide-react";
import type {
  AssetRecord,
  ChatMessage,
  CreatorMemoryProfile,
  Health,
  JobRecord,
  PendingPublishConfirmation,
  PostProject,
  PublishAuditRecord,
  PublishDraftState,
  RedactedSettings,
  SampleEvidence,
  Section,
  ViralCase,
  WorkflowResult,
  WorkspaceState
} from "@/app/types";
import { getOrderedPostNextActions, getPostStageGuidance } from "@/lib/post-project/guidance";
import { buildEvidenceCitationReport, buildEvidenceReferenceSummary } from "@/lib/post-project/citations";
import { activeAccountReadinessHint, isHealthForActiveAccount } from "@/app/components/account-readiness";
import { isPublishPlanForActiveAccount } from "@/app/components/publish-confirmation";
import { PostCanvasPanel } from "@/app/components/post-canvas-panel";
import { buildPostReadinessReport } from "@/lib/post-project/readiness";
import { getPostVersionDiffReport, getPostVersionStatus } from "@/lib/post-project/versioning";
import { buildEvidencePanelModel, summarizeEvidenceSample } from "@/app/components/evidence-display";
import { buildViralSaveCandidateModel } from "@/app/components/viral-save-candidates";
import { buildCanvasVersionDisplay } from "@/app/components/post-version-display";
import { labelForPostAction } from "@/app/components/post-action-labels";
import { buildPostStudioStatusSummary } from "@/app/components/post-studio-status";
import { buildViralApplicationModel } from "@/app/components/viral-application";
import { buildViralEvidenceSummary } from "@/app/components/viral-evidence-summary";
import { buildViralLibraryHealth } from "@/app/components/viral-library-health";
import { buildQualityViralCoverageView } from "@/app/components/quality-viral-coverage";
import { buildPublishConfirmationSummary } from "@/app/components/publish-confirmation-summary";
import { buildPublishSafetyBoundary } from "@/app/components/publish-safety-boundary";
import { buildPublishAccountSafety } from "@/app/components/publish-account-safety";
import { buildPublishAuditSafetySummary } from "@/app/components/publish-audit-summary";
import { buildPostProjectContextSummary } from "@/app/components/post-project-context";
import { buildGeneratedAssetSummary, buildReferenceAssetSummary } from "@/app/components/asset-panel-summary";
import { buildPostNextStepCoach } from "@/app/components/post-next-step-coach";
import { buildPostFlowSummary } from "@/app/components/post-flow-summary";
import { buildPostSideDigest } from "@/app/components/post-side-digest";
import { buildStudioTabGroups, getRecommendedStudioTabForStage } from "@/app/components/studio-tab-groups";
import { selectRunningJobForWorkspace } from "@/app/components/job-display";
import { buildCreationProvenance } from "@/app/components/creation-provenance";
import { buildBriefTabSummary, buildImageTabSummary, buildPublishTabSummary } from "@/app/components/studio-tab-summary";
import { EvidenceCatalogDrawer, EvidenceDrawer, ViralCaseDrawer } from "@/app/components/post-studio-drawers";
import { PostStudioHeaderPanel } from "@/app/components/post-studio-header-panel";
import { PostStudioAgentPane, type PostStudioResearchFormState } from "@/app/components/post-studio-agent-pane";
import { PostStudioSidePane, type StudioTab } from "@/app/components/post-studio-side-pane";
import { isPublishScheduleReady } from "@/app/components/post-studio-publish-readiness-panel";
import { emptyViralSearchForm } from "@/app/components/post-studio-viral-tab";
import { labelForPublishStatus } from "@/app/components/post-studio-publish-intent-panel";
import { buildVersionSwitchGuidance } from "@/app/components/version-switch-guidance";
import { resolvePostCreationTopic, resolvePostStudioTitle } from "@/app/components/post-studio-title";
import type { ViralLibrarySearchFilters } from "@/app/components/viral-search";
import type { PostReadinessItem } from "@/lib/post-project/readiness";
import type { PostAction } from "@/lib/post-project/types";

export type { StudioTab } from "@/app/components/post-studio-side-pane";

type ResearchForm = PostStudioResearchFormState;

export function PostStudioPanel({
  project,
  workspace,
  workflowResult,
  researchForm,
  messages,
  chatInput,
  busy,
  assets,
  publishDraft,
  publishAssetIds,
  publishVisibility,
  publishScheduleAt,
  canvasDirty,
  pendingPublish,
  publishAudits,
  settings,
  health,
  jobs,
  viralCases,
  creatorMemory,
  focusTab,
  onResearchFormChange,
  onRunResearch,
  onChatInput,
  onChatSubmit,
  onDraftChange,
  onCommitCanvas,
  onNavigate,
  onNewProject,
  onGenerateCopy,
  onQuickAction,
  onSelectCopyVersion,
  onSelectImagePromptVersion,
  onSelectPostImages,
  onFocusEvidenceIds,
  onSaveToViralLibrary,
  onSaveManyToViralLibrary,
  onReloadViralLibrary,
  onSearchViralLibrary,
  onRefreshViralEvidence,
  onOpenImageStudio,
  onUploadReferenceFiles,
  onOpenPublish,
  onPreparePublish,
  onVisibilityChange,
  onScheduleAtChange,
  onRefreshHealth,
  onSwitchAccount,
  onConfirmPublish,
  onCancelPublish
}: {
  project: PostProject | null;
  workspace: WorkspaceState | null;
  workflowResult: WorkflowResult | null;
  researchForm: ResearchForm;
  messages: ChatMessage[];
  chatInput: string;
  busy: boolean;
  assets: AssetRecord[];
  publishDraft: PublishDraftState;
  publishAssetIds: string[];
  publishVisibility: RedactedSettings["defaultVisibility"];
  publishScheduleAt: string;
  canvasDirty: boolean;
  pendingPublish: PendingPublishConfirmation | null;
  publishAudits: PublishAuditRecord[];
  settings: RedactedSettings;
  health: Health | null;
  jobs: JobRecord[];
  viralCases: ViralCase[];
  creatorMemory: CreatorMemoryProfile | null;
  focusTab?: { tab: StudioTab; nonce: number } | null;
  onResearchFormChange: (next: ResearchForm) => void;
  onRunResearch: (event: FormEvent<HTMLFormElement>) => void;
  onChatInput: (value: string) => void;
  onChatSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDraftChange: (next: PublishDraftState) => void;
  onCommitCanvas: () => void;
  onNavigate: (section: Section) => void;
  onNewProject: () => void;
  onGenerateCopy: (message: string) => void;
  onQuickAction: (action: string) => void;
  onSelectCopyVersion: (versionId: string) => void;
  onSelectImagePromptVersion: (versionId: string) => void;
  onSelectPostImages: (assetIds: string[]) => void;
  onFocusEvidenceIds: (ids: string[]) => void;
  onSaveToViralLibrary: (sample: SampleEvidence) => void;
  onSaveManyToViralLibrary: (samples: SampleEvidence[]) => void;
  onReloadViralLibrary: () => void;
  onSearchViralLibrary: (filters: ViralLibrarySearchFilters) => void;
  onRefreshViralEvidence: () => void;
  onOpenImageStudio: () => void;
  onUploadReferenceFiles: (files: FileList | File[]) => void;
  onOpenPublish: () => void;
  onPreparePublish: () => void;
  onVisibilityChange: (value: RedactedSettings["defaultVisibility"]) => void;
  onScheduleAtChange: (value: string) => void;
  onRefreshHealth: () => void;
  onSwitchAccount: (accountId: string) => void;
  onConfirmPublish: () => void;
  onCancelPublish: () => void;
}) {
  const [tab, setTab] = useState<StudioTab>("insights");
  const [selectedEvidence, setSelectedEvidence] = useState<SampleEvidence | null>(null);
  const [evidenceCatalogOpen, setEvidenceCatalogOpen] = useState(false);
  const [selectedViralCase, setSelectedViralCase] = useState<ViralCase | null>(null);
  const [viralSearchForm, setViralSearchForm] = useState(emptyViralSearchForm);
  const lastAutoTabKey = useRef("");
  useEffect(() => {
    if (focusTab?.tab) {
      setTab(focusTab.tab);
    }
  }, [focusTab?.nonce, focusTab?.tab]);
  useEffect(() => {
    if (focusTab?.tab) {
      return;
    }
    const stage = project?.currentStage ?? "empty";
    const autoTabKey = `${project?.id ?? "empty"}:${stage}`;
    if (lastAutoTabKey.current === autoTabKey) {
      return;
    }
    lastAutoTabKey.current = autoTabKey;
    setTab(getRecommendedStudioTabForStage(stage));
  }, [focusTab?.tab, project?.currentStage, project?.id]);
  const selectedAssets = assets.filter((asset) => publishAssetIds.includes(asset.id));
  const uploadAssets = assets.filter((asset) => asset.kind === "upload");
  const generatedAssets = [...assets].filter((asset) => asset.kind === "generated").sort(sortNewestAsset);
  const recentGeneratedAssets = uniqueAssets([...selectedAssets, ...generatedAssets]).slice(0, 6);
  const referenceAssets = uniqueAssets([...selectedAssets, ...uploadAssets]).slice(0, 6);
  const referenceAssetSummary = buildReferenceAssetSummary({
    selectedAssets,
    referenceAssets,
    totalUploadCount: uploadAssets.length,
    limit: 4
  });
  const generatedAssetSummary = buildGeneratedAssetSummary({
    selectedAssets,
    generatedAssets,
    totalGeneratedCount: generatedAssets.length,
    limit: 4
  });
  const runningJob = selectRunningJobForWorkspace(jobs, workspace);
  const insights = project?.evidencePack.insights ?? [];
  const viralInsights = insights.filter((insight) => insight.sourceType === "viral_library");
  const focusedEvidenceIds = project?.focusedEvidenceIds ?? [];
  const realtimeInsights = insights.filter((insight) => insight.sourceType !== "viral_library");
  const keyLearningInsights = pickKeyLearningInsights(insights);
  const keyViralInsights = pickKeyViralInsights(viralInsights, focusedEvidenceIds);
  const viralCaseById = new Map(viralCases.map((item) => [item.id, item]));
  const latestViralCases = [...viralCases].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)).slice(0, 3);
  const latestViralSummaries = latestViralCases.map((item) => ({
    item,
    learnings: pickViralLearningLines(item),
    rewriteRules: pickViralRewriteLines(item)
  }));
  const viralApplication = buildViralApplicationModel(project);
  const projectViralPack = extractProjectViralPack(project);
  const viralPack = workflowResult?.viralKnowledge ?? workflowResult?.researchSummary?.viralKnowledge ?? projectViralPack ?? null;
  const viralEvidenceSummary = buildViralEvidenceSummary({ project, viralCases, viralKnowledge: viralPack });
  const viralLibraryHealth = buildViralLibraryHealth(viralCases);
  const samples = project?.selectedSamples ?? workflowResult?.evidence ?? workspace?.selectedSamples ?? [];
  const evidenceSamples = samples.filter(isSampleEvidence);
  const evidencePanel = buildEvidencePanelModel(evidenceSamples, 3);
  const viralSaveCandidates = buildViralSaveCandidateModel(evidenceSamples, 3);
  const saveableSamples = viralSaveCandidates.candidates.map((item) => item.sample);
  const allowedPostActions = (project?.allowedActions ?? []) as PostAction[];
  const stageGuidance = getPostStageGuidance(project?.currentStage ?? "empty", allowedPostActions);
  const nextActions = getOrderedPostNextActions(project?.currentStage ?? "empty", allowedPostActions.length ? allowedPostActions : ["search_research"]);
  const projectTitle = resolvePostStudioTitle({ projectTopic: project?.topic, workspaceTopic: workspace?.topic });
  const creationTopic = resolvePostCreationTopic({
    projectTopic: project?.topic,
    workspaceTopic: workspace?.topic,
    researchTopic: researchForm.topic
  });
  const canGenerateCopy = Boolean(insights.length || workflowResult?.researchSummary || workspace?.evidenceSummary);
  const latestImagePrompt = publishDraft.imagePrompt || project?.imagePrompts.at(-1)?.value.prompt || "";
  const quality = project?.qualityCheck;
  const qualityViralCoverage = buildQualityViralCoverageView(quality?.viralCoverage);
  const brief = project?.creativeBrief;
  const briefTabSummary = buildBriefTabSummary({
    project,
    evidenceCount: insights.length,
    viralEvidenceCount: viralInsights.length
  });
  const referenceTabSummary = buildImageTabSummary({
    selectedCount: referenceAssetSummary.selectedCount,
    previewCount: referenceAssetSummary.previewAssets.length,
    hiddenCount: referenceAssetSummary.hiddenCount,
    mode: "reference"
  });
  const generatedTabSummary = buildImageTabSummary({
    selectedCount: generatedAssetSummary.selectedCount,
    previewCount: generatedAssetSummary.previewAssets.length,
    hiddenCount: generatedAssetSummary.hiddenCount,
    mode: "generated"
  });
  const activeAccount = settings.accounts.find((account) => account.id === settings.activeAccountId) ?? settings.accounts[0];
  const projectPublishPlanMatchesActiveAccount = isPublishPlanForActiveAccount(project?.publishPlan, settings.activeAccountId);
  const staleAccountPublishPlan = project?.publishPlan && !projectPublishPlanMatchesActiveAccount
    ? project.publishPlan
    : null;
  const staleCanvasPublishPlan = canvasDirty && Boolean(pendingPublish || project?.publishPlan);
  const activePublishPlan = !canvasDirty && pendingPublish
    ? {
        status: "awaiting_approval",
        visibility: pendingPublish.payload.visibility,
        scheduleAt: pendingPublish.payload.scheduleAt,
        scheduleTimezone: pendingPublish.payload.scheduleTimezone,
        images: pendingPublish.payload.assetIds,
        tags: pendingPublish.payload.tags,
        accountName: pendingPublish.accountDisplayName,
        loginName: pendingPublish.loginName,
        mcpUrl: pendingPublish.mcpUrl,
        confirmationChecklist: project?.publishPlan?.confirmationChecklist ?? [],
        evidenceCitationSummary: project?.publishPlan?.evidenceCitationSummary,
        versionSnapshot: project?.publishPlan?.versionSnapshot
      }
    : !canvasDirty && project?.publishPlan && projectPublishPlanMatchesActiveAccount
      ? {
          status: project.publishPlan.status,
          visibility: project.publishPlan.visibility,
          scheduleAt: project.publishPlan.scheduleAt,
          scheduleTimezone: project.publishPlan.scheduleTimezone,
          images: project.publishPlan.images,
          tags: project.publishPlan.tags,
          accountName: activeAccount?.displayName,
          loginName: health?.activeAccount?.loginName,
          mcpUrl: activeAccount?.mcpUrl ?? settings.mcpUrl,
          confirmationChecklist: project.publishPlan.confirmationChecklist ?? [],
          evidenceCitationSummary: project.publishPlan.evidenceCitationSummary,
          versionSnapshot: project.publishPlan.versionSnapshot
        }
      : null;
  const requiredConfirmations = activePublishPlan?.confirmationChecklist.filter((item) => item.required) ?? [];
  const confirmedRequiredCount = requiredConfirmations.filter((item) => item.confirmed).length;
  const copyVersions = project?.copyVersions ?? [];
  const imagePromptVersions = project?.imagePrompts ?? [];
  const draftEvidenceIds = project?.copyDraft?.draft.basedOnEvidenceIds ?? copyVersions.at(-1)?.basedOnEvidenceIds ?? [];
  const citationEvidenceIds = uniqueStringList([
    ...draftEvidenceIds,
    ...(project?.creativeBrief?.basedOnEvidenceIds ?? [])
  ]);
  const versionStatus = project ? getPostVersionStatus(project) : null;
  const copyVersionGuidance = buildVersionSwitchGuidance({
    kind: "copy",
    hasPublishPlan: Boolean(pendingPublish || project?.publishPlan),
    qualityGateFresh: versionStatus?.qualityGateFresh === true,
    finalPostExists: Boolean(project?.finalPost)
  });
  const promptVersionGuidance = buildVersionSwitchGuidance({
    kind: "prompt",
    hasPublishPlan: Boolean(pendingPublish || project?.publishPlan),
    qualityGateFresh: versionStatus?.qualityGateFresh === true,
    finalPostExists: Boolean(project?.finalPost)
  });
  const versionDiff = project ? getPostVersionDiffReport(project) : null;
  const canvasVersionDisplay = buildCanvasVersionDisplay(versionStatus, versionDiff);
  const citationReport = project && citationEvidenceIds.length
    ? buildEvidenceCitationReport(project, citationEvidenceIds, project.copyDraft?.draft.evidenceReferences)
    : null;
  const briefEvidenceSummary = project?.creativeBrief
    ? buildEvidenceReferenceSummary(project, project.creativeBrief.basedOnEvidenceIds)
    : null;
  const visualEvidenceSummary = project?.visualDirection
    ? buildEvidenceReferenceSummary(project, project.visualDirection.basedOnEvidenceIds)
    : null;
  const citationTraceReady = Boolean(
    citationReport &&
      citationReport.allEvidenceIds.length &&
      !citationReport.missingEvidenceIds.length &&
      citationReport.sections.every((section) => section.insights.length)
  );
  const hasVisualDirection = hasTraceableVisualDirection(project);
  const creationProvenance = buildCreationProvenance(project);
  const accountReady = isHealthForActiveAccount(health, settings);
  const accountReadyHint = activeAccountReadinessHint(health, settings);
  const publishScheduleReady = isPublishScheduleReady(publishScheduleAt);
  const publishReady = Boolean(
    publishDraft.title.trim() &&
      publishDraft.content.trim() &&
      publishDraft.tagsText.trim() &&
      selectedAssets.length &&
      hasVisualDirection &&
      citationTraceReady &&
      accountReady &&
      publishScheduleReady &&
      !canvasDirty &&
      quality?.canPublish === true &&
      versionStatus?.qualityGateFresh === true
  );
  const publishSummary = buildPublishConfirmationSummary({
    draft: publishDraft,
    selectedImageCount: selectedAssets.length,
    activePlan: activePublishPlan,
    pendingPublish,
    project,
    activeAccountName: activeAccount?.displayName,
    activeLoginName: health?.activeAccount?.loginName,
    visibility: publishVisibility,
    scheduleAt: publishScheduleAt,
    publishReady,
    citationTraceReady,
    canvasDirty,
    accountReady,
    hasVisualDirection,
    qualityGateFresh: versionStatus?.qualityGateFresh === true
  });
  const publishSafetyBoundary = buildPublishSafetyBoundary({
    publishReady,
    hasPendingConfirmation: Boolean(pendingPublish || activePublishPlan?.status === "awaiting_approval"),
    modeLabel: publishSummary.modeLabel,
    blockerCount: publishSummary.blockers.length
  });
  const publishAccountSafety = buildPublishAccountSafety({
    settings,
    health,
    publishPlan: project?.publishPlan,
    pendingPublish,
    canvasDirty
  });
  const publishTabSummary = buildPublishTabSummary({
    publishReady,
    pendingConfirmation: Boolean(pendingPublish || activePublishPlan?.status === "awaiting_approval"),
    blockerCount: publishSummary.blockers.length,
    riskLevel: publishSummary.riskLevel
  });
  const auditSummary = buildPublishAuditSafetySummary({
    audits: publishAudits,
    settings,
    currentTitle: publishDraft.title || project?.finalPost?.title || project?.copyDraft?.draft.title,
    publishIntentId: pendingPublish?.publishIntentId ?? project?.publishPlan?.id
  });
  const readiness = project ? buildPostReadinessReport(project) : null;
  const nextStepCoach = buildPostNextStepCoach({
    guidance: stageGuidance,
    readiness,
    nextActions,
    qualityViralCoverage,
    ragCreativeBlocked: viralApplication.readinessGate.status === "caution"
  });
  const flowSummary = buildPostFlowSummary(readiness, {
    ragCreativeBlocked: viralApplication.readinessGate.status === "caution"
  });
  const statusSummary = buildPostStudioStatusSummary({
    project,
    workspace,
    settings,
    health,
    evidenceCount: samples.length,
    hasDraft: Boolean(publishDraft.title || project?.copyDraft || project?.finalPost),
    selectedImageCount: selectedAssets.length,
    canvasDirty,
    ragCreativeBlocked: viralApplication.readinessGate.status === "caution"
  });
  const publishStatusLabel = staleCanvasPublishPlan
    ? "需重新确认"
    : labelForPublishStatus(project?.publishPlan?.status);
  const projectContextSummary = buildPostProjectContextSummary({
    project,
    workspace,
    settings,
    health,
    canvasDirty,
    pendingPublish,
    staleCanvasPublishPlan,
    staleAccountPublishPlan: Boolean(staleAccountPublishPlan)
  });

  const generatedCopyPrompt = useMemo(
    () =>
      [
        "请基于当前 PostProject 的证据和 CreativeBrief 生成一篇原创小红书图文笔记，不要重新搜索。",
        `主题：${creationTopic}`,
        `内容类型：${researchForm.contentType}`,
        `补充要求：${researchForm.requirements || "真实分享，不硬广，结构清楚，有收藏价值。"}`,
        "请输出：标题候选、最终标题、正文、标签、图片方向和发布前风险提醒。"
      ].join("\n"),
    [creationTopic, researchForm.contentType, researchForm.requirements]
  );
  const sideDigest = buildPostSideDigest({
    insightCount: insights.length,
    realtimeInsightCount: realtimeInsights.length,
    viralInsightCount: viralInsights.length,
    hasBrief: Boolean(brief),
    selectedImageCount: selectedAssets.length,
    generatedImageCount: generatedAssets.length,
    referenceImageCount: referenceAssets.length,
    publishReady,
    accountReady,
    qualityFresh: versionStatus?.qualityGateFresh === true,
    activeTab: tab
  });
  const studioTabGroups = buildStudioTabGroups(tab);

  return (
    <div className="postStudio">
      <section className="postStudioTop panel">
        <PostStudioHeaderPanel
          projectTitle={projectTitle}
          projectContextSummary={projectContextSummary}
          statusSummary={statusSummary}
          flowSummary={flowSummary}
          nextStepCoach={nextStepCoach}
          chatInput={chatInput}
          busy={busy}
          activeAccountId={settings.activeAccountId}
          onQuickAction={onQuickAction}
          onSwitchAccount={onSwitchAccount}
          onRefreshHealth={onRefreshHealth}
          onNavigate={onNavigate}
          onChatInput={onChatInput}
          onChatSubmit={onChatSubmit}
          onNewProject={onNewProject}
        />
        {readiness ? (
          <details className="postReadinessPanel" aria-label="发布准备度">
            <summary className="postReadinessHeader">
              <div>
                <span>发布准备度</span>
                <strong>{readiness.summary}</strong>
              </div>
              <em>{readiness.progress}%</em>
            </summary>
            <div className="postReadinessTrack" aria-hidden="true">
              <span style={{ width: `${readiness.progress}%` }} />
            </div>
            <div className="postReadinessSteps">
              {readiness.visibleItems.map((item) => (
                <ReadinessStep item={item} key={item.id} onQuickAction={onQuickAction} />
              ))}
            </div>
            <div className="postReadinessNext">
              <span>{readiness.blockers[0]?.detail ?? "可以生成发布确认单，进入最终人工确认。"}</span>
              {readiness.nextAction ? (
                <button type="button" onClick={() => onQuickAction(readiness.nextAction!)}>
                  {labelForAction(readiness.nextAction)}
                </button>
              ) : null}
            </div>
          </details>
        ) : null}
      </section>

      <div className="postStudioGrid">
        <PostStudioAgentPane
          busy={busy}
          chatInput={chatInput}
          evidenceCount={samples.length}
          ragCreativeBlocked={viralApplication.readinessGate.status === "caution"}
          messages={messages}
          onChatInput={onChatInput}
          onChatSubmit={onChatSubmit}
          onQuickAction={onQuickAction}
          onResearchFormChange={onResearchFormChange}
          onRunResearch={onRunResearch}
          researchForm={researchForm}
          runningJob={runningJob}
        />

        <PostCanvasPanel
          canGenerateCopy={canGenerateCopy}
          ragCreativeBlocked={viralApplication.readinessGate.status === "caution"}
          generatedCopyPrompt={generatedCopyPrompt}
          creationProvenance={creationProvenance}
          canvasVersionDisplay={canvasVersionDisplay}
          canvasDirty={canvasDirty}
          selectedAssets={selectedAssets}
          copyVersions={copyVersions}
          copyVersionGuidance={copyVersionGuidance}
          publishDraft={publishDraft}
          latestImagePrompt={latestImagePrompt}
          project={project}
          imagePromptVersions={imagePromptVersions}
          promptVersionGuidance={promptVersionGuidance}
          versionStatus={versionStatus}
          versionDiff={versionDiff}
          citationReport={citationReport}
          onGenerateCopy={onGenerateCopy}
          onOpenEvidence={() => setTab("insights")}
          onDraftChange={onDraftChange}
          onSelectCopyVersion={onSelectCopyVersion}
          onSelectImagePromptVersion={onSelectImagePromptVersion}
          onQuickAction={onQuickAction}
          onCommitCanvas={onCommitCanvas}
        />

        <PostStudioSidePane
          activeTab={tab}
          brief={{
            brief,
            briefEvidenceSummary,
            onQuickAction,
            summary: briefTabSummary,
            visualEvidenceSummary
          }}
          evidence={{
            evidencePanel,
            onOpenEvidenceCatalog: () => setEvidenceCatalogOpen(true),
            onOpenSample: setSelectedEvidence,
            onOpenWorkflow: () => onNavigate("workflow"),
            onSaveManyToViralLibrary,
            onSaveToViralLibrary,
            saveableSamples,
            summarizeEvidenceSample,
            viralSaveCandidates
          }}
          generated={{
            assetSummary: generatedAssetSummary,
            onOpenImageStudio,
            onQuickAction,
            onSelectPostImages,
            project,
            publishAssetIds,
            summary: generatedTabSummary
          }}
          insights={{
            citationReport,
            creatorMemory,
            keyLearningInsights,
            onOpenViral: () => setTab("viral"),
            projectMemory: project?.agentMemory ?? [],
            realtimeCount: realtimeInsights.length,
            totalInsightCount: insights.length,
            viralCount: viralInsights.length,
            viralEvidenceSummary
          }}
          onNavigate={onNavigate}
          onSelectTab={setTab}
          publish={{
            accountReady,
            accountReadyHint,
            activeAccountLabel: activeAccount?.displayName ?? settings.activeAccountId,
            activeLoginName: health?.activeAccount?.loginName,
            activePublishPlan,
            auditSummary,
            busy,
            citationReport,
            citationTraceReady,
            confirmedRequiredCount,
            defaultAutoPublish: settings.defaultAutoPublish,
            hasExistingVisualDirection: Boolean(project?.visualDirection),
            hasVisualDirection,
            onCancelPublish,
            onConfirmPublish,
            onNavigate,
            onOpenPublish,
            onPreparePublish,
            onQuickAction,
            onScheduleAtChange,
            onVisibilityChange,
            pendingPublish,
            publishAccountSafety,
            publishDraft,
            publishReady,
            publishSafetyBoundary,
            publishScheduleAt,
            publishSummary,
            publishVisibility,
            quality,
            qualityGateFresh: versionStatus?.qualityGateFresh === true,
            qualityViralCoverage,
            requiredConfirmations,
            selectedImageCount: selectedAssets.length,
            staleAccountPublishPlan,
            staleCanvasPublishPlan,
            summary: publishTabSummary
          }}
          references={{
            assetSummary: referenceAssetSummary,
            onNavigate,
            onOpenImageStudio,
            onQuickAction,
            onSelectPostImages,
            onUploadReferenceFiles,
            project,
            publishAssetIds,
            summary: referenceTabSummary
          }}
          sideDigest={sideDigest}
          studioTabGroups={studioTabGroups}
          viral={{
            focusedEvidenceIds,
            keyViralInsights,
            latestViralSummaries,
            onFocusEvidenceIds,
            onOpenViralCase: setSelectedViralCase,
            onQuickAction,
            onRefreshViralEvidence,
            onReloadViralLibrary,
            onResetSearch: () => {
              setViralSearchForm(emptyViralSearchForm);
              onReloadViralLibrary();
            },
            onSearchFormChange: (patch) => setViralSearchForm((current) => ({ ...current, ...patch })),
            onSearchViralLibrary,
            viralApplication,
            viralCaseById,
            viralCases,
            viralEvidenceSummary,
            viralInsights,
            viralLibraryHealth,
            viralPack,
            viralSearchForm
          }}
        />
      </div>

      {selectedEvidence ? (
        <EvidenceDrawer sample={selectedEvidence} onClose={() => setSelectedEvidence(null)} onSave={() => onSaveToViralLibrary(selectedEvidence)} />
      ) : null}
      {evidenceCatalogOpen ? (
        <EvidenceCatalogDrawer
          samples={evidenceSamples}
          onClose={() => setEvidenceCatalogOpen(false)}
          onOpenSample={(sample) => {
            setEvidenceCatalogOpen(false);
            setSelectedEvidence(sample);
          }}
          onSaveSample={onSaveToViralLibrary}
        />
      ) : null}
      {selectedViralCase ? (
        <ViralCaseDrawer viralCase={selectedViralCase} onClose={() => setSelectedViralCase(null)} />
      ) : null}
    </div>
  );
}

function uniqueStringList(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function extractProjectViralPack(project?: PostProject | null): WorkflowResult["viralKnowledge"] {
  const summary = project?.evidencePack.summary;
  if (!isRecordValue(summary) || !isRecordValue(summary.viralKnowledge)) {
    return null;
  }
  return summary.viralKnowledge as WorkflowResult["viralKnowledge"];
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function ReadinessStep({
  item,
  onQuickAction
}: {
  item: PostReadinessItem;
  onQuickAction: (action: string) => void;
}) {
  return (
    <button
      className={item.ready ? "readinessStep ready" : "readinessStep"}
      disabled={item.ready || !item.action}
      onClick={() => item.action && onQuickAction(item.action)}
      title={item.detail}
      type="button"
    >
      <span>{item.ready ? "✓" : "·"}</span>
      {item.label}
    </button>
  );
}

type ProjectInsight = PostProject["evidencePack"]["insights"][number];

function pickKeyLearningInsights(insights: ProjectInsight[]): ProjectInsight[] {
  const preferredOrder = ["hook", "title", "structure", "copy", "visual", "tag", "pain_point", "audience", "comment"];
  const sourceRank = (sourceType?: string) => {
    if (sourceType === "user_input") return 0;
    if (sourceType === "realtime" || !sourceType) return 1;
    if (sourceType === "viral_library") return 2;
    return 3;
  };
  const selected: ProjectInsight[] = [];
  const usedTypes = new Set<string>();
  const usedSources = new Set<string>();
  const sorted = [...insights]
    .filter((insight) => insight.insight.trim())
    .sort((left, right) => {
      const leftRank = preferredOrder.indexOf(left.type);
      const rightRank = preferredOrder.indexOf(right.type);
      const byType = (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank);
      const bySource = sourceRank(left.sourceType) - sourceRank(right.sourceType);
      return byType || bySource || right.confidence - left.confidence || left.id.localeCompare(right.id);
    });

  for (const insight of sorted) {
    if (selected.length >= 5) break;
    const source = insight.sourceType ?? "realtime";
    if (usedTypes.has(insight.type) && selected.length < 3) continue;
    if (usedSources.has(source) && selected.length < 2 && sorted.some((item) => (item.sourceType ?? "realtime") !== source)) continue;
    selected.push(insight);
    usedTypes.add(insight.type);
    usedSources.add(source);
  }

  return selected.length ? selected : insights.slice(0, 5);
}

export function pickKeyViralInsights(insights: ProjectInsight[], focusedEvidenceIds: string[] = []): ProjectInsight[] {
  const preferredOrder = ["hook", "structure", "copy", "tag", "visual", "pain_point", "audience", "comment", "title"];
  const selected: ProjectInsight[] = [];
  const usedTypes = new Set<string>();
  const focusedIdSet = new Set(focusedEvidenceIds);
  const focusedInsights = insights
    .filter((insight) => focusedIdSet.has(insight.id) && insight.insight.trim())
    .sort((left, right) => focusedEvidenceIds.indexOf(left.id) - focusedEvidenceIds.indexOf(right.id));
  const sorted = [...insights]
    .filter((insight) => insight.insight.trim() && !focusedIdSet.has(insight.id))
    .sort((left, right) => {
      const leftRank = preferredOrder.indexOf(left.type);
      const rightRank = preferredOrder.indexOf(right.type);
      const byType = (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank);
      return byType || right.confidence - left.confidence || left.id.localeCompare(right.id);
    });

  for (const insight of focusedInsights) {
    if (selected.length >= 5) break;
    selected.push(insight);
    usedTypes.add(insight.type);
  }

  for (const insight of sorted) {
    if (selected.length >= 5) break;
    if (usedTypes.has(insight.type) && selected.length < 3) continue;
    selected.push(insight);
    usedTypes.add(insight.type);
  }

  return selected.length ? selected : insights.slice(0, 5);
}

function pickViralLearningLines(item: ViralCase): string[] {
  return uniqueText([
    ...(item.creativeSafety?.reusablePatterns ?? []),
    ...item.extractedInsights.reusableRules,
    ...item.extractedInsights.titleHooks.map((line) => `标题：${line}`),
    ...item.extractedInsights.copyStructures.map((line) => `结构：${line}`),
    ...item.extractedInsights.tagPatterns.map((line) => `标签：${line}`),
    ...item.extractedInsights.visualPatterns.map((line) => `图片：${line}`),
    ...item.contentStructure.map((line) => `结构：${line}`)
  ]).slice(0, 5);
}

function pickViralRewriteLines(item: ViralCase): string[] {
  return uniqueText([
    ...(item.creativeSafety?.transformationGuidance ?? []),
    ...(item.creativeSafety?.doNotCopy ?? []),
    ...item.extractedInsights.avoidCopying,
    "不要复用原文句式、原图构图和具体个人经历"
  ]).slice(0, 4);
}

function uniqueText(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const clean = value.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
  }
  return result;
}

function labelForAction(action: string): string {
  return labelForPostAction(action);
}

function labelForCanvasSaveStatus(
  canvasDirty: boolean,
  versionStatus: ReturnType<typeof getPostVersionStatus> | null
): string {
  if (canvasDirty) return "未保存";
  if (versionStatus?.finalPostMatchesCanvas) return "已入稿";
  return "已同步";
}

function labelForVersionLockStatus(versionStatus: ReturnType<typeof getPostVersionStatus> | null): string {
  if (!versionStatus) return "待生成";
  if (versionStatus.qualityGateFresh) return "已锁定";
  if (versionStatus.finalPostMatchesCanvas) return "待检查";
  if (versionStatus.needsReassemble) return "需组装";
  return "待确认";
}

function labelForQualityStatus(
  quality: PostProject["qualityCheck"] | undefined,
  qualityGateFresh: boolean
): string {
  if (!quality) return "未检查";
  if (!qualityGateFresh) return "已失效";
  return quality.canPublish ? "通过" : "需处理";
}

function hasTraceableVisualDirection(project: PostProject | null): boolean {
  if (!project) return false;
  const isConfirmed = project.visualDirection?.confirmationStatus === "confirmed" || Boolean(project.visualDirection?.confirmedAt);
  if (!isConfirmed) return false;
  const visualEvidenceIds = project.visualDirection?.basedOnEvidenceIds ?? [];
  const promptEvidenceIds = project.imagePrompts.flatMap((prompt) => prompt.basedOnEvidenceIds ?? []);
  return [...visualEvidenceIds, ...promptEvidenceIds].some((id) => id.trim());
}

function isSampleEvidence(value: unknown): value is SampleEvidence {
  return Boolean(value) && typeof value === "object" && typeof (value as { id?: unknown }).id === "string" && typeof (value as { title?: unknown }).title === "string";
}

function uniqueAssets(assets: AssetRecord[]): AssetRecord[] {
  const seen = new Set<string>();
  return assets.filter((asset) => {
    if (seen.has(asset.id)) return false;
    seen.add(asset.id);
    return true;
  });
}

function sortNewestAsset(left: AssetRecord, right: AssetRecord): number {
  return Date.parse(right.createdAt) - Date.parse(left.createdAt);
}
