"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  MessageSquareText,
  Rocket,
  Search,
  Send
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  AssetRecord,
  AgentResponseCard,
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
import { isHighPriorityAgentCard, pickVisibleAgentCards } from "@/app/components/agent-card-visibility";
import { buildAgentMessageDisplay } from "@/app/components/agent-message-display";
import { buildAgentTraceSummary } from "@/app/components/agent-trace-summary";
import { extractStageGuidanceDisplay } from "@/app/components/agent-stage-guidance";
import { PostCanvasPanel } from "@/app/components/post-canvas-panel";
import { extractAgentDirectorSummaryDisplay } from "@/app/components/agent-director-summary-display";
import { extractAgentCreationProvenanceDisplay } from "@/app/components/agent-creation-provenance-display";
import { selectStudioChatWindow } from "@/app/components/studio-chat-window";
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
import { buildStudioTabGroups } from "@/app/components/studio-tab-groups";
import { selectRunningJobForWorkspace } from "@/app/components/job-display";
import { buildCreationProvenance } from "@/app/components/creation-provenance";
import { buildBriefTabSummary, buildImageTabSummary, buildPublishTabSummary, type StudioTabSummary } from "@/app/components/studio-tab-summary";
import { EvidenceCatalogDrawer, EvidenceDrawer, ViralCaseDrawer } from "@/app/components/post-studio-drawers";
import { PostStudioHeaderPanel } from "@/app/components/post-studio-header-panel";
import { PostStudioSideNavigator } from "@/app/components/post-studio-side-navigator";
import {
  PostStudioBriefTab,
  PostStudioEvidenceTab,
  PostStudioInsightsTab
} from "@/app/components/post-studio-evidence-tabs";
import { PostStudioGeneratedTab, PostStudioReferencesTab } from "@/app/components/post-studio-media-tabs";
import { emptyViralSearchForm, PostStudioViralTab } from "@/app/components/post-studio-viral-tab";
import { labelForPublishStatus } from "@/app/components/post-studio-publish-intent-panel";
import { PostStudioPublishTab } from "@/app/components/post-studio-publish-tab";
import { buildVersionSwitchGuidance } from "@/app/components/version-switch-guidance";
import { resolvePostCreationTopic, resolvePostStudioTitle } from "@/app/components/post-studio-title";
import type { ViralLibrarySearchFilters } from "@/app/components/viral-search";
import type { PostReadinessItem } from "@/lib/post-project/readiness";
import type { PostAction } from "@/lib/post-project/types";

export type StudioTab = "insights" | "brief" | "evidence" | "viral" | "references" | "generated" | "publish";

