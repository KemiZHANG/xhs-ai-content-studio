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
import { clientApi, clientFormDataApi, getClientActionToken } from "@/app/client/api";
import { useJobStream } from "@/app/hooks/use-job-stream";
import { useSettingsHealth } from "@/app/hooks/use-settings-health";
import { defaultSettings } from "@/app/config/default-settings";
import {
  buildWorkflowRibbonState,
  hasRunningJobs as hasRunningJobsInList,
  selectActiveJob,
  selectWorkflowResultForDisplay
} from "@/app/state/page-derived";
import { buildPageJobsSnapshotPlan } from "@/app/state/page-jobs";
import { shouldAutoOpenLatestConversation } from "@/app/state/chat-history-selection";
import { noticeForProjectReset, resetWorkflowFormForNewProject } from "@/app/state/project-reset";
import { formatViralSaveError } from "@/app/state/viral-save";
import { isJobForWorkspace } from "@/lib/jobs/context";
import { buildPublishVersionSnapshot } from "@/lib/post-project/versioning";

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
    topic: "",
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
  const [chatInput, setChatInput] = useState("");
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
      health,
      currentVersionSnapshot: postProject ? buildPublishVersionSnapshot(postProject) : undefined
    });
    if (!hydrated) {
      setPendingPublish(null);
      return;
    }
    if (hydrated.publishIntentId === dismissedPublishIntentId) {
      return;
    }
    setPendingPublish((current) =>
      current?.publishIntentId === hydrated.publishIntentId ? current : hydrated
    );
  }, [
    dismissedPublishIntentId,
    health?.activeAccount?.loginName,
    postProject?.copyDraft?.id,
    postProject?.finalPost?.copyVersionId,
    postProject?.qualityCheck?.checkedAt,
    postProject?.selectedImages.join("|"),
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
    const plan = buildPageJobsSnapshotPlan({
      nextJobs,
      streamedWorkspace,
      streamedPostProject,
      currentWorkspace: workspace,
      autoReturnJobId,
      autoReturnTarget,
      currentWorkflowResult: workflowResult
    });
    if (plan.applyStreamedWorkspace) {
      setWorkspace(plan.applyStreamedWorkspace);
      if (plan.applyStreamedWorkspace.currentDraft) {
        applyCurrentDraft(plan.applyStreamedWorkspace.currentDraft);
      } else {
        setCurrentDraft(null);
        setPublishDraft({ title: "", content: "", tagsText: "", imagePrompt: "" });
      }
      setPublishAssetIds(plan.applyStreamedWorkspace.selectedImageIds ?? []);
    }
    if (plan.applyStreamedPostProject) {
      setPostProject(plan.applyStreamedPostProject);
    }
    if (plan.autoReturn) {
      applyWorkflowResult(plan.autoReturn.job.result!);
      setActiveJobId(plan.autoReturn.job.id);
      setAutoReturnJobId(null);
      setSection(plan.autoReturn.targetSection);
      setNotice(plan.autoReturn.notice);
      await loadWorkspace();
      await loadPostProject();
      if (plan.autoReturn.reloadCurrentDraft) {
        await loadCurrentDraft();
      }
      return;
    }
    if (plan.clearAutoReturn) {
      setAutoReturnJobId(null);
    }
    if (plan.latestResult?.target === "workflow") {
      applyWorkflowResult(plan.latestResult.result);
    } else if (plan.latestResult?.target === "research") {
      setResearchResult(plan.latestResult.result);
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

  async function focusEvidenceIds(ids: string[]) {
    const focusedEvidenceIds = uniqueIds(ids);
    const data = (await clientApi("/api/post-project", {
      method: "PATCH",
      body: JSON.stringify({ action: "focus_evidence", focusedEvidenceIds })
    })) as { project: PostProject };
    setPostProject(data.project);
    setPendingPublish(null);
    setNotice(focusedEvidenceIds.length
      ? `已设置 ${focusedEvidenceIds.length} 条本次重点规律，后续 Brief、文案和图片方向会优先围绕它们。`
      : "已清空本次重点规律。");
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
    } catch (error) {
      setNotice(formatViralSaveError(error));
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
    const topic = workflowForm.topic.trim();
    if (!topic) {
      setChatInput("我想新建一篇小红书帖子。主题是：；目标人群是：；内容目标是：。请先帮我整理还缺哪些信息，再开始搜索真实笔记。");
      focusPostStudioTab("insights");
      setNotice("先补充主题再开始研究。Agent 输入框里已放好需求模板，避免创建空主题任务。");
      return;
    }
    setBusy("workflow");
    setNotice("");
    try {
      await resetActiveWorkspace({
        topic,
        lastUserIntent: "start_research"
      });
      const researchInput = {
        ...workflowForm,
        topic,
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
      case "confirm_visual_direction":
        await submitChatMessage("确认图片方向，就按当前视觉方向继续。", false);
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
      const data = (await clientApi("/api/post-project", {
        method: "PATCH",
        body: JSON.stringify({
          action: "update_reference_assets",
          referenceAssetIds: uniqueIds([...(postProject?.productInfo?.referenceAssetIds ?? workspace?.productImageIds ?? []), ...ids])
        })
      })) as { project: PostProject };
      setPostProject(data.project);
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
      const nextSelectedImageIds = uniqueIds([data.asset.id, ...(workspace?.selectedImageIds ?? [])]);
      setPublishAssetIds(nextSelectedImageIds);
      await patchWorkspace({
        selectedImageIds: nextSelectedImageIds,
        productImageIds: assetIds.length
          ? uniqueIds([...(workspace?.productImageIds ?? []), ...assetIds])
          : workspace?.productImageIds ?? [],
        lastUserIntent: "generate_images"
      });
      await selectPostImages(nextSelectedImageIds);
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
      const nextSelectedImageIds = uniqueIds([...ids, ...(workspace?.selectedImageIds ?? [])]);
      setPublishAssetIds(nextSelectedImageIds);
      await patchWorkspace({
        selectedImageIds: nextSelectedImageIds,
        lastUserIntent: "generate_card_images"
      });
      await selectPostImages(nextSelectedImageIds);
      setNotice(`已生成 ${ids.length} 张图文卡片，并加入 Post Studio 成果画布和发布候选图。`);
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
    const streamMessageId = `assistant-stream-${Date.now()}`;
    const streamingAssistant: ChatMessage = {
      id: streamMessageId,
      role: "assistant",
      content: "正在读取当前 PostProject、判断意图并准备工具调用...",
      createdAt: new Date().toISOString(),
      toolTrace: [
        {
          id: `${streamMessageId}-status`,
          label: "agent.stream",
          status: "running",
          detail: "等待 Agent 返回阶段、工具和结果卡片。",
          createdAt: new Date().toISOString()
        }
      ]
    };
    setMessages((current) => [...current, userMessage, streamingAssistant]);
    setChatInput("");
    setChatAssetIds([]);
    if (switchToChat) {
      setSection("chat");
    }
    setBusy("chat");

    try {
      const data = await requestChatTurn({
        content,
        conversationId: activeConversationId,
        assetIds,
        onStreamStatus: (status) => {
          setMessages((current) =>
            current.map((item) =>
              item.id === streamMessageId
                ? {
                    ...item,
                    content: status.message ?? `Agent 正在执行：${status.stage ?? "处理中"}`,
                    intent: status.intent ?? item.intent,
                    intentConfidence: status.intentConfidence ?? item.intentConfidence,
                    stage: status.stage && isPostStage(status.stage) ? status.stage : item.stage,
                    toolTrace: [
                      {
                        id: `${streamMessageId}-status`,
                        label: "agent.stream",
                        status: "running",
                        detail: buildStreamStatusDetail(status),
                        createdAt: new Date().toISOString()
                      }
                    ]
                  }
                : item
            )
          );
        }
      });
      if (requestWorkspaceId !== workspaceIdRef.current || requestConversationId !== activeConversationIdRef.current) {
        return;
      }
      const assistantMessage: ChatMessage = {
        id: streamMessageId,
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
      setMessages((current) =>
        current.some((item) => item.id === streamMessageId)
          ? current.map((item) => (item.id === streamMessageId ? assistantMessage : item))
          : [...current, assistantMessage]
      );
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

  function clearLocalWorkspaceState(seed: Partial<WorkspaceState> = {}) {
    setWorkspace(null);
    setPostProject(null);
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
  }

  async function resetActiveWorkspace(seed: Partial<WorkspaceState> = {}) {
    clearLocalWorkspaceState(seed);
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
    return data.workspace;
  }

  async function startNewConversation() {
    await resetActiveWorkspace({ lastUserIntent: "start_new_conversation" });
    setActiveConversationId(null);
    setMessages([]);
    setChatInput("");
    setSection("flow");
    focusPostStudioTab("insights");
    setNotice(noticeForProjectReset("conversation"));
  }

  async function startNewProject() {
    await resetActiveWorkspace({ lastUserIntent: "start_new_project" });
    setActiveConversationId(null);
    setMessages([]);
    setChatInput("");
    setSection("flow");
    focusPostStudioTab("insights");
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
    setSection("flow");
    setNotice("已把精简文案简报放入 Post Studio 输入框，确认或补充后再发送给 AI。");
  }

  function openImageStudioFromEvidence(brief?: string) {
    const source = researchResult ?? workflowResult;
    const imageBrief = buildImageCreativeBrief(source, brief);
    setAssetForm((current) => ({
      ...current,
      extraPrompt: imageBrief || current.extraPrompt
    }));
    setChatInput(
      [
        "请基于当前 PostProject 的证据、爆款库规律和 CreativeBrief 规划图片方向，并生成可执行的图片 Prompt，不要重新搜索。",
        imageBrief ? `图片简报：${imageBrief}` : "图片简报：请先提炼封面、正文图和产品/场景图方向。",
        "请说明参考了哪些视觉证据，并提醒我是否需要上传产品图或参考图。"
      ].join("\n")
    );
    setSection("flow");
    focusPostStudioTab("references");
    setNotice("已把图片创作简报放回 Post Studio。你可以上传产品图/参考图，或直接让 Agent 规划图片方向。");
  }

  async function openPublishAssembly(draft?: NonNullable<WorkflowResult["draft"]>, options: { stayInStudio?: boolean } = {}) {
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
    if (options.stayInStudio) {
      focusPostStudioTab("publish");
      setSection("flow");
      setNotice("已在 Post Studio 内聚焦发布检查。确认文案、图片、账号、可见范围和时间后再生成确认单。");
    } else {
      setSection("publish");
      setNotice("请在发布确认页核对文案、图片、可见范围和发布时间。");
    }
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
      setNotice("已把当前草稿和已选图片带到 Post Studio 发布检查。");
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
        setNotice("发布前确认单已生成，请在 Post Studio 发布检查中人工确认。");
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
    setPublishStatus("已取消本次发布确认。内容和图片仍保留在当前 Post Studio 项目中。");
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
            publishAudits={publishAudits}
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
            onFocusEvidenceIds={(ids) => void focusEvidenceIds(ids)}
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
            onRefreshHealth={() => void checkHealth()}
            onSwitchAccount={(accountId) => void switchActiveAccount(accountId)}
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
            onOpenPublish={(draft) => void openPublishAssembly(draft, { stayInStudio: true })}
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
            onGoChat={() => {
              setSection("flow");
              focusPostStudioTab("brief");
            }}
            onOpenPublish={() => void openPublishAssembly(undefined, { stayInStudio: true })}
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
            onOpenPublish={(draft) => void openPublishAssembly(draft, { stayInStudio: true })}
            onOpenPublishFromWorkspace={() => void openPublishAssemblyFromWorkspace({ stayInStudio: true })}
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
            onOpenPublish={(draft) => openPublishAssembly(draft, { stayInStudio: true })}
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

type ChatTurnResponse = {
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

type ChatStreamStatus = {
  stage?: string;
  message?: string;
  intent?: string;
  intentConfidence?: number;
  toolCount?: number;
  cardCount?: number;
};

async function requestChatTurn({
  content,
  conversationId,
  assetIds,
  onStreamStatus
}: {
  content: string;
  conversationId: string | null;
  assetIds: string[];
  onStreamStatus: (status: ChatStreamStatus) => void;
}): Promise<ChatTurnResponse> {
  const body = JSON.stringify({ message: content, conversationId, assetIds });
  try {
    const streamed = await requestChatTurnStream(body, onStreamStatus);
    if (streamed) return streamed;
  } catch {
    onStreamStatus({
      stage: "fallback",
      message: "流式连接不可用，已自动切回普通对话请求。"
    });
  }

  return clientApi<ChatTurnResponse>("/api/chat", {
    method: "POST",
    body
  });
}

async function requestChatTurnStream(
  body: string,
  onStreamStatus: (status: ChatStreamStatus) => void
): Promise<ChatTurnResponse | null> {
  const headers = new Headers({
    Accept: "text/event-stream",
    "Content-Type": "application/json"
  });
  const token = getClientActionToken();
  if (token) {
    headers.set("X-XHS-Action-Token", token);
  }

  const response = await fetch("/api/chat/stream", {
    method: "POST",
    headers,
    body
  });
  if (!response.ok || !response.body) {
    return null;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ChatTurnResponse | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: !done });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const eventText of events) {
        const event = parseSseEvent(eventText);
        if (!event) continue;
        if (event.event === "status") {
          onStreamStatus(event.data as ChatStreamStatus);
        } else if (event.event === "result") {
          result = event.data as ChatTurnResponse;
        } else if (event.event === "error") {
          const errorData = event.data as { error?: string };
          throw new Error(errorData.error || "流式对话执行失败");
        }
      }
    }
    if (done) break;
  }

  if (buffer.trim()) {
    const event = parseSseEvent(buffer);
    if (event?.event === "result") {
      result = event.data as ChatTurnResponse;
    }
  }

  return result;
}

function parseSseEvent(text: string): { event: string; data: unknown } | null {
  const lines = text.split(/\r?\n/);
  const event = lines.find((line) => line.startsWith("event:"))?.replace(/^event:\s*/, "").trim();
  const dataLines = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.replace(/^data:\s*/, ""));
  if (!event || !dataLines.length) return null;
  try {
    return {
      event,
      data: JSON.parse(dataLines.join("\n"))
    };
  } catch {
    return null;
  }
}

function buildStreamStatusDetail(status: ChatStreamStatus): string {
  const parts = [
    status.stage ? `阶段 ${status.stage}` : "",
    status.intent ? `意图 ${status.intent}` : "",
    status.intentConfidence !== undefined ? `置信度 ${Math.round(status.intentConfidence * 100)}%` : "",
    status.toolCount !== undefined ? `工具 ${status.toolCount}` : "",
    status.cardCount !== undefined ? `卡片 ${status.cardCount}` : ""
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : status.message ?? "Agent 正在执行。";
}

function isPostStage(value: string): value is PostProject["currentStage"] {
  return [
    "empty",
    "briefing",
    "researching",
    "evidence_ready",
    "brief_ready",
    "copy_drafting",
    "copy_ready",
    "visual_planning",
    "image_prompt_ready",
    "image_generating",
    "image_ready",
    "assembling",
    "reviewing",
    "scheduled",
    "published",
    "failed"
  ].includes(value);
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
