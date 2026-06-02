"use client";

import { CheckCircle2 } from "lucide-react";
import type { PublishAccountSafety } from "@/app/components/publish-account-safety";
import type { PublishAuditSafetySummary } from "@/app/components/publish-audit-summary";
import type { PublishConfirmationSummary } from "@/app/components/publish-confirmation-summary";
import type { PublishSafetyBoundaryModel } from "@/app/components/publish-safety-boundary";
import { PostStudioPublishIntentPanel } from "@/app/components/post-studio-publish-intent-panel";
import { PostStudioPublishReadinessPanel } from "@/app/components/post-studio-publish-readiness-panel";
import { PostStudioPublishSafetyPanel } from "@/app/components/post-studio-publish-safety-panel";
import { PostStudioQualityPanel } from "@/app/components/post-studio-quality-panel";
import type { QualityViralCoverageView } from "@/app/components/quality-viral-coverage";
import type { StudioTabSummary } from "@/app/components/studio-tab-summary";
import type {
  PendingPublishConfirmation,
  PostProject,
  PublishDraftState,
  RedactedSettings,
  Section,
  WorkspacePublishPlan
} from "@/app/types";
import type { EvidenceCitationReport } from "@/lib/post-project/citations";

type RequiredConfirmation = NonNullable<WorkspacePublishPlan["confirmationChecklist"]>[number];

type PublishFocusBlocker = {
  text: string;
  action?: string;
  actionLabel?: string;
};

export function buildPublishFocusModel(publishSummary: PublishConfirmationSummary) {
  const blockerPreview = publishSummary.visibleBlockers.slice(0, 3);
  const blockerActions = blockerPreview.map((text) => ({
    text,
    ...actionForPublishBlocker(text)
  }));
  return {
    blockerPreview,
    blockerActions,
    hiddenBlockerCount: Math.max(0, publishSummary.visibleBlockers.length - blockerPreview.length),
    hasBlockers: blockerPreview.length > 0
  };
}

