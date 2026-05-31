"use client";

import { Database, FileCheck2, MessageSquareText, Rocket } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { buildCopyCreativeBrief, buildDraftPromptFromBrief, buildImageCreativeBrief } from "@/lib/workflows/creative-briefs";
import { parseTagsText } from "@/lib/publishing/assembly";
import {
  AssetsPanel,
  Dashboard,
  HistoryPanel,
  JobsPanel,
  PublishAuditPanel,
  WorkflowPanel,
  WorkflowRibbon
} from "@/app/components/xhs-panels";
import { buildPendingPublishFromPlan } from "@/app/components/publish-confirmation";
import { buildViralKnowledgeSearchParams, type ViralLibrarySearchFilters } from "@/app/components/viral-search";
import { PostStudioPanel, type StudioTab } from "@/app/components/post-studio-panel";
import { ChatPanel } from "@/app/components/chat-workbench";
import { SettingsPanel } from "@/app/components/settings-panel";
import { PublishAssemblyPanel } from "@/app/components/publish-assembly-panel";
import { ImageStudioPanel } from "@/app/components/image-studio-panel";
import {
  buildClientEvidenceContext,
  normalizeLocalDatetimeForApi,
  uniqueIds
} from "@/app/components/xhs-display-utils";
import { AppShell } from "@/app/components/app-shell";
import { clientApi, clientFormDataApi } from "@/app/client/api";
import { useJobStream } from "@/app/hooks/use-job-stream";
import { useSettingsHealth } from "@/app/hooks/use-settings-health";
import { defaultSettings } from "@/app/config/default-settings";
import {
  buildWorkflowRibbonState,
  hasRunningJobs as hasRunningJobsInList,
  selectActiveJob,
  selectWorkflowResultForDisplay
} from "@/app/state/page-derived";
import { shouldAutoOpenLatestConversation } from "@/app/state/chat-history-selection";
import { noticeForProjectReset, resetWorkflowFormForNewProject } from "@/app/state/project-reset";
import { canApplyWorkspaceSnapshot, isJobForWorkspace } from "@/lib/jobs/context";

import type {
  AssetRecord,
  CardPaginationMode,
  CardTheme,
  ChatConversation,
  ChatMessage,
  CreatorMemoryProfile,
  DraftRecord,
  ImageStudioMode,
  JobRecord,
  PendingPublishConfirmation,
  PostProject,
  PublishAuditRecord,
  PublishDraftState,
  PublishPayload,
  RedactedSettings,
  SampleEvidence,
  Section,
  ViralCase,
  WorkflowResult,
  WorkflowRun,
  WorkspaceState
} from "@/app/types";

