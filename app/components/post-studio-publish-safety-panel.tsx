"use client";

import type { PublishAccountSafety } from "@/app/components/publish-account-safety";
import type { PublishAuditSafetySummary } from "@/app/components/publish-audit-summary";
import type { PublishConfirmationSummary } from "@/app/components/publish-confirmation-summary";
import type { Section } from "@/app/types";

export function PostStudioPublishSafetyPanel({
  publishSummary,
  publishAccountSafety,
  auditSummary,
  onNavigate
}: {
  publishSummary: PublishConfirmationSummary;
  publishAccountSafety: PublishAccountSafety;
  auditSummary: PublishAuditSafetySummary;
  onNavigate: (section: Section) => void;
}) {
  return (
    <>
      <PublishFinalSummary publishSummary={publishSummary} />
      <PublishAccountSafetyCard publishAccountSafety={publishAccountSafety} />
      <PublishAuditMini auditSummary={auditSummary} onNavigate={onNavigate} />
    </>
  );
}

function PublishFinalSummary({ publishSummary }: { publishSummary: PublishConfirmationSummary }) {
  return (
    <div className={`publishFinalSummary ${publishSummary.riskLevel}`}>
      <div className="publishFinalSummaryHeader">
        <div>
          <strong>{publishSummary.headline}</strong>
          <p>{publishSummary.detail}</p>
        </div>
        <span>{publishSummary.modeLabel}</span>
      </div>
      <div className="publishDecisionStrip">
        <strong>{publishSummary.decisionLine}</strong>
        <p>{publishSummary.nextStepLine}</p>
        <small>{publishSummary.detailCompressionLine}</small>
      </div>
      <div className="publishManualReviewChecklist" aria-label="发布前人工复核清单">
        {publishSummary.manualReviewChecklist.slice(0, 8).map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      {publishSummary.confirmationItems.length ? (
        <div className="publishConfirmationChips" aria-label="人工确认清单摘要">
          {publishSummary.confirmationItems.slice(0, 6).map((item) => (
            <span className={item.confirmed ? "confirmed" : item.required ? "required" : "optional"} key={`${item.label}-${item.required}`}>
              <b>{item.confirmed ? "已确认" : item.required ? "待确认" : "可选"}</b>
              {item.label}
              {item.detail ? <small>{item.detail}</small> : null}
            </span>
          ))}
        </div>
      ) : null}
      {publishSummary.visibleBlockers.length ? (
        <ul>
          {publishSummary.visibleBlockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
          {publishSummary.blockers.length > publishSummary.visibleBlockers.length ? (
            <li>还有 {publishSummary.blockers.length - publishSummary.visibleBlockers.length} 项已收进详细快照</li>
          ) : null}
        </ul>
      ) : null}
      <details className="publishSnapshotDetails">
        <summary>
          <strong>详细发布快照</strong>
          <span>账号、时间、版本、证据和 Quality Gate</span>
        </summary>
        <div className="publishFinalSummaryGrid">
          <span>账号 <b>{publishSummary.accountLine}</b></span>
          <span>连接 <b>{publishSummary.accountSafetyLine}</b></span>
          <span>时间 <b>{publishSummary.timingLine}</b></span>
          <span>可见 <b>{publishSummary.visibilityLine}</b></span>
          <span>内容 <b>{publishSummary.contentLine}</b></span>
          <span>图片 <b>{publishSummary.imageLine}</b></span>
          <span>证据 <b>{publishSummary.evidenceLine}</b></span>
          <span>来源 <b>{publishSummary.evidenceSourceLine}</b></span>
          <span>版本 <b>{publishSummary.versionLine}</b></span>
          <span>质量 <b>{publishSummary.qualityLine}</b></span>
          <span>确认 <b>{publishSummary.checklistLine}</b></span>
        </div>
      </details>
    </div>
  );
}

function PublishAccountSafetyCard({ publishAccountSafety }: { publishAccountSafety: PublishAccountSafety }) {
  return (
    <div className={`publishAccountSafety ${publishAccountSafety.status}`}>
      <div>
        <span>账号安全锁</span>
        <strong>{publishAccountSafety.headline}</strong>
        <p>{publishAccountSafety.detail}</p>
      </div>
      <div className="publishAccountSafetyLines">
        <span>当前账号 <b>{publishAccountSafety.activeAccountLine}</b></span>
        <span>确认单绑定 <b>{publishAccountSafety.lockedAccountLine}</b></span>
      </div>
      <div className="publishAccountSafetyChecks">
        {publishAccountSafety.checks.map((check) => (
          <em className={check.severity} key={check.label}>
            <small>{check.ok ? "通过" : check.severity === "blocked" ? "阻塞" : "提醒"}</small>
            <b>{check.label}</b>
            <span>{check.detail}</span>
          </em>
        ))}
      </div>
    </div>
  );
}

function PublishAuditMini({
  auditSummary,
  onNavigate
}: {
  auditSummary: PublishAuditSafetySummary;
  onNavigate: (section: Section) => void;
}) {
  return (
    <div className={`publishAuditMini ${auditSummary.state}`}>
      <div>
        <span>最近发布审计</span>
        <strong>{auditSummary.headline}</strong>
        <p>{auditSummary.detail}</p>
      </div>
      <div className="publishAuditMiniGrid">
        <span>动作 <b>{auditSummary.eventLabel}</b></span>
        <span>账号 <b>{auditSummary.accountLine ?? "当前账号"}</b></span>
        {auditSummary.createdAt ? <span>时间 <b>{new Date(auditSummary.createdAt).toLocaleString()}</b></span> : null}
        {auditSummary.title ? <span>标题 <b>{auditSummary.title}</b></span> : null}
      </div>
      {auditSummary.reasonLine ? <p className="muted">原因：{auditSummary.reasonLine}</p> : null}
      {auditSummary.evidenceLine ? <p className="muted">证据：{auditSummary.evidenceLine}</p> : null}
      <button className="secondaryButton fullWidth" onClick={() => onNavigate("audit")} type="button">
        查看完整发布历史
      </button>
    </div>
  );
}
