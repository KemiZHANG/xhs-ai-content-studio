"use client";

import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
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
  ChatMessage,
  Health,
  JobRecord,
  PendingPublishConfirmation,
  PostProject,
  PublishDraftState,
  RedactedSettings,
  SampleEvidence,
  Section,
  ViralCase,
  WorkflowResult,
  WorkspaceState
} from "@/app/types";
import { getPostStageGuidance } from "@/lib/post-project/guidance";
import { buildEvidenceCitationReport } from "@/lib/post-project/citations";
import { getPostVersionStatus } from "@/lib/post-project/versioning";
import type { PostAction } from "@/lib/post-project/types";

type StudioTab = "insights" | "brief" | "evidence" | "viral" | "references" | "generated" | "publish";

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
  pendingPublish,
  settings,
  health,
  jobs,
  viralCases,
  onResearchFormChange,
  onRunResearch,
  onChatInput,
  onChatSubmit,
  onDraftChange,
  onNavigate,
  onNewProject,
  onGenerateCopy,
  onQuickAction,
  onSelectCopyVersion,
  onSelectImagePromptVersion,
  onSelectPostImages,
  onSaveToViralLibrary,
  onReloadViralLibrary,
  onRefreshViralEvidence,
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
  publishVisibility: RedactedSettings["defaultVisibility"];
  publishScheduleAt: string;
  pendingPublish: PendingPublishConfirmation | null;
  settings: RedactedSettings;
  health: Health | null;
  jobs: JobRecord[];
  viralCases: ViralCase[];
  onResearchFormChange: (next: ResearchForm) => void;
  onRunResearch: (event: FormEvent<HTMLFormElement>) => void;
  onChatInput: (value: string) => void;
  onChatSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDraftChange: (next: PublishDraftState) => void;
  onNavigate: (section: Section) => void;
  onNewProject: () => void;
  onGenerateCopy: (message: string) => void;
  onQuickAction: (action: string) => void;
  onSelectCopyVersion: (versionId: string) => void;
  onSelectImagePromptVersion: (versionId: string) => void;
  onSelectPostImages: (assetIds: string[]) => void;
  onSaveToViralLibrary: (sample: SampleEvidence) => void;
  onReloadViralLibrary: () => void;
  onRefreshViralEvidence: () => void;
  onOpenImageStudio: () => void;
  onOpenPublish: () => void;
}) {
  const [tab, setTab] = useState<StudioTab>("insights");
  const [selectedEvidence, setSelectedEvidence] = useState<SampleEvidence | null>(null);
  const [selectedViralCase, setSelectedViralCase] = useState<ViralCase | null>(null);
  const selectedAssets = assets.filter((asset) => publishAssetIds.includes(asset.id));
  const uploadAssets = assets.filter((asset) => asset.kind === "upload");
  const generatedAssets = [...assets].filter((asset) => asset.kind === "generated").sort(sortNewestAsset);
  const recentGeneratedAssets = uniqueAssets([...selectedAssets, ...generatedAssets]).slice(0, 6);
  const referenceAssets = uniqueAssets([...selectedAssets, ...uploadAssets]).slice(0, 6);
  const runningJob = jobs.find((job) => job.status === "queued" || job.status === "running") ?? null;
  const insights = project?.evidencePack.insights ?? [];
  const viralInsights = insights.filter((insight) => insight.sourceType === "viral_library");
  const realtimeInsights = insights.filter((insight) => insight.sourceType !== "viral_library");
  const keyLearningInsights = pickKeyLearningInsights(insights);
  const keyViralInsights = pickKeyViralInsights(viralInsights);
  const viralCaseById = new Map(viralCases.map((item) => [item.id, item]));
  const viralPack = workflowResult?.viralKnowledge ?? workflowResult?.researchSummary?.viralKnowledge ?? null;
  const samples = project?.selectedSamples ?? workflowResult?.evidence ?? workspace?.selectedSamples ?? [];
  const saveableSamples = samples.filter(isSampleEvidence).slice(0, 3);
  const allowedPostActions = (project?.allowedActions ?? []) as PostAction[];
  const nextActions = allowedPostActions.length ? allowedPostActions.slice(0, 3) : (["search_research"] as PostAction[]);
  const stageGuidance = getPostStageGuidance(project?.currentStage ?? "empty", allowedPostActions);
  const projectTitle = project?.topic || workspace?.topic || researchForm.topic || "未命名帖子项目";
  const canGenerateCopy = Boolean(insights.length || workflowResult?.researchSummary || workspace?.evidenceSummary);
  const latestImagePrompt = publishDraft.imagePrompt || project?.imagePrompts.at(-1)?.value.prompt || "";
  const quality = project?.qualityCheck;
  const brief = project?.creativeBrief;
  const copyVersions = project?.copyVersions ?? [];
  const imagePromptVersions = project?.imagePrompts ?? [];
  const draftEvidenceIds = project?.copyDraft?.draft.basedOnEvidenceIds ?? copyVersions.at(-1)?.basedOnEvidenceIds ?? [];
  const versionStatus = project ? getPostVersionStatus(project) : null;
  const citationReport = project && draftEvidenceIds.length
    ? buildEvidenceCitationReport(project, draftEvidenceIds, project.copyDraft?.draft.evidenceReferences)
    : null;
  const citationTraceReady = Boolean(
    citationReport &&
      citationReport.allEvidenceIds.length &&
      !citationReport.missingEvidenceIds.length &&
      citationReport.sections.every((section) => section.insights.length)
  );
  const hasVisualDirection = Boolean(latestImagePrompt || project?.visualDirection);
  const activeAccount = settings.accounts.find((account) => account.id === settings.activeAccountId) ?? settings.accounts[0];
  const accountReady = Boolean(health?.loggedIn);
  const publishReady = Boolean(
    publishDraft.title.trim() &&
      publishDraft.content.trim() &&
      publishDraft.tagsText.trim() &&
      selectedAssets.length &&
      hasVisualDirection &&
      accountReady &&
      quality?.canPublish === true &&
      versionStatus?.qualityGateFresh === true
  );

  const generatedCopyPrompt = useMemo(
    () =>
      [
        "请基于当前 PostProject 的证据和 CreativeBrief 生成一篇原创小红书图文笔记，不要重新搜索。",
        `主题：${projectTitle}`,
        `内容类型：${researchForm.contentType}`,
        `补充要求：${researchForm.requirements || "真实分享，不硬广，结构清楚，有收藏价值。"}`,
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
          <p>围绕一篇帖子推进：先研究真实笔记，再生成文案、图片方向、发布预览和安全检查。</p>
        </div>
        <div className="postStageStrip">
          <StagePill label="阶段" value={labelForStage(project?.currentStage ?? "empty")} />
          <StagePill label="研究" value={samples.length ? `${samples.length} 条证据` : "待研究"} />
          <StagePill label="文案" value={publishDraft.title ? "可编辑" : "待生成"} />
          <StagePill label="图片" value={selectedAssets.length ? `${selectedAssets.length} 张` : "待选择"} />
          <StagePill label="发布" value={labelForPublishStatus(project?.publishPlan?.status)} />
        </div>
        <div className="nextActionBar">
          <strong>{stageGuidance.title}</strong>
          <p>{stageGuidance.description}</p>
          <div className="nextActionButtons">
            {nextActions.map((action) => (
              <button className={action === stageGuidance.primaryAction ? "isPrimaryNext" : undefined} key={action} type="button" onClick={() => onQuickAction(action)}>
                {labelForAction(action)}
              </button>
            ))}
          </div>
          <button className="secondaryButton" onClick={onNewProject} type="button">新建项目</button>
        </div>
      </section>

      <div className="postStudioGrid">
        <section className="panel studioAgentPane">
          <div className="panelHeader compact">
            <div>
              <h2>AI Agent</h2>
              <p>像内容导演一样工作：先判断阶段和信息是否足够，再搜索、总结、生成或追问。</p>
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
                <div className="chatBubbleHeader">
                  <strong>{message.role === "user" ? "你" : "AI Agent"}</strong>
                  {message.role === "assistant" && message.intent ? <span>{message.intent}</span> : null}
                </div>
                <p>{message.content}</p>
                {message.role === "assistant" ? (
                  <AgentStructuredMessage message={message} onQuickAction={onQuickAction} />
                ) : null}
              </article>
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
              {copyVersions.length ? (
                <section className="versionSwitcher" aria-label="文案版本">
                  <div>
                    <strong>文案版本</strong>
                    <span>选择一个版本会回填到画布，发布前仍需确认。</span>
                  </div>
                  <div>
                    {copyVersions.slice(-4).map((version, index) => (
                      <article className="versionCard" key={version.id}>
                        <div>
                          <strong>{version.value.title || version.label || `版本 ${index + 1}`}</strong>
                          <span>{formatDateTime(version.createdAt)} · 证据 {version.basedOnEvidenceIds.length}</span>
                        </div>
                        <p>{summarizeDraftDiff(publishDraft, version.value)}</p>
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
              {imagePromptVersions.length ? (
                <section className="versionSwitcher compactVersionSwitcher" aria-label="图片 Prompt 版本">
                  <div>
                    <strong>Prompt 版本</strong>
                    <span>用于图片创作台继续生图。</span>
                  </div>
                  <div>
                    {imagePromptVersions.slice(-3).map((version, index) => (
                      <article className="versionCard promptVersionCard" key={version.id}>
                        <div>
                          <strong>{version.label || `Prompt ${index + 1}`}</strong>
                          <span>{formatDateTime(version.createdAt)} · 证据 {version.basedOnEvidenceIds.length}</span>
                        </div>
                        <p>{summarizePromptDiff(latestImagePrompt, version.value.prompt)}</p>
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
                  </div>
                </section>
              ) : null}
              {versionStatus ? (
                <section className={versionStatus.qualityGateFresh ? "versionIntegrity ok" : "versionIntegrity warn"} aria-label="版本与发布检查状态">
                  <strong>{versionStatus.qualityGateFresh ? "版本已确认" : "版本需要复核"}</strong>
                  <p>{versionStatus.summary}</p>
                  <div>
                    <span>文案：{versionStatus.activeCopyVersionId ?? "待生成"}</span>
                    <span>Prompt：{versionStatus.activeImagePromptVersionIds.length || 0} 个</span>
                  </div>
                  {versionStatus.warnings.slice(0, 3).map((warning) => (
                    <small key={warning}>{warning}</small>
                  ))}
                </section>
              ) : null}
              {draftEvidenceIds.length ? (
                <section className="evidenceReferenceStrip" aria-label="文案证据引用">
                  <strong>证据引用</strong>
                  <span>{draftEvidenceIds.slice(0, 5).join(" / ")}</span>
                </section>
              ) : null}
            </div>
          </div>

          <div className="canvasActionRow">
            <button className="secondaryButton" onClick={() => onQuickAction("plan_visuals")} type="button">
              <Sparkles size={16} />
              规划图片方向
            </button>
            <button className="secondaryButton" onClick={() => onQuickAction("generate_images")} type="button">
              <ImagePlus size={16} />
              Agent 生图
            </button>
            <button className="primaryButton" onClick={() => onQuickAction("run_quality_gate")} disabled={!publishDraft.title || !publishDraft.content} type="button">
              <ShieldCheck size={16} />
              发布检查
            </button>
          </div>
        </section>

        <aside className="panel studioSidePane">
          <div className="studioTabs" role="tablist">
            {[
              { id: "insights", label: "结论" },
              { id: "brief", label: "Brief" },
              { id: "evidence", label: "证据" },
              { id: "viral", label: "爆款库" },
              { id: "references", label: "图片参考" },
              { id: "generated", label: "生成素材" },
              { id: "publish", label: "检查" }
            ].map((item) => (
              <button className={tab === item.id ? "active" : ""} key={item.id} onClick={() => setTab(item.id as StudioTab)} type="button">
                {item.label}
              </button>
            ))}
          </div>

          {tab === "insights" ? (
            <SideSection icon={FileText} title="可学习结论">
              <div className="evidenceSourceStrip">
                <span>实时证据 {realtimeInsights.length}</span>
                <span>爆款库 {viralInsights.length}</span>
              </div>
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
                </>
              ) : (
                <p className="muted">研究完成后这里只显示 3-5 条核心结论；完整样本、评论和原文放在证据详情里。</p>
              )}
            </SideSection>
          ) : null}

          {tab === "brief" ? (
            <SideSection icon={Sparkles} title="CreativeBrief">
              {brief ? (
                <div className="briefStack">
                  <BriefLine label="人群" value={brief.audience} />
                  <BriefLine label="痛点" value={brief.painPoint} />
                  <BriefLine label="角度" value={brief.contentAngle} />
                  <BriefLine label="语气" value={brief.tone} />
                  <BriefLine label="视觉" value={brief.visualMood} />
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
            <SideSection icon={Library} title="研究证据">
              <strong>{samples.length} 条样本</strong>
              <p className="muted">默认只展示摘要；完整笔记、评论和图片证据保留在主题研究台。</p>
              {saveableSamples.length ? (
                <div className="miniEvidenceList">
                  {saveableSamples.map((sample) => (
                    <article key={sample.id}>
                      <strong>{sample.title}</strong>
                      <span>赞 {sample.likes} · 藏 {sample.collects} · 评 {sample.comments}</span>
                      <div className="evidenceActions">
                        <button className="textButton" type="button" onClick={() => setSelectedEvidence(sample)}>
                          查看详情
                        </button>
                        <button className="textButton" type="button" onClick={() => onSaveToViralLibrary(sample)}>
                          保存到爆款库
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
              <button className="secondaryButton fullWidth" onClick={() => saveableSamples[0] ? setSelectedEvidence(saveableSamples[0]) : onNavigate("workflow")} type="button">查看证据详情</button>
            </SideSection>
          ) : null}

          {tab === "viral" ? (
            <SideSection icon={Library} title="爆款库证据">
              <strong>{viralCases.length} 条历史爆款规律</strong>
              <p className="muted">这里长期沉淀标题钩子、正文结构、标签组合、图片风格和评论关注点。默认只显示关键规律，不保存原文合集。</p>
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
              {viralPack?.strategyReport ? (
                <div className="viralStrategyCard">
                  <strong>爆款策略摘要</strong>
                  <p>{viralPack.strategyReport.summary}</p>
                  <div className="viralStrategyGrid">
                    <KnowledgeList title="标题打法" items={viralPack.strategyReport.titleMoves} />
                    <KnowledgeList title="正文结构" items={viralPack.strategyReport.structureMoves} />
                    <KnowledgeList title="图片方向" items={viralPack.strategyReport.visualMoves} />
                    <KnowledgeList title="原创边界" items={viralPack.strategyReport.originalityRules} />
                  </div>
                </div>
              ) : null}
              {viralInsights.length ? (
                <div className="miniEvidenceList">
                  {keyViralInsights.map((insight) => (
                    <article className="keyViralInsight" key={insight.id}>
                      <span>{labelForInsight(insight.type)} · 爆款库 · 置信 {Math.round(insight.confidence * 100)}%</span>
                      <p>{insight.insight}</p>
                      <small>{insight.id}</small>
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
                      <p>{item.extractedInsights.reusableRules[0] || item.contentStructure.join(" / ")}</p>
                      <span>赞 {item.metrics.likes} · 藏 {item.metrics.collects}</span>
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
              <strong>{selectedAssets.length ? `已选 ${selectedAssets.length} 张发布图片` : "还没有选中发布图片"}</strong>
              <p className="muted">这里主要放产品原图、参考图和当前选中图。默认不铺开全部素材，更多管理在 Assets。</p>
              {referenceAssets.length ? (
                <div className="studioAssetGrid selectable">
                  {referenceAssets.map((asset) => {
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
                <p className="muted">还没有产品图或参考图。可以去图片创作台上传，也可以直接让 Agent 生成图片方向。</p>
              )}
              {project?.finalPost?.imageIds.length ? (
                <p className="muted">最终帖子图片：{project.finalPost.imageIds.slice(0, 4).join(" / ")}</p>
              ) : null}
              <div className="inlineActionGrid">
                <button className="secondaryButton fullWidth" onClick={onOpenImageStudio} type="button">高级图片创作台</button>
                <button className="secondaryButton fullWidth" onClick={() => onNavigate("assets")} type="button">管理全部素材</button>
              </div>
            </SideSection>
          ) : null}

          {tab === "generated" ? (
            <SideSection icon={ImagePlus} title="已生成素材">
              <strong>{recentGeneratedAssets.length ? `最近 ${recentGeneratedAssets.length} 张` : "还没有生成图"}</strong>
              <p className="muted">这里只展示当前选中图和最近生成结果，避免素材过多干扰创作决策。</p>
              {recentGeneratedAssets.length ? (
                <div className="studioAssetGrid selectable">
                  {recentGeneratedAssets.map((asset) => {
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
                        <span>{selected ? "已选" : "生成图"}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="muted">可以让 Agent 生成配图，或在图片创作台生成 AI 生图 / 图文卡片。</p>
              )}
              <div className="inlineActionGrid">
                <button className="secondaryButton fullWidth" onClick={() => onQuickAction("generate_images")} type="button">Agent 生成配图</button>
                <button className="secondaryButton fullWidth" onClick={onOpenImageStudio} type="button">打开图片创作台</button>
              </div>
            </SideSection>
          ) : null}

          {tab === "publish" ? (
            <SideSection icon={CheckCircle2} title="发布检查">
              <CheckItem ok={Boolean(publishDraft.title)} label="标题已填写" />
              <CheckItem ok={Boolean(publishDraft.content)} label="正文已填写" />
              <CheckItem ok={Boolean(publishDraft.tagsText)} label="标签已填写" />
              <CheckItem ok={Boolean(selectedAssets.length)} label="已选择图片" />
              <CheckItem ok={hasVisualDirection} label="图片方向 / Prompt 已确认" />
              <CheckItem ok={citationTraceReady} label="字段级证据引用可追溯" />
              <CheckItem ok={versionStatus?.qualityGateFresh === true} label="最终版本与 Quality Gate 一致" />
              <CheckItem ok={accountReady} label={`账号：${activeAccount?.displayName ?? "未配置"}`} />
              <CheckItem ok={publishVisibility === "仅自己可见"} label={`可见范围：${publishVisibility}`} />
              <CheckItem ok={!publishScheduleAt || Date.parse(publishScheduleAt) > Date.now()} label={publishScheduleAt ? `定时：${publishScheduleAt}（本地时区）` : "发布时间：立即"} />
              <CheckItem ok={settings.defaultAutoPublish === false} label="自动发布默认关闭" />
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
                        accountReady,
                        quality,
                        qualityGateFresh: versionStatus?.qualityGateFresh === true
                      })}
                </p>
                <span>确认单：{pendingPublish ? `${pendingPublish.mode === "schedule" ? "定时" : "立即"} · 待人工确认` : "未生成"}</span>
                {health?.activeAccount?.loginName ? <span>登录名：{health.activeAccount.loginName}</span> : null}
              </div>
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
                <button className="primaryButton fullWidth" disabled={!publishReady} onClick={onOpenPublish} type="button">进入发布确认</button>
              </div>
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

      {selectedEvidence ? (
        <EvidenceDrawer sample={selectedEvidence} onClose={() => setSelectedEvidence(null)} onSave={() => onSaveToViralLibrary(selectedEvidence)} />
      ) : null}
      {selectedViralCase ? (
        <ViralCaseDrawer viralCase={selectedViralCase} onClose={() => setSelectedViralCase(null)} />
      ) : null}
    </div>
  );
}

function AgentStructuredMessage({
  message,
  onQuickAction
}: {
  message: ChatMessage;
  onQuickAction: (action: string) => void;
}) {
  const cards = (message.cards ?? []).slice(0, 4);
  const trace = (message.toolTrace ?? []).slice(-4);
  const actions = (message.quickActions ?? []).slice(0, 3);
  if (!cards.length && !trace.length && !actions.length && !message.questions?.length) {
    return null;
  }

  return (
    <div className="agentMessageMeta">
      {cards.length ? (
        <div className="agentCardStrip">
          {cards.map((card) => (
            <article className={`agentMiniCard ${card.type}`} key={card.id}>
              <span>{labelForAgentCard(card.type)}</span>
              <strong>{card.title}</strong>
              <p>{card.summary}</p>
            </article>
          ))}
        </div>
      ) : null}

      {message.questions?.length ? (
        <div className="agentQuestionBox">
          <strong>Agent 还需要你补充</strong>
          {message.questions.slice(0, 3).map((question) => <p key={question}>{question}</p>)}
        </div>
      ) : null}

      {trace.length ? (
        <details className="agentTraceMini">
          <summary>工具轨迹 · {trace.length}</summary>
          {trace.map((item) => (
            <div key={item.id}>
              <span>{item.status}</span>
              <p>{item.label}：{item.detail}</p>
            </div>
          ))}
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

function StagePill({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <em>{label}</em>
      <strong>{value}</strong>
    </span>
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
  const labels: Record<string, string> = {
    start_brief: "补充需求",
    update_brief_inputs: "完善 Brief",
    search_research: "搜索笔记",
    summarize_evidence: "总结证据",
    create_creative_brief: "生成 Brief",
    generate_copy: "生成文案",
    revise_copy: "修改文案",
    plan_visuals: "规划图片",
    generate_image_prompts: "生成图片 Prompt",
    generate_images: "生成图片",
    select_images: "选图",
    assemble_post: "组装帖子",
    run_quality_gate: "质量检查",
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
    evidence_summary: "证据摘要",
    viral_knowledge: "爆款库",
    evidence_citations: "证据引用",
    creative_brief: "CreativeBrief",
    copy_draft: "文案草稿",
    visual_direction: "图片方向",
    image_prompt: "图片 Prompt",
    publish_check: "发布检查",
    quality_check: "质量检查"
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

function buildPublishReadinessHint({
  title,
  content,
  tagsText,
  imageCount,
  hasVisualDirection,
  accountReady,
  quality,
  qualityGateFresh
}: {
  title: string;
  content: string;
  tagsText: string;
  imageCount: number;
  hasVisualDirection: boolean;
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