export default function Home() {
  const [section, setSection] = useState<Section>("flow");
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [publishAudits, setPublishAudits] = useState<PublishAuditRecord[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [autoReturnJobId, setAutoReturnJobId] = useState<string | null>(null);
  const [autoReturnTarget, setAutoReturnTarget] = useState<"flow" | "chat">("flow");
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [postProject, setPostProject] = useState<PostProject | null>(null);
  const [postStudioFocus, setPostStudioFocus] = useState<{ tab: StudioTab; nonce: number } | null>(null);
  const [viralCases, setViralCases] = useState<ViralCase[]>([]);
  const [creatorMemory, setCreatorMemory] = useState<CreatorMemoryProfile | null>(null);
  const [workflowResult, setWorkflowResult] = useState<WorkflowResult | null>(null);
  const [researchResult, setResearchResult] = useState<WorkflowResult | null>(null);
  const [currentDraft, setCurrentDraft] = useState<DraftRecord | null>(null);
  const [publishDraft, setPublishDraft] = useState<PublishDraftState>({
    title: "",
    content: "",
    tagsText: "",
    imagePrompt: ""
  });
  const [canvasDirty, setCanvasDirty] = useState(false);
  const [publishAssetIds, setPublishAssetIds] = useState<string[]>([]);
  const [publishVisibility, setPublishVisibility] = useState<RedactedSettings["defaultVisibility"]>("仅自己可见");
  const [publishScheduleAt, setPublishScheduleAt] = useState("");
  const [publishStatus, setPublishStatus] = useState("");
  const [pendingPublish, setPendingPublish] = useState<PendingPublishConfirmation | null>(null);
  const [dismissedPublishIntentId, setDismissedPublishIntentId] = useState<string | null>(null);
  const [workflowForm, setWorkflowForm] = useState({
    topic: "上海安静咖啡馆",
    contentType: "探店",
    timeRange: "一周内",
    sampleCount: 8,
    visibility: "仅自己可见",
    autoPublish: false,
    workflowGoal: "research",
    publishMode: "draft",
    analyzeImages: true,
    generateImages: false,
    scheduleAt: "",
    requirements: "",
    imageSource: "ai",
    assetIds: [] as string[],
    productName: "",
    sellingPoints: "",
    scene: "真实生活使用场景",
    style: "小红书真实种草风",
    extraImagePrompt: ""
  });
  const [assetForm, setAssetForm] = useState({
    productName: "",
    sellingPoints: "",
    scene: "早晨自然光桌面",
    style: "小红书真实种草风",
    extraPrompt: ""
  });
  const [imageStudioMode, setImageStudioMode] = useState<ImageStudioMode>("ai");
  const [cardForm, setCardForm] = useState({
    title: "",
    subtitle: "",
    body: "",
    tagsText: "",
    theme: "sketch" as CardTheme,
    mode: "auto-split" as CardPaginationMode,
    width: 1080,
    height: 1440
  });
  const [chatInput, setChatInput] = useState("帮我分析最近一周「咖啡探店」的高收藏笔记");
  const [chatAssetIds, setChatAssetIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatConversations, setChatConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const workspaceIdRef = useRef<string | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>("");
  const {
    settings,
    setSettings,
    settingsDraft,
    setSettingsDraft,
    health,
    settingsBusy,
    modelReady,
    imageReady,
    loadSettings,
    checkHealth,
    saveSettings,
    switchActiveAccount
  } = useSettingsHealth(defaultSettings, {
    onNotice: setNotice,
    onBeforeAccountSwitch: () => {
      setPendingPublish(null);
      setPublishStatus("账号已切换，请重新生成发布确认单。");
    },
    onAfterAccountSwitch: () => loadCreatorMemory()
  });
  const activeBusy = settingsBusy ?? busy;

  useEffect(() => {
    void loadInitial();
  }, []);

  useEffect(() => {
    workspaceIdRef.current = workspace?.workspaceId ?? null;
  }, [workspace?.workspaceId]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    const hydrated = buildPendingPublishFromPlan({
      plan: postProject?.publishPlan ?? workspace?.publishPlan ?? null,
      settings,
      health
    });
    if (!hydrated || hydrated.publishIntentId === dismissedPublishIntentId) {
      return;
    }
    setPendingPublish((current) =>
      current?.publishIntentId === hydrated.publishIntentId ? current : hydrated
    );
  }, [
    dismissedPublishIntentId,
    health?.activeAccount?.loginName,
    postProject?.publishPlan?.id,
    postProject?.publishPlan?.status,
    settings.activeAccountId,
    settings.mcpUrl,
    workspace?.publishPlan?.id,
    workspace?.publishPlan?.status
  ]);

  const latestRun = useMemo(() => runs[0], [runs]);
  const activeJob = useMemo(() => selectActiveJob(jobs, activeJobId), [activeJobId, jobs]);
  const hasRunningJobs = hasRunningJobsInList(jobs);
  const workflowResultForDisplay = selectWorkflowResultForDisplay({ workflowResult, researchResult });
  const workflowRibbonState = buildWorkflowRibbonState({
    researchResult,
    workflowResult,
    workspace,
    currentDraft,
    publishAssetIds,
    workflowAssetIds: workflowForm.assetIds,
    jobs
  });

  async function loadInitial() {
    await Promise.all([
      loadSettings(),
      checkHealth(),
      loadHistory(),
      loadJobs(),
      loadPublishAudit(),
      loadAssets(),
      loadChatHistory(),
      loadCurrentDraft(),
      loadWorkspace(),
      loadPostProject(),
      loadViralKnowledge(),
      loadCreatorMemory()
    ]);
  }

  useJobStream({
    enabled: hasRunningJobs,
    onSnapshot: applyJobsSnapshot,
    onFallbackPoll: loadJobs
  });

  async function loadHistory() {
    const data = await clientApi<{ runs: WorkflowRun[] }>("/api/history");
    setRuns(data.runs);
  }

  async function loadJobs() {
    const data = (await clientApi("/api/jobs")) as {
      jobs: JobRecord[];
      workspace?: WorkspaceState;
      postProject?: PostProject;
    };
    await applyJobsSnapshot(data.jobs, data.workspace, data.postProject);
  }

  async function loadPublishAudit() {
    const data = (await clientApi("/api/publish/audit")) as { audit: PublishAuditRecord[] };
    setPublishAudits(data.audit);
  }

  async function applyJobsSnapshot(nextJobs: JobRecord[], streamedWorkspace?: WorkspaceState, streamedPostProject?: PostProject) {
    setJobs(nextJobs);
    const shouldApplyStreamedWorkspace = canApplyWorkspaceSnapshot(streamedWorkspace, workspace);
    const activeWorkspace = shouldApplyStreamedWorkspace && streamedWorkspace ? streamedWorkspace : workspace;
    const activeRecentJobIds = activeWorkspace?.recentJobIds;
    if (streamedWorkspace && shouldApplyStreamedWorkspace) {
      setWorkspace(streamedWorkspace);
      if (streamedWorkspace.currentDraft) {
        applyCurrentDraft(streamedWorkspace.currentDraft);
      } else {
        setCurrentDraft(null);
        setPublishDraft({ title: "", content: "", tagsText: "", imagePrompt: "" });
      }
      setPublishAssetIds(streamedWorkspace.selectedImageIds ?? []);
    }
    if (streamedPostProject && shouldApplyStreamedWorkspace) {
      setPostProject(streamedPostProject);
    }
    const autoReturnJob = autoReturnJobId ? nextJobs.find((job) => job.id === autoReturnJobId) : null;
    if (autoReturnJob?.status === "completed" && autoReturnJob.result && isJobForWorkspace(autoReturnJob, activeWorkspace)) {
      applyWorkflowResult(autoReturnJob.result);
      setActiveJobId(autoReturnJob.id);
      setAutoReturnJobId(null);
      setSection(autoReturnTarget);
      setNotice("研究完成，已回到结果页。可以继续进入文案创作或图片创作。");
      await loadWorkspace();
      await loadPostProject();
      if (autoReturnJob.result.draft) {
        await loadCurrentDraft();
      }
      return;
    }
    if (autoReturnJob?.status === "completed" && !isJobForWorkspace(autoReturnJob, activeWorkspace)) {
      setAutoReturnJobId(null);
    }
    if (autoReturnJob?.status === "failed") {
      setAutoReturnJobId(null);
    }
    const latestCompleted = nextJobs.find((job) => job.status === "completed" && job.result && isJobForWorkspace(job, activeWorkspace));
    if (latestCompleted && activeRecentJobIds && !activeRecentJobIds.includes(latestCompleted.id)) {
      return;
    }
    if (latestCompleted?.result) {
      if (!workflowResult) {
        applyWorkflowResult(latestCompleted.result);
      } else if (latestCompleted.result.status === "research_ready" || latestCompleted.result.researchSummary) {
        setResearchResult(latestCompleted.result);
      }
    }
  }

  async function loadAssets() {
    const data = (await clientApi("/api/assets")) as { assets: AssetRecord[] };
    setAssets(data.assets);
  }

  async function loadCurrentDraft() {
    const data = (await clientApi("/api/drafts/current")) as { currentDraft: DraftRecord | null };
    if (data.currentDraft) {
      applyCurrentDraft(data.currentDraft);
    } else {
      setCurrentDraft(null);
    }
  }

  async function loadWorkspace() {
    const data = (await clientApi("/api/agent/workspace")) as { workspace: WorkspaceState };
    setWorkspace(data.workspace);
    if (data.workspace.currentDraft) {
      applyCurrentDraft(data.workspace.currentDraft);
    } else {
      setCurrentDraft(null);
      setPublishDraft({ title: "", content: "", tagsText: "", imagePrompt: "" });
    }
    setPublishAssetIds(data.workspace.selectedImageIds ?? []);
  }

  async function loadPostProject() {
    const data = (await clientApi("/api/post-project")) as { project: PostProject };
    setPostProject(data.project);
    return data.project;
  }

  async function loadViralKnowledge(filters: ViralLibrarySearchFilters = {}) {
    const params = buildViralKnowledgeSearchParams(filters, 12);
    const data = (await clientApi(`/api/viral-knowledge?${params.toString()}`)) as { cases: ViralCase[] };
    setViralCases(data.cases ?? []);
  }

  async function loadCreatorMemory() {
    const data = (await clientApi("/api/agent/memory")) as { memory: CreatorMemoryProfile };
    setCreatorMemory(data.memory);
  }

  async function patchWorkspace(patch: Partial<WorkspaceState>) {
    const data = (await clientApi("/api/agent/workspace", {
      method: "PATCH",
      body: JSON.stringify(patch)
    })) as { workspace: WorkspaceState; postProject?: PostProject };
    setWorkspace(data.workspace);
    if (data.postProject) {
      setPostProject(data.postProject);
    }
    if (data.workspace.currentDraft) {
      applyCurrentDraft(data.workspace.currentDraft);
    }
    setPublishAssetIds(data.workspace.selectedImageIds ?? []);
    if (!data.postProject) {
      await loadPostProject();
    }
    return data.workspace;
  }

  function applyWorkflowResult(result: WorkflowResult) {
    setWorkflowResult(result);
    if (result.status === "research_ready" || result.researchSummary) {
      setResearchResult(result);
    }
    if (result.draft) {
      applyDraftToPublish(result.draft, workflowForm.visibility as RedactedSettings["defaultVisibility"]);
    }
  }

  function applyCurrentDraft(draft: DraftRecord) {
    setCurrentDraft(draft);
    applyDraftToPublish(draft.draft, draft.visibility);
  }

  function applyDraftToPublish(draft: NonNullable<WorkflowResult["draft"]>, visibility: RedactedSettings["defaultVisibility"]) {
    setPublishDraft({
      title: draft.title,
      content: draft.content,
      tagsText: draft.tags.map((tag) => `#${tag}`).join(" "),
      imagePrompt: draft.imagePrompt
    });
    setPublishVisibility(visibility);
    setCanvasDirty(false);
  }

  function handlePublishDraftChange(next: PublishDraftState) {
    setPendingPublish(null);
    setPublishDraft(next);
    setCanvasDirty(true);
  }

  async function commitCanvasToProject(overrides: Partial<PublishDraftState> = {}, selectedImageIds = publishAssetIds) {
    const draftState = { ...publishDraft, ...overrides };
    const data = (await clientApi("/api/post-project", {
      method: "PATCH",
      body: JSON.stringify({
        action: "commit_canvas",
        draft: {
          title: draftState.title,
          content: draftState.content,
          tags: parseTagsText(draftState.tagsText),
          structure: [],
          imagePrompt: draftState.imagePrompt
        },
        selectedImageIds,
        visibility: publishVisibility
      })
    })) as { project: PostProject; currentDraft?: DraftRecord | null };
    setPostProject(data.project);
    if (data.currentDraft) {
      applyCurrentDraft(data.currentDraft);
    }
    await loadWorkspace();
    setCanvasDirty(false);
    return data.project;
  }

  async function runCanvasQualityGate() {
    const data = (await clientApi("/api/post-project", {
      method: "PATCH",
      body: JSON.stringify({
        action: "run_quality_gate",
        draft: {
          title: publishDraft.title,
          content: publishDraft.content,
          tags: parseTagsText(publishDraft.tagsText),
          structure: [],
          imagePrompt: publishDraft.imagePrompt
        },
        selectedImageIds: publishAssetIds,
        visibility: publishVisibility
      })
    })) as { project: PostProject; currentDraft?: DraftRecord | null };
    setPostProject(data.project);
    if (data.currentDraft) {
      applyCurrentDraft(data.currentDraft);
    }
    await loadWorkspace();
    setCanvasDirty(false);
    setNotice(data.project.qualityCheck?.canPublish
      ? "发布检查已通过，已生成最终帖子快照。"
      : "发布检查完成：请先处理 Quality Gate 提示的问题。");
    return data.project;
  }

  async function selectCopyVersion(versionId: string) {
    setPendingPublish(null);
    const data = (await clientApi("/api/post-project", {
      method: "PATCH",
      body: JSON.stringify({ action: "select_copy_version", versionId })
    })) as { project: PostProject; currentDraft?: DraftRecord | null };
    setPostProject(data.project);
    if (data.currentDraft) {
      applyCurrentDraft(data.currentDraft);
    }
    await loadWorkspace();
    setNotice("已切换文案版本，并同步到当前帖子项目。");
  }

  async function selectImagePromptVersion(versionId: string) {
    setPendingPublish(null);
    const data = (await clientApi("/api/post-project", {
      method: "PATCH",
      body: JSON.stringify({ action: "select_image_prompt_version", versionId })
    })) as { project: PostProject; currentDraft?: DraftRecord | null };
    setPostProject(data.project);
    if (data.currentDraft) {
      applyCurrentDraft(data.currentDraft);
    }
    await loadWorkspace();
    setNotice("已切换图片 Prompt，并同步到当前帖子项目。");
  }

  async function selectPostImages(selectedImageIds: string[]) {
    setPendingPublish(null);
    const uniqueSelected = uniqueIds(selectedImageIds);
    const data = (await clientApi("/api/post-project", {
      method: "PATCH",
      body: JSON.stringify({ action: "select_images", selectedImageIds: uniqueSelected })
    })) as { project: PostProject; currentDraft?: DraftRecord | null };
    setPostProject(data.project);
    setPublishAssetIds(uniqueSelected);
    setCanvasDirty(false);
    await loadWorkspace();
    setNotice(uniqueSelected.length ? `已选择 ${uniqueSelected.length} 张发布图片。` : "已清空发布图片选择。");
  }

  async function saveSampleToViralLibrary(sample: SampleEvidence) {
    await saveSamplesToViralLibrary([sample]);
  }

  async function saveSamplesToViralLibrary(samples: SampleEvidence[]) {
    const uniqueSamples = uniqueById(samples).slice(0, 8);
    if (!uniqueSamples.length) return;
    setBusy("viral");
    try {
      const data = (await clientApi("/api/viral-knowledge", {
        method: "POST",
        body: JSON.stringify({
          samples: uniqueSamples,
          topic: postProject?.topic || workflowForm.topic,
          category: workflowForm.contentType,
          useModel: modelReady
        })
      })) as { case?: ViralCase; cases?: ViralCase[]; project?: PostProject; addedInsightIds?: string[]; addedSampleIds?: string[] };
      const savedCases = data.cases ?? (data.case ? [data.case] : []);
      setViralCases((current) => {
        const savedIds = new Set(savedCases.map((item) => item.id));
        return [...savedCases, ...current.filter((item) => !savedIds.has(item.id))].slice(0, 12);
      });
      if (data.project) {
        setPostProject(data.project);
      }
      setNotice(data.addedInsightIds?.length
        ? `已保存 ${savedCases.length} 条样本到爆款库，并为当前项目增加 ${data.addedInsightIds.length} 条可复用创作证据。`
        : "已保存到爆款库：系统会沉淀结构化创作规律，不会把原文当作仿写素材。");
      await loadPostProject();
    } finally {
      setBusy(null);
    }
  }

  async function loadChatHistory() {
    const data = (await clientApi("/api/chat/history")) as { conversations: ChatConversation[] };
    setChatConversations(data.conversations);
    if (shouldAutoOpenLatestConversation({ activeConversationId, conversations: data.conversations })) {
      setActiveConversationId(data.conversations[0].id);
      setMessages(data.conversations[0].messages);
    }
  }

  async function runWorkflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await startResearchJob();
  }

  async function startResearchJob() {
    setBusy("workflow");
    setNotice("");
    try {
      await resetActiveWorkspace({
        topic: workflowForm.topic,
        lastUserIntent: "start_research"
      });
      const researchInput = {
        ...workflowForm,
        workflowGoal: "research",
        publishMode: "draft",
        autoPublish: false,
        generateImages: false,
        scheduleAt: "",
        imageSource: "ai",
        assetIds: [] as string[],
        visibility: settings.defaultVisibility
      };
      const data = (await clientApi("/api/jobs", {
        method: "POST",
        body: JSON.stringify(researchInput)
      })) as { job: JobRecord; workspace?: WorkspaceState; postProject?: PostProject };
      if (data.workspace) {
        setWorkspace(data.workspace);
      }
      if (data.postProject) {
        setPostProject(data.postProject);
      }
      setActiveJobId(data.job.id);
      setAutoReturnTarget("flow");
      setAutoReturnJobId(data.job.id);
      setJobs((current) => [data.job, ...current.filter((job) => job.id !== data.job.id)]);
      focusPostStudioTab("evidence");
      setNotice("主题研究任务已创建，只会搜索和分析，不会生成草稿或发布。进度会留在 Post Studio 左侧，结果会同步到右侧证据面板。");
    } finally {
      setBusy(null);
    }
  }

  async function handlePostStudioAction(action: string) {
    switch (action) {
      case "start_brief":
      case "update_brief_inputs":
        setChatInput("我想补充这个帖子项目的需求：目标人群是；内容目标是；语气希望；产品/店铺信息是。请先判断还缺什么，再帮我整理 CreativeBrief。");
        setNotice("已把补充需求模板放入 Agent 输入框。");
        return;
      case "search_research":
      case "summarize_evidence":
        await startResearchJob();
        return;
      case "open_jobs":
        setSection("jobs");
        setNotice("已打开任务进度，后台研究完成后会同步回 Post Studio。");
        return;
      case "create_creative_brief":
        await submitChatMessage("请基于当前研究证据和爆款库规律，生成/刷新这个 PostProject 的 CreativeBrief，并说明参考了哪些证据。", false);
        return;
      case "retrieve_viral_knowledge":
        await submitChatMessage("请刷新当前项目的爆款库 RAG 证据，不要重新搜索小红书。请把可复用的标题钩子、正文结构、标签组合、图片风格和评论关注点合入 PostProject evidencePack。", false);
        await loadViralKnowledge();
        await loadPostProject();
        return;
      case "generate_copy":
        await submitChatMessage("请基于当前 PostProject 的证据、爆款库规律和 CreativeBrief 生成一篇原创小红书图文笔记，不要重新搜索，并记录引用的证据 ID。", false);
        return;
      case "revise_copy":
        setChatInput("请把当前文案改得更生活化、更像真实分享，但不要改变已确认的信息和证据依据。");
        setNotice("已把文案修改指令放入 Agent 输入框。");
        return;
      case "plan_visuals":
      case "generate_image_prompts":
        await submitChatMessage("请基于当前 CreativeBrief 和证据生成图片方向与图片提示词，不要直接生图，先让我确认方向。", false);
        return;
      case "generate_images":
        await submitChatMessage("请基于当前草稿、CreativeBrief 和图片提示词生成小红书配图。", false, chatAssetIds);
        return;
      case "generate_cards":
        await submitChatMessage("请把当前草稿生成小红书图文卡片：封面 + 多张正文卡片，默认 1080×1440，内容要清晰、有收藏价值。", false);
        return;
      case "select_images":
        focusPostStudioTab(publishAssetIds.length ? "generated" : "references");
        setNotice("已聚焦 Post Studio 的图片面板。你可以在右侧选择已有图片；需要高级生图时再打开图片创作台。");
        return;
      case "assemble_post":
      case "run_quality_gate":
        await runCanvasQualityGate();
        setSection("flow");
        return;
      case "request_publish_confirmation":
      case "schedule_publish":
      case "publish_now":
        await openPublishAssemblyFromWorkspace({ stayInStudio: true });
        return;
      case "review_publish_confirmation":
        focusPostStudioTab("publish");
        setNotice("已打开当前发布确认单。请核对账号、可见范围、图片版本和时间。");
        return;
      case "confirm_publish":
        if (pendingPublish) {
          await confirmPendingPublish();
        } else {
          focusPostStudioTab("publish");
          setNotice("当前没有可确认的发布单，请先生成发布确认单。");
        }
        return;
      case "cancel_publish":
        cancelPendingPublish();
        return;
      case "view_publish_history":
        setSection("audit");
        await loadPublishAudit();
        return;
      case "start_project":
        await startNewProject();
        return;
      case "recover":
        await loadWorkspace();
        await loadPostProject();
        setNotice("已刷新当前项目状态。");
        return;
      default:
        setChatInput(`请继续执行下一步：${action}`);
    }
  }

  function focusPostStudioTab(tab: StudioTab) {
    setPostStudioFocus({ tab, nonce: Date.now() });
    setSection("flow");
  }

  async function uploadAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.querySelector<HTMLInputElement>('input[type="file"]');
    const ids = await uploadFiles(input?.files ?? []);
    if (input && ids.length) {
      input.value = "";
    }
  }

  async function uploadFiles(files: FileList | File[]): Promise<string[]> {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      setNotice("请选择图片");
      return [];
    }

    setBusy("asset-upload");
    const uploadedIds: string[] = [];
    try {
      for (const file of imageFiles) {
        const form = new FormData();
        form.set("file", file);
        const data = await clientFormDataApi<{ asset: AssetRecord }>("/api/assets", form);
        uploadedIds.push(data.asset.id);
      }
      await loadAssets();
      setNotice(`已上传 ${uploadedIds.length} 张图片`);
      return uploadedIds;
    } finally {
      setBusy(null);
    }
  }

  async function attachChatFiles(files: FileList | File[]) {
    const ids = await uploadFiles(files);
    if (ids.length) {
      setChatAssetIds((current) => uniqueIds([...current, ...ids]));
      void patchWorkspace({
        productImageIds: uniqueIds([...(workspace?.productImageIds ?? []), ...ids]),
        lastUserIntent: "upload_product_images"
      });
      setSection("chat");
    }
  }

  async function attachImageStudioFiles(files: FileList | File[]) {
    const ids = await uploadFiles(files);
    if (ids.length) {
      setWorkflowForm((current) => ({
        ...current,
        assetIds: uniqueIds([...current.assetIds, ...ids]),
        imageSource: "product",
        generateImages: true
      }));
      void patchWorkspace({
        productImageIds: uniqueIds([...(workspace?.productImageIds ?? []), ...ids]),
        lastUserIntent: "upload_product_images"
      });
      setSection("imageStudio");
    }
  }

  async function attachPostStudioReferenceFiles(files: FileList | File[]) {
    const ids = await uploadFiles(files);
    if (ids.length) {
      setWorkflowForm((current) => ({
        ...current,
        assetIds: uniqueIds([...current.assetIds, ...ids]),
        imageSource: "product"
      }));
      await patchWorkspace({
        productImageIds: uniqueIds([...(workspace?.productImageIds ?? []), ...ids]),
        lastUserIntent: "upload_product_images"
      });
      focusPostStudioTab("references");
      setNotice(`已把 ${ids.length} 张图片加入当前 PostProject 参考图。需要作为发布图时，在右侧点选即可。`);
    }
  }

  async function generateProductAsset(
    assetIds: string[],
    options: { allowEmpty?: boolean; evidenceContext?: string } = {}
  ) {
    if (!assetIds.length && !options.allowEmpty) {
      setNotice("请先选择产品图");
      return;
    }

    setBusy("asset-generate");
    try {
      const data = (await clientApi("/api/assets/generate", {
        method: "POST",
        body: JSON.stringify({
          assetIds,
          ...assetForm,
          evidenceContext: options.evidenceContext
        })
      })) as { asset: AssetRecord; prompt: string };
      await loadAssets();
      setPublishAssetIds((current) => uniqueIds([data.asset.id, ...current]));
      await patchWorkspace({
        selectedImageIds: uniqueIds([data.asset.id, ...(workspace?.selectedImageIds ?? [])]),
        productImageIds: assetIds.length
          ? uniqueIds([...(workspace?.productImageIds ?? []), ...assetIds])
          : workspace?.productImageIds ?? [],
        lastUserIntent: "generate_images"
      });
      setNotice(assetIds.length ? "产品场景图已生成" : "原创图片已生成");
    } finally {
      setBusy(null);
    }
  }

  async function generateCardAssets() {
    const fallbackDraft = currentDraft?.draft ?? workspace?.currentDraft?.draft ?? null;
    const title = cardForm.title.trim() || fallbackDraft?.title || "";
    const body = cardForm.body.trim() || fallbackDraft?.content || "";
    const tags = parseTagsText(cardForm.tagsText || fallbackDraft?.tags.map((tag) => `#${tag}`).join(" ") || "");

    if (!title.trim() || !body.trim()) {
      setNotice("请先填写卡片标题和正文，或先生成一篇草稿。");
      return;
    }

    setBusy("card-generate");
    try {
      const data = (await clientApi("/api/assets/cards", {
        method: "POST",
        body: JSON.stringify({
          title,
          subtitle: cardForm.subtitle,
          body,
          tags,
          theme: cardForm.theme,
          mode: cardForm.mode,
          width: cardForm.width,
          height: cardForm.height
        })
      })) as { assets: AssetRecord[] };
      const ids = data.assets.map((asset) => asset.id);
      await loadAssets();
      setPublishAssetIds((current) => uniqueIds([...ids, ...current]));
      await patchWorkspace({
        selectedImageIds: uniqueIds([...ids, ...(workspace?.selectedImageIds ?? [])]),
        lastUserIntent: "generate_card_images"
      });
      setNotice(`已生成 ${ids.length} 张图文卡片，并加入成果画布和发布装配台。`);
    } finally {
      setBusy(null);
    }
  }

  async function deleteAsset(id: string) {
    await clientApi(`/api/assets/${id}`, { method: "DELETE" });
    await loadAssets();
  }

  async function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitChatMessage(chatInput, false, chatAssetIds);
  }

  async function submitChatMessage(message: string, switchToChat = false, assetIds: string[] = []) {
    const content =
      message.trim() ||
      (assetIds.length
        ? "请分析我上传的产品图/参考图，并结合当前研究证据给出文案和图片创作建议"
        : "");
    if (!content) return;

    const requestWorkspaceId = workspaceIdRef.current;
    const requestConversationId = activeConversationIdRef.current;
    const attachedNames = assets.filter((asset) => assetIds.includes(asset.id)).map((asset) => asset.name);
    const userMessage: ChatMessage = {
      role: "user",
      content: attachedNames.length ? `${content}\n\n已附图：${attachedNames.join("、")}` : content,
      createdAt: new Date().toISOString()
    };
    setMessages((current) => [...current, userMessage]);
    setChatInput("");
    setChatAssetIds([]);
    if (switchToChat) {
      setSection("chat");
    }
    setBusy("chat");

    try {
      const data = (await clientApi("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: content, conversationId: activeConversationId, assetIds })
      })) as {
        answer: string;
        cards?: ChatMessage["cards"];
        quickActions?: ChatMessage["quickActions"];
        toolTrace?: ChatMessage["toolTrace"];
        questions?: string[];
        intent?: string;
        intentConfidence?: number;
        needsUserInput?: boolean;
        stage?: PostProject["currentStage"];
        workflowResult?: WorkflowResult;
        currentDraft?: DraftRecord;
        job?: JobRecord;
        conversation?: ChatConversation;
      };
      if (requestWorkspaceId !== workspaceIdRef.current || requestConversationId !== activeConversationIdRef.current) {
        return;
      }
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.answer,
        createdAt: new Date().toISOString(),
        workflowResult: data.workflowResult,
        cards: data.cards,
        quickActions: data.quickActions,
        toolTrace: data.toolTrace,
        questions: data.questions,
        intent: data.intent,
        intentConfidence: data.intentConfidence,
        needsUserInput: data.needsUserInput,
        stage: data.stage
      };
      setMessages((current) => [...current, assistantMessage]);
      if (data.workflowResult) {
        applyWorkflowResult(data.workflowResult);
      }
      if (data.currentDraft) {
        applyCurrentDraft(data.currentDraft);
      }
      if (data.conversation) {
        setActiveConversationId(data.conversation.id);
        setMessages(mergeLatestAssistantMeta(data.conversation.messages, assistantMessage));
        setChatConversations((current) => [
          { ...data.conversation!, messages: mergeLatestAssistantMeta(data.conversation!.messages, assistantMessage) },
          ...current.filter((conversation) => conversation.id !== data.conversation!.id)
        ]);
      }
      if (data.job) {
        setActiveJobId(data.job.id);
        setAutoReturnTarget("chat");
        setAutoReturnJobId(data.job.id);
        setJobs((current) => [data.job!, ...current.filter((job) => job.id !== data.job!.id)]);
        setNotice("后台 Agent 任务已创建，结果会同步到右侧成果画布。");
      }
      await loadHistory();
      await loadChatHistory();
      await loadWorkspace();
      await loadPostProject();
      await loadCreatorMemory();
    } finally {
      setBusy(null);
    }
  }

  function mergeLatestAssistantMeta(conversationMessages: ChatMessage[], assistantMessage: ChatMessage): ChatMessage[] {
    if (!conversationMessages.length) return conversationMessages;
    const lastAssistantIndex = [...conversationMessages].reverse().findIndex((message) => message.role === "assistant");
    if (lastAssistantIndex < 0) return conversationMessages;
    const index = conversationMessages.length - 1 - lastAssistantIndex;
    return conversationMessages.map((message, messageIndex) =>
      messageIndex === index
        ? {
            ...message,
            workflowResult: message.workflowResult ?? assistantMessage.workflowResult,
            cards: message.cards ?? assistantMessage.cards,
            quickActions: message.quickActions ?? assistantMessage.quickActions,
            toolTrace: message.toolTrace ?? assistantMessage.toolTrace,
            questions: message.questions ?? assistantMessage.questions,
            intent: message.intent ?? assistantMessage.intent,
            intentConfidence: message.intentConfidence ?? assistantMessage.intentConfidence,
            needsUserInput: message.needsUserInput ?? assistantMessage.needsUserInput,
            stage: message.stage ?? assistantMessage.stage
          }
        : message
    );
  }

  function selectConversation(conversation: ChatConversation) {
    setActiveConversationId(conversation.id);
    setMessages(conversation.messages);
  }

  async function resetActiveWorkspace(seed: Partial<WorkspaceState> = {}) {
    const data = (await clientApi("/api/agent/workspace/reset", {
      method: "POST",
      body: JSON.stringify(seed)
    })) as { workspace: WorkspaceState; postProject?: PostProject };
    setWorkspace(data.workspace);
    if (data.postProject) {
      setPostProject(data.postProject);
    } else {
      setPostProject(null);
    }
    setWorkflowResult(null);
    setResearchResult(null);
    setCurrentDraft(null);
    setPublishDraft({ title: "", content: "", tagsText: "", imagePrompt: "" });
    setCanvasDirty(false);
    setPublishAssetIds([]);
    setPublishVisibility(settings.defaultVisibility);
    setPublishScheduleAt("");
    setPublishStatus("");
    setPendingPublish(null);
    setDismissedPublishIntentId(null);
    setActiveJobId(null);
    setSelectedRunId(null);
    setPostStudioFocus(null);
    setAutoReturnJobId(null);
    setAutoReturnTarget("flow");
    setWorkflowForm((current) =>
      resetWorkflowFormForNewProject(current, {
        topic: seed.topic,
        defaultVisibility: settings.defaultVisibility
      })
    );
    setAssetForm((current) => ({
      ...current,
      productName: "",
      sellingPoints: "",
      extraPrompt: ""
    }));
    setCardForm((current) => ({
      ...current,
      title: "",
      subtitle: "",
      body: "",
      tagsText: ""
    }));
    setChatAssetIds([]);
    return data.workspace;
  }

  async function startNewConversation() {
    await resetActiveWorkspace({ lastUserIntent: "start_new_conversation" });
    setActiveConversationId(null);
    setMessages([]);
    setChatInput("");
    setSection("chat");
    setNotice(noticeForProjectReset("conversation"));
  }

  async function startNewProject() {
    await resetActiveWorkspace({ lastUserIntent: "start_new_project" });
    setActiveConversationId(null);
    setMessages([]);
    setSection("flow");
    setNotice(noticeForProjectReset("project"));
  }

  async function rememberCurrentPreference(text: string) {
    const now = new Date().toISOString();
    const memoryItem = {
      text,
      confidence: "explicit",
      count: 1,
      updatedAt: now,
      source: "draft"
    };
    const data = (await clientApi("/api/agent/memory", {
      method: "PATCH",
      body: JSON.stringify({
        liked: [memoryItem, ...(creatorMemory?.liked ?? [])]
      })
    })) as { memory: CreatorMemoryProfile };
    setCreatorMemory(data.memory);
    setNotice("已记住这次偏好，后续创作会把它作为稳定偏好参考。");
  }

  function openCopyWorkspaceFromEvidence(brief?: string) {
    const source = researchResult ?? workflowResult;
    const copyBrief = buildCopyCreativeBrief(source, brief);
    setChatInput(buildDraftPromptFromBrief(copyBrief));
    setSection("chat");
    setNotice("已把精简文案简报放入输入框，确认或补充后再发送给 AI。");
  }

  function openImageStudioFromEvidence(brief?: string) {
    const source = researchResult ?? workflowResult;
    const imageBrief = buildImageCreativeBrief(source, brief);
    setAssetForm((current) => ({
      ...current,
      extraPrompt: imageBrief || current.extraPrompt
    }));
    setSection("imageStudio");
    setNotice("已带入图片创作简报，只包含图片风格和生成要求。");
  }

  async function openPublishAssembly(draft?: NonNullable<WorkflowResult["draft"]>) {
    if (draft) {
      applyDraftToPublish(draft, publishVisibility);
      await commitCanvasToProject({
        title: draft.title,
        content: draft.content,
        tagsText: draft.tags.map((tag) => `#${tag}`).join(" "),
        imagePrompt: draft.imagePrompt
      });
    } else {
      await commitCanvasToProject();
    }
    setSection("publish");
    setNotice("请在发布装配台确认文案、图片、可见范围和发布时间。");
  }

  async function openPublishAssemblyFromWorkspace(options: { stayInStudio?: boolean } = {}) {
    const draftRecord = workspace?.currentDraft ?? currentDraft;
    const selectedImageIds = workspace?.selectedImageIds?.length ? workspace.selectedImageIds : publishAssetIds;
    if (draftRecord) {
      applyDraftToPublish(draftRecord.draft, draftRecord.visibility);
    }
    if (workspace?.selectedImageIds?.length) {
      setPublishAssetIds(workspace.selectedImageIds);
    }
    await commitCanvasToProject(
      draftRecord
        ? {
            title: draftRecord.draft.title,
            content: draftRecord.draft.content,
            tagsText: draftRecord.draft.tags.map((tag) => `#${tag}`).join(" "),
            imagePrompt: draftRecord.draft.imagePrompt
          }
        : {},
      selectedImageIds
    );
    if (options.stayInStudio) {
      focusPostStudioTab("publish");
      setNotice("已在 Post Studio 内聚焦发布检查。确认文案、图片、账号、可见范围和时间后再生成确认单。");
    } else {
      setSection("publish");
      setNotice("已把当前草稿和已选图片带到发布装配台。");
    }
  }

  async function submitFinalPublish(scheduleAt?: string) {
    setBusy("publish");
    setPublishStatus("");
    setPendingPublish(null);
    try {
      await commitCanvasToProject();
      const publishPayload: PublishPayload = {
        title: publishDraft.title,
        content: publishDraft.content,
        tags: parseTagsText(publishDraft.tagsText),
        assetIds: publishAssetIds,
        visibility: publishVisibility,
        scheduleAt: normalizeLocalDatetimeForApi(scheduleAt),
        imagePrompt: publishDraft.imagePrompt
      };
      let data = (await clientApi("/api/publish", {
        method: "POST",
        body: JSON.stringify(publishPayload)
      })) as {
        status?: "published" | "scheduled";
        publishResult?: unknown;
        currentDraft?: DraftRecord;
        requiresConfirmation?: boolean;
        publishIntent?: { id?: string };
      };
      if (data.requiresConfirmation && data.publishIntent?.id) {
        const activeAccount =
          settings.accounts.find((account) => account.id === settings.activeAccountId) ?? settings.accounts[0];
        setDismissedPublishIntentId(null);
        setPendingPublish({
          payload: publishPayload,
          publishIntentId: data.publishIntent.id,
          mode: publishPayload.scheduleAt ? "schedule" : "now",
          createdAt: new Date().toISOString(),
          accountId: settings.activeAccountId,
          accountDisplayName: activeAccount?.displayName ?? "当前小红书账号",
          mcpUrl: settings.mcpUrl,
          loginName: health?.activeAccount?.loginName
        });
        setPublishStatus("已生成发布确认单。确认后才会真实提交到小红书。");
        setNotice("发布前确认单已生成，请在发布装配台确认。");
        return;
      }
      if (data.currentDraft) {
        applyCurrentDraft(data.currentDraft);
      }
      await loadWorkspace();
      await loadPostProject();
      await loadPublishAudit();
      setPublishStatus(data.status === "scheduled" ? "已提交定时发布" : "已提交立即发布");
      setNotice(data.status === "scheduled" ? "定时发布已提交" : "发布已提交");
    } finally {
      setBusy(null);
    }
  }

  async function confirmPendingPublish() {
    if (!pendingPublish) {
      return;
    }

    setBusy("publish");
    setPublishStatus("");
    try {
      await commitCanvasToProject();
      const data = (await clientApi("/api/publish", {
        method: "POST",
        body: JSON.stringify({
          ...pendingPublish.payload,
          confirmed: true,
          publishIntentId: pendingPublish.publishIntentId
        })
      })) as {
        status?: "published" | "scheduled";
        publishResult?: unknown;
        currentDraft?: DraftRecord;
        requiresConfirmation?: boolean;
        publishIntent?: { id?: string };
      };

      if (data.requiresConfirmation) {
        setPublishStatus("确认单已过期或内容发生变化，请重新生成发布确认。");
        setNotice("发布确认失败，请重新检查内容后再提交。");
        return;
      }

      if (data.currentDraft) {
        applyCurrentDraft(data.currentDraft);
      }
      setPendingPublish(null);
      await loadWorkspace();
      await loadPostProject();
      await loadPublishAudit();
      setPublishStatus(data.status === "scheduled" ? "已提交定时发布" : "已提交立即发布");
      setNotice(data.status === "scheduled" ? "定时发布已提交" : "发布已提交");
    } finally {
      setBusy(null);
    }
  }

  function cancelPendingPublish() {
    if (pendingPublish?.publishIntentId) {
      setDismissedPublishIntentId(pendingPublish.publishIntentId);
    }
    setPendingPublish(null);
    setPublishStatus("已取消本次发布确认。内容和图片仍保留在发布装配台。");
  }

  async function viewJobResult(job: JobRecord) {
    if (job.result) {
      if (!isJobForWorkspace(job, workspace)) {
        setActiveJobId(job.id);
        setSection("jobs");
        setNotice("这个任务属于其他 PostProject，已保留在任务历史中；点击“恢复为当前项目”后才会导入，避免覆盖当前画布。");
        return;
      }
      setWorkflowResult(job.result);
      if (job.result.status === "research_ready" || job.result.researchSummary) {
        setResearchResult(job.result);
      }
      setActiveJobId(job.id);
      setSection("flow");
      await loadWorkspace();
      await loadPostProject();
      setNotice("已把任务结果带回 Post Studio，可以继续生成 CreativeBrief、文案或图片。");
    }
  }

  async function restoreJobResult(job: JobRecord) {
    if (!job.result) return;
    setBusy("jobs");
    try {
      const data = (await clientApi(`/api/jobs/${job.id}`, {
        method: "POST",
        body: JSON.stringify({ action: "restore" })
      })) as {
        job: JobRecord;
        workspace: WorkspaceState;
        postProject: PostProject;
        workflowResult: WorkflowResult;
      };
      setWorkspace(data.workspace);
      setPostProject(data.postProject);
      setWorkflowResult(data.workflowResult);
      if (data.workflowResult.status === "research_ready" || data.workflowResult.researchSummary) {
        setResearchResult(data.workflowResult);
      }
      setCurrentDraft(data.workspace.currentDraft ?? null);
      if (data.workspace.currentDraft) {
        applyCurrentDraft(data.workspace.currentDraft);
      } else {
        setPublishDraft({ title: "", content: "", tagsText: "", imagePrompt: "" });
      }
      setPublishAssetIds(data.workspace.selectedImageIds ?? []);
      setActiveJobId(data.job.id);
      setAutoReturnJobId(null);
      setSection("flow");
      focusPostStudioTab(data.workflowResult.draft ? "generated" : "evidence");
      await loadJobs();
      setNotice("已把历史任务恢复为当前 PostProject。现在可以在 Post Studio 继续生成 CreativeBrief、文案、图片或发布检查。");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell
      section={section}
      settings={settings}
      health={health}
      settingsBusy={settingsBusy}
      modelReady={modelReady}
      imageReady={imageReady}
      jobs={jobs}
      assets={assets}
      currentDraft={currentDraft}
      notice={notice}
      onNavigate={setSection}
      onRefreshHealth={() => void checkHealth()}
      onSwitchAccount={(accountId) => void switchActiveAccount(accountId)}
      ribbon={
          <WorkflowRibbon
            activeSection={section}
            researchReady={workflowRibbonState.researchReady}
            draftReady={workflowRibbonState.draftReady}
            imageReady={workflowRibbonState.imageReady}
            publishReady={workflowRibbonState.publishReady}
            runningCount={workflowRibbonState.runningCount}
            onNavigate={setSection}
          />
      }
    >

        {section === "flow" ? (
          <PostStudioPanel
            project={postProject}
            workspace={workspace}
            workflowResult={workflowResultForDisplay}
            researchForm={workflowForm}
            messages={messages}
            chatInput={chatInput}
            busy={Boolean(busy)}
            assets={assets}
            publishDraft={publishDraft}
            publishAssetIds={publishAssetIds}
            publishVisibility={publishVisibility}
            publishScheduleAt={publishScheduleAt}
            canvasDirty={canvasDirty}
            pendingPublish={pendingPublish}
            settings={settings}
            health={health}
            jobs={jobs}
            viralCases={viralCases}
            creatorMemory={creatorMemory}
            focusTab={postStudioFocus}
            onResearchFormChange={(next) => setWorkflowForm((current) => ({ ...current, ...next }))}
            onRunResearch={(event) => void runWorkflow(event)}
            onChatInput={setChatInput}
            onChatSubmit={(event) => void sendChat(event)}
            onDraftChange={handlePublishDraftChange}
            onCommitCanvas={() => void commitCanvasToProject()}
            onNewProject={() => void startNewProject()}
            onGenerateCopy={(message) => void submitChatMessage(message, true)}
            onQuickAction={(action) => void handlePostStudioAction(action)}
            onSelectCopyVersion={(versionId) => void selectCopyVersion(versionId)}
            onSelectImagePromptVersion={(versionId) => void selectImagePromptVersion(versionId)}
            onSelectPostImages={(ids) => void selectPostImages(ids)}
            onSaveToViralLibrary={(sample) => void saveSampleToViralLibrary(sample)}
            onSaveManyToViralLibrary={(samples) => void saveSamplesToViralLibrary(samples)}
            onReloadViralLibrary={() => void loadViralKnowledge()}
            onSearchViralLibrary={(filters) => void loadViralKnowledge(filters)}
            onRefreshViralEvidence={() => void handlePostStudioAction("retrieve_viral_knowledge")}
            onOpenImageStudio={() => setSection("imageStudio")}
            onUploadReferenceFiles={(files) => void attachPostStudioReferenceFiles(files)}
            onOpenPublish={() => void openPublishAssemblyFromWorkspace({ stayInStudio: true })}
            onPreparePublish={() => void submitFinalPublish(publishScheduleAt)}
            onVisibilityChange={(value) => {
              setPendingPublish(null);
              setPublishVisibility(value);
            }}
            onScheduleAtChange={(value) => {
              setPendingPublish(null);
              setPublishScheduleAt(value);
            }}
            onConfirmPublish={() => void confirmPendingPublish()}
            onCancelPublish={() => cancelPendingPublish()}
            onNavigate={setSection}
          />
        ) : null}

        {section === "dashboard" ? (
          <Dashboard
            health={health}
            modelReady={modelReady}
            imageReady={imageReady}
            latestRun={latestRun}
            busy={activeBusy}
            onRefresh={() => void checkHealth()}
          />
        ) : null}

        {section === "workflow" ? (
          <WorkflowPanel
            form={workflowForm}
            busy={busy === "workflow"}
            result={workflowResultForDisplay}
            onChange={setWorkflowForm}
            onSubmit={(event) => void runWorkflow(event)}
            onDraftCommand={(message) => void submitChatMessage(message, true)}
            onCopyStudio={(brief) => openCopyWorkspaceFromEvidence(brief)}
            onImageStudio={(brief) => openImageStudioFromEvidence(brief)}
            onOpenPublish={(draft) => void openPublishAssembly(draft)}
          />
        ) : null}

        {section === "jobs" ? (
          <JobsPanel
            jobs={jobs}
            activeJob={activeJob}
            workspace={workspace}
            onReload={() => void loadJobs()}
            onSelectJob={(job) => setActiveJobId(job.id)}
            onViewResult={viewJobResult}
            onRestoreResult={(job) => void restoreJobResult(job)}
            onOpenImageStudio={() => openImageStudioFromEvidence()}
          />
        ) : null}

        {section === "assets" ? (
          <AssetsPanel
            assets={assets}
            assetForm={assetForm}
            busy={busy}
            selectedIds={workflowForm.assetIds}
            onAssetFormChange={setAssetForm}
            onUpload={(event) => void uploadAsset(event)}
            onGenerate={() => void generateProductAsset(workflowForm.assetIds)}
            onDelete={(id) => void deleteAsset(id)}
            onToggleSelect={(id) =>
              setWorkflowForm((current) => ({
                ...current,
                assetIds: current.assetIds.includes(id)
                  ? current.assetIds.filter((assetId) => assetId !== id)
                  : [...current.assetIds, id],
                imageSource: "product",
                generateImages: true
              }))
            }
          />
        ) : null}

        {section === "imageStudio" ? (
          <ImageStudioPanel
            assets={assets}
            selectedIds={workflowForm.assetIds}
            assetForm={assetForm}
            cardForm={cardForm}
            mode={imageStudioMode}
            busy={busy}
            evidenceContext={buildClientEvidenceContext(researchResult ?? workflowResult)}
            onAssetFormChange={setAssetForm}
            onCardFormChange={setCardForm}
            onModeChange={setImageStudioMode}
            onUploadFiles={(files) => void attachImageStudioFiles(files)}
            onGenerate={() =>
              void generateProductAsset(workflowForm.assetIds, {
                allowEmpty: true,
                evidenceContext: buildClientEvidenceContext(researchResult ?? workflowResult)
              })
            }
            onGenerateCards={() => void generateCardAssets()}
            onToggleSelect={(id) =>
              setWorkflowForm((current) => ({
                ...current,
                assetIds: current.assetIds.includes(id)
                  ? current.assetIds.filter((assetId) => assetId !== id)
                  : [...current.assetIds, id],
                imageSource: "product",
                generateImages: true
              }))
            }
            onGoChat={() => setSection("chat")}
            onOpenPublish={() => void openPublishAssembly()}
          />
        ) : null}

        {section === "chat" ? (
          <ChatPanel
            assets={assets}
            attachedAssetIds={chatAssetIds}
            conversations={chatConversations}
            activeConversationId={activeConversationId}
            messages={messages}
            input={chatInput}
            busy={busy === "chat"}
            currentDraft={currentDraft}
            workspace={workspace}
            postProject={postProject}
            creatorMemory={creatorMemory}
            jobs={jobs}
            onInput={setChatInput}
            onSubmit={(event) => void sendChat(event)}
            onAttachFiles={(files) => void attachChatFiles(files)}
            onToggleAsset={(id) =>
              setChatAssetIds((current) =>
                current.includes(id) ? current.filter((assetId) => assetId !== id) : [...current, id]
              )
            }
            onRemoveAsset={(id) => setChatAssetIds((current) => current.filter((assetId) => assetId !== id))}
            onSelectConversation={selectConversation}
            onNewConversation={() => void startNewConversation()}
            onDraftCommand={(message) => void submitChatMessage(message, true)}
            onOpenCopyWorkspace={(brief) => openCopyWorkspaceFromEvidence(brief)}
            onOpenImageStudio={() => openImageStudioFromEvidence()}
            onOpenPublish={(draft) => void openPublishAssembly(draft)}
            onOpenPublishFromWorkspace={() => void openPublishAssemblyFromWorkspace()}
          />
        ) : null}

        {section === "publish" ? (
          <PublishAssemblyPanel
            assets={assets}
            settings={settings}
            health={health}
            draft={publishDraft}
            selectedAssetIds={publishAssetIds}
            visibility={publishVisibility}
            scheduleAt={publishScheduleAt}
            status={publishStatus}
            pendingPublish={pendingPublish}
            postProject={postProject}
            busy={busy === "publish"}
            onDraftChange={handlePublishDraftChange}
            onToggleAsset={(id) =>
              {
                setPendingPublish(null);
                const nextIds = publishAssetIds.includes(id)
                  ? publishAssetIds.filter((assetId) => assetId !== id)
                  : [...publishAssetIds, id];
                void selectPostImages(nextIds);
              }
            }
            onVisibilityChange={(value) => {
              setPendingPublish(null);
              setPublishVisibility(value);
            }}
            onScheduleAtChange={(value) => {
              setPendingPublish(null);
              setPublishScheduleAt(value);
            }}
            onPublishNow={() => void submitFinalPublish()}
            onSchedule={() => void submitFinalPublish(publishScheduleAt)}
            onConfirmPublish={() => void confirmPendingPublish()}
            onCancelPublish={() => cancelPendingPublish()}
            onGoCopy={() => setSection("chat")}
            onGoImage={() => setSection("imageStudio")}
          />
        ) : null}

        {section === "audit" ? (
          <PublishAuditPanel audits={publishAudits} onReload={() => void loadPublishAudit()} />
        ) : null}

        {section === "history" ? (
          <HistoryPanel
            runs={runs}
            selectedRunId={selectedRunId}
            onSelectRun={setSelectedRunId}
            onReload={() => void loadHistory()}
            onDraftCommand={(message) => void submitChatMessage(message, true)}
            onCopyStudio={(brief) => openCopyWorkspaceFromEvidence(brief)}
            onImageStudio={(brief) => openImageStudioFromEvidence(brief)}
            onOpenPublish={(draft) => openPublishAssembly(draft)}
          />
        ) : null}

        {section === "settings" ? (
          <SettingsPanel
            settings={settings}
            draft={settingsDraft}
            busy={settingsBusy === "settings"}
            onChange={setSettingsDraft}
            onSubmit={(event) => void saveSettings(event)}
          />
        ) : null}
    </AppShell>
  );
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
