"use client";

import {
  Bot,
  CheckCircle2,
  ClipboardList,
  Database,
  FileCheck2,
  History,
  ImagePlus,
  MessageSquareText,
  Play,
  RefreshCw,
  Rocket,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  X
} from "lucide-react";
import { ClipboardEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { buildCopyCreativeBrief, buildDraftPromptFromBrief, buildImageCreativeBrief } from "@/lib/workflows/creative-briefs";
import {
  applyImageProviderPreset,
  applyTextProviderPreset,
  inferImageProviderPreset,
  inferTextProviderPreset,
  modelProviderPresets,
  type ModelProviderPreset
} from "@/lib/models/presets";
import { parseTagsText } from "@/lib/publishing/assembly";
import {
  AccountStatusCard,
  AssetsPanel,
  ChatPanel,
  Dashboard,
  HistoryPanel,
  ImageStudioPanel,
  JobsPanel,
  PublishAuditPanel,
  PublishAssemblyPanel,
  SettingsPanel,
  StatusPill,
  WorkflowPanel,
  WorkflowRibbon,
  buildClientEvidenceContext,
  normalizeLocalDatetimeForApi,
  subtitleForSection,
  titleForSection,
  uniqueIds
} from "@/app/components/xhs-panels";

export type Section = "dashboard" | "workflow" | "jobs" | "assets" | "imageStudio" | "chat" | "publish" | "audit" | "history" | "settings";
export type ImageStudioMode = "ai" | "card";
export type CardTheme = "sketch" | "default" | "professional" | "retro" | "terminal" | "botanical" | "neo-brutalism" | "playful-geometric";
export type CardPaginationMode = "separator" | "auto-split" | "auto-fit" | "dynamic";

export type RedactedSettings = {
  mcpUrl: string;
  textBaseUrl: string;
  textModel: string;
  textApiKey: "configured" | "missing";
  imageBaseUrl: string;
  imageModel: string;
  imageApiKey: "configured" | "missing";
  actionToken: string;
  defaultVisibility: "公开可见" | "仅自己可见" | "仅互关好友可见";
  defaultAutoPublish: boolean;
  agentPublishPolicy: "draft_only" | "review_required" | "auto_publish_allowed";
  dailyTextCallLimit: number;
  dailyImageCallLimit: number;
  maxResearchSamples: number;
  activeAccountId: string;
  accounts: XhsAccountProfile[];
};

export type XhsAccountProfile = {
  id: string;
  displayName: string;
  mcpUrl: string;
  status: "unknown" | "logged_in" | "logged_out";
  createdAt: string;
  updatedAt: string;
};

export type SettingsDraft = Omit<RedactedSettings, "textApiKey" | "imageApiKey" | "actionToken"> & {
  textApiKey: string;
  imageApiKey: string;
};

export type Health = {
  ok: boolean;
  reachable: boolean;
  loggedIn: boolean;
  message: string;
  mcpUrl?: string;
  activeAccount?: XhsAccountProfile & { loginName?: string };
};

export type WorkflowStep = {
  id: string;
  label: string;
  status: "done" | "skipped" | "failed";
  detail: string;
};

export type WorkflowResult = {
  status: string;
  steps: WorkflowStep[];
  samples: WorkflowSample[];
  evidence?: SampleEvidence[];
  researchSummary?: ResearchSummary | null;
  report: string;
  imageStyleReport?: string;
  draft: null | {
    title: string;
    content: string;
    tags: string[];
    structure: string[];
    imagePrompt: string;
  };
  images: Array<{ path?: string; url?: string }>;
  publishResult: unknown;
};

export type ResearchSummary = {
  contentStrengths: string[];
  imageStrengths: string[];
  learningsForContent: string[];
  learningsForImages: string[];
  nextQuestions: string[];
};

export type SampleEvidence = {
  id: string;
  title: string;
  author: string;
  likes: number;
  collects: number;
  comments: number;
  shares: number;
  score: number;
  url: string;
  imageUrls: string[];
  cachedImageUrls?: string[];
  detailText: string;
  commentSnippets: string[];
  reasonHighlights: string[];
};

export type WorkflowSample = {
  id: string;
  title: string;
  score: number;
  likes?: number;
  collects?: number;
  comments?: number;
  shares?: number;
  xsecToken?: string;
  author?: string;
  url?: string;
  raw?: unknown;
};

export type WorkflowRun = {
  id: string;
  createdAt: string;
  input: {
    topic: string;
    contentType: string;
    timeRange: string;
    sampleCount: number;
    visibility: string;
    autoPublish: boolean;
    workflowGoal?: "research" | "draft";
    publishMode?: "draft" | "material" | "publish" | "schedule";
    analyzeImages?: boolean;
    generateImages?: boolean;
    scheduleAt?: string;
    requirements?: string;
  };
  result: WorkflowResult;
};

export type JobRecord = {
  id: string;
  type: string;
  title: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  createdAt: string;
  updatedAt: string;
  input: unknown;
  steps: WorkflowStep[];
  publish?: {
    title?: string;
    content?: string;
    tags?: string[];
    images?: string[];
    visibility?: string;
    scheduleAt?: string;
    status?: string;
    result?: unknown;
    error?: string;
  };
  result?: WorkflowResult;
  error?: string;
};

export type AssetRecord = {
  id: string;
  kind: "upload" | "generated";
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  prompt?: string;
  sourceAssetIds?: string[];
};

export type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  workflowResult?: WorkflowResult;
};