type ResearchForm = {
  topic: string;
  contentType: string;
  timeRange: string;
  sampleCount: number;
  analyzeImages: boolean;
  requirements: string;
};

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
  useEffect(() => {
    if (focusTab?.tab) {
      setTab(focusTab.tab);
    }
  }, [focusTab?.nonce, focusTab?.tab]);
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
  const keyViralInsights = pickKeyViralInsights(viralInsights);
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
  const publishReady = Boolean(
    publishDraft.title.trim() &&
      publishDraft.content.trim() &&
      publishDraft.tagsText.trim() &&
      selectedAssets.length &&
      hasVisualDirection &&
      citationTraceReady &&
      accountReady &&
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
    qualityViralCoverage
  });
  const flowSummary = buildPostFlowSummary(readiness);
  const statusSummary = buildPostStudioStatusSummary({
    project,
    workspace,
    settings,
    health,
    evidenceCount: samples.length,
    hasDraft: Boolean(publishDraft.title || project?.copyDraft || project?.finalPost),
    selectedImageCount: selectedAssets.length,
    canvasDirty
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
        <section className="panel studioAgentPane">
          <div className="panelHeader compact">
            <div>
              <h2>AI Agent</h2>
              <p>像内容导演一样工作：先判断阶段和信息是否足够，再搜索、总结、生成或追问。</p>
            </div>
          </div>

          <details className="studioResearchDetails" open={!samples.length}>
            <summary>
              <span>真实笔记研究</span>
              <strong>{samples.length ? `${samples.length} 条证据已绑定` : "先搜索证据"}</strong>
            </summary>
            <form className="studioResearchBox" onSubmit={onRunResearch}>
              <label>
                <span>主题</span>
                <input
                  placeholder="例如：广州咖啡馆 / 通勤包 / 产品种草"
                  value={researchForm.topic}
                  onChange={(event) => onResearchFormChange({ ...researchForm, topic: event.target.value })}
                />
              </label>
              <div className="formRow">
                <label>
                  <span>时间</span>
                  <select value={researchForm.timeRange} onChange={(event) => onResearchFormChange({ ...researchForm, timeRange: event.target.value })}>
                    <option>一天内</option>
                    <option>一周内</option>
                    <option>两周内</option>
                    <option>半年内</option>
                  </select>
                </label>
                <label>
                  <span>样本</span>
                  <input min={3} max={20} type="number" value={researchForm.sampleCount} onChange={(event) => onResearchFormChange({ ...researchForm, sampleCount: Number(event.target.value) })} />
                </label>
              </div>
              <label>
                <span>创作要求</span>
                <textarea
                  placeholder="目标人群、语气、卖点、禁忌词、产品信息等。"
                  value={researchForm.requirements}
                  onChange={(event) => onResearchFormChange({ ...researchForm, requirements: event.target.value })}
                />
              </label>
              <button className="primaryButton fullWidth" disabled={busy} type="submit">
                <Search size={16} />
                搜索并提炼证据
              </button>
            </form>
          </details>

          {runningJob ? (
            <div className="studioToolTrace">
              <div className="studioToolTraceHeader">
                <strong>{runningJob.title}</strong>
                <span>{runningJob.status} · {runningJob.progress}%</span>
              </div>
              <div className="miniProgress"><i style={{ width: `${runningJob.progress}%` }} /></div>
              {runningJob.steps.length ? (
                <ul className="studioToolStepList" aria-label="后台工具步骤">
                  {runningJob.steps.slice(-3).map((step) => (
                    <li className={step.status} key={step.id}>
                      <span>{labelForTraceStatus(step.status === "done" ? "completed" : step.status)}</span>
                      <p>{step.label}</p>
                      {step.detail ? <small>{step.detail}</small> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <span>任务已创建，等待工具步骤回传。</span>
              )}
            </div>
          ) : null}

          <div className="studioChatList">
            {selectStudioChatWindow(messages).map((message, index) => (
              <StudioChatBubble
                index={index}
                key={message.id ?? `${message.role}-${index}`}
                message={message}
                onQuickAction={onQuickAction}
              />
            ))}
            {!messages.length ? (
              <div className="studioEmpty">
                <MessageSquareText size={22} />
                <strong>告诉 Agent 你要做什么</strong>
                <p>例如：找最近一周高收藏笔记，分析标题和图片风格，再生成一篇适合探店账号的图文笔记。</p>
              </div>
            ) : null}
          </div>

          <form className="studioComposer" onSubmit={onChatSubmit}>
            <textarea value={chatInput} onChange={(event) => onChatInput(event.target.value)} placeholder="继续追问：再生活化一点 / 用第二张图 / 今晚八点发..." />
            <button className="primaryButton" disabled={busy} type="submit">
              <Send size={16} />
              发送
            </button>
          </form>
        </section>

        <PostCanvasPanel
          canGenerateCopy={canGenerateCopy}
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

        <aside className="panel studioSidePane">
          <PostStudioSideNavigator
            activeTab={tab}
            sideDigest={sideDigest}
            studioTabGroups={studioTabGroups}
            onSelectTab={setTab}
          />

          {tab === "insights" ? (
            <PostStudioInsightsTab
              citationReport={citationReport}
              creatorMemory={creatorMemory}
              keyLearningInsights={keyLearningInsights}
              onOpenViral={() => setTab("viral")}
              projectMemory={project?.agentMemory ?? []}
              realtimeCount={realtimeInsights.length}
              totalInsightCount={insights.length}
              viralCount={viralInsights.length}
              viralEvidenceSummary={viralEvidenceSummary}
            />
          ) : null}

          {tab === "brief" ? (
            <PostStudioBriefTab
              brief={brief}
              briefEvidenceSummary={briefEvidenceSummary}
              onQuickAction={onQuickAction}
              summary={briefTabSummary}
              visualEvidenceSummary={visualEvidenceSummary}
            />
          ) : null}

          {tab === "evidence" ? (
            <PostStudioEvidenceTab
              evidencePanel={evidencePanel}
              onOpenEvidenceCatalog={() => setEvidenceCatalogOpen(true)}
              onOpenSample={setSelectedEvidence}
              onOpenWorkflow={() => onNavigate("workflow")}
              onSaveManyToViralLibrary={onSaveManyToViralLibrary}
              onSaveToViralLibrary={onSaveToViralLibrary}
              saveableSamples={saveableSamples}
              summarizeEvidenceSample={summarizeEvidenceSample}
              viralSaveCandidates={viralSaveCandidates}
            />
          ) : null}

          {tab === "viral" ? (
            <PostStudioViralTab
              focusedEvidenceIds={focusedEvidenceIds}
              keyViralInsights={keyViralInsights}
              latestViralSummaries={latestViralSummaries}
              onFocusEvidenceIds={onFocusEvidenceIds}
              onOpenViralCase={setSelectedViralCase}
              onQuickAction={onQuickAction}
              onRefreshViralEvidence={onRefreshViralEvidence}
              onReloadViralLibrary={onReloadViralLibrary}
              onResetSearch={() => {
                setViralSearchForm(emptyViralSearchForm);
                onReloadViralLibrary();
              }}
              onSearchFormChange={(patch) => setViralSearchForm((current) => ({ ...current, ...patch }))}
              onSearchViralLibrary={onSearchViralLibrary}
              viralApplication={viralApplication}
              viralCaseById={viralCaseById}
              viralCases={viralCases}
              viralEvidenceSummary={viralEvidenceSummary}
              viralInsights={viralInsights}
              viralLibraryHealth={viralLibraryHealth}
              viralPack={viralPack}
              viralSearchForm={viralSearchForm}
            />
          ) : null}

          {tab === "references" ? (
            <PostStudioReferencesTab
              assetSummary={referenceAssetSummary}
              onNavigate={onNavigate}
              onOpenImageStudio={onOpenImageStudio}
              onQuickAction={onQuickAction}
              onSelectPostImages={onSelectPostImages}
              onUploadReferenceFiles={onUploadReferenceFiles}
              project={project}
              publishAssetIds={publishAssetIds}
              summary={referenceTabSummary}
            />
          ) : null}

          {tab === "generated" ? (
            <PostStudioGeneratedTab
              assetSummary={generatedAssetSummary}
              onOpenImageStudio={onOpenImageStudio}
              onQuickAction={onQuickAction}
              onSelectPostImages={onSelectPostImages}
              project={project}
              publishAssetIds={publishAssetIds}
              summary={generatedTabSummary}
            />
          ) : null}

          {tab === "publish" ? (
            <PostStudioPublishTab
              accountReady={accountReady}
              accountReadyHint={accountReadyHint}
              activeAccountLabel={activeAccount?.displayName ?? settings.activeAccountId}
              activeLoginName={health?.activeAccount?.loginName}
              activePublishPlan={activePublishPlan}
              auditSummary={auditSummary}
              busy={busy}
              citationReport={citationReport}
              citationTraceReady={citationTraceReady}
              confirmedRequiredCount={confirmedRequiredCount}
              defaultAutoPublish={settings.defaultAutoPublish}
              hasExistingVisualDirection={Boolean(project?.visualDirection)}
              hasVisualDirection={hasVisualDirection}
              onCancelPublish={onCancelPublish}
              onConfirmPublish={onConfirmPublish}
              onNavigate={onNavigate}
              onOpenPublish={onOpenPublish}
              onPreparePublish={onPreparePublish}
              onQuickAction={onQuickAction}
              onScheduleAtChange={onScheduleAtChange}
              onVisibilityChange={onVisibilityChange}
              pendingPublish={pendingPublish}
              publishAccountSafety={publishAccountSafety}
              publishDraft={publishDraft}
              publishReady={publishReady}
              publishSafetyBoundary={publishSafetyBoundary}
              publishScheduleAt={publishScheduleAt}
              publishSummary={publishSummary}
              publishVisibility={publishVisibility}
              quality={quality}
              qualityGateFresh={versionStatus?.qualityGateFresh === true}
              qualityViralCoverage={qualityViralCoverage}
              requiredConfirmations={requiredConfirmations}
              selectedImageCount={selectedAssets.length}
              staleAccountPublishPlan={staleAccountPublishPlan}
              staleCanvasPublishPlan={staleCanvasPublishPlan}
              summary={publishTabSummary}
            />
          ) : null}

          <details className="advancedEntry compactAdvancedEntry">
            <summary>
              <strong>高级/调试工具</strong>
              <span>日常创作留在 Post Studio；只有排查任务或单独批量处理时再展开。</span>
            </summary>
            <div className="advancedToolList">
              <button onClick={() => onNavigate("workflow")} type="button">
                <strong>独立主题研究</strong>
                <span>单独复查搜索条件和样本表。</span>
              </button>
              <button onClick={() => onNavigate("imageStudio")} type="button">
                <strong>高级图片工具</strong>
                <span>批量生成 AI 图片或图文卡片。</span>
              </button>
              <button onClick={() => onNavigate("jobs")} type="button">
                <strong>任务进度</strong>
                <span>查看后台长任务和失败原因。</span>
              </button>
              <button onClick={() => onNavigate("publish")} type="button">
                <strong>发布装配调试</strong>
                <span>备用入口；正式发布仍优先在本页确认。</span>
              </button>
            </div>
          </details>
        </aside>
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

function StudioChatBubble({
  message,
  index,
  onQuickAction
}: {
  message: ChatMessage;
  index: number;
  onQuickAction: (action: string) => void;
}) {
  const display = buildAgentMessageDisplay(message.content, {
    maxChars: message.role === "assistant" ? 420 : 260,
    maxLines: message.role === "assistant" ? 7 : 4
  });

  return (
    <article className={message.role === "user" ? "studioChatBubble user" : "studioChatBubble"} data-message-index={index}>
      <div className="chatBubbleHeader">
        <strong>{message.role === "user" ? "你" : "AI Agent"}</strong>
        {message.role === "assistant" ? (
          <AgentIntentBadge
            confidence={message.intentConfidence}
            intent={message.intent}
            needsUserInput={message.needsUserInput}
            stage={message.stage}
          />
        ) : null}
      </div>
      {display.visibleText ? <p>{display.visibleText}</p> : null}
      {display.truncated ? (
        <details className="agentLongMessage">
          <summary>{message.role === "assistant" ? "展开完整回复" : "展开完整输入"}</summary>
          <p>{display.fullText}</p>
        </details>
      ) : null}
      {message.role === "assistant" ? (
        <AgentStructuredMessage message={message} onQuickAction={onQuickAction} />
      ) : null}
    </article>
  );
}

function AgentStructuredMessage({
  message,
  onQuickAction
}: {
  message: ChatMessage;
  onQuickAction: (action: string) => void;
}) {
  const allCards = message.cards ?? [];
  const cards = pickVisibleAgentCards(allCards);
  const hiddenCards = allCards.filter((card) => !cards.some((visible) => visible.id === card.id));
  const traceSummary = buildAgentTraceSummary(message.toolTrace ?? []);
  const trace = traceSummary.visibleTrace;
  const actions = (message.quickActions ?? []).slice(0, 3);
  if (!cards.length && !trace.length && !actions.length && !message.questions?.length) {
    return null;
  }

  return (
    <div className="agentMessageMeta">
      {message.questions?.length ? (
        <div className="agentQuestionBox priority">
          <strong>Agent 还需要你补充</strong>
          {message.questions.slice(0, 3).map((question) => <p key={question}>{question}</p>)}
        </div>
      ) : null}

      {cards.length ? (
        <div className="agentCardStrip">
          {cards.map((card) => (
            <article className={`agentMiniCard ${card.type} ${isHighPriorityAgentCard(card.type) ? "highPriority" : ""}`} key={card.id}>
              <span>{labelForAgentCard(card.type)}</span>
              <strong>{card.title}</strong>
              <p>{card.summary}</p>
              <AgentCardInlineDetails card={card} onQuickAction={onQuickAction} />
              {extractEvidenceIdsFromAgentCard(card).length ? (
                <small>证据：{extractEvidenceIdsFromAgentCard(card).slice(0, 3).join(" / ")}</small>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {hiddenCards.length ? (
        <details className="agentHiddenCards">
          <summary>还有 {hiddenCards.length} 张结构卡已折叠</summary>
          {hiddenCards.slice(0, 6).map((card) => (
            <p key={card.id}>{labelForAgentCard(card.type)}：{card.title}</p>
          ))}
        </details>
      ) : null}

      {trace.length ? (
        <details className="agentTraceMini">
          <summary>工具轨迹 · {traceSummary.summaryLabel}</summary>
          {trace.map((item) => (
            <div key={item.id}>
              <span className={`traceStatus ${item.status}`}>{labelForTraceStatus(item.status)}</span>
              <p>{item.label}：{item.detail}</p>
            </div>
          ))}
          {traceSummary.recoveryHint ? <p className="traceRecoveryHint">{traceSummary.recoveryHint}</p> : null}
        </details>
      ) : null}

      {actions.length ? (
        <div className="agentQuickActionRow">
          {actions.map((action) => (
            <button
              className="miniActionButton"
              disabled={action.disabled}
              key={action.id}
              onClick={() => onQuickAction(action.action)}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AgentCardInlineDetails({
  card,
  onQuickAction
}: {
  card: AgentResponseCard;
  onQuickAction: (action: string) => void;
}) {
  const directorSummary = extractAgentDirectorSummaryDisplay(card);
  const stageGuidance = extractStageGuidanceDisplay(card);
  const provenance = extractAgentCreationProvenanceDisplay(card);
  if (directorSummary) {
    return (
      <div className="agentDirectorMini">
        <div className="agentDirectorReason">
          <span>{directorSummary.needsUserInput ? "需要补充" : "阶段判断"}</span>
          <strong>{directorSummary.stageTitle}</strong>
          <p>{directorSummary.stageDescription}</p>
        </div>
        <div className="agentDirectorWhy">
          <span>为什么这样做</span>
          <p>{directorSummary.why}</p>
        </div>
        <div className="agentDirectorStats">
          <span>进度 <b>{directorSummary.progress ?? 0}%</b></span>
          <span>证据 <b>{directorSummary.evidenceCount}</b></span>
          <span>草稿 <b>{directorSummary.hasDraft ? "已建立" : "待生成"}</b></span>
          <span>记忆 <b>{directorSummary.memorySignalCount}</b></span>
        </div>
        {directorSummary.memoryHints.length ? (
          <div className="agentDirectorMemory">
            <span>本项目记忆</span>
            {directorSummary.memoryHints.map((item) => <p key={item}>{item}</p>)}
          </div>
        ) : null}
        {directorSummary.blockerCount ? <small className="agentDirectorBlocker">还有 {directorSummary.blockerCount} 个阻塞项需要处理</small> : null}
        {directorSummary.nextAction ? (
          <button className="miniActionButton primaryInline" type="button" onClick={() => onQuickAction(directorSummary.nextAction!)}>
            建议下一步：{directorSummary.nextActionLabel}
          </button>
        ) : null}
      </div>
    );
  }
  if (provenance) {
    return (
      <div className="agentProvenanceMini">
        <div className="agentProvenanceHeader">
          <span>{provenance.headline}</span>
          <p>{provenance.detail}</p>
        </div>
        <div className="agentProvenanceItems">
          {provenance.items.map((item) => (
            <div className={item.status} key={item.id}>
              <span>{item.status === "ready" ? "已追溯" : item.status === "warn" ? "需复核" : "待建立"}</span>
              <strong>{item.label}</strong>
              <p>{item.summary}</p>
              <small>
                {item.sourceLine} · 证据 {item.evidenceCount}
                {item.missingCount ? ` · 待补 ${item.missingCount}` : ""}
              </small>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (!stageGuidance) return null;
  return (
    <div className="agentStageMiniFlow">
      <div className="agentStageProgress">
        <span>进度</span>
        <strong>{stageGuidance.progress ?? 0}%</strong>
      </div>
      <div className="agentStageChecklist">
        {stageGuidance.items.map((item) => (
          <div className={item.ready ? "ready" : "todo"} key={`${item.label}-${item.action ?? item.detail}`}>
            <span>{item.ready ? "已完成" : "下一步"}</span>
            <strong>{item.label}</strong>
            <p>{item.detail}</p>
            {!item.ready && item.action ? (
              <button type="button" onClick={() => onQuickAction(item.action!)}>
                {labelForPostAction(item.action)}
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {stageGuidance.primaryAction ? (
        <button className="miniActionButton primaryInline" type="button" onClick={() => onQuickAction(stageGuidance.primaryAction!)}>
          建议下一步：{labelForPostAction(stageGuidance.primaryAction)}
        </button>
      ) : null}
    </div>
  );
}

function AgentIntentBadge({
  intent,
  confidence,
  needsUserInput,
  stage
}: {
  intent?: string;
  confidence?: number;
  needsUserInput?: boolean;
  stage?: PostProject["currentStage"];
}) {
  if (!intent && confidence === undefined && !needsUserInput && !stage) return null;
  const confidenceLabel = confidence === undefined ? "" : `${Math.round(confidence * 100)}%`;
  return (
    <span className={needsUserInput ? "agentIntentBadge ask" : "agentIntentBadge"}>
      {needsUserInput ? "需补充" : intent || "Agent"}
      {confidenceLabel ? ` · ${confidenceLabel}` : ""}
      {stage ? ` · ${labelForStage(stage)}` : ""}
    </span>
  );
}

function extractEvidenceIdsFromAgentCard(card: AgentResponseCard): string[] {
  if (!isRecordValue(card.data)) return [];
  const directIds = stringListFromRecordValue(card.data.basedOnEvidenceIds);
  const reportIds = stringListFromRecordValue(card.data.allEvidenceIds);
  const viralIds = stringListFromRecordValue(card.data.evidenceIds);
  return uniqueText([...directIds, ...reportIds, ...viralIds]).slice(0, 6);
}

function stringListFromRecordValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
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

function SideSection({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section className="studioSideSection">
      <h3><Icon size={16} />{title}</h3>
      {children}
    </section>
  );
}

function StudioTaskSummary({
  summary,
  onQuickAction
}: {
  summary: StudioTabSummary;
  onQuickAction: (action: string) => void;
}) {
  return (
    <article className={`studioTaskSummary ${summary.state}`}>
      <div>
        <span>当前状态</span>
        <strong>{summary.headline}</strong>
        <p>{summary.detail}</p>
      </div>
      {summary.primaryAction ? (
        <button className="secondaryButton fullWidth" type="button" onClick={() => onQuickAction(summary.primaryAction!)}>
          {summary.primaryActionLabel}
        </button>
      ) : (
        <small>{summary.primaryActionLabel}</small>
      )}
    </article>
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

function pickKeyViralInsights(insights: ProjectInsight[]): ProjectInsight[] {
  const preferredOrder = ["hook", "structure", "copy", "tag", "visual", "pain_point", "audience", "comment", "title"];
  const selected: ProjectInsight[] = [];
  const usedTypes = new Set<string>();
  const sorted = [...insights]
    .filter((insight) => insight.insight.trim())
    .sort((left, right) => {
      const leftRank = preferredOrder.indexOf(left.type);
      const rightRank = preferredOrder.indexOf(right.type);
      const byType = (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank);
      return byType || right.confidence - left.confidence || left.id.localeCompare(right.id);
    });

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

function labelForStage(stage: PostProject["currentStage"]): string {
  const labels: Record<PostProject["currentStage"], string> = {
    empty: "空项目",
    briefing: "补充需求",
    researching: "研究中",
    evidence_ready: "证据就绪",
    brief_ready: "Brief 就绪",
    copy_drafting: "文案生成中",
    copy_ready: "文案就绪",
    visual_planning: "规划图片",
    image_prompt_ready: "Prompt 就绪",
    image_generating: "图片生成中",
    image_ready: "图片就绪",
    assembling: "组装帖子",
    reviewing: "发布检查",
    scheduled: "已定时",
    published: "已发布",
    failed: "失败"
  };
  return labels[stage];
}

function labelForAction(action: string): string {
  return labelForPostAction(action);
}

function labelForAgentCard(type: string): string {
  const labels: Record<string, string> = {
    director_summary: "导演摘要",
    agent_plan: "Agent 计划",
    stage_guidance: "下一步",
    evidence_summary: "证据摘要",
    viral_knowledge: "爆款库",
    evidence_citations: "证据引用",
    creation_provenance: "创作依据",
    creative_brief: "CreativeBrief",
    copy_draft: "文案草稿",
    visual_direction: "图片方向",
    image_prompt: "图片 Prompt",
    publish_check: "发布检查",
    quality_check: "质量检查"
  };
  return labels[type] ?? type;
}

function labelForTraceStatus(status: string): string {
  const labels: Record<string, string> = {
    planned: "已计划",
    running: "执行中",
    completed: "完成",
    failed: "失败"
  };
  return labels[status] ?? status;
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
