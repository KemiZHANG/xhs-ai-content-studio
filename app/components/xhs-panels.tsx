"use client";

import {
  Bot,
  CheckCircle2,
  ClipboardList,
  Database,
  FileCheck2,
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
  UserRound,
  X
} from "lucide-react";
import { ClipboardEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { buildCopyCreativeBrief, buildImageCreativeBrief } from "@/lib/workflows/creative-briefs";
import {
  applyImageProviderPreset,
  applyTextProviderPreset,
  inferImageProviderPreset,
  inferTextProviderPreset,
  modelProviderPresets,
  type ModelProviderPreset
} from "@/lib/models/presets";
import { parseTagsText } from "@/lib/publishing/assembly";
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
  PublishAuditRecord,
  PublishDraftState,
  RedactedSettings,
  ResearchSummary,
  SampleEvidence,
  Section,
  SettingsDraft,
  WorkflowResult,
  WorkflowRun,
  WorkflowSample,
  WorkspaceState,
  XhsAccountProfile
} from "@/app/page";

const fallbackAccounts: XhsAccountProfile[] = [
  {
    id: "local-default",
    displayName: "默认小红书账号",
    mcpUrl: "http://localhost:18060/mcp",
    status: "unknown",
    createdAt: "2026-05-25T00:00:00.000Z",
    updatedAt: "2026-05-25T00:00:00.000Z"
  }
];

