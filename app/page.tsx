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
import { ClipboardEvent, DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { buildCopyCreativeBrief, buildDraftPromptFromBrief, buildImageCreativeBrief } from "@/lib/workflows/creative-briefs";
import { parseTagsText } from "@/lib/publishing/assembly";

type Section = "dashboard" | "workflow" | "jobs" | "assets" | "imageStudio" | "chat" | "publish" | "history" | "settings";

type RedactedSettings = {
  mcpUrl: string;
  textBaseUrl: string;
  textModel: string;
  textApiKey: "configured" | "missing";
  imageBaseUrl: string;
  imageModel: string;
  imageApiKey: "configured" | "missing";
  defaultVisibility: "公开可见" | "仅自己可见" | "仅互关好友可见";
  defaultAutoPublish: boolean;
};

type SettingsDraft = Omit<RedactedSettings, "textApiKey" | "imageApiKey"> & {
  textApiKey: string;
  imageApiKey: string;
};

type Health = {
  ok: boolean;
  reachable: boolean;
  loggedIn: boolean;
  message: string;
  mcpUrl?: string;
};

type WorkflowStep = {
  id: string;
  label: string;
  status: "done" | "skipped" | "failed";
  detail: string;
};

type WorkflowResult = {
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

type ResearchSummary = {
  contentStrengths: string[];
  imageStrengths: string[];
  learningsForContent: string[];
  learningsForImages: string[];
  nextQuestions: string[];
};

type SampleEvidence = {
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

type WorkflowSample = {
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

type WorkflowRun = {
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

type JobRecord = {
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

type AssetRecord = {
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

type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  workflowResult?: WorkflowResult;
};

type ChatConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

type DraftRecord = {
  id: string;
  updatedAt: string;
  draft: NonNullable<WorkflowResult["draft"]>;
  images: Array<{ path?: string; url?: string }>;
  visibility: RedactedSettings["defaultVisibility"];
};

type PublishDraftState = {
  title: string;
  content: string;
  tagsText: string;
  imagePrompt: string;
};

const navItems: Array<{ id: Section; label: string; icon: typeof ClipboardList }> = [
  { id: "dashboard", label: "控制台", icon: ClipboardList },
  { id: "workflow", label: "一键发帖", icon: Rocket },
  { id: "jobs", label: "任务进度", icon: Database },
  { id: "assets", label: "产品素材/参考图", icon: ImagePlus },
  { id: "imageStudio", label: "图片创作台", icon: Sparkles },
  { id: "chat", label: "AI 对话", icon: MessageSquareText },
  { id: "publish", label: "发布装配台", icon: FileCheck2 },
  { id: "history", label: "历史记录", icon: History },
  { id: "settings", label: "模型设置", icon: Settings }
];

const defaultSettings: RedactedSettings = {
  mcpUrl: "http://localhost:18060/mcp",
  textBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  textModel: "gemini-3-flash-preview",
  textApiKey: "missing",
  imageBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  imageModel: "gemini-2.5-flash-image",
  imageApiKey: "missing",
  defaultVisibility: "仅自己可见",
  defaultAutoPublish: false
};

export default function Home() {
  const [section, setSection] = useState<Section>("dashboard");
  const [settings, setSettings] = useState<RedactedSettings>(defaultSettings);
  const [settingsDraft, setSettingsDraft] = useState({
    ...defaultSettings,
    textApiKey: "",
    imageApiKey: ""
  });
  const [health, setHealth] = useState<Health | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [autoReturnJobId, setAutoReturnJobId] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
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
  const workflowResultForDisplay =
    workflowResult?.status === "research_ready" ? workflowResult : researchResult ?? workflowResult;

  async function loadInitial() {
    await Promise.all([
      loadSettings(),
      checkHealth(),
      loadHistory(),
      loadJobs(),
      loadAssets(),
      loadChatHistory(),
      loadCurrentDraft()
    ]);
  }

  useEffect(() => {
    const hasRunning = jobs.some((job) => job.status === "queued" || job.status === "running");
    if (!hasRunning) return;

    const timer = window.setInterval(() => {
      void loadJobs();
    }, 2500);

    return () => window.clearInterval(timer);
  }, [jobs]);

  async function loadSettings() {
    const data = (await api("/api/settings")) as RedactedSettings;
    setSettings(data);
    setSettingsDraft({
      ...data,
      textApiKey: "",
      imageApiKey: ""
    });
  }

  async function checkHealth() {
    setBusy("health");
    try {
      const data = (await api("/api/health/mcp")) as Health;
      setHealth(data);
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
    setJobs(data.jobs);
    const autoReturnJob = autoReturnJobId ? data.jobs.find((job) => job.id === autoReturnJobId) : null;
    if (autoReturnJob?.status === "completed" && autoReturnJob.result) {
      applyWorkflowResult(autoReturnJob.result);
      setActiveJobId(autoReturnJob.id);
      setAutoReturnJobId(null);
      setSection("workflow");
      setNotice("研究完成，已回到结果页。可以继续进入文案创作或图片创作。");
      if (autoReturnJob.result.draft) {
        await loadCurrentDraft();
      }
      return;
    }
    if (autoReturnJob?.status === "failed") {
      setAutoReturnJobId(null);
    }
    const latestCompleted = data.jobs.find((job) => job.status === "completed" && job.result);
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
      setSettings(data);
      setSettingsDraft({
        ...data,
        textApiKey: "",
        imageApiKey: ""
      });
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
      const data = (await api("/api/jobs", {
        method: "POST",
        body: JSON.stringify(workflowForm)
      })) as { job: JobRecord };
      setActiveJobId(data.job.id);
      setAutoReturnJobId(data.job.id);
      setJobs((current) => [data.job, ...current.filter((job) => job.id !== data.job.id)]);
      setSection("jobs");
      setNotice("后台任务已创建");
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
        const data = (await fetch("/api/assets", { method: "POST", body: form }).then(async (response) => {
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
      setNotice(assetIds.length ? "产品场景图已生成" : "原创图片已生成");
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
        setJobs((current) => [data.job!, ...current.filter((job) => job.id !== data.job!.id)]);
        setSection("jobs");
      }
      await loadHistory();
      await loadChatHistory();
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

  async function submitFinalPublish(scheduleAt?: string) {
    setBusy("publish");
    setPublishStatus("");
    try {
      const data = (await api("/api/publish", {
        method: "POST",
        body: JSON.stringify({
          title: publishDraft.title,
          content: publishDraft.content,
          tags: parseTagsText(publishDraft.tagsText),
          assetIds: publishAssetIds,
          visibility: publishVisibility,
          scheduleAt,
          imagePrompt: publishDraft.imagePrompt
        })
      })) as { status: "published" | "scheduled"; publishResult: unknown; currentDraft?: DraftRecord };
      if (data.currentDraft) {
        applyCurrentDraft(data.currentDraft);
      }
      setPublishStatus(data.status === "scheduled" ? "已提交定时发布" : "已提交立即发布");
      setNotice(data.status === "scheduled" ? "定时发布已提交" : "发布已提交");
    } finally {
      setBusy(null);
    }
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
            <div className="brandTitle">XHS Studio</div>
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

        <div className="sidebarStatus">
          <StatusPill ok={Boolean(health?.loggedIn)} label={health?.loggedIn ? "小红书已登录" : "待检测登录"} />
          <StatusPill ok={modelReady} label={modelReady ? "文本模型已配置" : "缺少文本模型"} />
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Local AI Operations</p>
            <h1>{titleForSection(section)}</h1>
          </div>
          <div className="topbarActions">
            {notice ? <span className="notice">{notice}</span> : null}
            <button className="iconButton" onClick={() => void checkHealth()} type="button" title="刷新 MCP 状态">
              <RefreshCw size={18} className={busy === "health" ? "spin" : ""} />
            </button>
          </div>
        </header>

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
            assets={assets}
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
            busy={busy}
            evidenceContext={buildClientEvidenceContext(researchResult ?? workflowResult)}
            onAssetFormChange={setAssetForm}
            onUploadFiles={(files) => void attachImageStudioFiles(files)}
            onGenerate={() =>
              void generateProductAsset(workflowForm.assetIds, {
                allowEmpty: true,
                evidenceContext: buildClientEvidenceContext(researchResult ?? workflowResult)
              })
            }
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
          />
        ) : null}

        {section === "publish" ? (
          <PublishAssemblyPanel
            assets={assets}
            draft={publishDraft}
            selectedAssetIds={publishAssetIds}
            visibility={publishVisibility}
            scheduleAt={publishScheduleAt}
            status={publishStatus}
            busy={busy === "publish"}
            onDraftChange={setPublishDraft}
            onToggleAsset={(id) =>
              setPublishAssetIds((current) =>
                current.includes(id) ? current.filter((assetId) => assetId !== id) : [...current, id]
              )
            }
            onVisibilityChange={setPublishVisibility}
            onScheduleAtChange={setPublishScheduleAt}
            onPublishNow={() => void submitFinalPublish()}
            onSchedule={() => void submitFinalPublish(publishScheduleAt)}
            onGoCopy={() => setSection("chat")}
            onGoImage={() => setSection("imageStudio")}
          />
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

function Dashboard({
  health,
  modelReady,
  imageReady,
  latestRun,
  busy,
  onRefresh
}: {
  health: Health | null;
  modelReady: boolean;
  imageReady: boolean;
  latestRun?: WorkflowRun;
  busy: string | null;
  onRefresh: () => void;
}) {
  return (
    <div className="dashboardGrid">
      <section className="panel spanTwo">
        <div className="panelHeader">
          <div>
            <h2>运行状态</h2>
            <p>确认网页后端、小红书 MCP 和模型配置是否就绪。</p>
          </div>
          <button className="secondaryButton" onClick={onRefresh} type="button">
            <RefreshCw size={16} className={busy === "health" ? "spin" : ""} />
            检测
          </button>
        </div>

        <div className="statusGrid">
          <Metric icon={ShieldCheck} label="MCP 服务" value={health?.reachable ? "可访问" : "未确认"} ok={Boolean(health?.reachable)} />
          <Metric icon={CheckCircle2} label="登录状态" value={health?.loggedIn ? "已登录" : "待登录"} ok={Boolean(health?.loggedIn)} />
          <Metric icon={Bot} label="文本模型" value={modelReady ? "已配置" : "待配置"} ok={modelReady} />
          <Metric icon={Sparkles} label="图片模型" value={imageReady ? "已配置" : "可稍后配置"} ok={imageReady} />
        </div>

        {health?.message ? <pre className="logBox">{health.message}</pre> : null}
      </section>

      <section className="panel">
        <div className="panelHeader compact">
          <h2>最近工作流</h2>
        </div>
        {latestRun ? (
          <div className="runSummary">
            <span>{new Date(latestRun.createdAt).toLocaleString()}</span>
            <strong>{latestRun.input.topic}</strong>
            <p>{latestRun.result.draft?.title ?? latestRun.result.report}</p>
          </div>
        ) : (
          <p className="muted">还没有运行记录。</p>
        )}
      </section>

      <section className="panel">
        <div className="panelHeader compact">
          <h2>推荐起步</h2>
        </div>
        <div className="hintList">
          <span>{modelReady ? "文本模型已配置，可以进行搜索分析、生成草稿和 AI 对话。" : "先在模型设置里填文本模型 API Key。"}</span>
          <span>{imageReady ? "图片模型已配置，可以生成原创配图；样本图也会尽量缓存到本地。" : "图片模型没配时也能先生成文案和图片提示词。"}</span>
          <span>第一次真实发布仍建议用“仅自己可见”，确认效果后再公开发布。</span>
        </div>
      </section>
    </div>
  );
}

function WorkflowPanel({
  assets,
  form,
  busy,
  result,
  onChange,
  onSubmit,
  onDraftCommand,
  onCopyStudio,
  onImageStudio,
  onOpenPublish
}: {
  assets: AssetRecord[];
  form: {
    topic: string;
    contentType: string;
    timeRange: string;
    sampleCount: number;
    visibility: string;
    autoPublish: boolean;
    workflowGoal: string;
    publishMode: string;
    analyzeImages: boolean;
    generateImages: boolean;
    scheduleAt: string;
    requirements: string;
    imageSource: string;
    assetIds: string[];
    productName: string;
    sellingPoints: string;
    scene: string;
    style: string;
    extraImagePrompt: string;
  };
  busy: boolean;
  result: WorkflowResult | null;
  onChange: (next: typeof form) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDraftCommand: (message: string) => void;
  onCopyStudio: (brief?: string) => void;
  onImageStudio: (brief?: string) => void;
  onOpenPublish: (draft?: NonNullable<WorkflowResult["draft"]>) => void;
}) {
  return (
    <div className="twoColumn">
      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2>主题研究台</h2>
            <p>先拿真实笔记、正文、图片和互动证据，再决定是否进入创作，不再无依据直接生成。</p>
          </div>
        </div>

        <form className="formStack" onSubmit={onSubmit}>
          <div className="modeSwitch">
            <button
              className={form.workflowGoal === "research" ? "modeCard active" : "modeCard"}
              type="button"
              onClick={() =>
                onChange({
                  ...form,
                  workflowGoal: "research",
                  publishMode: "draft",
                  autoPublish: false,
                  generateImages: false
                })
              }
            >
              <strong>先做研究</strong>
              <span>抓笔记、看正文和图片，总结优点，等待你补充需求。</span>
            </button>
            <button
              className={form.workflowGoal === "draft" ? "modeCard active" : "modeCard"}
              type="button"
              onClick={() => onChange({ ...form, workflowGoal: "draft" })}
            >
              <strong>直接创作</strong>
              <span>基于证据生成草稿、图片素材，并按设置发布或定时。</span>
            </button>
          </div>

          <label>
            <span>主题</span>
            <input value={form.topic} onChange={(event) => onChange({ ...form, topic: event.target.value })} />
          </label>

          <div className="formRow">
            <label>
              <span>类型</span>
              <select value={form.contentType} onChange={(event) => onChange({ ...form, contentType: event.target.value })}>
                <option>图文</option>
                <option>探店</option>
                <option>种草</option>
                <option>干货</option>
                <option>穿搭</option>
                <option>视频</option>
              </select>
            </label>
            <label>
              <span>时间范围</span>
              <select value={form.timeRange} onChange={(event) => onChange({ ...form, timeRange: event.target.value })}>
                <option>一天内</option>
                <option>一周内</option>
                <option>两周内</option>
                <option>半年内</option>
              </select>
            </label>
          </div>

          <div className="formRow">
            <label>
              <span>样本数</span>
              <input
                min={3}
                max={20}
                type="number"
                value={form.sampleCount}
                onChange={(event) => onChange({ ...form, sampleCount: Number(event.target.value) })}
              />
            </label>
            <label>
              <span>可见范围</span>
              <select value={form.visibility} onChange={(event) => onChange({ ...form, visibility: event.target.value })}>
                <option>仅自己可见</option>
                <option>公开可见</option>
                <option>仅互关好友可见</option>
              </select>
            </label>
          </div>

          <label>
            <span>{form.workflowGoal === "research" ? "研究完成后" : "发布方式"}</span>
            <select
              value={form.publishMode}
              disabled={form.workflowGoal === "research"}
              onChange={(event) => {
                const publishMode = event.target.value;
                onChange({
                  ...form,
                  publishMode,
                  autoPublish: publishMode === "publish" || publishMode === "schedule",
                  generateImages: publishMode === "draft" ? form.generateImages : true
                });
              }}
            >
              <option value="draft">仅生成草稿</option>
              <option value="material">生成素材但不发布</option>
              <option value="publish">立即自动发布</option>
              <option value="schedule">定时发布</option>
            </select>
            {form.workflowGoal === "research" ? (
              <small className="fieldHint">研究模式会停在证据总结，不会发布。你可以在结果页继续补充需求并跳到 AI 对话。</small>
            ) : null}
          </label>

          {form.publishMode === "schedule" ? (
            <label>
              <span>定时发布时间</span>
              <input
                placeholder="例如 2026-05-19T20:00:00+08:00"
                value={form.scheduleAt}
                onChange={(event) => onChange({ ...form, scheduleAt: event.target.value })}
              />
            </label>
          ) : null}

          <label className="checkLine">
            <input
              checked={form.analyzeImages}
              type="checkbox"
              onChange={(event) => onChange({ ...form, analyzeImages: event.target.checked })}
            />
            <span>分析竞品图片风格</span>
          </label>

          <label className="checkLine">
            <input
              checked={form.generateImages}
              type="checkbox"
              onChange={(event) => onChange({ ...form, generateImages: event.target.checked })}
            />
            <span>生成新的原创图片</span>
          </label>

          <label>
            <span>图片来源</span>
            <select
              value={form.imageSource}
              onChange={(event) => onChange({ ...form, imageSource: event.target.value })}
            >
              <option value="ai">AI 根据主题生成</option>
              <option value="product">基于我的产品图生成</option>
              <option value="asset">直接使用已有素材</option>
            </select>
          </label>

          {form.imageSource !== "ai" ? (
            <div className="assetPicker">
              {assets.length ? (
                assets.slice(0, 8).map((asset) => (
                  <label className="assetPickItem" key={asset.id}>
                    <input
                      checked={form.assetIds.includes(asset.id)}
                      type="checkbox"
                      onChange={(event) =>
                        onChange({
                          ...form,
                          assetIds: event.target.checked
                            ? [...form.assetIds, asset.id]
                            : form.assetIds.filter((id) => id !== asset.id)
                        })
                      }
                    />
                    <img alt={asset.name} src={`/api/assets/file/${asset.id}`} />
                    <span>{asset.name}</span>
                  </label>
                ))
              ) : (
                <p className="muted">产品素材/参考图还没有图片。可以先去“产品素材/参考图”上传产品图。</p>
              )}
            </div>
          ) : null}

          {form.imageSource === "product" ? (
            <div className="formStack insetFields">
              <label>
                <span>产品名称</span>
                <input value={form.productName} onChange={(event) => onChange({ ...form, productName: event.target.value })} />
              </label>
              <label>
                <span>产品卖点</span>
                <input value={form.sellingPoints} onChange={(event) => onChange({ ...form, sellingPoints: event.target.value })} />
              </label>
              <div className="formRow">
                <label>
                  <span>生成场景</span>
                  <input value={form.scene} onChange={(event) => onChange({ ...form, scene: event.target.value })} />
                </label>
                <label>
                  <span>图片风格</span>
                  <input value={form.style} onChange={(event) => onChange({ ...form, style: event.target.value })} />
                </label>
              </div>
            </div>
          ) : null}

          <label>
            <span>你的创作补充需求（可先留空）</span>
            <textarea
              placeholder="例如：我要宣传哪款产品、产品怎么用、主打卖点；或我要探哪家店、想强调安静办公/约会/拍照/价格等。"
              value={form.requirements}
              onChange={(event) => onChange({ ...form, requirements: event.target.value })}
            />
          </label>

          <button className="primaryButton" disabled={busy} type="submit">
            <Play size={16} />
            {busy ? "创建中" : form.workflowGoal === "research" ? "开始证据研究" : "创建创作任务"}
          </button>
        </form>
      </section>

      <section className="panel resultPanel">
        <div className="panelHeader compact">
          <h2>结果</h2>
        </div>
        {result ? (
          <WorkflowResultView
            result={result}
            onDraftCommand={onDraftCommand}
            onCopyStudio={onCopyStudio}
            onImageStudio={onImageStudio}
            onOpenPublish={onOpenPublish}
          />
        ) : (
          <p className="muted">运行后这里会先展示抓到的真实笔记、正文、图片和 AI 研究总结。满意后再继续创作。</p>
        )}
      </section>
    </div>
  );
}

function ChatPanel({
  assets,
  attachedAssetIds,
  conversations,
  activeConversationId,
  messages,
  input,
  busy,
  currentDraft,
  onInput,
  onSubmit,
  onAttachFiles,
  onToggleAsset,
  onRemoveAsset,
  onSelectConversation,
  onNewConversation,
  onDraftCommand,
  onOpenCopyWorkspace,
  onOpenImageStudio,
  onOpenPublish
}: {
  assets: AssetRecord[];
  attachedAssetIds: string[];
  conversations: ChatConversation[];
  activeConversationId: string | null;
  messages: ChatMessage[];
  input: string;
  busy: boolean;
  currentDraft: DraftRecord | null;
  onInput: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onAttachFiles: (files: FileList | File[]) => void;
  onToggleAsset: (id: string) => void;
  onRemoveAsset: (id: string) => void;
  onSelectConversation: (conversation: ChatConversation) => void;
  onNewConversation: () => void;
  onDraftCommand: (message: string) => void;
  onOpenCopyWorkspace: (brief?: string) => void;
  onOpenImageStudio: () => void;
  onOpenPublish: (draft?: NonNullable<WorkflowResult["draft"]>) => void;
}) {
  const attachedAssets = assets.filter((asset) => attachedAssetIds.includes(asset.id));

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (event.dataTransfer.files.length) {
      onAttachFiles(event.dataTransfer.files);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLElement>) {
    if (event.clipboardData.files.length) {
      onAttachFiles(event.clipboardData.files);
    }
  }

  return (
    <div className="chatLayout">
      <aside className="chatHistoryPanel">
        <div className="panelHeader compact">
          <h2>对话历史</h2>
        </div>
        <button className="secondaryButton fullWidth" onClick={onNewConversation} type="button">
          新对话
        </button>
        <div className="conversationList">
          {conversations.length ? (
            conversations.map((conversation) => (
              <button
                className={conversation.id === activeConversationId ? "conversationItem active" : "conversationItem"}
                key={conversation.id}
                onClick={() => onSelectConversation(conversation)}
                type="button"
              >
                <strong>{conversation.title}</strong>
                <span>{new Date(conversation.updatedAt).toLocaleString()}</span>
              </button>
            ))
          ) : (
            <p className="muted">暂无对话，发一句问题就会自动保存。</p>
          )}
        </div>
      </aside>

      <section className="panel chatPanel">
        <div className="panelHeader">
          <div>
            <h2>网页 AI 对话</h2>
            <p>像 ChatGPT 一样连续追问：搜索真实笔记、查看证据、生成草稿、继续修改、最后发布或定时。</p>
          </div>
        </div>

        {currentDraft ? (
          <section className="currentDraftStrip">
            <div>
              <span>当前文案草稿</span>
              <strong>{currentDraft.draft.title}</strong>
              <p>{currentDraft.draft.content.slice(0, 88)}{currentDraft.draft.content.length > 88 ? "..." : ""}</p>
            </div>
            <div className="actionRow">
              <button className="secondaryButton" onClick={onOpenImageStudio} type="button">
                去配图
              </button>
              <button className="primaryButton" onClick={() => onOpenPublish(currentDraft.draft)} type="button">
                进入发布装配台
              </button>
            </div>
          </section>
        ) : null}

        <div className="chatTranscript">
          {messages.length ? (
            messages.map((message, index) => (
              <div className={message.role === "user" ? "chatBubble user" : "chatBubble assistant"} key={message.id ?? `${message.role}-${index}`}>
                <strong>{message.role === "user" ? "你" : "AI"}</strong>
                <p>{message.content}</p>
                {message.workflowResult ? (
                  <WorkflowResultView
                    result={message.workflowResult}
                    onDraftCommand={onDraftCommand}
                    onCopyStudio={onOpenCopyWorkspace}
                    onImageStudio={() => onOpenImageStudio()}
                    onOpenPublish={onOpenPublish}
                  />
                ) : null}
              </div>
            ))
          ) : (
            <div className="emptyChat">
              <MessageSquareText size={26} />
              <span>可以问：“帮我搜索 8 篇广州咖啡馆高收藏笔记，并基于证据写一篇草稿”。</span>
            </div>
          )}
        </div>

        <div
          className="chatAttachmentZone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          onPaste={handlePaste}
          tabIndex={0}
        >
          <div>
            <strong>图片上下文</strong>
            <span>拖入、粘贴或上传产品图/参考图，AI 会带着图片和当前研究证据一起创作。</span>
          </div>
          <label className="secondaryButton attachmentButton">
            <Upload size={16} />
            上传图片
            <input
              accept="image/*"
              multiple
              type="file"
              onChange={(event) => {
                if (event.target.files?.length) onAttachFiles(event.target.files);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>

        {attachedAssets.length ? (
          <div className="attachedAssetStrip">
            {attachedAssets.map((asset) => (
              <span key={asset.id}>
                <img alt={asset.name} src={`/api/assets/file/${asset.id}`} />
                {asset.name}
                <button type="button" onClick={() => onRemoveAsset(asset.id)} aria-label={`移除 ${asset.name}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {assets.length ? (
          <div className="quickAssetStrip">
            {assets.slice(0, 8).map((asset) => (
              <button
                className={attachedAssetIds.includes(asset.id) ? "quickAsset active" : "quickAsset"}
                key={asset.id}
                onClick={() => onToggleAsset(asset.id)}
                type="button"
              >
                <img alt={asset.name} src={`/api/assets/file/${asset.id}`} />
                <span>{asset.name}</span>
              </button>
            ))}
            <button className="quickAsset textOnly" onClick={onOpenImageStudio} type="button">
              去图片创作台
            </button>
          </div>
        ) : null}

        <form className="chatInput" onSubmit={onSubmit} onPaste={handlePaste}>
          <input
            placeholder="输入需求，也可以只附图后直接发送"
            value={input}
            onChange={(event) => onInput(event.target.value)}
          />
          <button className="primaryButton" disabled={busy} type="submit">
            <Search size={16} />
            {busy ? "处理中" : "发送"}
          </button>
        </form>
      </section>
    </div>
  );
}

function PublishAssemblyPanel({
  assets,
  draft,
  selectedAssetIds,
  visibility,
  scheduleAt,
  status,
  busy,
  onDraftChange,
  onToggleAsset,
  onVisibilityChange,
  onScheduleAtChange,
  onPublishNow,
  onSchedule,
  onGoCopy,
  onGoImage
}: {
  assets: AssetRecord[];
  draft: PublishDraftState;
  selectedAssetIds: string[];
  visibility: RedactedSettings["defaultVisibility"];
  scheduleAt: string;
  status: string;
  busy: boolean;
  onDraftChange: (draft: PublishDraftState) => void;
  onToggleAsset: (id: string) => void;
  onVisibilityChange: (value: RedactedSettings["defaultVisibility"]) => void;
  onScheduleAtChange: (value: string) => void;
  onPublishNow: () => void;
  onSchedule: () => void;
  onGoCopy: () => void;
  onGoImage: () => void;
}) {
  const selectedAssets = assets.filter((asset) => selectedAssetIds.includes(asset.id));
  const tagCount = parseTagsText(draft.tagsText).length;
  const ready = Boolean(draft.title.trim() && draft.content.trim() && tagCount && selectedAssets.length);

  return (
    <div className="twoColumn wideLeft">
      <section className="panel publishPreviewPanel">
        <div className="panelHeader">
          <div>
            <h2>发布装配台</h2>
            <p>这里是最终发布前的整合页：确认文案、标签、图片、可见范围和发布时间。</p>
          </div>
          <StatusPill ok={ready} label={ready ? "可以发布" : "缺少内容"} />
        </div>

        <div className="publishPreview">
          <label>
            <span>标题</span>
            <input value={draft.title} onChange={(event) => onDraftChange({ ...draft, title: event.target.value })} />
          </label>
          <label>
            <span>正文</span>
            <textarea value={draft.content} onChange={(event) => onDraftChange({ ...draft, content: event.target.value })} />
          </label>
          <label>
            <span>标签</span>
            <input
              placeholder="#广州咖啡 #探店"
              value={draft.tagsText}
              onChange={(event) => onDraftChange({ ...draft, tagsText: event.target.value })}
            />
            <small className="fieldHint">当前识别 {tagCount} 个标签。</small>
          </label>
          <label>
            <span>图片提示词记录</span>
            <textarea
              value={draft.imagePrompt}
              onChange={(event) => onDraftChange({ ...draft, imagePrompt: event.target.value })}
            />
          </label>
        </div>

        <section className="resultBlock">
          <div className="blockTitleRow">
            <div>
              <h3>最终发布图片</h3>
              <p>选中的图片会随这篇笔记一起发送。图片创作台生成的新图会自动加入这里，也可以手动勾选素材库里的图片。</p>
            </div>
            <button className="secondaryButton" onClick={onGoImage} type="button">
              去图片创作台
            </button>
          </div>
          {selectedAssets.length ? (
            <div className="attachedAssetStrip large">
              {selectedAssets.map((asset) => (
                <span key={asset.id}>
                  <img alt={asset.name} src={`/api/assets/file/${asset.id}`} />
                  {asset.name}
                  <button type="button" onClick={() => onToggleAsset(asset.id)} aria-label={`移除 ${asset.name}`}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">还没有选择发布图片。先去图片创作台生成，或从右侧素材中选择。</p>
          )}
        </section>

        <div className="publishControls">
          <label>
            <span>可见范围</span>
            <select value={visibility} onChange={(event) => onVisibilityChange(event.target.value as RedactedSettings["defaultVisibility"])}>
              <option>仅自己可见</option>
              <option>公开可见</option>
              <option>仅互关好友可见</option>
            </select>
          </label>
          <label>
            <span>定时发布时间</span>
            <input type="datetime-local" value={scheduleAt} onChange={(event) => onScheduleAtChange(event.target.value)} />
          </label>
        </div>

        {status ? <p className="notice inlineNotice">{status}</p> : null}

        <div className="actionRow publishActions">
          <button className="secondaryButton" onClick={onGoCopy} type="button">
            回文案创作台
          </button>
          <button className="primaryButton" disabled={busy || !ready} onClick={onPublishNow} type="button">
            {busy ? "发布中" : "立即发布"}
          </button>
          <button className="secondaryButton" disabled={busy || !ready || !scheduleAt} onClick={onSchedule} type="button">
            {busy ? "提交中" : "定时发布"}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader compact">
          <h2>可选图片素材</h2>
        </div>
        <div className="assetGrid compactAssets">
          {assets.length ? (
            assets.map((asset) => (
              <article className={selectedAssetIds.includes(asset.id) ? "assetCard selected" : "assetCard"} key={asset.id}>
                <button className="assetImageButton" onClick={() => onToggleAsset(asset.id)} type="button">
                  <img alt={asset.name} src={`/api/assets/file/${asset.id}`} />
                </button>
                <div>
                  <strong>{asset.name}</strong>
                  <span>{asset.kind === "generated" ? "生成图，可发布" : "产品/参考图"}</span>
                </div>
              </article>
            ))
          ) : (
            <p className="muted">还没有素材。请去图片创作台上传或生成图片。</p>
          )}
        </div>
      </section>
    </div>
  );
}

function JobsPanel({
  jobs,
  activeJob,
  onReload,
  onViewResult,
  onOpenImageStudio
}: {
  jobs: JobRecord[];
  activeJob?: JobRecord;
  onReload: () => void;
  onViewResult: (job: JobRecord) => void;
  onOpenImageStudio: () => void;
}) {
  return (
    <div className="twoColumn wideLeft">
      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2>任务进度</h2>
            <p>长任务会在后台执行，页面可以随时回来查看。</p>
          </div>
          <button className="secondaryButton" onClick={onReload} type="button">
            <RefreshCw size={16} />
            刷新
          </button>
        </div>

        {activeJob ? (
          <div className="jobDetail">
            <div className="jobTitleRow">
              <div>
                <strong>{activeJob.title}</strong>
                <span>{new Date(activeJob.createdAt).toLocaleString()}</span>
              </div>
              <StatusPill ok={activeJob.status === "completed"} label={`${activeJob.status} · ${activeJob.progress}%`} />
            </div>
            <div className="progressTrack">
              <i style={{ width: `${activeJob.progress}%` }} />
            </div>
            <div className="stepList">
              {activeJob.steps.map((step) => (
                <div className={`stepItem ${step.status}`} key={step.id}>
                  <span>{step.label}</span>
                  <p>{step.detail}</p>
                </div>
              ))}
            </div>

            {activeJob.status === "completed" && activeJob.result ? (
              <section className="resultBlock jobCompletionActions">
                <h3>任务已完成</h3>
                <p>研究结果已经准备好，可以回到主题研究台查看证据，也可以继续进入图片创作台。</p>
                <div className="actionRow">
                  <button className="primaryButton" onClick={() => onViewResult(activeJob)} type="button">
                    查看研究结果
                  </button>
                  <button className="secondaryButton" onClick={onOpenImageStudio} type="button">
                    进入图片创作台
                  </button>
                </div>
              </section>
            ) : null}

            {activeJob.publish ? (
              <section className="resultBlock">
                <h3>发布记录</h3>
                <p>状态：{activeJob.publish.status ?? "-"}</p>
                <p>标题：{activeJob.publish.title ?? "-"}</p>
                <p>可见范围：{activeJob.publish.visibility ?? "-"}</p>
                <p>定时：{activeJob.publish.scheduleAt ?? "-"}</p>
              </section>
            ) : null}
          </div>
        ) : (
          <p className="muted">还没有任务。</p>
        )}
      </section>

      <section className="panel">
        <div className="panelHeader compact">
          <h2>任务列表</h2>
        </div>
        <div className="historyList">
          {jobs.length ? (
            jobs.map((job) => (
              <article className="historyItem" key={job.id}>
                <div>
                  <span>{new Date(job.updatedAt).toLocaleString()}</span>
                  <h3>{job.title}</h3>
                  <p>{job.status} · {job.progress}%</p>
                </div>
                <div className="historyMeta">
                  <span>{job.type}</span>
                </div>
              </article>
            ))
          ) : (
            <p className="muted">暂无任务。</p>
          )}
        </div>
      </section>
    </div>
  );
}

function AssetsPanel({
  assets,
  selectedIds,
  assetForm,
  busy,
  onAssetFormChange,
  onUpload,
  onGenerate,
  onDelete,
  onToggleSelect
}: {
  assets: AssetRecord[];
  selectedIds: string[];
  assetForm: {
    productName: string;
    sellingPoints: string;
    scene: string;
    style: string;
    extraPrompt: string;
  };
  busy: string | null;
  onAssetFormChange: (next: typeof assetForm) => void;
  onUpload: (event: FormEvent<HTMLFormElement>) => void;
  onGenerate: () => void;
  onDelete: (id: string) => void;
  onToggleSelect: (id: string) => void;
}) {
  return (
    <div className="twoColumn">
      <section className="panel">
        <div className="panelHeader">
          <div>
          <h2>上传产品素材/参考图</h2>
          <p>这里放你自己的产品原图、包装图、参考场景图和生成结果。产品图用于保留主体换场景，参考图用于学习画面风格。</p>
          </div>
        </div>

        <form className="formStack" onSubmit={onUpload}>
          <label>
            <span>选择图片</span>
            <input accept="image/*" type="file" />
          </label>
          <button className="primaryButton" disabled={busy === "asset-upload"} type="submit">
            <ImagePlus size={16} />
            {busy === "asset-upload" ? "上传中" : "上传产品/参考图"}
          </button>
        </form>

        <div className="divider" />

        <div className="formStack">
          <label>
            <span>产品名称</span>
            <input value={assetForm.productName} onChange={(event) => onAssetFormChange({ ...assetForm, productName: event.target.value })} />
          </label>
          <label>
            <span>产品卖点</span>
            <input value={assetForm.sellingPoints} onChange={(event) => onAssetFormChange({ ...assetForm, sellingPoints: event.target.value })} />
          </label>
          <div className="formRow">
            <label>
              <span>生成场景</span>
              <input value={assetForm.scene} onChange={(event) => onAssetFormChange({ ...assetForm, scene: event.target.value })} />
            </label>
            <label>
              <span>风格</span>
              <input value={assetForm.style} onChange={(event) => onAssetFormChange({ ...assetForm, style: event.target.value })} />
            </label>
          </div>
          <label>
            <span>补充要求</span>
            <input value={assetForm.extraPrompt} onChange={(event) => onAssetFormChange({ ...assetForm, extraPrompt: event.target.value })} />
          </label>
          <button className="secondaryButton" disabled={busy === "asset-generate"} onClick={onGenerate} type="button">
            <Sparkles size={16} />
            {busy === "asset-generate" ? "生成中" : "基于选中产品图生成小红书场景图"}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader compact">
          <h2>本地产品素材/参考图</h2>
        </div>
        <div className="assetGrid">
          {assets.length ? (
            assets.map((asset) => (
              <article className={selectedIds.includes(asset.id) ? "assetCard selected" : "assetCard"} key={asset.id}>
                <button className="assetImageButton" onClick={() => onToggleSelect(asset.id)} type="button">
                  <img alt={asset.name} src={`/api/assets/file/${asset.id}`} />
                </button>
                <div>
                  <strong>{asset.name}</strong>
                  <span>{asset.kind === "generated" ? "生成图" : "上传图"}</span>
                </div>
                <button className="textButton" onClick={() => onDelete(asset.id)} type="button">
                  删除
                </button>
              </article>
            ))
          ) : (
            <p className="muted">还没有素材。</p>
          )}
        </div>
      </section>
    </div>
  );
}

function ImageStudioPanel({
  assets,
  selectedIds,
  assetForm,
  busy,
  evidenceContext,
  onAssetFormChange,
  onUploadFiles,
  onGenerate,
  onToggleSelect,
  onGoChat,
  onOpenPublish
}: {
  assets: AssetRecord[];
  selectedIds: string[];
  assetForm: {
    productName: string;
    sellingPoints: string;
    scene: string;
    style: string;
    extraPrompt: string;
  };
  busy: string | null;
  evidenceContext: string;
  onAssetFormChange: (next: typeof assetForm) => void;
  onUploadFiles: (files: FileList | File[]) => void;
  onGenerate: () => void;
  onToggleSelect: (id: string) => void;
  onGoChat: () => void;
  onOpenPublish: () => void;
}) {
  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (event.dataTransfer.files.length) {
      onUploadFiles(event.dataTransfer.files);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLElement>) {
    if (event.clipboardData.files.length) {
      onUploadFiles(event.clipboardData.files);
    }
  }

  const selectedAssets = assets.filter((asset) => selectedIds.includes(asset.id));

  return (
    <div className="twoColumn wideLeft">
      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2>图片创作台</h2>
            <p>这里专门生成要随笔记发布的图片。可以上传产品图，也可以不上传，只根据研究证据和你的需求生成原创配图。</p>
          </div>
        </div>

        <div
          className="imageStudioDrop"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          onPaste={handlePaste}
          tabIndex={0}
        >
          <ImagePlus size={24} />
          <strong>拖入或粘贴产品图/参考图</strong>
          <span>上传后会进入产品素材库，并自动选入本次生成。没有参考图也可以直接生成。</span>
          <label className="secondaryButton attachmentButton">
            <Upload size={16} />
            上传图片
            <input
              accept="image/*"
              multiple
              type="file"
              onChange={(event) => {
                if (event.target.files?.length) onUploadFiles(event.target.files);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>

        <div className="formStack imageStudioForm">
          <div className="formRow">
            <label>
              <span>产品/对象名称</span>
              <input value={assetForm.productName} onChange={(event) => onAssetFormChange({ ...assetForm, productName: event.target.value })} />
            </label>
            <label>
              <span>卖点/内容要点</span>
              <input value={assetForm.sellingPoints} onChange={(event) => onAssetFormChange({ ...assetForm, sellingPoints: event.target.value })} />
            </label>
          </div>
          <div className="formRow">
            <label>
              <span>生成场景</span>
              <input value={assetForm.scene} onChange={(event) => onAssetFormChange({ ...assetForm, scene: event.target.value })} />
            </label>
            <label>
              <span>图片风格</span>
              <input value={assetForm.style} onChange={(event) => onAssetFormChange({ ...assetForm, style: event.target.value })} />
            </label>
          </div>
          <label>
            <span>补充要求</span>
            <textarea
              value={assetForm.extraPrompt}
              onChange={(event) => onAssetFormChange({ ...assetForm, extraPrompt: event.target.value })}
              placeholder="例如：生成首图封面，保留产品瓶身，背景换成广州咖啡馆窗边桌面，真实自然光。"
            />
          </label>
        </div>

        <section className="resultBlock evidenceCarryBlock">
          <h3>已携带研究证据</h3>
          <p>{evidenceContext || "还没有研究证据。你仍然可以仅根据文字和参考图生成图片。"}</p>
        </section>

        <div className="actionRow">
          <button className="primaryButton" disabled={busy === "asset-generate"} onClick={onGenerate} type="button">
            <Sparkles size={16} />
            {busy === "asset-generate" ? "生成中" : selectedIds.length ? "基于选中图片生成" : "无参考图直接生成"}
          </button>
          <button className="secondaryButton" onClick={onGoChat} type="button">
            回到文案对话
          </button>
          <button className="secondaryButton" onClick={onOpenPublish} type="button">
            进入发布装配台
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader compact">
          <h2>本次参考图</h2>
        </div>
        {selectedAssets.length ? (
          <div className="attachedAssetStrip large">
            {selectedAssets.map((asset) => (
              <span key={asset.id}>
                <img alt={asset.name} src={`/api/assets/file/${asset.id}`} />
                {asset.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="muted">未选择参考图，将按文字和研究证据直接生成。</p>
        )}

        <div className="divider" />
        <div className="panelHeader compact">
          <h2>产品素材 / 参考图 / 生成结果</h2>
        </div>
        <div className="assetGrid compactAssets">
          {assets.length ? (
            assets.map((asset) => (
              <article className={selectedIds.includes(asset.id) ? "assetCard selected" : "assetCard"} key={asset.id}>
                <button className="assetImageButton" onClick={() => onToggleSelect(asset.id)} type="button">
                  <img alt={asset.name} src={`/api/assets/file/${asset.id}`} />
                </button>
                <div>
                  <strong>{asset.name}</strong>
                  <span>{asset.kind === "generated" ? "生成结果" : "产品/参考图"}</span>
                </div>
              </article>
            ))
          ) : (
            <p className="muted">还没有素材。可以直接拖图到左侧上传。</p>
          )}
        </div>
      </section>
    </div>
  );
}

function HistoryPanel({
  runs,
  selectedRunId,
  onSelectRun,
  onReload,
  onDraftCommand,
  onCopyStudio,
  onImageStudio,
  onOpenPublish
}: {
  runs: WorkflowRun[];
  selectedRunId: string | null;
  onSelectRun: (id: string) => void;
  onReload: () => void;
  onDraftCommand: (message: string) => void;
  onCopyStudio: (brief?: string) => void;
  onImageStudio: (brief?: string) => void;
  onOpenPublish: (draft?: NonNullable<WorkflowResult["draft"]>) => void;
}) {
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? runs[0];

  return (
    <div className="twoColumn wideLeft">
      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2>历史记录</h2>
            <p>保存最近 100 次工作流运行结果，点击任意记录可查看完整证据、分析和草稿。</p>
          </div>
          <button className="secondaryButton" onClick={onReload} type="button">
            <RefreshCw size={16} />
            刷新
          </button>
        </div>

        <div className="historyList">
          {runs.length ? (
            runs.map((run) => (
              <button
                className={selectedRun?.id === run.id ? "historyItem active" : "historyItem"}
                key={run.id}
                onClick={() => onSelectRun(run.id)}
                type="button"
              >
                <div>
                  <span>{new Date(run.createdAt).toLocaleString()}</span>
                  <h3>{run.result.draft?.title ?? run.input.topic}</h3>
                  <p>
                    {run.input.contentType} · {run.input.timeRange} ·{" "}
                    {run.input.workflowGoal === "research" ? "research" : run.input.publishMode ?? "draft"} · {run.result.status}
                  </p>
                </div>
                <div className="historyMeta">
                  <span>{run.result.evidence?.length ?? run.result.samples.length} 证据</span>
                  <span>
                    {modeLabel(
                      run.input.workflowGoal === "research"
                        ? "research"
                        : run.input.publishMode ?? (run.input.autoPublish ? "publish" : "draft")
                    )}
                  </span>
                </div>
              </button>
            ))
          ) : (
            <p className="muted">暂无历史记录。</p>
          )}
        </div>
      </section>

      <section className="panel resultPanel">
        <div className="panelHeader compact">
          <h2>记录详情</h2>
        </div>
        {selectedRun ? (
          <>
            <div className="runSummary">
              <span>{new Date(selectedRun.createdAt).toLocaleString()}</span>
              <strong>{selectedRun.input.topic}</strong>
              <p>
                {selectedRun.input.contentType} · {selectedRun.input.timeRange} ·{" "}
                {modeLabel(
                  selectedRun.input.workflowGoal === "research"
                    ? "research"
                    : selectedRun.input.publishMode ?? (selectedRun.input.autoPublish ? "publish" : "draft")
                )}
              </p>
            </div>
            <WorkflowResultView
              result={selectedRun.result}
              onDraftCommand={onDraftCommand}
              onCopyStudio={onCopyStudio}
              onImageStudio={onImageStudio}
              onOpenPublish={onOpenPublish}
            />
          </>
        ) : (
          <p className="muted">选择一条历史记录后，这里会展示完整详情。</p>
        )}
      </section>
    </div>
  );
}

function SettingsPanel({
  settings,
  draft,
  busy,
  onChange,
  onSubmit
}: {
  settings: RedactedSettings;
  draft: SettingsDraft;
  busy: boolean;
  onChange: (next: SettingsDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="panel settingsPanel">
      <div className="panelHeader">
        <div>
          <h2>连接配置</h2>
          <p>API Key 只保存在本机 `data/settings.json`，网页不会回显完整密钥。</p>
        </div>
      </div>

      <form className="formStack" onSubmit={onSubmit}>
        <label>
          <span>MCP 地址</span>
          <input value={draft.mcpUrl} onChange={(event) => onChange({ ...draft, mcpUrl: event.target.value })} />
        </label>

        <div className="formRow">
          <label>
            <span>文本 Base URL</span>
            <input value={draft.textBaseUrl} onChange={(event) => onChange({ ...draft, textBaseUrl: event.target.value })} />
          </label>
          <label>
            <span>文本模型</span>
            <input value={draft.textModel} onChange={(event) => onChange({ ...draft, textModel: event.target.value })} />
          </label>
        </div>

        <label>
          <span>文本 API Key：{settings.textApiKey === "configured" ? "已配置" : "未配置"}</span>
          <input
            autoComplete="off"
            placeholder="留空表示不修改"
            type="password"
            value={draft.textApiKey}
            onChange={(event) => onChange({ ...draft, textApiKey: event.target.value })}
          />
        </label>

        <div className="formRow">
          <label>
            <span>图片 Base URL</span>
            <input value={draft.imageBaseUrl} onChange={(event) => onChange({ ...draft, imageBaseUrl: event.target.value })} />
          </label>
          <label>
            <span>图片模型</span>
            <input
              list="image-model-presets"
              value={draft.imageModel}
              onChange={(event) => onChange({ ...draft, imageModel: event.target.value })}
            />
            <datalist id="image-model-presets">
              <option label="Nano Banana / Gemini 2.5 Flash Image" value="gemini-2.5-flash-image" />
            </datalist>
          </label>
        </div>

        <p className="fieldHint">当前推荐图片模型：Nano Banana，也就是 Gemini 2.5 Flash Image。</p>

        <label>
          <span>图片 API Key：{settings.imageApiKey === "configured" ? "已配置" : "未配置"}</span>
          <input
            autoComplete="off"
            placeholder="留空表示不修改"
            type="password"
            value={draft.imageApiKey}
            onChange={(event) => onChange({ ...draft, imageApiKey: event.target.value })}
          />
        </label>

        <div className="formRow">
          <label>
            <span>默认可见范围</span>
            <select
              value={draft.defaultVisibility}
              onChange={(event) =>
                onChange({
                  ...draft,
                  defaultVisibility: event.target.value as RedactedSettings["defaultVisibility"]
                })
              }
            >
              <option>仅自己可见</option>
              <option>公开可见</option>
              <option>仅互关好友可见</option>
            </select>
          </label>
          <label className="checkLine settingsCheck">
            <input
              checked={draft.defaultAutoPublish}
              type="checkbox"
              onChange={(event) => onChange({ ...draft, defaultAutoPublish: event.target.checked })}
            />
            <span>默认自动发布</span>
          </label>
        </div>

        <button className="primaryButton" disabled={busy} type="submit">
          <Save size={16} />
          {busy ? "保存中" : "保存设置"}
        </button>
      </form>
    </section>
  );
}

function WorkflowResultView({
  result,
  onDraftCommand,
  onCopyStudio,
  onImageStudio,
  onOpenPublish
}: {
  result: WorkflowResult;
  onDraftCommand?: (message: string) => void;
  onCopyStudio?: (brief?: string) => void;
  onImageStudio?: (brief?: string) => void;
  onOpenPublish?: (draft?: NonNullable<WorkflowResult["draft"]>) => void;
}) {
  const [draftInstruction, setDraftInstruction] = useState("帮我把当前草稿改得更有真实探店感，并补充具体信息");
  const [scheduleAt, setScheduleAt] = useState("");
  const [creativeBrief, setCreativeBrief] = useState(
    "我想基于这些证据写一篇原创小红书笔记。具体对象是：；我想强调：；目标人群是：。"
  );
  const evidence = result.evidence?.length ? result.evidence : result.samples.map(sampleToEvidence);

  return (
    <div className="workflowResult">
      <div className="resultStatus">
        <strong>{result.status}</strong>
        <span>{evidence.length} 条证据样本</span>
      </div>

      <div className="stepList">
        {result.steps.map((step) => (
          <div className={`stepItem ${step.status}`} key={step.id}>
            <span>{step.label}</span>
            <p>{step.detail}</p>
          </div>
        ))}
      </div>

      {evidence.length ? (
        <section className="resultBlock">
          <div className="blockTitleRow">
            <div>
              <h3>真实笔记证据</h3>
              <p>先看别人真实笔记里写了什么、图怎么拍、互动为什么高；点击卡片可在本页展开完整图文。</p>
            </div>
          </div>
          <div className="evidenceGrid">
            {evidence.map((item, index) => (
              <EvidenceCard item={item} index={index} key={`${item.id}-${index}`} />
            ))}
          </div>
        </section>
      ) : null}

      {result.researchSummary ? (
        <ResearchSummaryView summary={result.researchSummary} />
      ) : null}

      {result.report ? (
        <section className="resultBlock">
          <h3>分析报告</h3>
          <p>{result.report}</p>
        </section>
      ) : null}

      {result.imageStyleReport ? (
        <section className="resultBlock">
          <h3>图片风格分析</h3>
          <p>{result.imageStyleReport}</p>
        </section>
      ) : null}

      {result.samples.length ? (
        <section className="resultBlock">
          <h3>爆款样本表</h3>
          <div className="tableWrap">
            <table className="sampleTable">
              <thead>
                <tr>
                  <th>标题</th>
                  <th>作者</th>
                  <th>点赞</th>
                  <th>收藏</th>
                  <th>评论</th>
                  <th>评分</th>
                  <th>链接</th>
                </tr>
              </thead>
              <tbody>
                {result.samples.map((sample) => {
                  const display = displaySample(sample);
                  return (
                  <tr key={sample.id}>
                    <td>{display.title}</td>
                    <td>{display.author || "-"}</td>
                    <td>{display.likes}</td>
                    <td>{display.collects}</td>
                    <td>{display.comments}</td>
                    <td>{Math.round(display.score)}</td>
                    <td>
                      {display.url ? (
                        <a href={display.url} rel="noreferrer" target="_blank">
                          打开
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {result.draft ? (
        <section className="resultBlock">
          <h3>生成草稿：{result.draft.title}</h3>
          <p>{result.draft.content}</p>
          <div className="tagRow">
            {result.draft.tags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
          <pre className="logBox">{result.draft.imagePrompt}</pre>
          {onDraftCommand || onOpenPublish ? (
            <div className="draftActions">
              {onDraftCommand ? (
                <label>
                  <span>继续修改这篇草稿</span>
                  <input value={draftInstruction} onChange={(event) => setDraftInstruction(event.target.value)} />
                </label>
              ) : null}
              <div className="actionRow">
                <button
                  className="secondaryButton"
                  onClick={() => void navigator.clipboard?.writeText(`${result.draft?.title}\n\n${result.draft?.content}`)}
                  type="button"
                >
                  复制草稿
                </button>
                {onDraftCommand ? (
                  <button
                    className="secondaryButton"
                    onClick={() => onDraftCommand(draftInstruction)}
                    type="button"
                  >
                    让 AI 修改
                  </button>
                ) : null}
                {onOpenPublish ? (
                  <button className="primaryButton" onClick={() => onOpenPublish(result.draft ?? undefined)} type="button">
                    进入发布装配台
                  </button>
                ) : null}
              </div>
              {onOpenPublish ? (
              <div className="actionRow">
                <input value={scheduleAt} type="datetime-local" onChange={(event) => setScheduleAt(event.target.value)} />
                <button
                  className="secondaryButton"
                  onClick={() => onOpenPublish(result.draft ?? undefined)}
                  type="button"
                >
                  去设置定时发布
                </button>
              </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {!result.draft && (onCopyStudio || onImageStudio) && result.status === "research_ready" ? (
        <section className="resultBlock creativeBriefBlock">
          <div>
            <h3>下一步：选择创作窗口</h3>
            <p>
              文案窗口只带标题、正文、标签的学习结论；图片创作台只带图片风格结论。不会把原帖全文或样本图片塞进文案对话。
            </p>
          </div>
          <label>
            <span>补充你的真实需求</span>
            <textarea value={creativeBrief} onChange={(event) => setCreativeBrief(event.target.value)} />
          </label>
          <div className="creativeGatewayGrid">
            <button
              className="modeCard active"
              type="button"
              onClick={() => onCopyStudio?.(creativeBrief)}
            >
              <strong>进入文案创作窗口</strong>
              <span>先预填精简文案简报，你可以继续修改需求、拖入产品图，再手动发送给 AI。</span>
            </button>
            <button
              className="modeCard"
              type="button"
              onClick={() => onImageStudio?.(creativeBrief)}
            >
              <strong>进入图片创作台</strong>
              <span>带着图片风格证据生成配图。可以上传产品图，也可以无参考图直接生成。</span>
            </button>
          </div>
        </section>
      ) : null}

      {result.images.length ? (
        <section className="resultBlock">
          <h3>生成图片</h3>
          <div className="assetList">
            {result.images.map((image, index) => (
              <span key={`${image.path ?? image.url}-${index}`}>{image.path ?? image.url}</span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function EvidenceCard({ item, index }: { item: SampleEvidence; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const images = displayEvidenceImages(item);
  const hasLongText = item.detailText.length > 180;
  const shownText = expanded || !hasLongText ? item.detailText : `${item.detailText.slice(0, 180)}...`;

  return (
    <article
      className={expanded ? "evidenceCard expanded" : "evidenceCard"}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a,button")) return;
        setExpanded((value) => !value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setExpanded((value) => !value);
        }
      }}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
    >
      <div className="evidenceHeader">
        <span>样本 {index + 1}</span>
        {item.url ? (
          <a href={item.url} rel="noreferrer" target="_blank">
            备用打开原笔记
          </a>
        ) : null}
      </div>
      <h4>{item.title}</h4>
      <p className="muted">{item.author || "未知作者"}</p>
      <button className="evidenceOpenButton" type="button" onClick={() => setExpanded((value) => !value)}>
        {expanded ? "收起卡片" : "查看完整图文"}
      </button>
      <div className="metricStrip">
        <span>赞 {item.likes}</span>
        <span>藏 {item.collects}</span>
        <span>评 {item.comments}</span>
        <span>转 {item.shares}</span>
      </div>
      {images.length ? (
        <div className="evidenceImages">
          {images.slice(0, expanded ? 8 : 4).map((url) => (
            <img alt={item.title} key={url} src={url} />
          ))}
        </div>
      ) : (
        <p className="muted">没有拿到可展示图片。</p>
      )}
      {item.detailText ? (
        <div className="evidenceBody">
          <strong>正文内容</strong>
          <p className="evidenceText">{shownText}</p>
          {hasLongText ? (
            <button className="inlineTextButton" type="button" onClick={() => setExpanded((value) => !value)}>
              {expanded ? "收起正文" : "展开完整正文"}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="muted">详情正文暂未获取到，本条只使用搜索卡片信息。</p>
      )}
      {item.commentSnippets.length ? (
        <div className="quoteList">
          {item.commentSnippets.slice(0, expanded ? 6 : 3).map((comment) => (
            <span key={comment}>评论：{comment}</span>
          ))}
        </div>
      ) : null}
      <div className="reasonList">
        {item.reasonHighlights.map((reason) => (
          <span key={reason}>{reason}</span>
        ))}
      </div>
    </article>
  );
}

function ResearchSummaryView({ summary }: { summary: ResearchSummary }) {
  return (
    <section className="resultBlock researchSummaryGrid">
      <InsightList title="内容哪里好" items={summary.contentStrengths} />
      <InsightList title="图片哪里好" items={summary.imageStrengths} />
      <InsightList title="正文怎么学" items={summary.learningsForContent} />
      <InsightList title="图片怎么学" items={summary.learningsForImages} />
      <InsightList title="生成前要补充" items={summary.nextQuestions} wide />
    </section>
  );
}

function InsightList({ title, items, wide = false }: { title: string; items: string[]; wide?: boolean }) {
  return (
    <div className={wide ? "insightCard wide" : "insightCard"}>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  ok
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="metricTile">
      <Icon size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={ok ? "dot ok" : "dot"} />
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={ok ? "statusPill ok" : "statusPill"}>
      <i />
      {label}
    </span>
  );
}

function titleForSection(section: Section): string {
  const titles: Record<Section, string> = {
    dashboard: "控制台",
    workflow: "一键发帖工作流",
    jobs: "任务进度",
    assets: "产品素材/参考图",
    imageStudio: "图片创作台",
    chat: "网页自然语言助手",
    publish: "发布装配台",
    history: "历史记录",
    settings: "模型与连接设置"
  };
  return titles[section];
}

function modeLabel(mode: string): string {
  const labels: Record<string, string> = {
    research: "证据研究",
    draft: "草稿模式",
    material: "素材模式",
    publish: "立即发布",
    schedule: "定时发布"
  };
  return labels[mode] ?? mode;
}

function sampleToEvidence(sample: WorkflowSample): SampleEvidence {
  const display = displaySample(sample);
  const rawImageUrls = collectDisplayImageUrls(sample.raw).slice(0, 8);
  const raw = isRecord(sample.raw) ? sample.raw : {};
  const xsecToken = chooseText(sample.xsecToken, raw.xsecToken, raw.xsec_token);
  const sourceUrl = xsecToken && !sample.url?.includes("xsec_token") ? buildDisplayXhsUrl(sample.id, xsecToken) : sample.url ?? "";

  return {
    id: sample.id,
    title: display.title,
    author: display.author || "",
    likes: display.likes,
    collects: display.collects,
    comments: display.comments,
    shares: display.shares ?? 0,
    score: display.score,
    url: sourceUrl,
    imageUrls: rawImageUrls,
    cachedImageUrls: [],
    detailText: "",
    commentSnippets: [],
    reasonHighlights: ["这是旧记录中的样本卡片；后续新运行会保存更完整的正文、评论和图片证据。"]
  };
}

function displayEvidenceImages(item: SampleEvidence): string[] {
  return item.cachedImageUrls?.length ? item.cachedImageUrls : item.imageUrls;
}

function buildClientEvidenceContext(result: WorkflowResult | null): string {
  if (!result) {
    return "";
  }
  return buildImageCreativeBrief(result).slice(0, 2400);
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function buildDisplayXhsUrl(id: string, xsecToken?: string): string {
  if (!id || id.startsWith("feed-")) {
    return "";
  }

  const baseUrl = `https://www.xiaohongshu.com/explore/${encodeURIComponent(id)}`;
  return xsecToken
    ? `${baseUrl}?xsec_token=${encodeURIComponent(xsecToken)}&xsec_source=pc_search`
    : baseUrl;
}

function displaySample(sample: WorkflowSample): WorkflowSample & Required<Pick<WorkflowSample, "likes" | "collects" | "comments">> {
  const raw = isRecord(sample.raw) ? sample.raw : {};
  const noteCard = firstRecord(raw.noteCard, raw.note_card, raw.note, raw.card) ?? {};
  const user = firstRecord(raw.user, raw.userInfo, raw.user_info, noteCard.user, noteCard.userInfo) ?? {};
  const interact = firstRecord(raw.interactInfo, raw.interact_info, noteCard.interactInfo, noteCard.interact_info) ?? {};
  const title = chooseText(sample.title === "未命名笔记" ? "" : sample.title, noteCard.displayTitle, noteCard.display_title, raw.title);
  const author = chooseText(sample.author, user.nickname, user.nickName, user.userName, raw.author);
  const likes = chooseNumber(sample.likes, interact.likedCount, interact.liked_count, raw.likes);
  const collects = chooseNumber(sample.collects, interact.collectedCount, interact.collected_count, raw.collects);
  const comments = chooseNumber(sample.comments, interact.commentCount, interact.comment_count, raw.comments);
  const shares = chooseNumber(sample.shares, interact.sharedCount, interact.shared_count, raw.shares);
  const score = sample.score > 0 ? sample.score : likes + collects * 3 + comments * 2 + shares * 1.5;
  const xsecToken = chooseText(sample.xsecToken, raw.xsecToken, raw.xsec_token);
  const url = xsecToken && !sample.url?.includes("xsec_token") ? buildDisplayXhsUrl(sample.id, xsecToken) : sample.url;

  return {
    ...sample,
    title: title || "未命名笔记",
    author,
    likes,
    collects,
    comments,
    shares,
    url,
    score
  };
}

function collectDisplayImageUrls(value: unknown): string[] {
  const urls = new Set<string>();

  function visit(candidate: unknown): void {
    if (typeof candidate === "string") {
      if (/^https?:\/\/.+\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(candidate) || candidate.includes("sns-webpic")) {
        urls.add(candidate);
      }
      return;
    }

    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }

    if (isRecord(candidate)) {
      Object.values(candidate).forEach(visit);
    }
  }

  visit(value);
  return [...urls];
}

function firstRecord(...values: unknown[]): Record<string, unknown> | undefined {
  return values.find(isRecord);
}

function chooseText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function chooseNumber(...values: unknown[]): number {
  for (const value of values) {
    const parsed = toDisplayNumber(value);
    if (parsed > 0) {
      return parsed;
    }
  }
  return 0;
}

function toDisplayNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return 0;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return 0;
  }
  const multiplier = normalized.includes("万") || normalized.includes("w") ? 10000 : 1;
  const numeric = Number.parseFloat(normalized.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? Math.round(numeric * multiplier) : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function api(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "请求失败");
  }

  return data;
}
