"use client";

import { ClipboardEvent, DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import { MessageSquareText, Search, Upload, X } from "lucide-react";
import { buildCopyCreativeBrief } from "@/lib/workflows/creative-briefs";
import { WorkspaceCanvas } from "@/app/components/workspace-canvas";
import {
  canShowCurrentDraftInConversation,
  getConversationContextWarning,
  getConversationProjectContext,
  getConversationSubmitGuard
} from "@/app/components/chat-context";
import type {
  AssetRecord,
  ChatConversation,
  ChatMessage,
  CreatorMemoryProfile,
  DraftRecord,
  JobRecord,
  PostProject,
  WorkflowResult,
  WorkspaceState
} from "@/app/types";

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
  postProject,
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
  postProject?: PostProject | null;
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
  const [showComposerContext, setShowComposerContext] = useState(false);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const latestConversationId = conversations[0]?.id ?? activeConversationId;
  const isLatestConversation = !activeConversationId || activeConversationId === latestConversationId;
  const conversationContext = getConversationProjectContext(messages);
  const conversationWarning = getConversationContextWarning({
    isLatestConversation,
    conversationPostProjectId: conversationContext.postProjectId,
    currentPostProjectId: postProject?.id
  });
  const submitGuard = getConversationSubmitGuard({
    isLatestConversation,
    conversationPostProjectId: conversationContext.postProjectId,
    currentPostProjectId: postProject?.id
  });
  const showCurrentDraftStrip = Boolean(
    currentDraft &&
      canShowCurrentDraftInConversation({
        hasCurrentDraft: Boolean(currentDraft),
        isLatestConversation,
        conversationPostProjectId: conversationContext.postProjectId,
        currentPostProjectId: postProject?.id
      })
  );
  const latestWorkflowResultIndex = messages.reduce((latest, message, index) => (message.workflowResult ? index : latest), -1);

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

        {conversationWarning ? (
          <section className="contextWarning">
            <strong>历史对话上下文</strong>
            <p>{conversationWarning}</p>
            {submitGuard.reason ? <p>{submitGuard.reason}</p> : null}
            <button className="secondaryButton" onClick={onNewConversation} type="button">
              新建干净对话
            </button>
          </section>
        ) : null}

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
                    requiresConfirmation={
                      !(message.postProjectId && postProject?.id && message.postProjectId === postProject.id) &&
                      (!isLatestConversation || index !== latestWorkflowResultIndex)
                    }
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
              disabled={submitGuard.blocked || busy}
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
            <button className="primaryButton" disabled={busy || submitGuard.blocked} type="submit">
              <Search size={16} />
              {submitGuard.blocked ? "只读" : busy ? "处理中" : "发送"}
            </button>
          </form>
        </div>
      </section>

      <WorkspaceCanvas
        workspace={workspace}
        currentDraft={currentDraft}
        postProject={postProject}
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
  requiresConfirmation,
  onDraftCommand,
  onCopyStudio,
  onImageStudio,
  onOpenPublish
}: {
  result: WorkflowResult;
  requiresConfirmation?: boolean;
  onDraftCommand: (message: string) => void;
  onCopyStudio: (brief?: string) => void;
  onImageStudio: () => void;
  onOpenPublish: (draft?: NonNullable<WorkflowResult["draft"]>) => void;
}) {
  const [armed, setArmed] = useState(false);
  const canUseResult = !requiresConfirmation || armed;
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
      {requiresConfirmation ? (
        <div className={armed ? "chatResultGuard ready" : "chatResultGuard"}>
          <strong>{armed ? "已确认使用这条结果" : "历史结果需确认"}</strong>
          <p>继续操作会把这条研究或草稿带入当前 PostProject。若要从零开始，请先新建项目。</p>
          {!armed ? (
            <button className="secondaryButton" onClick={() => setArmed(true)} type="button">
              使用这条结果
            </button>
          ) : null}
        </div>
      ) : null}
      {canUseResult ? (
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
      ) : null}
    </section>
  );
}