export function AccountStatusCard({
  settings,
  health,
  busy,
  onRefresh,
  onManage,
  onSwitch
}: {
  settings: RedactedSettings;
  health: Health | null;
  busy: boolean;
  onRefresh: () => void;
  onManage: () => void;
  onSwitch: (accountId: string) => void;
}) {
  const accounts = settings.accounts?.length ? settings.accounts : fallbackAccounts;
  const activeAccount = accounts.find((account) => account.id === settings.activeAccountId) ?? accounts[0];
  const loginName = health?.activeAccount?.loginName;
  const state = !health ? "unknown" : health.loggedIn ? "ok" : health.reachable ? "warn" : "offline";
  const stateLabel = !health
    ? "待检测"
    : health.loggedIn
      ? "已登录"
      : health.reachable
        ? "未登录"
        : "MCP 未连接";

  return (
    <section className="accountStatusCard" aria-label="小红书账号状态">
      <div className="accountStatusHeader">
        <div className="accountAvatar" aria-hidden="true">
          <UserRound size={18} />
        </div>
        <div className="accountIdentity">
          <span className="accountMeta">当前小红书账号</span>
          <strong className="accountName">{activeAccount.displayName}</strong>
        </div>
        <span className={`accountState ${state}`}>
          <i />
          {stateLabel}
        </span>
      </div>

      <div className="accountDetails">
        <span>{loginName ? `登录名：${loginName}` : "登录名：检测后显示"}</span>
        <span title={activeAccount.mcpUrl}>{formatMcpEndpoint(activeAccount.mcpUrl)}</span>
      </div>

      {accounts.length > 1 ? (
        <label className="accountSwitcher">
          <span>切换账号</span>
          <select disabled={busy} value={activeAccount.id} onChange={(event) => onSwitch(event.target.value)}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.displayName}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="accountActions">
        <button className="sidebarMiniButton" disabled={busy} onClick={onRefresh} type="button">
          <RefreshCw size={14} className={busy ? "spin" : ""} />
          检测
        </button>
        <button className="sidebarMiniButton" onClick={onManage} type="button">
          <Settings size={14} />
          管理
        </button>
      </div>
      {!health?.loggedIn ? <p className="accountHint">未登录时运行 .\\login-xhs.ps1 完成登录，再点击检测。</p> : null}
    </section>
  );
}

export function Dashboard({
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

export function WorkflowPanel({
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
            <p>这里只做搜索和分析：按主题、类型、时间范围拿真实样本，总结标题、正文、标签和图片优点。</p>
          </div>
        </div>

        <form className="formStack" onSubmit={onSubmit}>
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
            <label className="checkCard">
              <input
                checked={form.analyzeImages}
                type="checkbox"
                onChange={(event) => onChange({ ...form, analyzeImages: event.target.checked })}
              />
              <span>
                <strong>分析竞品图片风格</strong>
                <small>会把图片构图、色调、封面信息层级整理成可学习的创作要点。</small>
              </span>
            </label>
          </div>

          <div className="researchScopeHint">
            <strong>研究台不会发布。</strong>
            <span>完成后会把“标题怎么学、正文怎么学、标签怎么学、图片怎么学”带到 AI 工作台和图片创作台。</span>
          </div>

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
            {busy ? "创建中" : "开始主题研究"}
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
          <p className="muted">研究完成后这里会显示真实笔记、互动数据、正文片段、图片证据和可学习要点。你可以一键带到 AI 工作台写文案，或带到图片创作台生成配图。</p>
        )}
      </section>
    </div>
  );
}

export function ChatPanel({
  assets,
  attachedAssetIds,
  conversations,
  activeConversationId,
  messages,
  input,
  busy,
  currentDraft,
  workspace,
  creatorMemory,
  jobs,
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
  onOpenPublish,
  onOpenPublishFromWorkspace
}: {
  assets: AssetRecord[];
  attachedAssetIds: string[];
  conversations: ChatConversation[];
  activeConversationId: string | null;
  messages: ChatMessage[];
  input: string;
  busy: boolean;
  currentDraft: DraftRecord | null;
  workspace: WorkspaceState | null;
  creatorMemory: CreatorMemoryProfile | null;
  jobs: JobRecord[];
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
  onOpenPublishFromWorkspace: () => void;
}) {
  const attachedAssets = assets.filter((asset) => attachedAssetIds.includes(asset.id));
  const showCurrentDraftStrip = Boolean(currentDraft && (activeConversationId || messages.length));
  const [showComposerContext, setShowComposerContext] = useState(false);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript) {
      return;
    }
    transcript.scrollTo({ top: transcript.scrollHeight, behavior: "smooth" });
  }, [messages.length, busy]);

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
            <h2>AI 对话工作台</h2>
            <p>像 ChatGPT 一样连续追问：搜索真实笔记、查看证据、生成草稿、继续修改、最后发布或定时。</p>
          </div>
        </div>

        {currentDraft && showCurrentDraftStrip ? (
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

        <div className="chatTranscript" ref={transcriptRef}>
          {messages.length ? (
            messages.map((message, index) => (
              <div className={message.role === "user" ? "chatBubble user" : "chatBubble assistant"} key={message.id ?? `${message.role}-${index}`}>
                <strong>{message.role === "user" ? "你" : "AI"}</strong>
                <p>{message.content}</p>
                {message.workflowResult ? (
                  <ChatWorkflowResultSummary
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
              <div className="emptyChatIntro">
                <MessageSquareText size={28} />
                <strong>从一个内容任务开始</strong>
                <p>输入一句话即可；需要产品图时直接拖进下方输入区。</p>
              </div>
              <div className="promptGrid compactPrompts">
                <button type="button" onClick={() => onInput("帮我找最近一周广州咖啡馆高收藏笔记，分析标题和图片风格，再生成一篇适合探店账号的图文笔记。")}>
                  <strong>找高收藏笔记</strong>
                  <span>研究 + 草稿</span>
                </button>
                <button type="button" onClick={() => onInput("基于我上传的产品图，生成一组适合小红书发布的产品场景图和配套标题文案。")}>
                  <strong>产品图场景化</strong>
                  <span>上传图后继续</span>
                </button>
                <button type="button" onClick={() => onInput("把当前草稿整理成封面加多张正文卡片，风格要专业、有收藏价值。")}>
                  <strong>生成图文卡片</strong>
                  <span>封面 + 多页</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          className="composerDock"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          onPaste={handlePaste}
        >
          <div className="composerMeta">
            <button
              className={showComposerContext ? "composerToggle active" : "composerToggle"}
              onClick={() => setShowComposerContext((current) => !current)}
              type="button"
            >
              图片
              <strong>{attachedAssets.length}</strong>
            </button>
            <span>可选：拖入或粘贴产品图/参考图；没有图片也可以直接发送。</span>
            <label className="secondaryButton attachmentButton compact">
              <Upload size={16} />
              上传
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

          {showComposerContext ? (
            <div className="composerContextPanel" tabIndex={0}>
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
              ) : (
                <p className="muted">还没有附加图片。拖入、粘贴或上传产品图/参考图后，AI 会带着它们继续创作。</p>
              )}

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
            </div>
          ) : null}

          <form className="chatInput" onSubmit={onSubmit}>
            <textarea
              placeholder="输入下一步，例如：把标题更生活化 / 用第二张图 / 今晚 8 点发布"
              rows={2}
              value={input}
              onChange={(event) => onInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button className="primaryButton" disabled={busy} type="submit">
              <Search size={16} />
              {busy ? "处理中" : "发送"}
            </button>
          </form>
        </div>
      </section>

      <WorkspaceCanvas
        workspace={workspace}
        currentDraft={currentDraft}
        creatorMemory={creatorMemory}
        assets={assets}
        jobs={jobs}
        onOpenImageStudio={onOpenImageStudio}
        onOpenPublish={onOpenPublishFromWorkspace}
      />
    </div>
  );
}

export function ChatWorkflowResultSummary({
  result,
  onDraftCommand,
  onCopyStudio,
  onImageStudio,
  onOpenPublish
}: {
  result: WorkflowResult;
  onDraftCommand: (message: string) => void;
  onCopyStudio: (brief?: string) => void;
  onImageStudio: () => void;
  onOpenPublish: (draft?: NonNullable<WorkflowResult["draft"]>) => void;
}) {
  const evidenceCount = result.evidence?.length ?? result.samples.length;
  const imageCount = result.images.length;
  const title = result.draft?.title || (result.status === "research_ready" ? "证据研究已完成" : "工作流结果");
  const hasResearch = Boolean(result.researchSummary || evidenceCount);

  return (
    <section className="chatResultSummary">
      <div className="chatResultMain">
        <span>{result.status}</span>
        <strong>{title}</strong>
        <p>
          {evidenceCount} 条证据 · {imageCount} 张图片 · {result.draft ? "已生成草稿" : hasResearch ? "可继续创作" : "等待下一步"}
        </p>
      </div>
      <div className="chatResultActions">
        {hasResearch ? (
          <button className="secondaryButton" onClick={() => onCopyStudio(buildCopyCreativeBrief(result))} type="button">
            带证据写文案
          </button>
        ) : null}
        <button className="secondaryButton" onClick={onImageStudio} type="button">
          去生成图片
        </button>
        {result.draft ? (
          <>
            <button
              className="secondaryButton"
              onClick={() => onDraftCommand("请基于当前草稿继续优化标题、正文、标签，让它更像真实小红书分享。")}
              type="button"
            >
              继续改稿
            </button>
            <button className="primaryButton" onClick={() => onOpenPublish(result.draft ?? undefined)} type="button">
              装配发布
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}

export function WorkspaceCanvas({
  workspace,
  currentDraft,
  creatorMemory,
  assets,
  jobs,
  onOpenImageStudio,
  onOpenPublish
}: {
  workspace: WorkspaceState | null;
  currentDraft: DraftRecord | null;
  creatorMemory: CreatorMemoryProfile | null;
  assets: AssetRecord[];
  jobs: JobRecord[];
  onOpenImageStudio: () => void;
  onOpenPublish: () => void;
}) {
  const activeJob = jobs.find((job) => job.status === "queued" || job.status === "running") ?? jobs[0];
  const draft = workspace?.currentDraft ?? currentDraft;
  const publishPlan = workspace?.publishPlan;
  const samples = Array.isArray(workspace?.selectedSamples) ? workspace?.selectedSamples ?? [] : [];
  const images = draft?.images?.filter((image) => image.path || image.url) ?? [];
  const selectedAssets = assets.filter((asset) => workspace?.selectedImageIds.includes(asset.id));
  const productAssets = assets.filter((asset) => workspace?.productImageIds.includes(asset.id));
  const memorySignals = [
    ...(creatorMemory?.liked ?? []).slice(0, 2).map((item) => item.text),
    ...(creatorMemory?.tone ?? []).slice(0, 2).map((item) => item.text),
    ...(creatorMemory?.disliked ?? []).slice(0, 1).map((item) => `避免：${item.text}`)
  ];
  const [canvasMode, setCanvasMode] = useState<"overview" | "draft" | "visual" | "publish">("overview");

  return (
    <aside className="workspaceCanvas panel" data-canvas-mode={canvasMode}>
      <div className="panelHeader compact">
        <div>
          <h2>成果画布</h2>
          <p>当前对话里的研究、草稿、图片和发布计划。</p>
        </div>
      </div>

      <div className="canvasTabs" role="tablist" aria-label="成果画布视图">
        {[
          { id: "overview", label: "总览" },
          { id: "draft", label: "草稿" },
          { id: "visual", label: "图片" },
          { id: "publish", label: "发布" }
        ].map((item) => (
          <button
            aria-selected={canvasMode === item.id}
            className={canvasMode === item.id ? "active" : ""}
            key={item.id}
            onClick={() => setCanvasMode(item.id as typeof canvasMode)}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      {canvasMode === "draft" && draft ? (
        <section className="notePreviewCard" data-canvas-card="draft">
          <div className="notePreviewMedia">
            {selectedAssets[0] ? (
              <img alt={selectedAssets[0].name} src={`/api/assets/file/${selectedAssets[0].id}`} />
            ) : (
              <span>封面待选</span>
            )}
          </div>
          <div className="notePreviewBody">
            <span>发布预览</span>
            <strong>{draft.draft.title}</strong>
            <p>{draft.draft.content.slice(0, 86)}{draft.draft.content.length > 86 ? "..." : ""}</p>
            <div className="tagRow">
              {draft.draft.tags.slice(0, 4).map((tag) => (
                <em key={tag}>#{tag}</em>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {canvasMode === "draft" && !draft ? (
        <section className="canvasCard" data-canvas-card="draft">
          <span>当前草稿</span>
          <strong>还没有草稿</strong>
          <p>在中间对话里让 Agent 先研究主题并生成原创小红书笔记，草稿会同步到这里。</p>
        </section>
      ) : null}

      <section className="canvasCard" data-canvas-card="overview">
        <span>当前项目</span>
        <strong>{workspace?.topic || draft?.draft.title || "等待任务"}</strong>
        <p>最近意图：{workspace?.lastUserIntent || "-"}</p>
      </section>

      {activeJob ? (
        <section className="canvasCard" data-canvas-card="overview">
          <span>后台任务</span>
          <strong>{activeJob.title}</strong>
          <div className="miniProgress">
            <i style={{ width: `${activeJob.progress}%` }} />
          </div>
          <p>{activeJob.status} · {activeJob.progress}%</p>
        </section>
      ) : null}

      <section className="canvasCard" data-canvas-card="overview">
        <span>研究证据</span>
        <strong>{samples.length} 条样本</strong>
        <p>{workspace?.evidenceSummary ? "已生成洞察总结" : "完成研究后会显示标题、正文、标签和图片规律。"}</p>
      </section>

      <section className="canvasCard" data-canvas-card="overview">
        <span>创作者记忆</span>
        <strong>{memorySignals.length ? "已启用" : "等待偏好"}</strong>
        <p>
          {memorySignals.length
            ? memorySignals.slice(0, 2).join("；")
            : "你明确说喜欢/不喜欢的风格、产品信息和常用标签会自动沉淀到这里。"}
        </p>
        {creatorMemory?.tags?.length ? (
          <div className="tagRow">
            {creatorMemory.tags.slice(0, 4).map((tag) => (
              <em key={tag.name}>#{tag.name}</em>
            ))}
          </div>
        ) : null}
      </section>

      {draft ? (
        <section className="canvasCard" data-canvas-card="draft">
          <span>当前草稿</span>
          <strong>{draft.draft.title}</strong>
          <p>{draft.draft.content.slice(0, 120)}{draft.draft.content.length > 120 ? "..." : ""}</p>
          <div className="tagRow">
            {draft.draft.tags.slice(0, 5).map((tag) => (
              <em key={tag}>#{tag}</em>
            ))}
          </div>
        </section>
      ) : null}

      <section className="canvasCard" data-canvas-card="visual">
        <span>发布图片</span>
        <strong>{selectedAssets.length || images.length} 张</strong>
        {selectedAssets.length ? (
          <div className="canvasImageGrid withImages">
            {selectedAssets.slice(0, 4).map((asset, index) => (
              <div key={asset.id}>
                <img alt={asset.name} src={`/api/assets/file/${asset.id}`} />
                <b>{index + 1}</b>
              </div>
            ))}
          </div>
        ) : images.length ? (
          <div className="canvasImageGrid">
            {images.slice(0, 4).map((image, index) => (
              <div key={`${image.path ?? image.url}-${index}`}>{index + 1}</div>
            ))}
          </div>
        ) : (
          <p>可以上传产品图，或进入图片创作台生成场景图。</p>
        )}
        <button className="secondaryButton fullWidth" onClick={onOpenImageStudio} type="button">
          图片创作台
        </button>
      </section>

      {productAssets.length ? (
        <section className="canvasCard" data-canvas-card="visual">
          <span>产品/参考图</span>
          <strong>{productAssets.length} 张</strong>
          <div className="canvasImageGrid withImages">
            {productAssets.slice(0, 4).map((asset, index) => (
              <div key={asset.id}>
                <img alt={asset.name} src={`/api/assets/file/${asset.id}`} />
                <b>{index + 1}</b>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="canvasCard" data-canvas-card="publish">
        <span>发布计划</span>
        <strong>{publishPlan?.status || "未准备"}</strong>
        <p>{publishPlan?.scheduleAt ? `定时：${publishPlan.scheduleAt}` : "默认先进入确认，不会误发。"}</p>
        {publishPlan ? (
          <p>
            可见范围：{publishPlan.visibility}；图片 {publishPlan.images?.length ?? 0} 张；来源：{publishPlan.requestedBy ?? "-"}
          </p>
        ) : null}
        <button className="primaryButton fullWidth" disabled={!draft} onClick={onOpenPublish} type="button">
          发布装配台
        </button>
      </section>
    </aside>
  );
}

export function PublishAuditPanel({
  audits,
  onReload
}: {
  audits: PublishAuditRecord[];
  onReload: () => void;
}) {
  const externalWrites = audits.filter((audit) => audit.event === "published" || audit.event === "scheduled");
  const blocked = audits.filter((audit) => audit.event === "blocked" || audit.event === "failed");

  return (
    <div className="twoColumn wideLeft">
      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2>发布审计</h2>
            <p>这里记录发布预览、确认、阻止、真实发布和定时发布。正文只保存哈希，不保存完整内容。</p>
          </div>
          <button className="secondaryButton" onClick={onReload} type="button">
            <RefreshCw size={16} />
            刷新
          </button>
        </div>

        <div className="auditSummaryGrid">
          <Metric icon={FileCheck2} label="审计记录" value={`${audits.length}`} ok={audits.length > 0} />
          <Metric icon={Rocket} label="外部提交" value={`${externalWrites.length}`} ok={externalWrites.length === 0} />
          <Metric icon={ShieldCheck} label="拦截/失败" value={`${blocked.length}`} ok />
        </div>

        <div className="auditList">
          {audits.length ? (
            audits.map((audit) => (
              <article className="auditItem" key={audit.id}>
                <div>
                  <span>{new Date(audit.createdAt).toLocaleString()}</span>
                  <strong>{audit.title || "未命名发布"}</strong>
                  <p>
                    {audit.requestedBy} · {audit.visibility} · {audit.imageCount} 张图 · {audit.tags.length} 个标签
                    {audit.scheduleAt ? ` · 定时 ${audit.scheduleAt}` : ""}
                  </p>
                  <p className="muted">内容哈希：{audit.contentHash}；确认单：{audit.publishIntentId ?? "-"}</p>
                  {audit.reasons.length ? <p className="muted">原因：{audit.reasons.join("；")}</p> : null}
                </div>
                <StatusPill
                  ok={audit.event === "preview" || audit.event === "awaiting_approval" || audit.event === "blocked"}
                  label={audit.event}
                />
              </article>
            ))
          ) : (
            <p className="muted">还没有发布审计记录。生成发布预览或确认单后，这里会开始记录。</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader compact">
          <h2>审计说明</h2>
        </div>
        <div className="hintList">
          <span>preview：只是发布预演，不会调用小红书 MCP。</span>
          <span>awaiting_approval：已生成确认单，需要你手动确认。</span>
          <span>published / scheduled：已经真实提交或定时提交到小红书 MCP。</span>
          <span>blocked / failed：被安全规则阻止或调用失败。</span>
        </div>
      </section>
    </div>
  );
}

export function PublishAssemblyPanel({
  assets,
  settings,
  health,
  draft,
  selectedAssetIds,
  visibility,
  scheduleAt,
  status,
  pendingPublish,
  busy,
  onDraftChange,
  onToggleAsset,
  onVisibilityChange,
  onScheduleAtChange,
  onPublishNow,
  onSchedule,
  onConfirmPublish,
  onCancelPublish,
  onGoCopy,
  onGoImage
}: {
  assets: AssetRecord[];
  settings: RedactedSettings;
  health: Health | null;
  draft: PublishDraftState;
  selectedAssetIds: string[];
  visibility: RedactedSettings["defaultVisibility"];
  scheduleAt: string;
  status: string;
  pendingPublish: PendingPublishConfirmation | null;
  busy: boolean;
  onDraftChange: (draft: PublishDraftState) => void;
  onToggleAsset: (id: string) => void;
  onVisibilityChange: (value: RedactedSettings["defaultVisibility"]) => void;
  onScheduleAtChange: (value: string) => void;
  onPublishNow: () => void;
  onSchedule: () => void;
  onConfirmPublish: () => void;
  onCancelPublish: () => void;
  onGoCopy: () => void;
  onGoImage: () => void;
}) {
  const selectedAssets = assets.filter((asset) => selectedAssetIds.includes(asset.id));
  const tagCount = parseTagsText(draft.tagsText).length;
  const ready = Boolean(draft.title.trim() && draft.content.trim() && tagCount && selectedAssets.length);
  const activeAccount = settings.accounts.find((account) => account.id === settings.activeAccountId) ?? settings.accounts[0];
  const accountReady = Boolean(health?.loggedIn);
  const canSubmit = ready && accountReady;

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

        <div className="publishReadinessGrid">
          <section className="phonePreview">
            <div className="phonePreviewMedia">
              {selectedAssets[0] ? (
                <img alt={selectedAssets[0].name} src={`/api/assets/file/${selectedAssets[0].id}`} />
              ) : (
                <span>选择封面图</span>
              )}
            </div>
            <div className="phonePreviewText">
              <strong>{draft.title || "标题会显示在这里"}</strong>
              <p>{draft.content ? `${draft.content.slice(0, 120)}${draft.content.length > 120 ? "..." : ""}` : "正文预览会在这里显示，发布前先确认读起来像真实笔记。"}</p>
              <div className="tagRow">
                {parseTagsText(draft.tagsText).slice(0, 5).map((tag) => (
                  <em key={tag}>#{tag}</em>
                ))}
              </div>
            </div>
          </section>
          <section className="publishChecklist">
            <h3>发布检查</h3>
            <StatusLine ok={Boolean(draft.title.trim())} label="标题已填写" />
            <StatusLine ok={Boolean(draft.content.trim())} label="正文已填写" />
            <StatusLine ok={Boolean(tagCount)} label={`${tagCount} 个标签`} />
            <StatusLine ok={Boolean(selectedAssets.length)} label={`${selectedAssets.length} 张图片`} />
            <StatusLine ok={visibility === "仅自己可见"} label={`可见范围：${visibility}`} />
            <StatusLine ok={accountReady} label={`发布账号：${activeAccount?.displayName ?? "未配置账号"}`} />
          </section>
        </div>

        <section className={accountReady ? "publishAccountGuard ok" : "publishAccountGuard warn"}>
          <div>
            <strong>将发布到：{activeAccount?.displayName ?? "未配置账号"}</strong>
            <span>{health?.activeAccount?.loginName ? `真实登录名：${health.activeAccount.loginName}` : "真实登录名：检测后显示"}</span>
            <span>{activeAccount?.mcpUrl ?? settings.mcpUrl}</span>
          </div>
          <StatusPill ok={accountReady} label={accountReady ? "账号已登录" : "请先检测/登录"} />
        </section>

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

        {pendingPublish ? (
          <section className="resultBlock publishConfirmBlock">
            <div className="blockTitleRow">
              <div>
                <h3>{pendingPublish.mode === "schedule" ? "定时发布确认" : "立即发布确认"}</h3>
                <p>
                  系统已生成发布确认单。确认前请再核对标题、正文、标签、图片和可见范围；确认后才会调用小红书 MCP。
                </p>
              </div>
              <StatusPill ok label="等待确认" />
            </div>
            <div className="publishConfirmGrid">
              <span>
                <small>可见范围</small>
                <strong>{pendingPublish.payload.visibility}</strong>
              </span>
              <span>
                <small>图片</small>
                <strong>{pendingPublish.payload.assetIds.length} 张</strong>
              </span>
              <span>
                <small>标签</small>
                <strong>{pendingPublish.payload.tags.length} 个</strong>
              </span>
              <span>
                <small>发布时间</small>
                <strong>{pendingPublish.payload.scheduleAt || "立即"}</strong>
              </span>
              <span>
                <small>发布账号</small>
                <strong>{pendingPublish.accountDisplayName}</strong>
              </span>
              <span>
                <small>登录名</small>
                <strong>{pendingPublish.loginName || "检测后显示"}</strong>
              </span>
            </div>
            <p className="muted">
              这张确认单绑定账号 {pendingPublish.accountDisplayName}（{formatMcpEndpoint(pendingPublish.mcpUrl)}）。如果切换账号，需要重新生成确认单。
            </p>
            <div className="actionRow">
              <button className="secondaryButton" disabled={busy} onClick={onCancelPublish} type="button">
                取消确认
              </button>
              <button className="primaryButton dangerAction" disabled={busy || !accountReady} onClick={onConfirmPublish} type="button">
                {busy ? "提交中" : pendingPublish.mode === "schedule" ? "确认定时发布" : "确认立即发布"}
              </button>
            </div>
          </section>
        ) : null}

        <div className="actionRow publishActions">
          <button className="secondaryButton" onClick={onGoCopy} type="button">
            回文案创作台
          </button>
          <button className="primaryButton" disabled={busy || !canSubmit} onClick={onPublishNow} type="button">
            {busy ? "发布中" : "立即发布"}
          </button>
          <button className="secondaryButton" disabled={busy || !canSubmit || !scheduleAt} onClick={onSchedule} type="button">
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

export function StatusLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={ok ? "statusLine ok" : "statusLine"}>
      <i />
      {label}
    </span>
  );
}

export function JobsPanel({
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

export function AssetsPanel({
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

export function ImageStudioPanel({
  assets,
  selectedIds,
  assetForm,
  cardForm,
  mode,
  busy,
  evidenceContext,
  onAssetFormChange,
  onCardFormChange,
  onModeChange,
  onUploadFiles,
  onGenerate,
  onGenerateCards,
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
  cardForm: {
    title: string;
    subtitle: string;
    body: string;
    tagsText: string;
    theme: CardTheme;
    mode: CardPaginationMode;
    width: number;
    height: number;
  };
  mode: ImageStudioMode;
  busy: string | null;
  evidenceContext: string;
  onAssetFormChange: (next: typeof assetForm) => void;
  onCardFormChange: (next: typeof cardForm) => void;
  onModeChange: (next: ImageStudioMode) => void;
  onUploadFiles: (files: FileList | File[]) => void;
  onGenerate: () => void;
  onGenerateCards: () => void;
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
            <p>这里专门生成要随笔记发布的图片。可以 AI 生图，也可以稳定生成小红书图文卡片。</p>
          </div>
        </div>

        <div className="segmentedControl" aria-label="图片创作模式">
          <button className={mode === "ai" ? "active" : ""} onClick={() => onModeChange("ai")} type="button">
            AI 生图
          </button>
          <button className={mode === "card" ? "active" : ""} onClick={() => onModeChange("card")} type="button">
            图文卡片
          </button>
        </div>

        {mode === "ai" ? (
          <>
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
          </>
        ) : (
          <div className="formStack imageStudioForm cardStudioForm">
            <label>
              <span>卡片标题</span>
              <input
                value={cardForm.title}
                onChange={(event) => onCardFormChange({ ...cardForm, title: event.target.value })}
                placeholder="例如：广州咖啡馆一周收藏趋势"
              />
            </label>
            <label>
              <span>副标题</span>
              <input
                value={cardForm.subtitle}
                onChange={(event) => onCardFormChange({ ...cardForm, subtitle: event.target.value })}
                placeholder="例如：适合周末探店账号的选题拆解"
              />
            </label>
            <div className="formRow">
              <label>
                <span>主题风格</span>
                <select value={cardForm.theme} onChange={(event) => onCardFormChange({ ...cardForm, theme: event.target.value as CardTheme })}>
                  <option value="sketch">手绘草稿风</option>
                  <option value="professional">专业蓝白风</option>
                  <option value="retro">复古杂志风</option>
                  <option value="terminal">终端黑绿风</option>
                  <option value="botanical">自然植物风</option>
                  <option value="neo-brutalism">新粗野主义</option>
                  <option value="playful-geometric">几何活泼风</option>
                  <option value="default">极简默认风</option>
                </select>
              </label>
              <label>
                <span>分页模式</span>
                <select value={cardForm.mode} onChange={(event) => onCardFormChange({ ...cardForm, mode: event.target.value as CardPaginationMode })}>
                  <option value="auto-split">自动拆页</option>
                  <option value="auto-fit">自动缩放到一页</option>
                  <option value="separator">手动分页：用 --- 分隔</option>
                  <option value="dynamic">动态长文分页</option>
                </select>
              </label>
            </div>
            <div className="formRow">
              <label>
                <span>宽度</span>
                <input
                  type="number"
                  value={cardForm.width}
                  onChange={(event) => onCardFormChange({ ...cardForm, width: Number(event.target.value) })}
                />
              </label>
              <label>
                <span>高度</span>
                <input
                  type="number"
                  value={cardForm.height}
                  onChange={(event) => onCardFormChange({ ...cardForm, height: Number(event.target.value) })}
                />
              </label>
            </div>
            <label>
              <span>卡片正文</span>
              <textarea
                value={cardForm.body}
                onChange={(event) => onCardFormChange({ ...cardForm, body: event.target.value })}
                placeholder={"如果选择手动分页，可以用 --- 分隔每一张正文卡片。留空时会尝试使用当前草稿正文。"}
              />
            </label>
            <label>
              <span>标签</span>
              <input
                value={cardForm.tagsText}
                onChange={(event) => onCardFormChange({ ...cardForm, tagsText: event.target.value })}
                placeholder="#广州咖啡 #探店 #周末去哪儿"
              />
            </label>
          </div>
        )}

        <section className="resultBlock evidenceCarryBlock">
          <h3>已携带研究证据</h3>
          <p>{evidenceContext || "还没有研究证据。你仍然可以仅根据文字和参考图生成图片。"}</p>
        </section>

        <div className="actionRow">
          <button
            className="primaryButton"
            disabled={busy === "asset-generate" || busy === "card-generate"}
            onClick={mode === "ai" ? onGenerate : onGenerateCards}
            type="button"
          >
            <Sparkles size={16} />
            {busy === "asset-generate" || busy === "card-generate"
              ? "生成中"
              : mode === "card"
                ? "生成图文卡片"
                : selectedIds.length
                  ? "基于选中图片生成"
                  : "无参考图直接生成"}
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

export function HistoryPanel({
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

export function SettingsPanel({
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
  const textProvider = inferTextProviderPreset(draft);
  const imageProvider = inferImageProviderPreset(draft);
  const accounts = draft.accounts?.length ? draft.accounts : fallbackAccounts;
  const activeAccount = accounts.find((account) => account.id === draft.activeAccountId) ?? accounts[0];

  function selectAccount(accountId: string) {
    const nextAccount = accounts.find((account) => account.id === accountId) ?? accounts[0];
    onChange({
      ...draft,
      activeAccountId: nextAccount.id,
      mcpUrl: nextAccount.mcpUrl
    });
  }

  function updateActiveAccountUrl(mcpUrl: string) {
    onChange({
      ...draft,
      mcpUrl,
      accounts: accounts.map((account) =>
        account.id === activeAccount.id ? { ...account, mcpUrl, updatedAt: new Date().toISOString() } : account
      )
    });
  }

  function updateActiveAccountName(displayName: string) {
    onChange({
      ...draft,
      accounts: accounts.map((account) =>
        account.id === activeAccount.id ? { ...account, displayName, updatedAt: new Date().toISOString() } : account
      )
    });
  }

  function addAccount() {
    const nextId = `xhs-account-${Date.now()}`;
    const nextAccount: XhsAccountProfile = {
      id: nextId,
      displayName: `小红书账号 ${accounts.length + 1}`,
      mcpUrl: draft.mcpUrl || "http://localhost:18060/mcp",
      status: "unknown",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    onChange({
      ...draft,
      accounts: [...accounts, nextAccount],
      activeAccountId: nextId,
      mcpUrl: nextAccount.mcpUrl
    });
  }

  return (
    <section className="panel settingsPanel">
      <div className="panelHeader">
        <div>
          <h2>连接配置</h2>
          <p>普通用户只需要选择服务商并填写 API Key。Base URL 和模型名称会自动设置，并且只保存在本机。</p>
        </div>
      </div>

      <form className="formStack" onSubmit={onSubmit}>
        <section className="settingsGroup accountSettings">
          <div>
            <h3>小红书账号管理</h3>
            <p>每个账号档案对应一个 MCP 地址。保存后，左侧账号卡会显示当前激活账号、登录状态和切换入口。</p>
          </div>
          <div className="formRow">
            <label>
              <span>编辑账号档案</span>
              <select value={activeAccount.id} onChange={(event) => selectAccount(event.target.value)}>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.displayName}
                  </option>
                ))}
              </select>
            </label>
            <button className="secondaryButton accountAddButton" type="button" onClick={addAccount}>
              新增账号档案
            </button>
          </div>
          <label>
            <span>账号显示名</span>
            <input value={activeAccount.displayName} onChange={(event) => updateActiveAccountName(event.target.value)} />
            <small className="fieldHint">这是本地显示名，方便你区分多个账号；真实小红书昵称会在登录检测后显示在左侧账号卡。</small>
          </label>
        </section>

        <label>
          <span>MCP 地址</span>
          <input value={draft.mcpUrl} onChange={(event) => updateActiveAccountUrl(event.target.value)} />
        </label>

        <section className="settingsGroup">
          <div>
            <h3>文本模型</h3>
            <p>用于 AI 对话、研究总结、文案生成和图片理解。大多数人选 Gemini 后只填 API Key 就可以。</p>
          </div>
          <label>
            <span>文本模型服务商</span>
            <select
              value={textProvider}
              onChange={(event) =>
                onChange(applyTextProviderPreset(draft, event.target.value as ModelProviderPreset))
              }
            >
              <option value="gemini">Gemini（推荐，只填 API Key）</option>
              <option value="openai">OpenAI（只填 API Key）</option>
              <option value="custom">自定义 OpenAI-compatible 接口</option>
            </select>
            <small className="fieldHint">{providerDescription(textProvider)}</small>
          </label>

          <label>
            <span>文本 API Key：{settings.textApiKey === "configured" ? "已配置" : "未配置"}</span>
            <input
              autoComplete="off"
              placeholder="填入你自己的 API Key；留空表示不修改已保存的 Key"
              type="password"
              value={draft.textApiKey}
              onChange={(event) => onChange({ ...draft, textApiKey: event.target.value })}
            />
          </label>

          <details className="advancedSettings" open={textProvider === "custom"}>
            <summary>高级设置：文本 Base URL 和模型名称</summary>
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
          </details>
        </section>

        <section className="settingsGroup">
          <div>
            <h3>图片模型</h3>
            <p>用于生成原创配图和产品场景图。基于产品图生成新图时，Gemini 路径支持更完整的参考图输入。</p>
          </div>
          <label>
            <span>图片模型服务商</span>
            <select
              value={imageProvider}
              onChange={(event) =>
                onChange(applyImageProviderPreset(draft, event.target.value as ModelProviderPreset))
              }
            >
              <option value="gemini">Gemini / Nano Banana（推荐，只填 API Key）</option>
              <option value="openai">OpenAI（只填 API Key）</option>
              <option value="custom">自定义 OpenAI-compatible 接口</option>
            </select>
            <small className="fieldHint">{providerDescription(imageProvider)}</small>
          </label>

          <label>
            <span>图片 API Key：{settings.imageApiKey === "configured" ? "已配置" : "未配置"}</span>
            <input
              autoComplete="off"
              placeholder="填入你自己的 API Key；留空表示不修改已保存的 Key"
              type="password"
              value={draft.imageApiKey}
              onChange={(event) => onChange({ ...draft, imageApiKey: event.target.value })}
            />
          </label>

          <details className="advancedSettings" open={imageProvider === "custom"}>
            <summary>高级设置：图片 Base URL 和模型名称</summary>
            <div className="formRow">
              <label>
                <span>图片 Base URL</span>
                <input value={draft.imageBaseUrl} onChange={(event) => onChange({ ...draft, imageBaseUrl: event.target.value })} />
              </label>
              <label>
                <span>图片模型</span>
                <input value={draft.imageModel} onChange={(event) => onChange({ ...draft, imageModel: event.target.value })} />
              </label>
            </div>
          </details>
        </section>

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

        <section className="settingsGroup">
          <div>
            <h3>Agent 发布权限</h3>
            <p>控制网页 AI 对话能不能真实触发外部发布。建议日常使用“半自动”，先生成发布确认单。</p>
          </div>
          <label>
            <span>对话发布模式</span>
            <select
              value={draft.agentPublishPolicy}
              onChange={(event) =>
                onChange({
                  ...draft,
                  agentPublishPolicy: event.target.value as RedactedSettings["agentPublishPolicy"]
                })
              }
            >
              <option value="draft_only">安全模式：只生成内容，不发布</option>
              <option value="review_required">半自动模式：发布前确认</option>
              <option value="auto_publish_allowed">自动模式：允许对话直接发布/定时</option>
            </select>
            <small className="fieldHint">
              真实发布仍会经过标题、正文、标签、图片、可见范围、定时时间和重复发布检查。
            </small>
          </label>
        </section>

        <section className="settingsGroup">
          <div>
            <h3>模型成本与风险控制</h3>
            <p>给文本分析、图片生成和竞品研究设置本地上限，避免一次误操作消耗太多模型额度。</p>
          </div>
          <div className="formRow">
            <label>
              <span>每日文本模型调用上限</span>
              <input
                min={1}
                max={500}
                type="number"
                value={draft.dailyTextCallLimit}
                onChange={(event) => onChange({ ...draft, dailyTextCallLimit: Number(event.target.value) })}
              />
            </label>
            <label>
              <span>每日图片模型调用上限</span>
              <input
                min={1}
                max={100}
                type="number"
                value={draft.dailyImageCallLimit}
                onChange={(event) => onChange({ ...draft, dailyImageCallLimit: Number(event.target.value) })}
              />
            </label>
          </div>
          <label>
            <span>单次研究样本上限</span>
            <input
              min={3}
              max={30}
              type="number"
              value={draft.maxResearchSamples}
              onChange={(event) => onChange({ ...draft, maxResearchSamples: Number(event.target.value) })}
            />
            <small className="fieldHint">AI 工作台和主题研究台都会遵守这个上限。</small>
          </label>
        </section>

        <button className="primaryButton" disabled={busy} type="submit">
          <Save size={16} />
          {busy ? "保存中" : "保存设置"}
        </button>
      </form>
    </section>
  );
}

export function providerDescription(provider: ModelProviderPreset): string {
  if (provider === "custom") {
    return "用于硅基流动、OpenRouter、自建网关等兼容 OpenAI 格式的服务，需要自己填写 Base URL 和模型名称。";
  }
  return modelProviderPresets[provider].description;
}

export function WorkflowResultView({
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

      {!result.draft && (onCopyStudio || onImageStudio) && result.status === "research_ready" ? (
        <section className="resultBlock creativeBriefBlock priorityBriefBlock">
          <div>
            <h3>研究完成，直接进入下一步</h3>
            <p>
              已经提炼出标题、正文、标签和图片风格的学习结论。你可以先补充自己的产品、对象、口吻，再进入文案或图片创作。
            </p>
          </div>
          <label>
            <span>你的真实需求</span>
            <textarea value={creativeBrief} onChange={(event) => setCreativeBrief(event.target.value)} />
          </label>
          <div className="creativeGatewayGrid">
            <button
              className="modeCard active"
              type="button"
              onClick={() => onCopyStudio?.(creativeBrief)}
            >
              <strong>进入文案创作窗口</strong>
              <span>只带标题、正文、标签的学习结论，不把原帖全文塞进对话。</span>
            </button>
            <button
              className="modeCard"
              type="button"
              onClick={() => onImageStudio?.(creativeBrief)}
            >
              <strong>进入图片创作台</strong>
              <span>带图片风格结论生成配图，可上传产品图或直接生成卡片。</span>
            </button>
          </div>
        </section>
      ) : null}

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

export function EvidenceCard({ item, index }: { item: SampleEvidence; index: number }) {
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

export function ResearchSummaryView({ summary }: { summary: ResearchSummary }) {
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

export function InsightList({ title, items, wide = false }: { title: string; items: string[]; wide?: boolean }) {
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

export function Metric({
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

export function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={ok ? "statusPill ok" : "statusPill"}>
      <i />
      {label}
    </span>
  );
}

export function WorkflowRibbon({
  activeSection,
  researchReady,
  draftReady,
  imageReady,
  publishReady,
  runningCount,
  onNavigate
}: {
  activeSection: Section;
  researchReady: boolean;
  draftReady: boolean;
  imageReady: boolean;
  publishReady: boolean;
  runningCount: number;
  onNavigate: (section: Section) => void;
}) {
  const stages: Array<{
    id: string;
    label: string;
    detail: string;
    section: Section;
    ready: boolean;
    icon: typeof Search;
  }> = [
    { id: "research", label: "研究证据", detail: "找样本与洞察", section: "workflow", ready: researchReady, icon: Search },
    { id: "draft", label: "文案草稿", detail: "标题正文标签", section: "chat", ready: draftReady, icon: Bot },
    { id: "visual", label: "发布图片", detail: "生图或卡片", section: "imageStudio", ready: imageReady, icon: ImagePlus },
    { id: "publish", label: "发布计划", detail: "立即或定时", section: "publish", ready: publishReady, icon: FileCheck2 }
  ];

  return (
    <section className="workflowRibbon" aria-label="当前内容流水线">
      <div className="ribbonLead">
        <span>当前流水线</span>
        <strong>{runningCount ? `${runningCount} 个任务运行中` : "等待你的下一步指令"}</strong>
      </div>
      <div className="ribbonStages">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const isActive = activeSection === stage.section;
          return (
            <button
              className={stage.ready ? "ribbonStage ready" : isActive ? "ribbonStage active" : "ribbonStage"}
              data-stage-index={index}
              key={stage.id}
              onClick={() => onNavigate(stage.section)}
              type="button"
            >
              <Icon size={16} />
              <span>
                <strong>{stage.label}</strong>
                <small>{stage.ready ? "已准备" : stage.detail}</small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function titleForSection(section: Section): string {
  const titles: Record<Section, string> = {
    dashboard: "控制台",
    workflow: "主题研究台",
    jobs: "任务进度",
    assets: "素材管理",
    imageStudio: "图片创作台",
    chat: "AI 工作台",
    publish: "发布装配台",
    audit: "发布审计",
    history: "历史记录",
    settings: "模型与连接设置"
  };
  return titles[section];
}

export function subtitleForSection(section: Section): string {
  const subtitles: Record<Section, string> = {
    dashboard: "查看 MCP、模型、任务和发布安全状态。",
    workflow: "按主题、类型、时间和样本数搜索真实笔记，只做研究分析，不生成、不发布。",
    jobs: "追踪搜索、分析、生成图片和发布任务的后台进度。",
    assets: "管理产品原图、参考图和生成结果；主要从 AI 工作台和图片创作台上传使用。",
    imageStudio: "在 AI 生图和图文卡片之间切换，产出可直接发布的视觉素材。",
    chat: "用自然语言调度搜索、分析、文案、图片和发布装配。",
    publish: "合并当前草稿与图片，检查安全项后立即或定时发布。",
    audit: "回看发布预览、确认单、阻止原因、真实发布和定时发布记录。",
    history: "回看研究记录、证据、草稿和生成结果。",
    settings: "配置本地 MCP、文本模型、图片模型与发布权限。"
  };
  return subtitles[section];
}

export function modeLabel(mode: string): string {
  const labels: Record<string, string> = {
    research: "证据研究",
    draft: "草稿模式",
    material: "素材模式",
    publish: "立即发布",
    schedule: "定时发布"
  };
  return labels[mode] ?? mode;
}

export function sampleToEvidence(sample: WorkflowSample): SampleEvidence {
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

export function displayEvidenceImages(item: SampleEvidence): string[] {
  return item.cachedImageUrls?.length ? item.cachedImageUrls : item.imageUrls;
}

export function buildClientEvidenceContext(result: WorkflowResult | null): string {
  if (!result) {
    return "";
  }
  return buildImageCreativeBrief(result).slice(0, 2400);
}

export function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

export function normalizeLocalDatetimeForApi(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)
    ? `${trimmed}+08:00`
    : `${trimmed}:00+08:00`;
}

export function buildDisplayXhsUrl(id: string, xsecToken?: string): string {
  if (!id || id.startsWith("feed-")) {
    return "";
  }

  const baseUrl = `https://www.xiaohongshu.com/explore/${encodeURIComponent(id)}`;
  return xsecToken
    ? `${baseUrl}?xsec_token=${encodeURIComponent(xsecToken)}&xsec_source=pc_search`
    : baseUrl;
}

export function displaySample(sample: WorkflowSample): WorkflowSample & Required<Pick<WorkflowSample, "likes" | "collects" | "comments">> {
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

export function collectDisplayImageUrls(value: unknown): string[] {
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

export function firstRecord(...values: unknown[]): Record<string, unknown> | undefined {
  return values.find(isRecord);
}

export function chooseText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export function chooseNumber(...values: unknown[]): number {
  for (const value of values) {
    const parsed = toDisplayNumber(value);
    if (parsed > 0) {
      return parsed;
    }
  }
  return 0;
}

export function toDisplayNumber(value: unknown): number {
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatMcpEndpoint(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || (parsed.protocol === "https:" ? "443" : "80")}`;
  } catch {
    return url || "未配置 MCP";
  }
}