export function PostStudioPublishTab({
  summary,
  publishDraft,
  selectedImageCount,
  hasVisualDirection,
  citationTraceReady,
  qualityGateFresh,
  accountReady,
  activeAccountLabel,
  accountReadyHint,
  publishVisibility,
  publishScheduleAt,
  defaultAutoPublish,
  publishReady,
  quality,
  qualityViralCoverage,
  citationReport,
  publishSummary,
  publishAccountSafety,
  auditSummary,
  publishSafetyBoundary,
  activePublishPlan,
  requiredConfirmations,
  confirmedRequiredCount,
  pendingPublish,
  activeLoginName,
  hasExistingVisualDirection,
  busy,
  staleAccountPublishPlan,
  staleCanvasPublishPlan,
  onNavigate,
  onVisibilityChange,
  onScheduleAtChange,
  onQuickAction,
  onCancelPublish,
  onConfirmPublish,
  onPreparePublish,
  onOpenPublish
}: {
  summary: StudioTabSummary;
  publishDraft: PublishDraftState;
  selectedImageCount: number;
  hasVisualDirection: boolean;
  citationTraceReady: boolean;
  qualityGateFresh: boolean;
  accountReady: boolean;
  activeAccountLabel: string;
  accountReadyHint: string;
  publishVisibility: RedactedSettings["defaultVisibility"];
  publishScheduleAt: string;
  defaultAutoPublish: boolean;
  publishReady: boolean;
  quality?: PostProject["qualityCheck"];
  qualityViralCoverage: QualityViralCoverageView;
  citationReport: EvidenceCitationReport | null;
  publishSummary: PublishConfirmationSummary;
  publishAccountSafety: PublishAccountSafety;
  auditSummary: PublishAuditSafetySummary;
  publishSafetyBoundary: PublishSafetyBoundaryModel;
  activePublishPlan: WorkspacePublishPlan | null;
  requiredConfirmations: RequiredConfirmation[];
  confirmedRequiredCount: number;
  pendingPublish: PendingPublishConfirmation | null;
  activeLoginName?: string;
  hasExistingVisualDirection: boolean;
  busy: boolean;
  staleAccountPublishPlan: WorkspacePublishPlan | null | undefined;
  staleCanvasPublishPlan: boolean;
  onNavigate: (section: Section) => void;
  onVisibilityChange: (value: RedactedSettings["defaultVisibility"]) => void;
  onScheduleAtChange: (value: string) => void;
  onQuickAction: (action: string) => void;
  onCancelPublish: () => void;
  onConfirmPublish: () => void;
  onPreparePublish: () => void;
  onOpenPublish: () => void;
}) {
  const publishFocus = buildPublishFocusModel(publishSummary);

  return (
    <section className="studioSideSection">
      <h3><CheckCircle2 size={16} />发布检查</h3>
      <div className="publishGuardNotice">
        <strong>安全边界：本页只生成发布确认单</strong>
        <p>真实发布或定时发布前，仍必须人工确认账号、可见范围、图片版本和时间；一句话指令不会直接发到小红书。</p>
      </div>
      <PublishTargetSummary
        accountReady={accountReady}
        activeAccountLabel={activeAccountLabel}
        accountReadyHint={accountReadyHint}
        activeLoginName={activeLoginName}
        defaultAutoPublish={defaultAutoPublish}
        publishScheduleAt={publishScheduleAt}
        publishVisibility={publishVisibility}
        selectedImageCount={selectedImageCount}
      />
      <PublishManualGate
        defaultAutoPublish={defaultAutoPublish}
        pendingPublish={pendingPublish}
        requiredConfirmations={requiredConfirmations}
        confirmedRequiredCount={confirmedRequiredCount}
        publishScheduleAt={publishScheduleAt}
      />
      <StudioTaskSummary summary={summary} onQuickAction={onQuickAction} />
      <article className={`publishFocusSummary ${publishSummary.riskLevel}`}>
        <span>{publishSummary.modeLabel}</span>
        <strong>{publishSummary.decisionLine}</strong>
        <p>{publishSummary.nextStepLine}</p>
        {publishFocus.hasBlockers ? (
          <ul className="publishFocusBlockers">
            {publishFocus.blockerActions.map((blocker: PublishFocusBlocker) => (
              <li key={blocker.text}>
                <span>{blocker.text}</span>
                {blocker.action ? (
                  <button type="button" onClick={() => onQuickAction(blocker.action!)}>
                    {blocker.actionLabel}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <small>暂无关键阻塞项，下一步只会生成发布确认单。</small>
        )}
        {publishFocus.hiddenBlockerCount ? (
          <small>还有 {publishFocus.hiddenBlockerCount} 项已收进下方详情。</small>
        ) : null}
      </article>
      <details className="publishChecklistDetails">
        <summary>
          <strong>详细发布检查</strong>
          <span>默认收起，关键阻塞项已汇总在确认摘要。</span>
        </summary>
        <CheckItem ok={Boolean(publishDraft.title)} label="标题已填写" />
        <CheckItem ok={Boolean(publishDraft.content)} label="正文已填写" />
        <CheckItem ok={Boolean(publishDraft.tagsText)} label="标签已填写" />
        <CheckItem ok={Boolean(selectedImageCount)} label="已选择图片" />
        <CheckItem ok={hasVisualDirection} label="图片方向 / Prompt 已确认" />
        <CheckItem ok={citationTraceReady} label="字段级证据引用可追溯" />
        <CheckItem ok={qualityGateFresh} label="最终版本与 Quality Gate 一致" />
        <CheckItem ok={accountReady} label={`账号: ${activeAccountLabel} · ${accountReadyHint}`} />
        <CheckItem ok={publishVisibility === "仅自己可见"} label={`可见范围: ${publishVisibility}`} />
        <CheckItem ok={!publishScheduleAt || Date.parse(publishScheduleAt) > Date.now()} label={publishScheduleAt ? `定时: ${publishScheduleAt} (本地时区)` : "发布时间: 立即"} />
        <CheckItem ok={defaultAutoPublish === false} label="自动发布默认关闭" />
      </details>
      <PostStudioPublishReadinessPanel
        publishVisibility={publishVisibility}
        publishScheduleAt={publishScheduleAt}
        publishReady={publishReady}
        publishDraft={publishDraft}
        selectedImageCount={selectedImageCount}
        hasVisualDirection={hasVisualDirection}
        citationTraceReady={citationTraceReady}
        accountReady={accountReady}
        quality={quality}
        qualityGateFresh={qualityGateFresh}
        pendingPublish={pendingPublish}
        activeLoginName={activeLoginName}
        publishSafetyBoundary={publishSafetyBoundary}
        hasExistingVisualDirection={hasExistingVisualDirection}
        busy={busy}
        onVisibilityChange={onVisibilityChange}
        onScheduleAtChange={onScheduleAtChange}
        onQuickAction={onQuickAction}
      />
      <details className="publishDetailsDrawer">
        <summary>
          <strong>发布详情与审计</strong>
          <span>确认单、Quality Gate、账号安全和审计记录</span>
        </summary>
        <PostStudioPublishSafetyPanel
          publishSummary={publishSummary}
          publishAccountSafety={publishAccountSafety}
          auditSummary={auditSummary}
          onNavigate={onNavigate}
        />
        <PostStudioPublishIntentPanel
          activePublishPlan={activePublishPlan}
          requiredConfirmations={requiredConfirmations}
          confirmedRequiredCount={confirmedRequiredCount}
          publishVisibility={publishVisibility}
          pendingPublish={pendingPublish}
          busy={busy}
          canConfirmExisting={publishAccountSafety.canConfirmExisting}
          staleAccountPublishPlan={staleAccountPublishPlan}
          activeAccountLabel={activeAccountLabel}
          staleCanvasPublishPlan={staleCanvasPublishPlan}
          onCancelPublish={onCancelPublish}
          onConfirmPublish={onConfirmPublish}
        />
        <PostStudioQualityPanel
          quality={quality}
          qualityViralCoverage={qualityViralCoverage}
          citationReport={citationReport}
          citationTraceReady={citationTraceReady}
        />
      </details>
      <div className="inlineActionGrid">
        <button className="secondaryButton fullWidth" onClick={() => onQuickAction("run_quality_gate")} type="button">刷新质量检查</button>
        <button className="primaryButton fullWidth" disabled={!publishReady || busy} onClick={onPreparePublish} type="button">
          {pendingPublish ? "重新生成确认单" : publishScheduleAt ? "生成定时确认单" : "生成发布确认单"}
        </button>
        <button className="secondaryButton fullWidth" onClick={onOpenPublish} type="button">聚焦发布检查</button>
      </div>
    </section>
  );
}

function PublishTargetSummary({
  accountReady,
  activeAccountLabel,
  accountReadyHint,
  activeLoginName,
  defaultAutoPublish,
  publishScheduleAt,
  publishVisibility,
  selectedImageCount
}: {
  accountReady: boolean;
  activeAccountLabel: string;
  accountReadyHint: string;
  activeLoginName?: string;
  defaultAutoPublish: boolean;
  publishScheduleAt: string;
  publishVisibility: RedactedSettings["defaultVisibility"];
  selectedImageCount: number;
}) {
  const timingLabel = publishScheduleAt ? `${publishScheduleAt} 本地时区` : "立即发布";
  return (
    <section className="publishTargetSummary" aria-label="发布目标确认摘要">
      <div>
        <span>发布目标</span>
        <strong>{activeAccountLabel || "未选择账号"}</strong>
        <small>{activeLoginName ? `登录名：${activeLoginName}` : accountReadyHint}</small>
      </div>
      <dl>
        <div className={accountReady ? "ok" : "warn"}>
          <dt>账号</dt>
          <dd>{accountReady ? "可用" : "需登录/切换"}</dd>
        </div>
        <div className={publishVisibility === "仅自己可见" ? "ok" : "warn"}>
          <dt>可见范围</dt>
          <dd>{publishVisibility}</dd>
        </div>
        <div className={publishScheduleAt ? "warn" : "ok"}>
          <dt>时间</dt>
          <dd>{timingLabel}</dd>
        </div>
        <div className={selectedImageCount ? "ok" : "warn"}>
          <dt>图片</dt>
          <dd>{selectedImageCount ? `${selectedImageCount} 张` : "未选择"}</dd>
        </div>
        <div className={defaultAutoPublish ? "warn" : "ok"}>
          <dt>自动发布</dt>
          <dd>{defaultAutoPublish ? "已开启" : "默认关闭"}</dd>
        </div>
      </dl>
    </section>
  );
}

function PublishManualGate({
  defaultAutoPublish,
  pendingPublish,
  requiredConfirmations,
  confirmedRequiredCount,
  publishScheduleAt
}: {
  defaultAutoPublish: boolean;
  pendingPublish: PendingPublishConfirmation | null;
  requiredConfirmations: RequiredConfirmation[];
  confirmedRequiredCount: number;
  publishScheduleAt: string;
}) {
  const requiredTotal = requiredConfirmations.length;
  const waitingCount = Math.max(0, requiredTotal - confirmedRequiredCount);
  return (
    <section className={pendingPublish ? "publishManualGate pending" : "publishManualGate"} aria-label="真实发布闸门">
      <div>
        <span>真实发布闸门</span>
        <strong>{pendingPublish ? "确认单已生成，等待你手动确认" : "当前不会直接发布到小红书"}</strong>
        <p>
          {pendingPublish
            ? `还需确认 ${waitingCount}/${requiredTotal} 项；确认前不会调用小红书 MCP。`
            : "生成确认单只是锁定当前版本，真正发布前仍要核对账号、可见范围、图片版本和时间。"}
        </p>
      </div>
      <div className="manualGateChecks">
        <em className={defaultAutoPublish ? "warn" : "ok"}>自动发布：{defaultAutoPublish ? "已开启但仍需确认单" : "关闭"}</em>
        <em className={pendingPublish ? "warn" : "ok"}>确认单：{pendingPublish ? "待人工确认" : "未生成"}</em>
        <em className={publishScheduleAt ? "warn" : "ok"}>时间：{publishScheduleAt ? "定时需确认时区" : "立即发布也需确认"}</em>
      </div>
    </section>
  );
}

function StudioTaskSummary({
  summary,
  onQuickAction
}: {
  summary: StudioTabSummary;
  onQuickAction: (action: string) => void;
}) {
  return (
    <article className={`studioTaskSummary ${summary.state}`}>
      <div>
        <span>当前状态</span>
        <strong>{summary.headline}</strong>
        <p>{summary.detail}</p>
      </div>
      {summary.primaryAction ? (
        <button className="secondaryButton fullWidth" type="button" onClick={() => onQuickAction(summary.primaryAction!)}>
          {summary.primaryActionLabel}
        </button>
      ) : (
        <small>{summary.primaryActionLabel}</small>
      )}
    </article>
  );
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return <span className={ok ? "checkItem ok" : "checkItem"}>{ok ? "✓" : "!"} {label}</span>;
}

function actionForPublishBlocker(blocker: string): Pick<PublishFocusBlocker, "action" | "actionLabel"> {
  if (blocker.includes("图片方向") || blocker.includes("Prompt") || blocker.includes("视觉")) {
    return { action: "plan_visuals", actionLabel: "规划图片" };
  }
  if (blocker.includes("图片")) {
    return { action: "select_images", actionLabel: "选择图片" };
  }
  if (blocker.includes("Quality") || blocker.includes("质量") || blocker.includes("风险")) {
    return { action: "run_quality_gate", actionLabel: "刷新检查" };
  }
  if (blocker.includes("标题") || blocker.includes("正文") || blocker.includes("标签") || blocker.includes("文案")) {
    return { action: "generate_copy", actionLabel: "补文案" };
  }
  if (blocker.includes("证据") || blocker.includes("引用")) {
    return { action: "create_creative_brief", actionLabel: "补证据" };
  }
  if (blocker.includes("版本") || blocker.includes("快照") || blocker.includes("画布")) {
    return { action: "assemble_post", actionLabel: "重新装配" };
  }
  if (blocker.includes("定时") || blocker.includes("时间")) {
    return { action: "schedule_publish", actionLabel: "改时间" };
  }
  return {};
}
