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
  return (
    <section className="studioSideSection">
      <h3><CheckCircle2 size={16} />发布检查</h3>
      <StudioTaskSummary summary={summary} onQuickAction={onQuickAction} />
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
        <CheckItem ok={accountReady} label={`账号：${activeAccountLabel} · ${accountReadyHint}`} />
        <CheckItem ok={publishVisibility === "仅自己可见"} label={`可见范围：${publishVisibility}`} />
        <CheckItem ok={!publishScheduleAt || Date.parse(publishScheduleAt) > Date.now()} label={publishScheduleAt ? `定时：${publishScheduleAt}（本地时区）` : "发布时间：立即"} />
        <CheckItem ok={defaultAutoPublish === false} label="自动发布默认关闭" />
      </details>
      <PostStudioPublishSafetyPanel
        publishSummary={publishSummary}
        publishAccountSafety={publishAccountSafety}
        auditSummary={auditSummary}
        onNavigate={onNavigate}
      />
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
