"use client";

import {
  ClipboardList,
  Database,
  FileCheck2,
  Layers3,
  MessageSquareText,
  RefreshCw,
  Rocket,
  Settings,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { buildCopyCreativeBrief, buildDraftPromptFromBrief, buildImageCreativeBrief } from "@/lib/workflows/creative-briefs";
import { modelProviderPresets } from "@/lib/models/presets";
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
import { AccountStatusCard } from "@/app/components/account-status-card";
import { PostStudioPanel } from "@/app/components/post-studio-panel";
import { ChatPanel } from "@/app/components/chat-workbench";
import { StatusPill } from "@/app/components/status-badges";
import { SettingsPanel } from "@/app/components/settings-panel";
import { PublishAssemblyPanel } from "@/app/components/publish-assembly-panel";
import { ImageStudioPanel } from "@/app/components/image-studio-panel";
import {
  buildClientEvidenceContext,
  normalizeLocalDatetimeForApi,
  subtitleForSection,
  titleForSection,
  uniqueIds
} from "@/app/components/xhs-display-utils";
import { clientApi, clientFormDataApi } from "@/app/client/api";
import { useJobStream } from "@/app/hooks/use-job-stream";
import { useSettingsHealth } from "@/app/hooks/use-settings-health";

import type {
  AssetRecord,
  CardPaginationMode,
  CardTheme,
  ChatConversation,
  ChatMessage,
  CreatorMemoryProfile,
  DraftRecord,
  Health,
  ImageStudioMode,
  JobRecord,
  PendingPublishConfirmation,
  PostProject,
  PublishAuditRecord,
  PublishDraftState,
  PublishPayload,
  RedactedSettings,
  Section,
  WorkflowResult,
  WorkflowRun,
  WorkspaceState
} from "@/app/types";

const navItems: Array<{ id: Section; label: string; icon: typeof ClipboardList }> = [
  { id: "flow", label: "Post Studio", icon: Layers3 },
  { id: "assets", label: "Assets", icon: Sparkles },
  { id: "audit", label: "Publish History", icon: ShieldCheck },
  { id: "settings", label: "模型设置", icon: Settings }
];

const defaultSettings: RedactedSettings = {
  mcpUrl: "http://localhost:18060/mcp",
  textBaseUrl: modelProviderPresets.gemini.text.textBaseUrl,
  textModel: modelProviderPresets.gemini.text.textModel,
  textApiKey: "missing",
  imageBaseUrl: modelProviderPresets.gemini.image.imageBaseUrl,
  imageModel: modelProviderPresets.gemini.image.imageModel,
  imageApiKey: "missing",
  actionToken: "",
  defaultVisibility: "仅自己可见",
  defaultAutoPublish: false,
  agentPublishPolicy: "review_required",
  dailyTextCallLimit: 80,
  dailyImageCallLimit: 20,
  maxResearchSamples: 12,
  activeAccountId: "local-default",
  accounts: [
    {
      id: "local-default",
      displayName: "默认小红书账号",
      mcpUrl: "http://localhost:18060/mcp",
      status: "unknown",
      createdAt: "2026-05-25T00:00:00.000Z",
      updatedAt: "2026-05-25T00:00:00.000Z"
    }
  ]
};

export default function Home() {
  const [section, setSection] = useState<Section>("flow");
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [publishAudits, setPublishAudits] = useState<PublishAuditRecord[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [autoReturnJobId, setAutoReturnJobId] = useState<string | null>(null);
  const [autoReturnTarget, setAutoReturnTarget] = useState<"flow" | "workflow" | "chat">("workflow");
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [postProject, setPostProject] = useState<PostProject | null>(null);
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
  const [publishAssetIds, setPublishAssetIds] = useState<string[]>([]);
  const [publishVisibility, setPublishVisibility] = useState<RedactedSettings["defaultVisibility"]>("仅自己可见");
  const [publishScheduleAt, setPublishScheduleAt] = useState("");
  const [publishStatus, setPublishStatus] = useState("");
  const [pendingPublish, setPendingPublish] = useState<PendingPublishConfirmation | null>(null);
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

  const latestRun = useMemo(() => runs[0], [runs]);
  const activeJob = useMemo(
    () => jobs.find((job) => job.id === activeJobId) ?? jobs[0],
    [activeJobId, jobs]
  );
  const hasRunningJobs = jobs.some((job) => job.status === "queued" || job.status === "running");
  const workflowResultForDisplay =
    workflowResult?.status === "research_ready" ? workflowResult : researchResult ?? workflowResult;

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
    const data = (await clientApi("/api/jobs")) as { jobs: JobRecord[] };
    await applyJobsSnapshot(data.jobs);
  }

  async function loadPublishAudit() {
    const data = (await clientApi("/api/publish/audit")) as { audit: PublishAuditRecord[] };
    setPublishAudits(data.audit);
  }

  async function applyJobsSnapshot(nextJobs: JobRecord[], streamedWorkspace?: WorkspaceState) {
    setJobs(nextJobs);
    if (streamedWorkspace) {
      setWorkspace(streamedWorkspace);
      if (streamedWorkspace.currentDraft) {
        applyCurrentDraft(streamedWorkspace.currentDraft);
      }
      setPublishAssetIds(streamedWorkspace.selectedImageIds ?? []);
    }
    const autoReturnJob = autoReturnJobId ? nextJobs.find((job) => job.id === autoReturnJobId) : null;
    if (autoReturnJob?.status === "completed" && autoReturnJob.result) {
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
    if (autoReturnJob?.status === "failed") {
      setAutoReturnJobId(null);
    }
    const latestCompleted = nextJobs.find((job) => job.status === "completed" && job.result);
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
    }
    setPublishAssetIds(data.workspace.selectedImageIds ?? []);
  }

  async function loadPostProject() {
    const data = (await clientApi("/api/post-project")) as { project: PostProject };
    setPostProject(data.project);
    return data.project;
  }

  async function loadCreatorMemory() {
    const data = (await clientApi("/api/agent/memory")) as { memory: CreatorMemoryProfile };
    setCreatorMemory(data.memory);
  }

  async function patchWorkspace(patch: Partial<WorkspaceState>) {
    const data = (await clientApi("/api/agent/workspace", {
      method: "PATCH",
      body: JSON.stringify(patch)
    })) as { workspace: WorkspaceState };
    setWorkspace(data.workspace);
    if (data.workspace.currentDraft) {
      applyCurrentDraft(data.workspace.currentDraft);
    }
    setPublishAssetIds(data.workspace.selectedImageIds ?? []);
    await loadPostProject();
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
  }

  async function loadChatHistory() {
    const data = (await clientApi("/api/chat/history")) as { conversations: ChatConversation[] };
    setChatConversations(data.conversations);
    if (!activeConversationId && data.conversations[0]) {
      setActiveConversationId(data.conversations[0].id);
      setMessages(data.conversations[0].messages);
    }
  }

  async function runWorkflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      })) as { job: JobRecord };
      setActiveJobId(data.job.id);
      setAutoReturnTarget(section === "flow" ? "flow" : "workflow");
      setAutoReturnJobId(data.job.id);
      setJobs((current) => [data.job, ...current.filter((job) => job.id !== data.job.id)]);
      setSection("jobs");
      setNotice("主题研究任务已创建，只会搜索和分析，不会生成草稿或发布。完成后会自动回到研究结果。");
    } finally {
      setBusy(null);
    }
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
        workflowResult?: WorkflowResult;
        currentDraft?: DraftRecord;
        job?: JobRecord;
        conversation?: ChatConversation;
      };
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.answer,
        createdAt: new Date().toISOString(),
        workflowResult: data.workflowResult
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
        setMessages(data.conversation.messages);
        setChatConversations((current) => [
          data.conversation!,
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

  function selectConversation(conversation: ChatConversation) {
    setActiveConversationId(conversation.id);
    setMessages(conversation.messages);
  }

  async function resetActiveWorkspace(seed: Partial<WorkspaceState> = {}) {
    const data = (await clientApi("/api/agent/workspace/reset", {
      method: "POST",
      body: JSON.stringify(seed)
    })) as { workspace: WorkspaceState };
    setWorkspace(data.workspace);
    setWorkflowResult(null);
    setResearchResult(null);
    setCurrentDraft(null);
    setPublishDraft({ title: "", content: "", tagsText: "", imagePrompt: "" });
    setPublishAssetIds([]);
    setPublishScheduleAt("");
    setPublishStatus("");
    setPendingPublish(null);
    setChatAssetIds([]);
    await loadPostProject();
    return data.workspace;
  }

  async function startNewConversation() {
    await resetActiveWorkspace({ lastUserIntent: "start_new_conversation" });
    setActiveConversationId(null);
    setMessages([]);
    setChatInput("");
    setSection("chat");
    setNotice("已开启干净的新对话，并清空当前工作区草稿、证据和发布计划。");
  }

  async function startNewProject() {
    await resetActiveWorkspace({ lastUserIntent: "start_new_project" });
    setActiveConversationId(null);
    setMessages([]);
    setSection("flow");
    setNotice("已新建干净的创作项目：研究证据、草稿、图片选择和发布计划已清空。");
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

  function openPublishAssembly(draft?: NonNullable<WorkflowResult["draft"]>) {
    if (draft) {
      applyDraftToPublish(draft, publishVisibility);
    }
    setSection("publish");
    setNotice("请在发布装配台确认文案、图片、可见范围和发布时间。");
  }

  function openPublishAssemblyFromWorkspace() {
    const draftRecord = workspace?.currentDraft ?? currentDraft;
    if (draftRecord) {
      applyDraftToPublish(draftRecord.draft, draftRecord.visibility);
    }
    if (workspace?.selectedImageIds?.length) {
      setPublishAssetIds(workspace.selectedImageIds);
    }
    setSection("publish");
    setNotice("已把当前草稿和已选图片带到发布装配台。");
  }

  async function submitFinalPublish(scheduleAt?: string) {
    setBusy("publish");
    setPublishStatus("");
    setPendingPublish(null);
    try {
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
    setPendingPublish(null);
    setPublishStatus("已取消本次发布确认。内容和图片仍保留在发布装配台。");
  }

  function viewJobResult(job: JobRecord) {
    if (job.result) {
      setWorkflowResult(job.result);
      setActiveJobId(job.id);
      setSection("workflow");
    }
  }

  return (
    <main className="appShell">
      <aside className="sidebar">
        <div className="brandBlock">
          <div className="brandMark">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="brandTitle">XHS AI Studio</div>
            <div className="brandSubtitle">本地内容中台</div>
          </div>
        </div>

        <nav className="navList" aria-label="主导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={section === item.id ? "navItem active" : "navItem"}
                onClick={() => setSection(item.id)}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <AccountStatusCard
          settings={settings}
          health={health}
          busy={settingsBusy === "health" || settingsBusy === "account-switch"}
          onRefresh={() => void checkHealth()}
          onManage={() => setSection("settings")}
          onSwitch={(accountId) => void switchActiveAccount(accountId)}
        />

        <div className="sidebarStatus">
          <StatusPill ok={modelReady} label={modelReady ? "文本模型已配置" : "缺少文本模型"} />
          <StatusPill ok={imageReady} label={imageReady ? "图片模型已配置" : "缺少图片模型"} />
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="titleBlock">
            <p className="eyebrow">Agent Content Operations</p>
            <h1>{titleForSection(section)}</h1>
            <p className="pageSubtitle">{subtitleForSection(section)}</p>
          </div>
          <div className="topbarActions">
            <div className="topbarStats" aria-label="当前工作区状态">
              <span>
                <strong>{jobs.filter((job) => job.status === "queued" || job.status === "running").length}</strong>
                运行中
              </span>
              <span>
                <strong>{assets.length}</strong>
                素材
              </span>
              <span>
                <strong>{currentDraft ? 1 : 0}</strong>
                当前草稿
              </span>
            </div>
            {notice ? <span className="notice">{notice}</span> : null}
            <button className="iconButton" onClick={() => void checkHealth()} type="button" title="刷新 MCP 状态" aria-label="刷新 MCP 状态">
              <RefreshCw size={18} className={settingsBusy === "health" ? "spin" : ""} />
            </button>
          </div>
        </header>

        {section === "flow" ? null : (
          <WorkflowRibbon
            activeSection={section}
            researchReady={Boolean(
              researchResult?.evidence?.length ||
                workflowResult?.evidence?.length ||
                (Array.isArray(workspace?.selectedSamples) && workspace.selectedSamples.length)
            )}
            draftReady={Boolean(currentDraft || workflowResult?.draft)}
            imageReady={Boolean(
              publishAssetIds.length ||
                workflowForm.assetIds.length ||
                workspace?.selectedImageIds.length ||
                currentDraft?.images?.length
            )}
            publishReady={Boolean(
              workspace?.publishPlan && !["blocked", "failed"].includes(workspace.publishPlan.status ?? "")
            )}
            runningCount={jobs.filter((job) => job.status === "queued" || job.status === "running").length}
            onNavigate={setSection}
          />
        )}

        {section === "flow" ? (
          <PostStudioPanel
            project={postProject}
            workspace={workspace}
            workflowResult={workflowResultForDisplay}
            researchForm={workflowForm}
            messages={messages}
            chatInput={chatInput}
            busy={busy === "workflow"}
            assets={assets}
            publishDraft={publishDraft}
            publishAssetIds={publishAssetIds}
            settings={settings}
            jobs={jobs}
            onResearchFormChange={(next) => setWorkflowForm((current) => ({ ...current, ...next }))}
            onRunResearch={(event) => void runWorkflow(event)}
            onChatInput={setChatInput}
            onChatSubmit={(event) => void sendChat(event)}
            onDraftChange={setPublishDraft}
            onNewProject={() => void startNewProject()}
            onGenerateCopy={(message) => void submitChatMessage(message, true)}
            onOpenImageStudio={() => setSection("imageStudio")}
            onOpenPublish={() => openPublishAssemblyFromWorkspace()}
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
            onOpenPublish={(draft) => openPublishAssembly(draft)}
          />
        ) : null}

        {section === "jobs" ? (
          <JobsPanel
            jobs={jobs}
            activeJob={activeJob}
            onReload={() => void loadJobs()}
            onViewResult={viewJobResult}
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
            onOpenPublish={() => openPublishAssembly()}
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
            onOpenPublish={(draft) => openPublishAssembly(draft)}
            onOpenPublishFromWorkspace={openPublishAssemblyFromWorkspace}
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
            busy={busy === "publish"}
            onDraftChange={(draft) => {
              setPendingPublish(null);
              setPublishDraft(draft);
            }}
            onToggleAsset={(id) =>
              {
                setPendingPublish(null);
                setPublishAssetIds((current) =>
                  current.includes(id) ? current.filter((assetId) => assetId !== id) : [...current, id]
                );
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
      </section>
    </main>
  );
}
