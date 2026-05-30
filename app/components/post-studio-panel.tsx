"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  FileText,
  ImagePlus,
  Library,
  MessageSquareText,
  Rocket,
  Search,
  Send,
  ShieldCheck
} from "lucide-react";
import type {
  AssetRecord,
  ChatMessage,
  JobRecord,
  PostProject,
  PublishDraftState,
  RedactedSettings,
  Section,
  WorkflowResult,
  WorkspaceState
} from "@/app/types";

type StudioTab = "insights" | "evidence" | "assets" | "publish";

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
  settings,
  jobs,
  onResearchFormChange,
  onRunResearch,
  onChatInput,
  onChatSubmit,
  onDraftChange,
  onNavigate,
  onNewProject,
  onGenerateCopy,
  onOpenImageStudio,
  onOpenPublish
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
  settings: RedactedSettings;
  jobs: JobRecord[];
  onResearchFormChange: (next: ResearchForm) => void;
  onRunResearch: (event: FormEvent<HTMLFormElement>) => void;
  onChatInput: (value: string) => void;
  onChatSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDraftChange: (next: PublishDraftState) => void;
  onNavigate: (section: Section) => void;
  onNewProject: () => void;
  onGenerateCopy: (message: string) => void;
  onOpenImageStudio: () => void;
  onOpenPublish: () => void;
}) {
  const [tab, setTab] = useState<StudioTab>("insights");
  const selectedAssets = assets.filter((asset) => publishAssetIds.includes(asset.id));
  const runningJob = jobs.find((job) => job.status === "queued" || job.status === "running") ?? null;
  const insights = project?.evidencePack.insights ?? [];
  const samples = project?.selectedSamples ?? workflowResult?.evidence ?? workspace?.selectedSamples ?? [];
  const nextActions = project?.allowedActions.slice(0, 3) ?? ["search_research"];
  const projectTitle = project?.topic || workspace?.topic || researchForm.topic || "未命名帖子项目";
  const canGenerateCopy = Boolean(insights.length || workflowResult?.researchSummary || workspace?.evidenceSummary);

  const generatedCopyPrompt = useMemo(
    () =>
      [
        "请基于当前 PostProject 的证据和创作简报生成一篇原创小红书图文笔记，不要重新搜索。",
        `主题：${projectTitle}`,
        `内容类型：${researchForm.contentType}`,
        `补充要求：${researchForm.requirements || "真实分享，不广告，结构清楚，有可收藏价值。"}`,
        "请输出：标题候选、最终标题、正文、标签、图片方向和发布前风险提醒。"
      ].join("\n"),
    [projectTitle, researchForm.contentType, researchForm.requirements]
  );

  return (
    <div className="postStudio">
      <section className="postStudioTop panel">
        <div>
          <span className="flowKicker">Post Studio</span>
          <h2>{projectTitle}</h2>
          <p>围绕一个帖子项目推进：研究证据、生成文案、规划图片、组装发布都在这里完成。</p>
        </div>
        <div className="postStageStrip">
          <StagePill label="阶段" value={labelForStage(project?.currentStage ?? "empty")} />
          <StagePill label="研究" value={samples.length ? `${samples.length} 条证据` : "待研究"} />
          <StagePill label="文案" value={publishDraft.title ? "可编辑" : "待生成"} />
          <StagePill label="图片" value={selectedAssets.length ? `${selectedAssets.length} 张` : "待选择"} />
          <StagePill label="发布" value={labelForPublishStatus(project?.publishPlan?.status)} />
        </div>
        <div className="nextActionBar">
          <strong>下一步</strong>
          <span>{nextActions.map(labelForAction).join(" / ")}</span>
          <button className="secondaryButton" onClick={onNewProject} type="button">新建项目</button>
        </div>
      </section>

      <div className="postStudioGrid">
        <section className="panel studioAgentPane">
          <div className="panelHeader compact">
            <div>
              <h2>AI Agent</h2>
              <p>自然对话 + 工具进度。信息不足时先补充需求，再执行。</p>
            </div>
          </div>

          <form className="studioResearchBox" onSubmit={onRunResearch}>
            <label>
              <span>主题</span>
              <input value={researchForm.topic} onChange={(event) => onResearchFormChange({ ...researchForm, topic: event.target.value })} />
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

          {runningJob ? (
            <div className="studioToolTrace">
              <strong>{runningJob.title}</strong>
              <div className="miniProgress"><i style={{ width: `${runningJob.progress}%` }} /></div>
              <span>{runningJob.status} · {runningJob.progress}%</span>
            </div>
          ) : null}

          <div className="studioChatList">
            {messages.slice(-6).map((message, index) => (
              <article className={message.role === "user" ? "studioChatBubble user" : "studioChatBubble"} key={message.id ?? `${message.role}-${index}`}>
                <strong>{message.role === "user" ? "你" : "AI"}</strong>
                <p>{message.content}</p>
              </article>
            ))}
            {!messages.length ? (
              <div className="studioEmpty">
                <MessageSquareText size={22} />
                <strong>告诉 Agent 你要做什么</strong>
                <p>例如：找最近一周高收藏笔记，生成一篇适合探店账号的图文笔记。</p>
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
              <p>最终帖子画布。标题、正文、标签和图片在这里合并。</p>
            </div>
            <button className="secondaryButton" disabled={!canGenerateCopy} onClick={() => onGenerateCopy(generatedCopyPrompt)} type="button">
              <Bot size={16} />
              生成文案
            </button>
          </div>

          <div className="postPreviewShell">
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
            <div className="postEditStack">
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
                <textarea value={publishDraft.imagePrompt} onChange={(event) => onDraftChange({ ...publishDraft, imagePrompt: event.target.value })} placeholder="文案和图片共享 CreativeBrief，图片方向会沉淀在这里。" />
              </label>
            </div>
          </div>

          <div className="canvasActionRow">
            <button className="secondaryButton" onClick={onOpenImageStudio} type="button">
              <ImagePlus size={16} />
              生成/选择图片
            </button>
            <button className="primaryButton" onClick={onOpenPublish} disabled={!publishDraft.title || !publishDraft.content} type="button">
              <ShieldCheck size={16} />
              发布检查
            </button>
          </div>
        </section>

        <aside className="panel studioSidePane">
          <div className="studioTabs" role="tablist">
            {[
              { id: "insights", label: "结论" },
              { id: "evidence", label: "证据" },
              { id: "assets", label: "素材" },
              { id: "publish", label: "检查" }
            ].map((item) => (
              <button className={tab === item.id ? "active" : ""} key={item.id} onClick={() => setTab(item.id as StudioTab)} type="button">
                {item.label}
              </button>
            ))}
          </div>

          {tab === "insights" ? (
            <SideSection icon={FileText} title="可学习结论">
              {insights.length ? (
                insights.slice(0, 5).map((insight) => (
                  <article className="insightLine" key={insight.id}>
                    <span>{labelForInsight(insight.type)}</span>
                    <p>{insight.insight}</p>
                  </article>
                ))
              ) : (
                <p className="muted">研究完成后这里只显示 3-5 条核心结论，完整样本放到证据详情里。</p>
              )}
            </SideSection>
          ) : null}

          {tab === "evidence" ? (
            <SideSection icon={Library} title="研究证据">
              <strong>{samples.length} 条样本</strong>
              <p className="muted">默认只展示摘要；完整笔记、评论和图片证据保留在主题研究台。</p>
              <button className="secondaryButton fullWidth" onClick={() => onNavigate("workflow")} type="button">查看证据详情</button>
            </SideSection>
          ) : null}

          {tab === "assets" ? (
            <SideSection icon={ImagePlus} title="图片与素材">
              {selectedAssets.length ? (
                <div className="studioAssetGrid">
                  {selectedAssets.slice(0, 4).map((asset) => (
                    <img alt={asset.name} key={asset.id} src={`/api/assets/file/${asset.id}`} />
                  ))}
                </div>
              ) : (
                <p className="muted">还没有选中发布图片。可以上传产品图、生成场景图或生成图文卡片。</p>
              )}
              <button className="secondaryButton fullWidth" onClick={onOpenImageStudio} type="button">打开图片创作台</button>
            </SideSection>
          ) : null}

          {tab === "publish" ? (
            <SideSection icon={CheckCircle2} title="发布检查">
              <CheckItem ok={Boolean(publishDraft.title)} label="标题已填写" />
              <CheckItem ok={Boolean(publishDraft.content)} label="正文已填写" />
              <CheckItem ok={Boolean(publishDraft.tagsText)} label="标签已填写" />
              <CheckItem ok={Boolean(selectedAssets.length)} label="已选择图片" />
              <CheckItem ok={settings.defaultAutoPublish === false} label="自动发布默认关闭" />
              <button className="primaryButton fullWidth" onClick={onOpenPublish} type="button">进入发布确认</button>
            </SideSection>
          ) : null}

          <div className="advancedEntry">
            <strong>高级入口</strong>
            <button onClick={() => onNavigate("chat")} type="button">AI 工作台</button>
            <button onClick={() => onNavigate("workflow")} type="button">主题研究台</button>
            <button onClick={() => onNavigate("jobs")} type="button">任务进度</button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StagePill({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <em>{label}</em>
      <strong>{value}</strong>
    </span>
  );
}

function SideSection({ icon: Icon, title, children }: { icon: typeof FileText; title: string; children: React.ReactNode }) {
  return (
    <section className="studioSideSection">
      <h3><Icon size={16} />{title}</h3>
      {children}
    </section>
  );
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return <span className={ok ? "checkItem ok" : "checkItem"}>{ok ? "✓" : "·"} {label}</span>;
}

function labelForStage(stage: PostProject["currentStage"]): string {
  const labels: Record<PostProject["currentStage"], string> = {
    empty: "空项目",
    briefing: "补充需求",
    researching: "研究中",
    evidence_ready: "证据已就绪",
    brief_ready: "创作简报",
    copy_drafting: "文案生成中",
    copy_ready: "文案已就绪",
    visual_planning: "图片方向",
    image_prompt_ready: "图片提示词",
    image_generating: "图片生成中",
    image_ready: "图片已就绪",
    assembling: "组装帖子",
    reviewing: "发布检查",
    scheduled: "已定时",
    published: "已发布",
    failed: "失败"
  };
  return labels[stage];
}

function labelForAction(action: string): string {
  const labels: Record<string, string> = {
    start_brief: "补充需求",
    update_brief_inputs: "完善简报",
    search_research: "搜索笔记",
    summarize_evidence: "总结证据",
    create_creative_brief: "生成创作简报",
    generate_copy: "生成文案",
    revise_copy: "修改文案",
    plan_visuals: "规划图片",
    generate_image_prompts: "生成图片提示词",
    generate_images: "生成图片",
    select_images: "选图",
    assemble_post: "组装帖子",
    run_quality_gate: "发布检查",
    request_publish_confirmation: "发布确认",
    schedule_publish: "定时发布",
    publish_now: "立即发布",
    recover: "恢复"
  };
  return labels[action] ?? action;
}

function labelForInsight(type: string): string {
  const labels: Record<string, string> = {
    title: "标题",
    copy: "正文",
    tag: "标签",
    visual: "图片",
    comment: "评论",
    audience: "人群",
    pain_point: "痛点"
  };
  return labels[type] ?? type;
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
