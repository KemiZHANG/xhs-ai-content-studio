"use client";

import {
  Bot,
  CheckCircle2,
  FileCheck2,
  ImagePlus,
  Play,
  RefreshCw,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { FormEvent, useState } from "react";
import type {
  AssetRecord,
  ChatConversation,
  ChatMessage,
  CreatorMemoryProfile,
  DraftRecord,
  Health,
  JobRecord,
  PublishAuditRecord,
  Section,
  WorkflowResult,
  WorkflowRun,
  WorkspaceState
} from "@/app/types";
import { AcceptanceStatusCompactPanel } from "@/app/components/acceptance-status-panel";
import { getJobDisplayMeta } from "@/app/components/job-display";
import { modeLabel } from "@/app/components/xhs-display-utils";
import { Metric, StatusPill } from "@/app/components/status-badges";
import { WorkflowResultView } from "@/app/components/workflow-result-view";

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
        <AcceptanceStatusCompactPanel />
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
            <span>完成后会把“标题怎么学、正文怎么学、标签怎么学、图片怎么学”带回 Post Studio。</span>
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
          <p className="muted">研究完成后这里会显示真实笔记、互动数据、正文片段、图片证据和可学习要点。日常创作会回到 Post Studio 继续写文案、生成图片和做发布检查。</p>
        )}
      </section>
    </div>
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
                    {audit.scheduleAt ? ` · 定时 ${formatAuditSchedule(audit)}` : ""}
                  </p>
                  <p className="muted">内容哈希：{audit.contentHash}；确认单：{audit.publishIntentId ?? "-"}</p>
                  {audit.evidenceCitationSummary ? (
                    <p className="muted">
                      证据追踪：{audit.evidenceCitationSummary.summary}
                      {formatAuditViralTraceLine(audit.evidenceCitationSummary.viralEvidenceTrace)}
                      {audit.evidenceCitationSummary.missingEvidenceIds.length ? `；缺失 ${audit.evidenceCitationSummary.missingEvidenceIds.length} 个` : ""}
                    </p>
                  ) : null}
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

function formatAuditSchedule(audit: PublishAuditRecord): string {
  return audit.scheduleTimezone ? `${audit.scheduleAt}（${audit.scheduleTimezone}）` : audit.scheduleAt ?? "";
}

function formatAuditViralTraceLine(trace: NonNullable<PublishAuditRecord["evidenceCitationSummary"]>["viralEvidenceTrace"]): string {
  if (!Array.isArray(trace) || !trace.length) return "";
  const visible = trace
    .map((item) => {
      const caseId = item.caseId?.trim();
      if (!caseId) return "";
      const sourceSampleId = item.sourceSampleId?.trim();
      return sourceSampleId ? `${caseId}/${sourceSampleId}` : caseId;
    })
    .filter(Boolean)
    .slice(0, 3);
  return visible.length ? `；爆款追溯 ${trace.length} 条：${visible.join("、")}` : "";
}

export function JobsPanel({
  jobs,
  activeJob,
  workspace,
  onReload,
  onSelectJob,
  onViewResult,
  onRestoreResult,
  onOpenImageStudio
}: {
  jobs: JobRecord[];
  activeJob?: JobRecord;
  workspace?: WorkspaceState | null;
  onReload: () => void;
  onSelectJob: (job: JobRecord) => void;
  onViewResult: (job: JobRecord) => void;
  onRestoreResult: (job: JobRecord) => void;
  onOpenImageStudio: () => void;
}) {
  const activeJobMeta = activeJob ? getJobDisplayMeta(activeJob, workspace) : null;

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
              <div className="jobTitlePills">
                <StatusPill ok={activeJob.status === "completed"} label={activeJobMeta?.statusLabel ?? `${activeJob.status} · ${activeJob.progress}%`} />
                {activeJobMeta ? <StatusPill ok={activeJobMeta.scopeTone === "current"} label={activeJobMeta.scopeLabel} /> : null}
              </div>
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
                <p>{activeJobMeta?.resultHint ?? "研究结果已经准备好，可以回到 Post Studio 查看证据、生成文案和选择图片。"}</p>
                <div className="actionRow">
                  <button className="primaryButton" disabled={!activeJobMeta?.canViewResult} onClick={() => onViewResult(activeJob)} type="button">
                    查看研究结果
                  </button>
                  <button className="secondaryButton" disabled={!activeJobMeta?.canRestoreResult} onClick={() => onRestoreResult(activeJob)} type="button">
                    恢复为当前项目
                  </button>
                  <button className="secondaryButton" onClick={onOpenImageStudio} type="button">
                    回到 Post Studio 图片面板
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
            jobs.map((job) => {
              const meta = getJobDisplayMeta(job, workspace);
              return (
                <article className={activeJob?.id === job.id ? "historyItem active jobHistoryItem" : "historyItem jobHistoryItem"} key={job.id}>
                  <div>
                    <span>{new Date(job.updatedAt).toLocaleString()}</span>
                    <h3>{job.title}</h3>
                    <p>{meta.statusLabel}</p>
                    <p className="jobResultHint">{meta.resultHint}</p>
                  </div>
                  <div className="historyMeta jobHistoryMeta">
                    <span>{job.type}</span>
                    <span className={`jobScopeBadge ${meta.scopeTone}`}>{meta.scopeLabel}</span>
                  </div>
                  <div className="jobHistoryActions">
                    <button className="secondaryButton" onClick={() => onSelectJob(job)} type="button">
                      {meta.primaryActionLabel}
                    </button>
                    <button className="secondaryButton" disabled={!meta.canViewResult} onClick={() => onViewResult(job)} type="button">
                      查看结果
                    </button>
                    <button className="secondaryButton" disabled={!meta.canRestoreResult} onClick={() => onRestoreResult(job)} type="button">
                      恢复
                    </button>
                  </div>
                </article>
              );
            })
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
    { id: "research", label: "研究证据", detail: "回 Post Studio 查看", section: "flow", ready: researchReady, icon: Search },
    { id: "draft", label: "文案草稿", detail: "回 Post Studio 编辑", section: "flow", ready: draftReady, icon: Bot },
    { id: "visual", label: "发布图片", detail: "回 Post Studio 选图", section: "flow", ready: imageReady, icon: ImagePlus },
    { id: "publish", label: "发布计划", detail: "回 Post Studio 确认", section: "flow", ready: publishReady, icon: FileCheck2 }
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