export type ChatConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

export type DraftRecord = {
  id: string;
  updatedAt: string;
  draft: NonNullable<WorkflowResult["draft"]>;
  images: Array<{ path?: string; url?: string }>;
  visibility: RedactedSettings["defaultVisibility"];
};

export type WorkspacePublishPlan = {
  id?: string;
  status?: string;
  title?: string;
  content?: string;
  tags?: string[];
  images?: string[];
  visibility?: string;
  scheduleAt?: string;
  requestedAt?: string;
  requestedBy?: string;
};

export type WorkspaceState = {
  topic?: string;
  researchRunId?: string;
  evidenceSummary?: ResearchSummary | unknown;
  selectedSamples: SampleEvidence[] | unknown[];
  currentDraftId?: string;
  currentDraft?: DraftRecord | null;
  selectedImageIds: string[];
  productImageIds: string[];
  publishPlan?: WorkspacePublishPlan | null;
  lastUserIntent?: string;
  recentJobIds: string[];
  recentRunIds: string[];
  recentConversationIds: string[];
};

export type CreatorMemoryProfile = {
  liked: Array<{ text: string }>;
  disliked: Array<{ text: string }>;
  tone: Array<{ text: string }>;
  tags: Array<{ name: string }>;
  products: Array<{ description: string }>;
};

export type PublishDraftState = {
  title: string;
  content: string;
  tagsText: string;
  imagePrompt: string;
};

export type PublishPayload = {
  title: string;
  content: string;
  tags: string[];
  assetIds: string[];
  visibility: RedactedSettings["defaultVisibility"];
  scheduleAt?: string;
  imagePrompt: string;
};

export type PendingPublishConfirmation = {
  payload: PublishPayload;
  publishIntentId: string;
  mode: "now" | "schedule";
  createdAt: string;
  accountId: string;
  accountDisplayName: string;
  mcpUrl: string;
  loginName?: string;
};

export type PublishAuditRecord = {
  id: string;
  createdAt: string;
  event: string;
  status: string;
  requestedBy: string;
  title: string;
  contentHash: string;
  tags: string[];
  imageCount: number;
  visibility: string;
  scheduleAt?: string;
  accountId?: string;
  mcpUrl?: string;
  publishIntentId?: string;
  idempotencyKeySuffix?: string;
  reasons: string[];
  resultSummary?: string;
};

