"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ExternalLink,
  FileText,
  ImagePlus,
  Library,
  MessageSquareText,
  Rocket,
  Search,
  Send,
  ShieldCheck,
  Sparkles
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
import { citationFieldBadges, formatCitationStripSummary } from "@/app/components/evidence-citation-display";
import { isHighPriorityAgentCard, pickVisibleAgentCards } from "@/app/components/agent-card-visibility";
import { buildAgentMessageDisplay } from "@/app/components/agent-message-display";
import { buildAgentTraceSummary } from "@/app/components/agent-trace-summary";
import { extractStageGuidanceDisplay } from "@/app/components/agent-stage-guidance";
import { extractAgentDirectorSummaryDisplay } from "@/app/components/agent-director-summary-display";
import { extractAgentCreationProvenanceDisplay } from "@/app/components/agent-creation-provenance-display";
import { selectStudioChatWindow } from "@/app/components/studio-chat-window";
import { buildPostReadinessReport } from "@/lib/post-project/readiness";
import { getPostVersionDiffReport, getPostVersionStatus } from "@/lib/post-project/versioning";
import { buildEvidencePanelModel, scoreEvidence, summarizeEvidenceSample } from "@/app/components/evidence-display";
import { buildViralSaveCandidateModel } from "@/app/components/viral-save-candidates";
import { buildCanvasVersionDisplay } from "@/app/components/post-version-display";
import { labelForPostAction } from "@/app/components/post-action-labels";
import { buildPostStudioStatusSummary } from "@/app/components/post-studio-status";
import { buildViralApplicationModel } from "@/app/components/viral-application";
import { buildViralEvidenceSummary } from "@/app/components/viral-evidence-summary";
import { buildViralLibraryHealth } from "@/app/components/viral-library-health";
import { buildPublishConfirmationSummary } from "@/app/components/publish-confirmation-summary";
import { buildPublishSafetyBoundary } from "@/app/components/publish-safety-boundary";
import { buildPublishAccountSafety } from "@/app/components/publish-account-safety";
import { buildPublishAuditSafetySummary } from "@/app/components/publish-audit-summary";
import { buildPostProjectContextSummary } from "@/app/components/post-project-context";
import { buildGeneratedAssetSummary, buildReferenceAssetSummary } from "@/app/components/asset-panel-summary";
import { buildPostNextStepCoach } from "@/app/components/post-next-step-coach";
import { buildPostFlowSummary, type PostFlowPhase } from "@/app/components/post-flow-summary";
import { buildPostSideDigest } from "@/app/components/post-side-digest";
import { buildStudioTabGroups } from "@/app/components/studio-tab-groups";
import { selectRunningJobForWorkspace } from "@/app/components/job-display";
import { buildCreationProvenance, type CreationProvenanceCard } from "@/app/components/creation-provenance";
import { buildBriefTabSummary, buildImageTabSummary, buildPublishTabSummary, type StudioTabSummary } from "@/app/components/studio-tab-summary";
import { buildVersionSwitchGuidance } from "@/app/components/version-switch-guidance";
import { buildCreatorMemoryDigest } from "@/lib/agent/memory-digest";
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
  const [viralSearchForm, setViralSearchForm] = useState({
    query: "",
    category: "",
    tags: "",
    audience: "",
    painPoint: "",
    createdAfter: "",
    createdBefore: "",
    minLikes: "",
    minCollects: "",
    minComments: "",
    minShares: "",
    minScore: "",
    sortBy: "score" as NonNullable<ViralLibrarySearchFilters["sortBy"]>,
    sortOrder: "desc" as NonNullable<ViralLibrarySearchFilters["sortOrder"]>
  });
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
  const focusedEvidenceIdSet = new Set(focusedEvidenceIds);
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
  const nextStepCoach = buildPostNextStepCoach({ guidance: stageGuidance, readiness, nextActions });
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
        <div>
          <span className="flowKicker">Post Studio</span>
          <h2>{projectTitle}</h2>
          <p>围绕一篇帖子推进：先研究真实笔记，再生成文案、图片方向、发布预览和安全检查。</p>
          <div className={`projectContextCard ${projectContextSummary.state}`}>
            <div>
              <span>当前帖子项目</span>
              <strong>{projectContextSummary.title}</strong>
              <p>{projectContextSummary.projectLine}</p>
            </div>
            <div className="projectContextLines">
              <span>{projectContextSummary.accountLine}</span>
              <span>{projectContextSummary.scopeLine}</span>
              <span>{projectContextSummary.publishLine}</span>
            </div>
            <div className="projectContextChips">
              {projectContextSummary.chips.map((item) => (
                <em className={item.state} key={item.label}>
                  <small>{item.label}</small>
                  {item.value}
                </em>
              ))}
            </div>
          </div>
          <div className={`studioStatusSummary ${statusSummary.riskLevel}`}>
            <div>
              <span>当前判断</span>
              <strong>{statusSummary.headline}</strong>
              <p>{statusSummary.detail}</p>
            </div>
            <div className="studioStatusProgress" aria-label="帖子项目完成度">
              <div>
                <span>{statusSummary.stageLine}</span>
                {statusSummary.primaryAction ? (
                  <button type="button" onClick={() => onQuickAction(statusSummary.primaryAction!)}>
                    建议：{statusSummary.primaryActionLabel}
                  </button>
                ) : statusSummary.primaryActionLabel ? (
                  <b>建议：{statusSummary.primaryActionLabel}</b>
                ) : null}
              </div>
              <i><em style={{ width: `${statusSummary.progressPercent}%` }} /></i>
            </div>
            <div className="studioStatusChips">
              {statusSummary.chips.map((item) => (
                <em className={item.state} key={item.label}>
                  <small>{item.label}</small>
                  {item.value}
                </em>
              ))}
            </div>
            <div className="studioAccountLine">
              <ShieldCheck size={15} />
              <span>{statusSummary.accountLine}</span>
            </div>
            <div className={`studioAccountControl ${statusSummary.accountReady ? "ready" : "warn"}`}>
              <div>
                <small>发布账号</small>
                <strong>{statusSummary.accountName}</strong>
                <span>{statusSummary.accountLoginName ? `登录名：${statusSummary.accountLoginName}` : "登录名待检测"}</span>
                <span>MCP：{statusSummary.accountMcpEndpoint}</span>
              </div>
              {settings.accounts.length > 1 ? (
                <label>
                  <span>切换</span>
                  <select value={settings.activeAccountId} onChange={(event) => onSwitchAccount(event.target.value)}>
                    {statusSummary.accountOptions.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="studioAccountButtons">
                <button className="secondaryButton" type="button" onClick={onRefreshHealth}>
                  检测当前账号
                </button>
                <button className="secondaryButton" type="button" onClick={() => onNavigate("settings")}>
                  账号设置
                </button>
              </div>
              <div className="studioAccountOptionList" aria-label="账号切换状态">
                {statusSummary.accountOptions.slice(0, 3).map((account) => (
                  <span className={account.isReady ? "ready" : account.isActive ? "active" : ""} key={account.id}>
                    {account.detail}
                  </span>
                ))}
              </div>
              <small className="studioAccountSwitchHint">{statusSummary.accountSwitchHint}</small>
            </div>
            {statusSummary.blockers.length ? (
              <ul className="studioStatusBlockers">
                {statusSummary.blockers.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : null}
          </div>
        </div>
        <div className="postFlowRail" aria-label="帖子创作流程">
          {flowSummary.map((phase, index) => (
            <PostFlowPhaseItem
              index={index}
              key={phase.id}
              phase={phase}
              onQuickAction={onQuickAction}
            />
          ))}
        </div>
        <div className="nextActionBar">
          <span className="nextActionEyebrow">下一步建议</span>
          <strong>{nextStepCoach.headline}</strong>
          <p>{nextStepCoach.detail}</p>
          {nextStepCoach.progressLine ? <small>{nextStepCoach.progressLine}</small> : null}
          <div className="nextActionButtons">
            {nextStepCoach.primaryAction ? (
              <button className="isPrimaryNext" type="button" onClick={() => onQuickAction(nextStepCoach.primaryAction!)}>
                {nextStepCoach.primaryLabel}
              </button>
            ) : null}
            {nextStepCoach.secondaryActions.map((item) => (
              <button key={item.action} type="button" onClick={() => onQuickAction(item.action)}>
                {item.label}
              </button>
            ))}
          </div>
          <form className="studioTopComposer" onSubmit={onChatSubmit}>
            <textarea
              aria-label="给 Agent 的下一步指令"
              value={chatInput}
              onChange={(event) => onChatInput(event.target.value)}
              placeholder="直接告诉 Agent 下一步：补充产品卖点 / 标题更生活化 / 用第二张图 / 今晚八点发"
            />
            <button className="primaryButton" disabled={busy} type="submit">
              <Send size={15} />
              发送
            </button>
          </form>
          <details className="nextActionDecision">
            <summary>查看原因与结果</summary>
            <span>为什么：{nextStepCoach.whyLine}</span>
            <span>完成后：{nextStepCoach.outcomeLine}</span>
            {nextStepCoach.safetyLine ? <span className="nextActionSafety">{nextStepCoach.safetyLine}</span> : null}
          </details>
          <button className="secondaryButton" onClick={onNewProject} type="button">新建项目</button>
        </div>
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

        <section className="panel postCanvasPane">
          <div className="panelHeader compact">
            <div>
              <h2>Post Canvas</h2>
              <p>最终帖子画布。标题、正文、标签、图片和预览在这里合并。</p>
            </div>
            <button className="secondaryButton" disabled={!canGenerateCopy} onClick={() => onGenerateCopy(generatedCopyPrompt)} type="button">
              <Bot size={16} />
              生成文案
            </button>
          </div>
          <CreationProvenanceStrip cards={creationProvenance} onOpenEvidence={() => setTab("insights")} />
          <section className={`canvasVersionSummary ${canvasVersionDisplay.tone}`} aria-label="画布版本同步摘要">
            <div>
              <span>版本同步</span>
              <strong>{canvasDirty ? "画布有未保存修改" : canvasVersionDisplay.label}</strong>
              <p>{canvasDirty ? "请先保存画布，再组装最终稿或运行发布检查。" : canvasVersionDisplay.detail}</p>
            </div>
            <div className="canvasVersionLanes">
              {canvasVersionDisplay.lanes.map((lane) => (
                <span className={lane.state} key={lane.id}>
                  <small>{lane.label}</small>
                  {lane.value}
                </span>
              ))}
            </div>
          </section>

          <div className="postPreviewShell">
            <div className="postPreviewMediaColumn">
              <div className="postCoverPreview">
                {selectedAssets[0] ? (
                  <img alt={selectedAssets[0].name} src={`/api/assets/file/${selectedAssets[0].id}`} />
                ) : (
                  <div>
                    <ImagePlus size={28} />
                    <span>封面待选择</span>
                  </div>
                )}
              </div>
              <section className={selectedAssets.length ? "selectedPostImages ready" : "selectedPostImages empty"} aria-label="已选择发布图片">
                <div>
                  <strong>{selectedAssets.length ? `已选 ${selectedAssets.length} 张发布图片` : "发布图片未选择"}</strong>
                  <span>{selectedAssets.length ? "这些图片已同步到当前 PostProject，会进入发布装配与安全检查。" : "在参考图或生成素材里点选图片，或让 Agent 先生成配图。"}</span>
                </div>
                {selectedAssets.length ? (
                  <div className="selectedPostImageThumbs">
                    {selectedAssets.slice(0, 4).map((asset) => (
                      <img alt={asset.name} key={asset.id} src={`/api/assets/file/${asset.id}`} />
                    ))}
                    {selectedAssets.length > 4 ? <span>+{selectedAssets.length - 4}</span> : null}
                  </div>
                ) : null}
              </section>
            </div>
            <div className="postEditStack">
              {copyVersions.length ? (
                <section className="versionSwitcher" aria-label="文案版本">
                  <div>
                    <strong>文案版本</strong>
                    <span>{copyVersionGuidance.detail}</span>
                  </div>
                  <div>
                    {copyVersions.slice(-4).map((version, index) => (
                      <article className="versionCard" key={version.id}>
                        <div>
                          <strong>{version.value.title || version.label || `版本 ${index + 1}`}</strong>
                          <span>{formatDateTime(version.createdAt)} · 证据 {version.basedOnEvidenceIds.length}</span>
                        </div>
                        <p>{summarizeDraftDiff(publishDraft, version.value)}</p>
                        <small className={`versionSwitchHint ${copyVersionGuidance.state}`}>{copyVersionGuidance.label}</small>
                        <button
                          type="button"
                          onClick={() => {
                            onDraftChange({
                              title: version.value.title,
                              content: version.value.content,
                              tagsText: version.value.tags.map((tag) => `#${tag}`).join(" "),
                              imagePrompt: version.value.imagePrompt || publishDraft.imagePrompt
                            });
                            onSelectCopyVersion(version.id);
                          }}
                        >
                          回滚到此版本
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
              <label>
                <span>标题</span>
                <input value={publishDraft.title} onChange={(event) => onDraftChange({ ...publishDraft, title: event.target.value })} placeholder="生成或手动填写标题" />
              </label>
              <label>
                <span>正文</span>
                <textarea value={publishDraft.content} onChange={(event) => onDraftChange({ ...publishDraft, content: event.target.value })} placeholder="正文会从 Agent 草稿同步过来，也可以直接编辑。" />
              </label>
              <label>
                <span>标签</span>
                <input value={publishDraft.tagsText} onChange={(event) => onDraftChange({ ...publishDraft, tagsText: event.target.value })} placeholder="#小红书 #探店" />
              </label>
              <label>
                <span>图片方向 / Prompt</span>
                <textarea
                  value={latestImagePrompt}
                  onChange={(event) => onDraftChange({ ...publishDraft, imagePrompt: event.target.value })}
                  placeholder="文案和图片共享 CreativeBrief，图片方向会沉淀在这里。"
                />
              </label>
              {project?.visualDirection ? (
                <section className={project.visualDirection.confirmedAt || project.visualDirection.confirmationStatus === "confirmed" ? "versionIntegrity ok" : "versionIntegrity warn"} aria-label="图片方向确认状态">
                  <strong>{project.visualDirection.confirmedAt || project.visualDirection.confirmationStatus === "confirmed" ? "图片方向已确认" : "图片方向待确认"}</strong>
                  <p>
                    {project.visualDirection.mood} · {project.visualDirection.composition}
                  </p>
                  {project.visualDirection.confirmedAt ? <small>确认时间：{formatDateTime(project.visualDirection.confirmedAt)}</small> : null}
                  {!(project.visualDirection.confirmedAt || project.visualDirection.confirmationStatus === "confirmed") ? (
                    <button className="secondaryButton compactButton" type="button" onClick={() => onQuickAction("confirm_visual_direction")}>
                      确认图片方向
                    </button>
                  ) : null}
                </section>
              ) : null}
              {imagePromptVersions.length ? (
                <section className="versionSwitcher compactVersionSwitcher" aria-label="图片 Prompt 版本">
                  <div>
                    <strong>Prompt 版本</strong>
                    <span>{promptVersionGuidance.detail}</span>
                  </div>
                  <div>
                    {imagePromptVersions.slice(-3).map((version, index) => (
                      <article className="versionCard promptVersionCard" key={version.id}>
                        <div>
                          <strong>{version.label || `Prompt ${index + 1}`}</strong>
                          <span>{formatDateTime(version.createdAt)} · 证据 {version.basedOnEvidenceIds.length}</span>
                        </div>
                        <p>{summarizePromptDiff(latestImagePrompt, version.value.prompt)}</p>
                        <small className={`versionSwitchHint ${promptVersionGuidance.state}`}>{promptVersionGuidance.label}</small>
                        {version.value.negativePrompt ? <small>避免：{version.value.negativePrompt.slice(0, 90)}</small> : null}
                        <button
                          type="button"
                          onClick={() => {
                            onDraftChange({ ...publishDraft, imagePrompt: version.value.prompt });
                            onSelectImagePromptVersion(version.id);
                          }}
                        >
                          使用此 Prompt
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
              {project?.finalPost ? (
                <section className="finalPostSnapshot" aria-label="最终帖子快照">
                  <strong>最终帖子快照</strong>
                  <div>
                    <span>文案版本：{project.finalPost.copyVersionId ?? "当前画布"}</span>
                    <span>图片：{project.finalPost.imageIds.length} 张</span>
                    <span>Prompt：{project.finalPost.imagePromptVersionIds.length} 个</span>
                    <span>证据：{project.finalPost.basedOnEvidenceIds?.length ?? 0} 条</span>
                  </div>
                </section>
              ) : null}
              {versionStatus ? (
                <section className={versionStatus.qualityGateFresh ? "versionIntegrity ok" : "versionIntegrity warn"} aria-label="版本与发布检查状态">
                  <strong>{canvasDirty ? "画布有未保存修改" : versionStatus.qualityGateFresh ? "版本已确认" : "版本需要复核"}</strong>
                  <p>{canvasDirty ? "请先保存画布到当前 PostProject，再运行发布检查，避免误用旧草稿或旧图片。" : versionStatus.summary}</p>
                  {versionDiff?.hasChanges ? (
                    <div className="versionDiffList" aria-label="版本差异">
                      {versionDiff.changes
                        .filter((change) => change.changed)
                        .slice(0, 3)
                        .map((change) => (
                          <small key={change.field}>
                            {change.label}：{change.beforeSummary} → {change.afterSummary}
                          </small>
                        ))}
                    </div>
                  ) : null}
                  <div>
                    <span>文案：{versionStatus.activeCopyVersionId ?? "待生成"}</span>
                    <span>Prompt：{versionStatus.activeImagePromptVersionIds.length || 0} 个</span>
                  </div>
                  {versionStatus.warnings.slice(0, 3).map((warning) => (
                    <small key={warning}>{warning}</small>
                  ))}
                </section>
              ) : null}
              {citationReport?.allEvidenceIds.length ? (
                <section className="evidenceReferenceStrip" aria-label="文案证据引用">
                  <strong>证据引用</strong>
                  <span>{formatCitationStripSummary(citationReport)}</span>
                  <div className="citationBadgeRow">
                    {citationFieldBadges(citationReport).map((badge) => (
                      <em className={badge.status} key={badge.label}>
                        {badge.label} {badge.count}
                      </em>
                    ))}
                  </div>
                  {citationReport.warnings.length ? <small>{citationReport.warnings[0]}</small> : null}
                </section>
              ) : null}
            </div>
          </div>

          <div className="canvasActionRow">
            <button className={canvasDirty ? "primaryButton" : "secondaryButton"} disabled={!publishDraft.title && !publishDraft.content} onClick={onCommitCanvas} type="button">
              <FileText size={16} />
              {canvasDirty ? "保存画布" : "画布已同步"}
            </button>
            <button className="secondaryButton" onClick={() => onQuickAction("plan_visuals")} type="button">
              <Sparkles size={16} />
              规划图片方向
            </button>
            <button className="secondaryButton" onClick={() => onQuickAction("generate_images")} type="button">
              <ImagePlus size={16} />
              Agent 生图
            </button>
            <button className="secondaryButton" onClick={() => onQuickAction("generate_cards")} disabled={!publishDraft.title || !publishDraft.content} type="button">
              <ImagePlus size={16} />
              生成图文卡片
            </button>
            <button className="primaryButton" onClick={() => onQuickAction("run_quality_gate")} disabled={!publishDraft.title || !publishDraft.content || canvasDirty} type="button">
              <ShieldCheck size={16} />
              {canvasDirty ? "先保存再检查" : "发布检查"}
            </button>
          </div>
        </section>

        <aside className="panel studioSidePane">
          <div className="studioSideDigest">
            <div>
              <span>右侧工作区</span>
              <strong>{sideDigest.headline}</strong>
              <p>{sideDigest.detail}</p>
            </div>
            <button className="studioSideDigestPrimary" type="button" onClick={() => setTab(sideDigest.primaryTab)}>
              <span>{sideDigest.primaryLabel}</span>
              <strong>{sideDigest.primaryReason}</strong>
            </button>
            <div className="studioSideDigestGrid">
              {sideDigest.cards.map((card) => (
                <button
                  className={`studioSideDigestCard ${card.state} ${tab === card.tab ? "active" : ""}`}
                  key={card.id}
                  onClick={() => setTab(card.tab)}
                  type="button"
                >
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.detail}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="studioTabGroups" role="tablist" aria-label="右侧工作区分组">
            {studioTabGroups.map((group) => (
              <section className={group.active ? "studioTabGroup active" : "studioTabGroup"} key={group.id}>
                <div>
                  <strong>{group.label}</strong>
                  <span>{group.detail}</span>
                </div>
                <div className="studioTabs">
                  {group.tabs.map((item) => (
                    <button
                      aria-selected={item.active}
                      className={item.active ? "active" : ""}
                      key={item.id}
                      onClick={() => setTab(item.id)}
                      role="tab"
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {tab === "insights" ? (
            <SideSection icon={FileText} title="可学习结论">
              <div className="evidenceSourceStrip">
                <span>实时证据 {realtimeInsights.length}</span>
                <span>爆款库 {viralInsights.length}</span>
              </div>
              <ViralEvidenceDigest summary={viralEvidenceSummary} compact onOpenViral={() => setTab("viral")} />
              {keyLearningInsights.length ? (
                <>
                {keyLearningInsights.map((insight) => (
                  <article className="insightLine" key={insight.id}>
                    <span>{labelForInsight(insight.type)} · {labelForSource(insight.sourceType)}</span>
                    <p>{insight.insight}</p>
                  </article>
                ))}
                {insights.length > keyLearningInsights.length ? (
                  <p className="muted">已压缩展示 {keyLearningInsights.length} 条核心规律；完整实时样本、爆款库来源和评论在“证据 / 爆款库”里查看。</p>
                ) : null}
                {citationReport?.allEvidenceIds.length ? (
                  <div className="citationSummaryBox">
                    <strong>当前草稿证据引用</strong>
                    <p>{citationReport.summary}</p>
                    <div className="citationFieldGrid">
                      {citationReport.sections.slice(0, 4).map((section) => (
                        <article key={section.field}>
                          <span>{labelForCitationField(section.field)} · {section.insights.length} 条</span>
                          <p>{section.insights.slice(0, 2).map((insight) => `${labelForSource(insight.sourceType)}：${insight.insight}`).join(" / ") || "暂无可追溯证据"}</p>
                        </article>
                      ))}
                    </div>
                    {citationReport.warnings.length ? (
                      <small>{citationReport.warnings.slice(0, 2).join("；")}</small>
                    ) : null}
                  </div>
                ) : null}
                <CreatorMemorySummary memory={creatorMemory} projectMemory={project?.agentMemory ?? []} />
                </>
              ) : (
                <>
                  <p className="muted">研究完成后这里只显示 3-5 条核心结论；完整样本、评论和原文放在证据详情里。</p>
                  <CreatorMemorySummary memory={creatorMemory} projectMemory={project?.agentMemory ?? []} />
                </>
              )}
            </SideSection>
          ) : null}

          {tab === "brief" ? (
            <SideSection icon={Sparkles} title="CreativeBrief">
              <StudioTaskSummary summary={briefTabSummary} onQuickAction={onQuickAction} />
              {brief ? (
                <div className="briefStack">
                  <BriefLine label="人群" value={brief.audience} />
                  <BriefLine label="痛点" value={brief.painPoint} />
                  <BriefLine label="角度" value={brief.contentAngle} />
                  <BriefLine label="语气" value={brief.tone} />
                  <BriefLine label="视觉" value={brief.visualMood} />
                  {briefEvidenceSummary?.insights.length ? (
                    <EvidenceReferenceBox title="Brief 参考证据" summary={briefEvidenceSummary} />
                  ) : null}
                  {visualEvidenceSummary?.insights.length ? (
                    <EvidenceReferenceBox title="图片方向参考证据" summary={visualEvidenceSummary} />
                  ) : null}
                  <ChipList title="证明点" items={brief.proofPoints} />
                  <ChipList title="图片必须有" items={brief.imageMustHave} />
                  <ChipList title="图片避免" items={brief.imageMustAvoid} />
                </div>
              ) : (
                <p className="muted">完成研究后，系统会把标题、正文、标签和图片规律压缩成统一 Brief，文案和图片都从这里出发。</p>
              )}
            </SideSection>
          ) : null}

          {tab === "evidence" ? (
            <EvidencePanelSummary
              compressionLine={evidencePanel.compressionLine}
              detailHint={evidencePanel.detailHint}
              onPrimaryAction={() => evidenceSamples.length ? setEvidenceCatalogOpen(true) : onNavigate("workflow")}
              primaryActionLabel={evidencePanel.primaryActionLabel}
              stats={evidencePanel.stats}
              summary={evidencePanel.summary}
            />
          ) : null}

          {tab === "evidence" ? (
            <SideSection icon={Library} title="研究证据">
              <strong>{evidencePanel.inlineTitle}</strong>
              <p className="muted">这里不会铺开原文、评论和图片；默认只保留可判断价值的摘要，完整内容进抽屉。</p>
              <div className="viralCandidateIntro">
                <strong>{viralSaveCandidates.headline}</strong>
                <p>{viralSaveCandidates.detail}</p>
                {viralSaveCandidates.rejectedCount ? <small>已过滤 {viralSaveCandidates.rejectedCount} 条证据较薄的样本。</small> : null}
              </div>
              {saveableSamples.length ? (
                <>
                  <div className="sideActionStack compact">
                    <button className="secondaryButton fullWidth" type="button" onClick={() => onSaveManyToViralLibrary(saveableSamples)}>
                      {viralSaveCandidates.actionLabel}
                    </button>
                  </div>
                  <div className="miniEvidenceList">
                    {viralSaveCandidates.candidates.map((candidate) => {
                      const sample = candidate.sample;

                      return (
                        <article key={sample.id}>
                          <strong>{sample.title}</strong>
                          <span>赞 {sample.likes} · 藏 {sample.collects} · 评 {sample.comments}</span>
                          <p>{summarizeEvidenceSample(sample)}</p>
                          <small>候选分 {candidate.score} · {candidate.reasons.slice(0, 2).join(" / ")}</small>
                          {candidate.warnings.length ? <em>{candidate.warnings.slice(0, 2).join(" / ")}</em> : null}
                          <div className="evidenceActions">
                            <button className="textButton" type="button" onClick={() => setSelectedEvidence(sample)}>
                              查看详情
                            </button>
                            <button className="textButton" type="button" onClick={() => onSaveToViralLibrary(sample)}>
                              保存到爆款库
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </>
              ) : null}
              <button
                className="secondaryButton fullWidth"
                onClick={() => evidenceSamples.length ? setEvidenceCatalogOpen(true) : onNavigate("workflow")}
                type="button"
              >
                {evidencePanel.primaryActionLabel}
              </button>
            </SideSection>
          ) : null}

          {tab === "viral" ? (
            <SideSection icon={Library} title="爆款库证据">
              <strong>{viralCases.length} 条历史爆款规律</strong>
              <p className="muted">这里长期沉淀标题钩子、正文结构、标签组合、图片风格和评论关注点。默认只显示关键规律，不保存原文合集。</p>
              <div className={viralLibraryHealth.status === "ready" ? "viralLibraryHealth ready" : "viralLibraryHealth"}>
                <div>
                  <strong>{viralLibraryHealth.headline}</strong>
                  <p>{viralLibraryHealth.detail}</p>
                </div>
                <div className="viralLibraryHealthStats">
                  {viralLibraryHealth.stats.map((item) => (
                    <span className={item.tone} key={item.label}>
                      {item.label} <b>{item.value}</b>
                    </span>
                  ))}
                </div>
                {viralLibraryHealth.warnings.length ? (
                  <small>风险：{viralLibraryHealth.warnings.slice(0, 2).join(" / ")}</small>
                ) : null}
                {viralLibraryHealth.recommendations.length ? (
                  <small>建议：{viralLibraryHealth.recommendations.slice(0, 2).join(" / ")}</small>
                ) : null}
              </div>
              <ViralEvidenceDigest summary={viralEvidenceSummary} />
              <details className="viralSearchDrawer">
                <summary>
                  <div>
                    <strong>检索 / 过滤爆款库</strong>
                    <span>默认收起，避免把创作证据挤到页面下方。</span>
                  </div>
                  <em>{viralCases.length} 条可检索</em>
                </summary>
                <form
                  className="viralSearchPanel"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onSearchViralLibrary({
                      query: viralSearchForm.query,
                      category: viralSearchForm.category,
                      tags: viralSearchForm.tags,
                      audience: viralSearchForm.audience,
                      painPoint: viralSearchForm.painPoint,
                      createdAfter: viralSearchForm.createdAfter,
                      createdBefore: viralSearchForm.createdBefore,
                      minLikes: viralSearchForm.minLikes,
                      minCollects: viralSearchForm.minCollects,
                      minComments: viralSearchForm.minComments,
                      minShares: viralSearchForm.minShares,
                      minScore: viralSearchForm.minScore,
                      sortBy: viralSearchForm.sortBy,
                      sortOrder: viralSearchForm.sortOrder
                    });
                  }}
                >
                <label>
                  <span>知识库检索</span>
                  <input
                    value={viralSearchForm.query}
                    onChange={(event) => setViralSearchForm((current) => ({ ...current, query: event.target.value }))}
                    placeholder="例如：广州咖啡馆、通勤包、产品种草"
                  />
                </label>
                <div className="viralSearchGrid">
                  <label>
                    <span>类目</span>
                    <input
                      value={viralSearchForm.category}
                      onChange={(event) => setViralSearchForm((current) => ({ ...current, category: event.target.value }))}
                      placeholder="探店 / 干货 / 种草"
                    />
                  </label>
                  <label>
                    <span>目标人群</span>
                    <input
                      value={viralSearchForm.audience}
                      onChange={(event) => setViralSearchForm((current) => ({ ...current, audience: event.target.value }))}
                      placeholder="例如：上班族"
                    />
                  </label>
                  <label>
                    <span>痛点</span>
                    <input
                      value={viralSearchForm.painPoint}
                      onChange={(event) => setViralSearchForm((current) => ({ ...current, painPoint: event.target.value }))}
                      placeholder="例如：不知道怎么选"
                    />
                  </label>
                  <label>
                    <span>标签</span>
                    <input
                      value={viralSearchForm.tags}
                      onChange={(event) => setViralSearchForm((current) => ({ ...current, tags: event.target.value }))}
                      placeholder="逗号分隔"
                    />
                  </label>
                </div>
                <details className="viralAdvancedSearch">
                  <summary>高级过滤</summary>
                  <div className="viralSearchGrid">
                    <label>
                      <span>入库开始日期</span>
                      <input
                        type="date"
                        value={viralSearchForm.createdAfter}
                        onChange={(event) => setViralSearchForm((current) => ({ ...current, createdAfter: event.target.value }))}
                      />
                    </label>
                    <label>
                      <span>入库结束日期</span>
                      <input
                        type="date"
                        value={viralSearchForm.createdBefore}
                        onChange={(event) => setViralSearchForm((current) => ({ ...current, createdBefore: event.target.value }))}
                      />
                    </label>
                    <label>
                      <span>最低点赞</span>
                      <input
                        inputMode="numeric"
                        value={viralSearchForm.minLikes}
                        onChange={(event) => setViralSearchForm((current) => ({ ...current, minLikes: event.target.value }))}
                        placeholder="可选"
                      />
                    </label>
                  <label>
                    <span>最低收藏</span>
                    <input
                      inputMode="numeric"
                      value={viralSearchForm.minCollects}
                      onChange={(event) => setViralSearchForm((current) => ({ ...current, minCollects: event.target.value }))}
                      placeholder="可选"
                    />
                  </label>
                    <label>
                      <span>最低评论</span>
                      <input
                        inputMode="numeric"
                        value={viralSearchForm.minComments}
                        onChange={(event) => setViralSearchForm((current) => ({ ...current, minComments: event.target.value }))}
                        placeholder="可选"
                      />
                    </label>
                    <label>
                      <span>最低分享</span>
                      <input
                        inputMode="numeric"
                        value={viralSearchForm.minShares}
                        onChange={(event) => setViralSearchForm((current) => ({ ...current, minShares: event.target.value }))}
                        placeholder="可选"
                      />
                    </label>
                    <label>
                      <span>最低评分</span>
                      <input
                        inputMode="decimal"
                        value={viralSearchForm.minScore}
                        onChange={(event) => setViralSearchForm((current) => ({ ...current, minScore: event.target.value }))}
                        placeholder="可选"
                      />
                    </label>
                    <label>
                      <span>排序</span>
                      <select
                        value={viralSearchForm.sortBy}
                        onChange={(event) => setViralSearchForm((current) => ({ ...current, sortBy: event.target.value as typeof current.sortBy }))}
                      >
                        <option value="score">综合分</option>
                        <option value="collects">收藏</option>
                        <option value="likes">点赞</option>
                        <option value="comments">评论</option>
                        <option value="shares">分享</option>
                        <option value="createdAt">入库时间</option>
                      </select>
                    </label>
                    <label>
                      <span>排序方向</span>
                      <select
                        value={viralSearchForm.sortOrder}
                        onChange={(event) => setViralSearchForm((current) => ({ ...current, sortOrder: event.target.value as typeof current.sortOrder }))}
                      >
                        <option value="desc">高到低 / 最新</option>
                        <option value="asc">低到高 / 最早</option>
                      </select>
                    </label>
                  </div>
                </details>
                <div className="viralSearchActions">
                  <button className="primaryButton" type="submit">检索爆款规律</button>
                  <button
                    className="secondaryButton"
                    type="button"
                    onClick={() => {
                      setViralSearchForm({
                        query: "",
                        category: "",
                        tags: "",
                        audience: "",
                        painPoint: "",
                        createdAfter: "",
                        createdBefore: "",
                        minLikes: "",
                        minCollects: "",
                        minComments: "",
                        minShares: "",
                        minScore: "",
                        sortBy: "score",
                        sortOrder: "desc"
                      });
                      onReloadViralLibrary();
                    }}
                  >
                    重置
                  </button>
                </div>
                </form>
              </details>
              {viralPack?.sufficiency ? (
                <div className={viralPack.sufficiency.isEnough ? "ragStatus good" : "ragStatus warn"}>
                  <strong>{viralPack.sufficiency.isEnough ? "RAG 证据充足" : "RAG 证据还不够"}</strong>
                  <p>{viralPack.sufficiency.recommendation}</p>
                  {viralPack.filterSummary ? (
                    <small className="ragFilterLine">本次筛选：{viralPack.filterSummary}</small>
                  ) : null}
                  {viralPack.rewrittenQueries?.length ? (
                    <small>检索扩展：{viralPack.rewrittenQueries.slice(0, 3).join(" / ")}</small>
                  ) : null}
                </div>
              ) : null}
              <div className={viralApplication.evidenceCount ? "viralApplyPanel ready" : "viralApplyPanel"}>
                <div>
                  <strong>{viralApplication.headline}</strong>
                  <p>{viralApplication.detail}</p>
                  {viralApplication.evidenceCount ? <small>当前已接入 {viralApplication.evidenceCount} 条爆款库 evidencePack 结论。</small> : null}
                  {viralApplication.focusedCount ? <small>本次重点：{viralApplication.focusedCount} 条，生成时会优先引用。</small> : null}
                  {viralApplication.citedEvidenceIds.length ? (
                    <small>已被当前创作引用：{viralApplication.citedEvidenceIds.slice(0, 4).join(" / ")}</small>
                  ) : null}
                  <div className={`ragReadinessLine ${viralApplication.ragStatus}`}>
                    <strong>{viralApplication.ragLine}</strong>
                    {viralApplication.missingEvidence.length ? <span>缺口：{viralApplication.missingEvidence.slice(0, 3).join(" / ")}</span> : null}
                    <span>{viralApplication.recommendation}</span>
                  </div>
                </div>
                <div className="viralApplicationRoutes" aria-label="爆款库应用路径">
                  {viralApplication.routes.map((route) => (
                    <article className={`viralApplicationRoute ${route.status}`} key={route.id}>
                      <span>{route.label}</span>
                      <strong>{labelForViralRouteStatus(route.status)}</strong>
                      <p>{route.detail}</p>
                      {route.evidenceIds.length ? <small>证据：{route.evidenceIds.slice(0, 3).join(" / ")}</small> : null}
                    </article>
                  ))}
                </div>
                <div className="inlineActionGrid">
                  {viralApplication.actions.map((item) => (
                    <button
                      className={item.primary ? "primaryButton fullWidth" : "secondaryButton fullWidth"}
                      key={item.id}
                      onClick={() => onQuickAction(item.action)}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              {viralPack?.strategyReport ? (
                <div className="viralStrategyCard">
                  <strong>爆款策略摘要</strong>
                  <p>{viralPack.strategyReport.summary}</p>
                  {viralPack.results?.length ? (
                    <div className="ragAngleStrip" aria-label="爆款库检索角度">
                      {viralPack.results.slice(0, 4).map((result) => (
                        <span key={result.case.id} title={[...(result.matchedQueries ?? []), ...result.reasons].slice(0, 3).join(" / ")}>
                          {result.angleSummary || `${result.case.hookType} · ${result.case.category}`}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="viralStrategyGrid">
                    <KnowledgeList title="标题打法" items={viralPack.strategyReport.titleMoves} />
                    <KnowledgeList title="正文结构" items={viralPack.strategyReport.structureMoves} />
                    <KnowledgeList title="图片方向" items={viralPack.strategyReport.visualMoves} />
                    <KnowledgeList title="原创边界" items={viralPack.strategyReport.originalityRules} />
                  </div>
                </div>
              ) : null}
              {latestViralSummaries.length ? (
                <div className="viralRecentPanel">
                  <strong>最近入库提炼</strong>
                  {latestViralSummaries.map(({ item, learnings, rewriteRules }) => (
                    <article key={item.id}>
                      <div>
                        <span className={item.extraction.method === "model" ? "viralExtractionBadge model" : "viralExtractionBadge"}>
                          {labelForViralExtraction(item.extraction.method)} · {item.category}
                        </span>
                        {item.quality ? <span className="viralExtractionBadge">规律质量 {Math.round(item.quality.score * 100)}%</span> : null}
                        <button className="textButton" type="button" onClick={() => setSelectedViralCase(item)}>查看</button>
                      </div>
                      <h4>{item.hookType || item.title}</h4>
                      <p>{item.creativeSafety?.summary || learnings[0] || "已入库，等待更多样本补齐可复用规律。"}</p>
                      <small>可学：{learnings.slice(0, 2).join(" / ") || "等待更多样本沉淀"}</small>
                      <small>必须改写：{rewriteRules.slice(0, 2).join(" / ") || "不要复用原文表达和原图"}</small>
                      {item.extraction.fallbackReason ? <small>提炼说明：{item.extraction.fallbackReason}</small> : null}
                    </article>
                  ))}
                </div>
              ) : null}
              {viralInsights.length ? (
                <div className="miniEvidenceList">
                  {keyViralInsights.map((insight) => (
                    <article className="keyViralInsight" key={insight.id}>
                      <span>{labelForInsight(insight.type)} · 爆款库 · 置信 {Math.round(insight.confidence * 100)}%</span>
                      <p>{insight.insight}</p>
                      <small>{focusedEvidenceIdSet.has(insight.id) ? "本次重点 · " : ""}{insight.id}</small>
                      <div className="evidenceActions">
                        <button
                          className={focusedEvidenceIdSet.has(insight.id) ? "textButton activeTextButton" : "textButton"}
                          type="button"
                          onClick={() => onFocusEvidenceIds(toggleFocusedEvidenceId(focusedEvidenceIds, insight.id))}
                        >
                          {focusedEvidenceIdSet.has(insight.id) ? "取消重点" : "设为本次重点"}
                        </button>
                      </div>
                      {findViralCaseForInsight(insight, viralCaseById) ? (
                        <div className="evidenceActions">
                          <button
                            className="textButton"
                            type="button"
                            onClick={() => {
                              const source = findViralCaseForInsight(insight, viralCaseById);
                              if (source) setSelectedViralCase(source);
                            }}
                          >
                            查看来源规律
                          </button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                  {viralInsights.length > keyViralInsights.length ? (
                    <p className="muted">已默认压缩展示 {keyViralInsights.length} 条关键规律，完整 {viralInsights.length} 条已写入 evidencePack，生成文案和图片方向时可追溯引用。</p>
                  ) : null}
                </div>
              ) : viralCases.length ? (
                <div className="miniEvidenceList">
                  {viralCases.slice(0, 5).map((item) => (
                    <article key={item.id}>
                      <strong>{item.hookType}</strong>
                      <span className="viralAngleLine">{item.hookType} · {item.category} · {item.imageStyle}</span>
                      <p>{item.extractedInsights.reusableRules[0] || item.contentStructure.join(" / ")}</p>
                      <span>赞 {item.metrics.likes} · 藏 {item.metrics.collects}{item.quality ? ` · 规律质量 ${Math.round(item.quality.score * 100)}%` : ""}</span>
                      <div className="evidenceActions">
                        <button className="textButton" type="button" onClick={() => setSelectedViralCase(item)}>
                          查看规律
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">还没有爆款库样本。可以先在“研究证据”里把高质量样本保存进库。</p>
              )}
              <div className="sideActionStack">
                <button className="primaryButton fullWidth" onClick={onRefreshViralEvidence} type="button">
                  <Sparkles size={16} />
                  刷新当前项目 RAG 证据
                </button>
                <button className="secondaryButton fullWidth" onClick={onReloadViralLibrary} type="button">只刷新本地爆款库列表</button>
              </div>
            </SideSection>
          ) : null}

          {tab === "references" ? (
            <SideSection icon={ImagePlus} title="图片参考">
              <StudioTaskSummary summary={referenceTabSummary} onQuickAction={onQuickAction} />
              <p className="muted">这里主要放产品原图、参考图和当前选中图。默认不铺开全部素材，更多管理在 Assets。</p>
              <p className="assetCompressionLine">{referenceAssetSummary.compressionLine}</p>
              <div
                className="studioReferenceDropzone"
                onDragOver={(event) => {
                  if (hasImageFiles(event.dataTransfer.files)) {
                    event.preventDefault();
                  }
                }}
                onDrop={(event) => {
                  if (!hasImageFiles(event.dataTransfer.files)) return;
                  event.preventDefault();
                  onUploadReferenceFiles(event.dataTransfer.files);
                }}
                onPaste={(event) => {
                  if (!hasImageFiles(event.clipboardData.files)) return;
                  event.preventDefault();
                  onUploadReferenceFiles(event.clipboardData.files);
                }}
                tabIndex={0}
              >
                <ImagePlus size={18} />
                <span>拖入或粘贴产品图 / 参考图</span>
              </div>
              {referenceAssetSummary.previewAssets.length ? (
                <div className="studioAssetGrid selectable">
                  {referenceAssetSummary.previewAssets.map((asset) => {
                    const selected = publishAssetIds.includes(asset.id);
                    return (
                      <button
                        className={selected ? "studioAssetPick selected" : "studioAssetPick"}
                        key={asset.id}
                        type="button"
                        onClick={() =>
                          onSelectPostImages(
                            selected
                              ? publishAssetIds.filter((id) => id !== asset.id)
                              : [...publishAssetIds, asset.id]
                          )
                        }
                      >
                        <img alt={asset.name} src={`/api/assets/file/${asset.id}`} />
                        <span>{selected ? "已选" : "参考图"}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="muted">还没有产品图或参考图。可以直接在这里上传，也可以让 Agent 先生成图片方向。</p>
              )}
              {project?.finalPost?.imageIds.length ? (
                <p className="muted">最终帖子图片：{project.finalPost.imageIds.slice(0, 4).join(" / ")}</p>
              ) : null}
              <div className="inlineActionGrid">
                <label className="secondaryButton fullWidth studioInlineUpload">
                  上传产品图 / 参考图
                  <input
                    accept="image/*"
                    multiple
                    type="file"
                    onChange={(event) => {
                      if (event.target.files?.length) {
                        onUploadReferenceFiles(event.target.files);
                        event.target.value = "";
                      }
                    }}
                  />
                </label>
                <button className="secondaryButton fullWidth" onClick={onOpenImageStudio} type="button">高级图片创作台</button>
                <button className="secondaryButton fullWidth" onClick={() => onNavigate("assets")} type="button">管理全部素材</button>
              </div>
            </SideSection>
          ) : null}

          {tab === "generated" ? (
            <SideSection icon={ImagePlus} title="已生成素材">
              <StudioTaskSummary summary={generatedTabSummary} onQuickAction={onQuickAction} />
              <div className={`assetPanelSummary ${generatedAssetSummary.state}`}>
                <strong>{generatedAssetSummary.headline}</strong>
                <p>{generatedAssetSummary.detail}</p>
                <small>{generatedAssetSummary.compressionLine}</small>
                <span>{generatedAssetSummary.actionHint}</span>
              </div>
              {generatedAssetSummary.previewAssets.length ? (
                <div className="studioAssetGrid selectable">
                  {generatedAssetSummary.previewAssets.map((asset) => {
                    const selected = publishAssetIds.includes(asset.id);
                    const projectImage = project?.generatedImages.find((image) => (image.assetId ?? image.id) === asset.id);
                    return (
                      <button
                        className={selected ? "studioAssetPick selected" : "studioAssetPick"}
                        key={asset.id}
                        type="button"
                        onClick={() =>
                          onSelectPostImages(
                            selected
                              ? publishAssetIds.filter((id) => id !== asset.id)
                              : [...publishAssetIds, asset.id]
                          )
                        }
                      >
                        <img alt={asset.name} src={`/api/assets/file/${asset.id}`} />
                        <span>{selected ? "已选" : "生成图"}</span>
                        {projectImage?.promptVersionId || projectImage?.basedOnEvidenceIds?.length ? (
                          <small>
                            {projectImage.promptVersionId ? `Prompt ${projectImage.promptVersionId}` : "Prompt 待绑定"}
                            {projectImage.basedOnEvidenceIds?.length ? ` · 证据 ${projectImage.basedOnEvidenceIds.length}` : ""}
                          </small>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="muted">可以让 Agent 在当前项目里生成配图；需要更多参数时再打开高级图片工具。</p>
              )}
              <div className="inlineActionGrid">
                <button className="secondaryButton fullWidth" onClick={() => onQuickAction("generate_images")} type="button">Agent 生成配图</button>
                <button className="secondaryButton fullWidth" onClick={() => onQuickAction("generate_cards")} type="button">生成图文卡片</button>
                <button className="secondaryButton fullWidth" onClick={onOpenImageStudio} type="button">高级图片工具</button>
              </div>
            </SideSection>
          ) : null}

          {tab === "publish" ? (
            <SideSection icon={CheckCircle2} title="发布检查">
              <StudioTaskSummary summary={publishTabSummary} onQuickAction={onQuickAction} />
              <details className="publishChecklistDetails">
                <summary>
                  <strong>详细发布检查</strong>
                  <span>默认收起，关键阻塞项已汇总在确认摘要。</span>
                </summary>
                <CheckItem ok={Boolean(publishDraft.title)} label="标题已填写" />
                <CheckItem ok={Boolean(publishDraft.content)} label="正文已填写" />
                <CheckItem ok={Boolean(publishDraft.tagsText)} label="标签已填写" />
                <CheckItem ok={Boolean(selectedAssets.length)} label="已选择图片" />
                <CheckItem ok={hasVisualDirection} label="图片方向 / Prompt 已确认" />
                <CheckItem ok={citationTraceReady} label="字段级证据引用可追溯" />
                <CheckItem ok={versionStatus?.qualityGateFresh === true} label="最终版本与 Quality Gate 一致" />
                <CheckItem ok={accountReady} label={`账号：${activeAccount?.displayName ?? "未配置"} · ${accountReadyHint}`} />
                <CheckItem ok={publishVisibility === "仅自己可见"} label={`可见范围：${publishVisibility}`} />
                <CheckItem ok={!publishScheduleAt || Date.parse(publishScheduleAt) > Date.now()} label={publishScheduleAt ? `定时：${publishScheduleAt}（本地时区）` : "发布时间：立即"} />
                <CheckItem ok={settings.defaultAutoPublish === false} label="自动发布默认关闭" />
              </details>
              <div className={`publishFinalSummary ${publishSummary.riskLevel}`}>
                <div className="publishFinalSummaryHeader">
                  <div>
                    <strong>{publishSummary.headline}</strong>
                    <p>{publishSummary.detail}</p>
                  </div>
                  <span>{publishSummary.modeLabel}</span>
                </div>
                <div className="publishDecisionStrip">
                  <strong>{publishSummary.decisionLine}</strong>
                  <p>{publishSummary.nextStepLine}</p>
                  <small>{publishSummary.detailCompressionLine}</small>
                </div>
                {publishSummary.confirmationItems.length ? (
                  <div className="publishConfirmationChips" aria-label="人工确认清单摘要">
                    {publishSummary.confirmationItems.slice(0, 6).map((item) => (
                      <span className={item.confirmed ? "confirmed" : item.required ? "required" : "optional"} key={`${item.label}-${item.required}`}>
                        <b>{item.confirmed ? "已确认" : item.required ? "待确认" : "可选"}</b>
                        {item.label}
                      </span>
                    ))}
                  </div>
                ) : null}
                {publishSummary.visibleBlockers.length ? (
                  <ul>
                    {publishSummary.visibleBlockers.map((blocker) => (
                      <li key={blocker}>{blocker}</li>
                    ))}
                    {publishSummary.blockers.length > publishSummary.visibleBlockers.length ? (
                      <li>还有 {publishSummary.blockers.length - publishSummary.visibleBlockers.length} 项已收进详细快照</li>
                    ) : null}
                  </ul>
                ) : null}
                <details className="publishSnapshotDetails">
                  <summary>
                    <strong>详细发布快照</strong>
                    <span>账号、时间、版本、证据和 Quality Gate</span>
                  </summary>
                  <div className="publishFinalSummaryGrid">
                    <span>账号 <b>{publishSummary.accountLine}</b></span>
                    <span>连接 <b>{publishSummary.accountSafetyLine}</b></span>
                    <span>时间 <b>{publishSummary.timingLine}</b></span>
                    <span>可见 <b>{publishSummary.visibilityLine}</b></span>
                    <span>内容 <b>{publishSummary.contentLine}</b></span>
                    <span>图片 <b>{publishSummary.imageLine}</b></span>
                    <span>证据 <b>{publishSummary.evidenceLine}</b></span>
                    <span>来源 <b>{publishSummary.evidenceSourceLine}</b></span>
                    <span>版本 <b>{publishSummary.versionLine}</b></span>
                    <span>质量 <b>{publishSummary.qualityLine}</b></span>
                    <span>确认 <b>{publishSummary.checklistLine}</b></span>
                  </div>
                </details>
              </div>
              <div className={`publishAccountSafety ${publishAccountSafety.status}`}>
                <div>
                  <span>账号安全锁</span>
                  <strong>{publishAccountSafety.headline}</strong>
                  <p>{publishAccountSafety.detail}</p>
                </div>
                <div className="publishAccountSafetyLines">
                  <span>当前账号 <b>{publishAccountSafety.activeAccountLine}</b></span>
                  <span>确认单绑定 <b>{publishAccountSafety.lockedAccountLine}</b></span>
                </div>
                <div className="publishAccountSafetyChecks">
                  {publishAccountSafety.checks.map((check) => (
                    <em className={check.severity} key={check.label}>
                      <small>{check.ok ? "通过" : check.severity === "blocked" ? "阻塞" : "提醒"}</small>
                      <b>{check.label}</b>
                      <span>{check.detail}</span>
                    </em>
                  ))}
                </div>
              </div>
              <div className="publishInlineControls">
                <label>
                  <span>可见范围</span>
                  <select value={publishVisibility} onChange={(event) => onVisibilityChange(event.target.value as RedactedSettings["defaultVisibility"])}>
                    <option>仅自己可见</option>
                    <option>公开可见</option>
                    <option>仅互关好友可见</option>
                  </select>
                </label>
                <label>
                  <span>定时时间</span>
                  <input type="datetime-local" value={publishScheduleAt} onChange={(event) => onScheduleAtChange(event.target.value)} />
                </label>
              </div>
              <div className={publishReady ? "publishConfirmMini ready" : "publishConfirmMini warn"}>
                <strong>{publishReady ? "可以生成发布确认单" : "发布前还需要处理"}</strong>
                <p>
                  {publishReady
                    ? "下一步会进入人工确认页，确认账号、可见范围、图片版本和时间后才会调用小红书发布。"
                    : buildPublishReadinessHint({
                        title: publishDraft.title,
                        content: publishDraft.content,
                        tagsText: publishDraft.tagsText,
                        imageCount: selectedAssets.length,
                        hasVisualDirection,
                        citationTraceReady,
                        accountReady,
                        quality,
                        qualityGateFresh: versionStatus?.qualityGateFresh === true
                      })}
                </p>
                <span>确认单：{pendingPublish ? `${pendingPublish.mode === "schedule" ? "定时" : "立即"} · 待人工确认` : "未生成"}</span>
                {health?.activeAccount?.loginName ? <span>登录名：{health.activeAccount.loginName}</span> : null}
                <div className={`publishSafetyBoundary ${publishSafetyBoundary.state}`} aria-label="发布安全边界">
                  <strong>{publishSafetyBoundary.headline}</strong>
                  <p>{publishSafetyBoundary.detail}</p>
                  <div>
                    {publishSafetyBoundary.checkpoints.map((checkpoint) => (
                      <em key={checkpoint}>{checkpoint}</em>
                    ))}
                  </div>
                </div>
                {!publishReady ? (
                  <div className="publishInlineFixes" aria-label="发布前快速处理">
                    {!hasVisualDirection ? (
                      <button type="button" onClick={() => onQuickAction(project?.visualDirection ? "confirm_visual_direction" : "plan_visuals")}>
                        {project?.visualDirection ? "确认图片方向" : "规划图片方向"}
                      </button>
                    ) : null}
                    {(!quality || quality?.canPublish === false || versionStatus?.qualityGateFresh !== true) ? (
                      <button type="button" onClick={() => onQuickAction("run_quality_gate")}>
                        运行质量检查
                      </button>
                    ) : null}
                    {!selectedAssets.length ? (
                      <button type="button" onClick={() => onQuickAction("select_images")}>
                        选择发布图片
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className={`publishAuditMini ${auditSummary.state}`}>
                <div>
                  <span>最近发布审计</span>
                  <strong>{auditSummary.headline}</strong>
                  <p>{auditSummary.detail}</p>
                </div>
                <div className="publishAuditMiniGrid">
                  <span>动作 <b>{auditSummary.eventLabel}</b></span>
                  <span>账号 <b>{auditSummary.accountLine ?? "当前账号"}</b></span>
                  {auditSummary.createdAt ? <span>时间 <b>{new Date(auditSummary.createdAt).toLocaleString()}</b></span> : null}
                  {auditSummary.title ? <span>标题 <b>{auditSummary.title}</b></span> : null}
                </div>
                {auditSummary.reasonLine ? <p className="muted">原因：{auditSummary.reasonLine}</p> : null}
                {auditSummary.evidenceLine ? <p className="muted">证据：{auditSummary.evidenceLine}</p> : null}
                <button className="secondaryButton fullWidth" onClick={() => onNavigate("audit")} type="button">
                  查看完整发布历史
                </button>
              </div>
              {activePublishPlan ? (
                <div className="publishIntentSummary">
                  <strong>当前确认单</strong>
                  <div>
                    <span>状态：{labelForPublishStatus(activePublishPlan.status)}</span>
                    <span>账号：{activePublishPlan.accountName ?? "未配置"}</span>
                    <span>图片：{activePublishPlan.images?.length ?? 0} 张</span>
                    <span>标签：{activePublishPlan.tags?.length ?? 0} 个</span>
                    <span>可见：{activePublishPlan.visibility ?? publishVisibility}</span>
                    <span>{activePublishPlan.scheduleAt ? `定时：${activePublishPlan.scheduleAt}` : "立即发布"}</span>
                  </div>
                  {activePublishPlan.loginName ? <p>登录名：{activePublishPlan.loginName}</p> : null}
                  {activePublishPlan.mcpUrl ? <p>MCP：{activePublishPlan.mcpUrl}</p> : null}
                  {activePublishPlan.versionSnapshot ? (
                    <div className={activePublishPlan.versionSnapshot.qualityGateFresh ? "publishVersionLock ok" : "publishVersionLock warn"}>
                      <strong>{activePublishPlan.versionSnapshot.qualityGateFresh ? "版本快照已锁定" : "版本快照需复核"}</strong>
                      <p>{activePublishPlan.versionSnapshot.summary}</p>
                      <div>
                        <span>文案：{activePublishPlan.versionSnapshot.copyVersionId ?? "待生成"}</span>
                        <span>Prompt：{activePublishPlan.versionSnapshot.imagePromptVersionIds.length} 个</span>
                        <span>图片：{activePublishPlan.versionSnapshot.selectedImageIds.length} 张</span>
                      </div>
                      {activePublishPlan.versionSnapshot.warnings.slice(0, 2).map((warning) => (
                        <small key={warning}>{warning}</small>
                      ))}
                    </div>
                  ) : null}
                  {requiredConfirmations.length ? (
                    <ul>
                      {requiredConfirmations.slice(0, 5).map((item) => (
                        <li key={item.id}>
                          {item.confirmed ? "已确认" : "待确认"}：{item.label}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p>人工确认：{confirmedRequiredCount}/{requiredConfirmations.length || 0} 项</p>
                  {pendingPublish ? (
                    <div className="publishIntentActions">
                      <button className="secondaryButton" disabled={busy} onClick={onCancelPublish} type="button">
                        取消确认单
                      </button>
                      <button className="primaryButton dangerAction" disabled={busy || !publishAccountSafety.canConfirmExisting} onClick={onConfirmPublish} type="button">
                        {pendingPublish.mode === "schedule" ? "确认定时发布" : "确认立即发布"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {staleAccountPublishPlan ? (
                <div className="publishIntentSummary stale">
                  <strong>发布确认单已与当前账号不匹配</strong>
                  <p>
                    这张确认单属于账号 {staleAccountPublishPlan.accountId ?? "未知账号"}，
                    当前账号是 {activeAccount?.displayName ?? settings.activeAccountId}。为了避免误发，请重新生成发布确认单。
                  </p>
                </div>
              ) : null}
              {staleCanvasPublishPlan ? (
                <div className="publishIntentSummary stale">
                  <strong>发布确认单已失效</strong>
                  <p>
                    你已经修改了当前画布的文案、标签、图片或 Prompt。为避免误发旧版本，请先保存画布并重新运行 Quality Gate，再生成新的发布确认单。
                  </p>
                </div>
              ) : null}
              {quality ? (
                <div className="qualityBox">
                  <strong>{quality.canPublish ? "质量检查通过" : "质量检查需处理"}</strong>
                  <div className="qualityScores">
                    <span>标题 {quality.titleScore}</span>
                    <span>正文 {quality.copyScore}</span>
                    <span>图文 {quality.visualConsistencyScore}</span>
                    <span>平台 {quality.platformFitScore}</span>
                    <span>合规 {quality.complianceScore}</span>
                  </div>
                  {quality.issues.slice(0, 3).map((issue) => (
                    <p className="muted" key={issue}>- {issue}</p>
                  ))}
                  {quality.issues.length || quality.suggestions.length ? (
                    <div className="qualityActionList" aria-label="Quality Gate action list">
                      {quality.issues.slice(0, 3).map((issue) => (
                        <div className="qualityActionItem issue" key={`issue-${issue}`}>
                          <span>阻塞项</span>
                          <strong>{issue}</strong>
                        </div>
                      ))}
                      {quality.suggestions.slice(0, 3).map((suggestion) => (
                        <div className="qualityActionItem suggestion" key={`suggestion-${suggestion}`}>
                          <span>建议优化</span>
                          <strong>{suggestion}</strong>
                        </div>
                      ))}
                      {quality.issues.length > 3 || quality.suggestions.length > 3 ? (
                        <small>还有 {Math.max(quality.issues.length - 3, 0) + Math.max(quality.suggestions.length - 3, 0)} 条细节，已收进发布检查详情。</small>
                      ) : null}
                    </div>
                  ) : null}
                  {quality.evidenceReview ? (
                    <p className="muted">证据覆盖：{quality.evidenceReview.summary}</p>
                  ) : null}
                  {quality.originalityReview ? (
                    <p className={quality.originalityReview.isSafe ? "muted" : "qualityWarningText"}>
                      原创边界：{quality.originalityReview.summary}
                    </p>
                  ) : null}
                  {citationReport?.allEvidenceIds.length ? (
                    <div className={citationTraceReady ? "citationAudit ok" : "citationAudit warn"}>
                      <span>字段级证据追踪</span>
                      <strong>{citationReport.summary}</strong>
                      <div>
                        {citationReport.sections.map((section) => (
                          <em key={section.field}>{labelForCitationField(section.field)} {section.insights.length}</em>
                        ))}
                      </div>
                      {citationReport.missingEvidenceIds.length ? (
                        <p>缺失：{citationReport.missingEvidenceIds.slice(0, 3).join(" / ")}</p>
                      ) : null}
                    </div>
                  ) : null}
                  {quality.evidenceAlignment ? (
                    <div className={quality.evidenceAlignment.isAligned ? "evidenceAlignment ok" : "evidenceAlignment warn"}>
                      <span>图文证据</span>
                      <strong>{quality.evidenceAlignment.summary}</strong>
                      <p>
                        文案 {quality.evidenceAlignment.copyEvidenceIds.length} 条 · 图片 {quality.evidenceAlignment.visualEvidenceIds.length} 条 · 共同 {quality.evidenceAlignment.sharedEvidenceIds.length} 条
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="inlineActionGrid">
                <button className="secondaryButton fullWidth" onClick={() => onQuickAction("run_quality_gate")} type="button">刷新质量检查</button>
                <button className="primaryButton fullWidth" disabled={!publishReady || busy} onClick={onPreparePublish} type="button">
                  {pendingPublish ? "重新生成确认单" : publishScheduleAt ? "生成定时确认单" : "生成发布确认单"}
                </button>
                <button className="secondaryButton fullWidth" onClick={onOpenPublish} type="button">聚焦发布检查</button>
              </div>
            </SideSection>
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

function hasImageFiles(files: FileList | File[]): boolean {
  return Array.from(files).some((file) => file.type.startsWith("image/"));
}

function uniqueStringList(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function toggleFocusedEvidenceId(currentIds: string[], id: string): string[] {
  return currentIds.includes(id)
    ? currentIds.filter((item) => item !== id)
    : [...currentIds, id].slice(-8);
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

function CreationProvenanceStrip({
  cards,
  onOpenEvidence
}: {
  cards: CreationProvenanceCard[];
  onOpenEvidence: () => void;
}) {
  return (
    <section className="creationProvenanceStrip" aria-label="创作证据追溯">
      <div className="creationProvenanceHeader">
        <div>
          <span>为什么这样创作</span>
          <strong>Brief、文案和图片方向都要能追溯到 evidencePack</strong>
        </div>
        <button className="textButton" type="button" onClick={onOpenEvidence}>
          查看证据
        </button>
      </div>
      <div className="creationProvenanceGrid">
        {cards.map((card) => (
          <article className={`creationProvenanceCard ${card.state}`} key={card.id}>
            <span>{card.label}</span>
            <strong>{card.headline}</strong>
            <p>{card.detail}</p>
            {card.safetyLine ? <p className="creationProvenanceSafety">{card.safetyLine}</p> : null}
            <small>
              {card.sourceLine} · 证据 {card.evidenceCount}
              {card.missingCount ? ` · 待补 ${card.missingCount}` : ""}
            </small>
          </article>
        ))}
      </div>
    </section>
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

function CreatorMemorySummary({
  memory,
  projectMemory
}: {
  memory: CreatorMemoryProfile | null;
  projectMemory: string[];
}) {
  const digest = buildCreatorMemoryDigest(memory, projectMemory);
  if (!digest.active) {
    return (
      <details className="creatorMemorySummary">
        <summary>创作记忆 · 等待沉淀</summary>
        <p>{digest.detail}</p>
      </details>
    );
  }
  return (
    <details className="creatorMemorySummary">
      <summary>创作记忆 · {digest.signalCount} 条线索</summary>
      <p>{digest.detail}</p>
      <div className="memorySignalGrid">
        <MemorySignalGroup title="会采用" items={digest.willUse} />
        <MemorySignalGroup title="会避免" items={digest.willAvoid} />
        <MemorySignalGroup title="产品线索" items={digest.productHints} />
        <MemorySignalGroup title="标签线索" items={digest.tagHints} />
      </div>
    </details>
  );
}

function MemorySignalGroup({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section>
      <strong>{title}</strong>
      <div>
        {items.slice(0, 4).map((item) => <span key={item}>{item}</span>)}
      </div>
    </section>
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

function PostFlowPhaseItem({
  phase,
  index,
  onQuickAction
}: {
  phase: PostFlowPhase;
  index: number;
  onQuickAction: (action: string) => void;
}) {
  return (
    <article className={`postFlowPhase ${phase.state}`}>
      <span className="postFlowIndex">{index + 1}</span>
      <div>
        <strong>{phase.label}</strong>
        <p>{phase.detail}</p>
      </div>
      {phase.state === "active" && phase.action ? (
        <button type="button" onClick={() => onQuickAction(phase.action!)}>
          {phase.actionLabel}
        </button>
      ) : null}
    </article>
  );
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

function BriefLine({ label, value }: { label: string; value?: string }) {
  return (
    <article className="insightLine">
      <span>{label}</span>
      <p>{value || "待补充"}</p>
    </article>
  );
}

function EvidenceReferenceBox({
  title,
  summary
}: {
  title: string;
  summary: ReturnType<typeof buildEvidenceReferenceSummary>;
}) {
  return (
    <article className="citationSummaryBox">
      <strong>{title}</strong>
      <p>{summary.summary}</p>
      <div className="citationFieldGrid">
        {summary.insights.slice(0, 4).map((insight) => (
          <article key={insight.id}>
            <span>{labelForSource(insight.sourceType)} · {labelForInsight(insight.type)}</span>
            <p>{insight.insight}</p>
            <small>{insight.id}</small>
          </article>
        ))}
      </div>
      {summary.missingEvidenceIds.length ? (
        <small>缺失证据 ID：{summary.missingEvidenceIds.slice(0, 3).join("、")}</small>
      ) : null}
    </article>
  );
}

function EvidencePanelSummary({
  summary,
  detailHint,
  compressionLine,
  stats,
  primaryActionLabel,
  onPrimaryAction
}: {
  summary: string;
  detailHint: string;
  compressionLine: string;
  stats: Array<{ label: string; value: string }>;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
}) {
  return (
    <article className="evidencePanelSummary">
      <div>
        <strong>{summary}</strong>
        <p>{detailHint}</p>
        <small>{compressionLine}</small>
      </div>
      <div className="evidencePanelStats" aria-label="证据摘要统计">
        {stats.map((item) => (
          <span key={item.label}>
            <small>{item.label}</small>
            {item.value}
          </span>
        ))}
      </div>
      <button className="secondaryButton fullWidth" type="button" onClick={onPrimaryAction}>
        {primaryActionLabel}
      </button>
    </article>
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

function ViralEvidenceDigest({
  summary,
  compact = false,
  onOpenViral
}: {
  summary: ReturnType<typeof buildViralEvidenceSummary>;
  compact?: boolean;
  onOpenViral?: () => void;
}) {
  return (
    <div className={summary.hasEvidence ? "viralEvidenceDigest ready" : "viralEvidenceDigest"}>
      <div className="viralEvidenceDigestHeader">
        <div>
          <strong>{summary.headline}</strong>
          <p>{summary.detail}</p>
        </div>
        <span>{summary.sourceLine}</span>
      </div>
      {summary.keyInsights.length ? (
        <div className="viralEvidenceDigestList">
          {summary.keyInsights.slice(0, compact ? 3 : 5).map((insight) => (
            <article key={insight.id}>
              <span>
                {labelForInsight(insight.type)}
                {insight.isFocused ? " · 重点" : ""}
                {insight.isCited ? " · 已引用" : ""}
              </span>
              <p>{insight.insight}</p>
            </article>
          ))}
        </div>
      ) : null}
      {summary.sourceCases.length && !compact ? (
        <div className="viralEvidenceSources">
          {summary.sourceCases.map((item) => (
            <span
              key={item.id}
              title={[
                item.safetySummary,
                item.reusablePatterns.length ? `可学：${item.reusablePatterns.join(" / ")}` : "",
                item.doNotCopy.length ? `不要复制：${item.doNotCopy.join(" / ")}` : ""
              ].filter(Boolean).join("\n")}
            >
              {item.hookType || item.title} · {item.category} · 分 {Math.round(item.score)}
              {item.doNotCopy.length ? ` · 边界：${item.doNotCopy[0]}` : ""}
            </span>
          ))}
        </div>
      ) : null}
      <small>{summary.traceLine}</small>
      {summary.missingLine ? <small>{summary.missingLine}</small> : null}
      {onOpenViral ? (
        <button className="textButton" type="button" onClick={onOpenViral}>查看爆款库证据</button>
      ) : null}
    </div>
  );
}

function ChipList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="muted">{title}</p>
      <div className="tagRow">
        {items.slice(0, 5).map((item) => (
          <em key={item}>{item}</em>
        ))}
      </div>
    </div>
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

function findViralCaseForInsight(insight: ProjectInsight, viralCaseById: Map<string, ViralCase>): ViralCase | undefined {
  for (const id of insight.sourceSampleIds) {
    const viralCase = viralCaseById.get(id);
    if (viralCase) return viralCase;
  }
  return undefined;
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

function labelForViralExtraction(method: ViralCase["extraction"]["method"]): string {
  return method === "model" ? "AI 提炼" : "本地启发式";
}

function labelForViralRouteStatus(status: "empty" | "pending" | "ready"): string {
  if (status === "ready") return "已应用";
  if (status === "pending") return "待应用";
  return "未开始";
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return <span className={ok ? "checkItem ok" : "checkItem"}>{ok ? "✓" : "·"} {label}</span>;
}

function EvidenceDrawer({ sample, onClose, onSave }: { sample: SampleEvidence; onClose: () => void; onSave: () => void }) {
  return (
    <div className="studioDrawerBackdrop" role="presentation" onClick={onClose}>
      <aside className="studioDrawer" role="dialog" aria-modal="true" aria-label="证据详情" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>Evidence Detail</span>
            <h3>{sample.title}</h3>
            <p>{sample.author || "未知作者"} · 赞 {sample.likes} · 藏 {sample.collects} · 评 {sample.comments}</p>
          </div>
          <button type="button" onClick={onClose}>关闭</button>
        </header>

        <section className="drawerSection">
          <h4>正文摘要</h4>
          <p>{sample.detailText || "当前 MCP 详情没有返回正文；可以保留互动数据和图片风格作为证据。"}</p>
        </section>

        {sample.reasonHighlights.length ? (
          <section className="drawerSection">
            <h4>为什么值得参考</h4>
            <ul>
              {sample.reasonHighlights.slice(0, 6).map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        ) : null}

        {sample.commentSnippets.length ? (
          <section className="drawerSection">
            <h4>评论关注点</h4>
            <ul>
              {sample.commentSnippets.slice(0, 8).map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        ) : null}

        {(sample.cachedImageUrls?.length ?? 0) || (sample.imageUrls?.length ?? 0) ? (
          <section className="drawerSection">
            <h4>图片参考</h4>
            <div className="drawerImageGrid">
              {[...(sample.cachedImageUrls ?? []), ...(sample.imageUrls ?? [])].slice(0, 6).map((url) => (
                <img alt={sample.title} key={url} src={url} />
              ))}
            </div>
          </section>
        ) : null}

        <footer>
          {sample.url ? (
            <a className="secondaryButton" href={sample.url} target="_blank" rel="noreferrer">
              <ExternalLink size={14} />
              来源链接
            </a>
          ) : null}
          <button className="primaryButton" type="button" onClick={onSave}>保存到爆款库</button>
        </footer>
      </aside>
    </div>
  );
}

function EvidenceCatalogDrawer({
  samples,
  onClose,
  onOpenSample,
  onSaveSample
}: {
  samples: SampleEvidence[];
  onClose: () => void;
  onOpenSample: (sample: SampleEvidence) => void;
  onSaveSample: (sample: SampleEvidence) => void;
}) {
  const sortedSamples = [...samples].sort((left, right) => scoreEvidence(right) - scoreEvidence(left));

  return (
    <div className="studioDrawerBackdrop" role="presentation" onClick={onClose}>
      <aside className="studioDrawer" role="dialog" aria-modal="true" aria-label="研究证据目录" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>Evidence Catalog</span>
            <h3>研究证据目录</h3>
            <p>完整样本留在抽屉里，不打断主创作台；打开单条后可查看正文、评论和图片。</p>
          </div>
          <button type="button" onClick={onClose}>关闭</button>
        </header>

        <section className="drawerSection">
          <div className="drawerEvidenceList">
            {sortedSamples.map((sample, index) => (
              <article key={sample.id}>
                <div>
                  <span>#{index + 1} · 赞 {sample.likes} · 藏 {sample.collects} · 评 {sample.comments}</span>
                  <strong>{sample.title}</strong>
                  <p>{summarizeEvidenceSample(sample)}</p>
                </div>
                <div className="evidenceActions">
                  <button className="textButton" type="button" onClick={() => onOpenSample(sample)}>
                    打开详情
                  </button>
                  <button className="textButton" type="button" onClick={() => onSaveSample(sample)}>
                    保存到爆款库
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function ViralCaseDrawer({ viralCase, onClose }: { viralCase: ViralCase; onClose: () => void }) {
  const insights = viralCase.extractedInsights;
  return (
    <div className="studioDrawerBackdrop" role="presentation" onClick={onClose}>
      <aside className="studioDrawer" role="dialog" aria-modal="true" aria-label="爆款库规律详情" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>Viral Knowledge Detail</span>
            <h3>{viralCase.hookType || viralCase.title}</h3>
            <p>{viralCase.topic} · {viralCase.category} · 赞 {viralCase.metrics.likes} · 藏 {viralCase.metrics.collects} · 评 {viralCase.metrics.comments}</p>
            <p className="muted">
              Extraction: {viralCase.extraction.method === "model" ? "AI model" : "local heuristic"}
              {" · "}Source: {viralCase.extraction.sourceSampleId || viralCase.sourceSampleId}
              {viralCase.quality ? ` · Quality: ${Math.round(viralCase.quality.score * 100)}%` : ""}
              {viralCase.extraction.fallbackReason ? ` · fallback: ${viralCase.extraction.fallbackReason}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose}>关闭</button>
        </header>

        <section className="drawerSection">
          <h4>可复用规律</h4>
          <ul>
            {insights.reusableRules.slice(0, 8).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section className="drawerSection">
          <h4>结构化创作知识</h4>
          {viralCase.creativeSafety ? (
            <div className="drawerInlineWarning">
              <strong>原创安全摘要</strong>
              <p>{viralCase.creativeSafety.summary}</p>
              {viralCase.quality?.warnings.length ? (
                <p>质量提示：{viralCase.quality.warnings.slice(0, 2).join(" / ")}</p>
              ) : null}
              <KnowledgeList title="可学习" items={viralCase.creativeSafety.reusablePatterns} />
              <KnowledgeList title="必须改写/替换" items={viralCase.creativeSafety.transformationGuidance} />
            </div>
          ) : null}
          <div className="viralKnowledgeGrid">
            <KnowledgeList title="标题钩子" items={insights.titleHooks.length ? insights.titleHooks : [viralCase.hookType]} />
            <KnowledgeList title="正文结构" items={insights.copyStructures.length ? insights.copyStructures : viralCase.contentStructure} />
            <KnowledgeList title="标签组合" items={insights.tagPatterns.length ? insights.tagPatterns : viralCase.tags} />
            <KnowledgeList title="图片风格" items={insights.visualPatterns.length ? insights.visualPatterns : [viralCase.imageStyle]} />
            <KnowledgeList title="目标人群" items={insights.audienceSignals.length ? insights.audienceSignals : [viralCase.audience]} />
            <KnowledgeList title="痛点/情绪" items={[...insights.painPoints, ...insights.emotionalTriggers].length ? [...insights.painPoints, ...insights.emotionalTriggers] : [viralCase.painPoint, viralCase.emotionalTrigger]} />
          </div>
        </section>

        {insights.commentConcerns.length ? (
          <section className="drawerSection">
            <h4>评论关注点</h4>
            <ul>
              {insights.commentConcerns.slice(0, 8).map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        ) : null}

        {insights.avoidCopying.length ? (
          <section className="drawerSection warningSection">
            <h4>不可复制/仿写</h4>
            <ul>
              {insights.avoidCopying.slice(0, 6).map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        ) : null}

        {viralCase.bodyExcerpt ? (
          <section className="drawerSection">
            <h4>原文摘要</h4>
            <p>{viralCase.bodyExcerpt}</p>
          </section>
        ) : null}

        <footer>
          {viralCase.sourceUrl ? (
            <a className="secondaryButton" href={viralCase.sourceUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={14} />
              来源链接
            </a>
          ) : null}
          <span className="drawerFootnote">只学习结构、风格和规律，不复制原文或原图。</span>
        </footer>
      </aside>
    </div>
  );
}

function KnowledgeList({ title, items }: { title: string; items: string[] }) {
  const visible = items.map((item) => item.trim()).filter(Boolean).slice(0, 5);
  if (!visible.length) return null;
  return (
    <article>
      <strong>{title}</strong>
      <ul>
        {visible.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </article>
  );
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

function labelForInsight(type: string): string {
  const labels: Record<string, string> = {
    title: "标题",
    copy: "正文",
    tag: "标签",
    visual: "图片",
    comment: "评论",
    audience: "人群",
    pain_point: "痛点",
    structure: "结构",
    hook: "钩子"
  };
  return labels[type] ?? type;
}

function labelForSource(sourceType?: string): string {
  const labels: Record<string, string> = {
    realtime: "实时",
    viral_library: "爆款库",
    user_input: "用户输入"
  };
  return sourceType ? labels[sourceType] ?? sourceType : "实时";
}

function labelForCitationField(field: string): string {
  const labels: Record<string, string> = {
    title: "标题",
    content: "正文",
    tags: "标签",
    imagePrompt: "图片方向"
  };
  return labels[field] ?? field;
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

function labelForPublishStatus(status?: string): string {
  const labels: Record<string, string> = {
    draft: "草稿",
    blocked: "已阻止",
    awaiting_approval: "待确认",
    approved: "已确认",
    publishing: "发布中",
    published: "已发布",
    scheduled: "已定时",
    failed: "失败",
    cancelled: "已取消"
  };
  return status ? labels[status] ?? status : "待检查";
}

function buildPublishReadinessHint({
  title,
  content,
  tagsText,
  imageCount,
  hasVisualDirection,
  citationTraceReady,
  accountReady,
  quality,
  qualityGateFresh
}: {
  title: string;
  content: string;
  tagsText: string;
  imageCount: number;
  hasVisualDirection: boolean;
  citationTraceReady: boolean;
  accountReady: boolean;
  quality?: PostProject["qualityCheck"];
  qualityGateFresh: boolean;
}): string {
  const missing: string[] = [];
  if (!title.trim()) missing.push("标题");
  if (!content.trim()) missing.push("正文");
  if (!tagsText.trim()) missing.push("标签");
  if (!imageCount) missing.push("发布图片");
  if (!hasVisualDirection) missing.push("图片方向 / Prompt");
  if (!citationTraceReady) missing.push("字段级证据引用");
  if (!accountReady) missing.push("小红书登录账号");
  if (!quality) {
    missing.push("Quality Gate 未运行");
  }
  if (quality?.canPublish === false) {
    const issueText = quality.issues.slice(0, 2).join("；") || "需要处理质量检查问题";
    missing.push(`Quality Gate：${issueText}`);
  }
  if (quality?.canPublish === true && !qualityGateFresh) {
    missing.push("版本状态：画布改动后需要重新运行 Quality Gate");
  }
  return missing.length ? `还缺：${missing.join("、")}。` : "请先刷新质量检查，再进入人工发布确认。";
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

function summarizeDraftDiff(current: PublishDraftState, version: NonNullable<WorkflowResult["draft"]>): string {
  const changes = [];
  if (current.title.trim() && current.title.trim() !== version.title.trim()) changes.push("标题不同");
  const currentLength = current.content.trim().length;
  const nextLength = version.content.trim().length;
  if (currentLength && currentLength !== nextLength) changes.push(`正文 ${nextLength - currentLength > 0 ? "+" : ""}${nextLength - currentLength} 字`);
  const currentTags = parseTags(current.tagsText).join("|");
  const versionTags = version.tags.join("|");
  if (currentTags && currentTags !== versionTags) changes.push("标签不同");
  return changes.length ? changes.join(" · ") : "当前画布一致";
}

function summarizePromptDiff(currentPrompt: string, nextPrompt: string): string {
  const current = currentPrompt.trim();
  const next = nextPrompt.trim();
  if (!current) return next ? `将填入 ${next.length} 字图片 Prompt` : "Prompt 为空";
  if (current === next) return "当前 Prompt 一致";
  const delta = next.length - current.length;
  return `Prompt ${delta > 0 ? "+" : ""}${delta} 字 · ${next.slice(0, 58)}${next.length > 58 ? "..." : ""}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function parseTags(value: string): string[] {
  return value.split(/[\s#，,、]+/).map((item) => item.trim()).filter(Boolean);
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