const navItems: Array<{ id: Section; label: string; icon: typeof ClipboardList }> = [
  { id: "chat", label: "AI 工作台", icon: MessageSquareText },
  { id: "workflow", label: "主题研究台", icon: Rocket },
  { id: "imageStudio", label: "图片创作台", icon: Sparkles },
  { id: "publish", label: "发布装配台", icon: FileCheck2 },
  { id: "audit", label: "发布审计", icon: ShieldCheck },
  { id: "jobs", label: "任务进度", icon: Database },
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

let clientActionToken = "";

function toSettingsDraft(settings: RedactedSettings): SettingsDraft {
  const { actionToken: _actionToken, textApiKey: _textApiKey, imageApiKey: _imageApiKey, ...draft } = settings;
  return {
    ...draft,
    textApiKey: "",
    imageApiKey: ""
  };
}

export default function Home() {
  const [section, setSection] = useState<Section>("chat");
  const [settings, setSettings] = useState<RedactedSettings>(defaultSettings);
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>(toSettingsDraft(defaultSettings));
  const [health, setHealth] = useState<Health | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [publishAudits, setPublishAudits] = useState<PublishAuditRecord[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [autoReturnJobId, setAutoReturnJobId] = useState<string | null>(null);
  const [autoReturnTarget, setAutoReturnTarget] = useState<"workflow" | "chat">("workflow");
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
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

  useEffect(() => {
    void loadInitial();
  }, []);

  const modelReady = settings.textApiKey === "configured";
  const imageReady = settings.imageApiKey === "configured";

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
      loadCreatorMemory()
    ]);
  }

  useEffect(() => {
    if (!hasRunningJobs) return;

    let fallbackTimer: number | null = null;
    const events = new EventSource("/api/jobs/stream");

    events.addEventListener("jobs", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as {
          jobs: JobRecord[];
          workspace?: WorkspaceState;
        };
        void applyJobsSnapshot(payload.jobs, payload.workspace);
      } catch {
        void loadJobs();
      }
    });

    events.onerror = () => {
      events.close();
      fallbackTimer = window.setInterval(() => {
        void loadJobs();
      }, 2500);
    };

    return () => {
      events.close();
      if (fallbackTimer) {
        window.clearInterval(fallbackTimer);
      }
    };
  }, [hasRunningJobs, autoReturnJobId, autoReturnTarget]);

  async function loadSettings() {
    const data = (await api("/api/settings")) as RedactedSettings;
    clientActionToken = data.actionToken;
    setSettings(data);
    setSettingsDraft(toSettingsDraft(data));
  }

  async function checkHealth() {
    setBusy("health");
    try {
      const data = (await api("/api/health/mcp")) as Health;
      setHealth(data);
      if (data.activeAccount) {
        setSettings((current) => ({
          ...current,
          mcpUrl: data.mcpUrl ?? current.mcpUrl,
          accounts: current.accounts.map((account) =>
            account.id === data.activeAccount?.id
              ? {
                  ...account,
                  status: data.loggedIn ? "logged_in" : "logged_out",
                  updatedAt: new Date().toISOString()
                }
              : account
          )
        }));
      }
    } finally {
      setBusy(null);
    }
  }

  async function switchActiveAccount(accountId: string) {
    const nextAccount = settings.accounts.find((account) => account.id === accountId);
    if (!nextAccount || nextAccount.id === settings.activeAccountId) {
      return;
    }

    setBusy("account-switch");
    setNotice("");
    setPendingPublish(null);
    setPublishStatus("账号已切换，请重新生成发布确认单。");
    try {
      const data = (await api("/api/settings", {
        method: "POST",
        body: JSON.stringify({
          ...settings,
          activeAccountId: nextAccount.id,
          mcpUrl: nextAccount.mcpUrl,
          accounts: settings.accounts
        })
      })) as RedactedSettings;
      clientActionToken = data.actionToken;
      setSettings(data);
      setSettingsDraft(toSettingsDraft(data));
      setHealth(null);
      setNotice(`已切换到 ${nextAccount.displayName}，正在重新检测登录状态。`);
      await checkHealth();
      await loadCreatorMemory();
    } finally {
      setBusy(null);
    }
  }

  async function loadHistory() {
    const data = (await api("/api/history")) as { runs: WorkflowRun[] };
    setRuns(data.runs);
    const latestResearch = data.runs.find((run) => run.result.status === "research_ready" || run.result.researchSummary);
    if (latestResearch?.result) {
      setResearchResult(latestResearch.result);
    }
  }

  async function loadJobs() {
    const data = (await api("/api/jobs")) as { jobs: JobRecord[] };
    await applyJobsSnapshot(data.jobs);
  }

  async function loadPublishAudit() {
    const data = (await api("/api/publish/audit")) as { audit: PublishAuditRecord[] };
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
    const data = (await api("/api/assets")) as { assets: AssetRecord[] };
    setAssets(data.assets);
  }

  async function loadCurrentDraft() {
    const data = (await api("/api/drafts/current")) as { currentDraft: DraftRecord | null };
    if (data.currentDraft) {
      applyCurrentDraft(data.currentDraft);
    }
  }

  async function loadWorkspace() {
    const data = (await api("/api/agent/workspace")) as { workspace: WorkspaceState };
    setWorkspace(data.workspace);
    if (data.workspace.currentDraft) {
      applyCurrentDraft(data.workspace.currentDraft);
    }
    setPublishAssetIds(data.workspace.selectedImageIds ?? []);
  }

  async function loadCreatorMemory() {
    const data = (await api("/api/agent/memory")) as { memory: CreatorMemoryProfile };
    setCreatorMemory(data.memory);
  }

  async function patchWorkspace(patch: Partial<WorkspaceState>) {
    const data = (await api("/api/agent/workspace", {
      method: "PATCH",
      body: JSON.stringify(patch)
    })) as { workspace: WorkspaceState };
    setWorkspace(data.workspace);
    if (data.workspace.currentDraft) {
      applyCurrentDraft(data.workspace.currentDraft);
    }
    setPublishAssetIds(data.workspace.selectedImageIds ?? []);
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
    const data = (await api("/api/chat/history")) as { conversations: ChatConversation[] };
    setChatConversations(data.conversations);
    if (!activeConversationId && data.conversations[0]) {
      setActiveConversationId(data.conversations[0].id);
      setMessages(data.conversations[0].messages);
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("settings");
    setNotice("");
    try {
      const data = (await api("/api/settings", {
        method: "POST",
        body: JSON.stringify(settingsDraft)
      })) as RedactedSettings;
      clientActionToken = data.actionToken;
      setSettings(data);
      setSettingsDraft(toSettingsDraft(data));
      setNotice("设置已保存");
    } finally {
      setBusy(null);
    }
  }

  async function runWorkflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("workflow");
    setNotice("");
    try {
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
      const data = (await api("/api/jobs", {
        method: "POST",
        body: JSON.stringify(researchInput)
      })) as { job: JobRecord };
      setActiveJobId(data.job.id);
      setAutoReturnTarget("workflow");
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
        const headers = new Headers();
        if (clientActionToken) {
          headers.set("X-XHS-Action-Token", clientActionToken);
        }
        const data = (await fetch("/api/assets", { method: "POST", body: form, headers }).then(async (response) => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error ?? "上传失败");
          return payload;
        })) as { asset: AssetRecord };
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
      const data = (await api("/api/assets/generate", {
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
      const data = (await api("/api/assets/cards", {
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
    await api(`/api/assets/${id}`, { method: "DELETE" });
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
      const data = (await api("/api/chat", {
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
      await loadCreatorMemory();
    } finally {
      setBusy(null);
    }
  }

  function selectConversation(conversation: ChatConversation) {
    setActiveConversationId(conversation.id);
    setMessages(conversation.messages);
  }

  function startNewConversation() {
    setActiveConversationId(null);
    setMessages([]);
    setSection("chat");
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
      let data = (await api("/api/publish", {
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
      const data = (await api("/api/publish", {
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
          busy={busy === "health" || busy === "account-switch"}
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
              <RefreshCw size={18} className={busy === "health" ? "spin" : ""} />
            </button>
          </div>
        </header>

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

        {section === "dashboard" ? (
          <Dashboard
            health={health}
            modelReady={modelReady}
            imageReady={imageReady}
            latestRun={latestRun}
            busy={busy}
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
            onNewConversation={startNewConversation}
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
            busy={busy === "settings"}
            onChange={setSettingsDraft}
            onSubmit={(event) => void saveSettings(event)}
          />
        ) : null}
      </section>
    </main>
  );
}

async function api(path: string, init?: RequestInit, options: { retriedActionToken?: boolean } = {}): Promise<unknown> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (clientActionToken && !headers.has("X-XHS-Action-Token")) {
    headers.set("X-XHS-Action-Token", clientActionToken);
  }

  const response = await fetch(path, {
    ...init,
    headers
  });

  const data = await response.json().catch(() => ({}));
  if (
    response.status === 403 &&
    !options.retriedActionToken &&
    typeof data.error === "string" &&
    data.error.includes("令牌") &&
    (await refreshActionToken())
  ) {
    return api(path, init, { retriedActionToken: true });
  }
  if (!response.ok) {
    throw new Error(data.error ?? "请求失败");
  }

  return data;
}

async function refreshActionToken(): Promise<boolean> {
  const response = await fetch("/api/settings", {
    headers: {
      Accept: "application/json"
    }
  });
  if (!response.ok) {
    return false;
  }

  const data = (await response.json()) as Partial<RedactedSettings>;
  if (!data.actionToken) {
    return false;
  }
  clientActionToken = data.actionToken;
  return true;
}
