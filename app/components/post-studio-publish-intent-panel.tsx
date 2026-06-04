"use client";

import type { PendingPublishConfirmation, WorkspacePublishPlan } from "@/app/types";

type RequiredConfirmation = NonNullable<WorkspacePublishPlan["confirmationChecklist"]>[number];

export function PostStudioPublishIntentPanel({
  activePublishPlan,
  requiredConfirmations,
  confirmedRequiredCount,
  publishVisibility,
  pendingPublish,
  busy,
  canConfirmExisting,
  staleAccountPublishPlan,
  activeAccountLabel,
  staleCanvasPublishPlan,
  onCancelPublish,
  onConfirmPublish
}: {
  activePublishPlan: WorkspacePublishPlan | null;
  requiredConfirmations: RequiredConfirmation[];
  confirmedRequiredCount: number;
  publishVisibility: string;
  pendingPublish: PendingPublishConfirmation | null;
  busy: boolean;
  canConfirmExisting: boolean;
  staleAccountPublishPlan: WorkspacePublishPlan | null | undefined;
  activeAccountLabel: string;
  staleCanvasPublishPlan: boolean;
  onCancelPublish: () => void;
  onConfirmPublish: () => void;
}) {
  return (
    <>
      {activePublishPlan ? (
        <div className="publishIntentSummary">
          <strong>当前确认单</strong>
          <div>
            <span>状态：{labelForPublishStatus(activePublishPlan.status)}</span>
            <span>账号：{activePublishPlan.accountLabel ?? activePublishPlan.accountId ?? "未配置"}</span>
            <span>图片：{activePublishPlan.images?.length ?? 0} 张</span>
            <span>标签：{activePublishPlan.tags?.length ?? 0} 个</span>
            <span>可见：{activePublishPlan.visibility ?? publishVisibility}</span>
            <span>{formatPublishSchedule(activePublishPlan)}</span>
          </div>
          {activePublishPlan.accountId ? <p>账号 ID：{activePublishPlan.accountId}</p> : null}
          {activePublishPlan.mcpUrl ? <p>MCP：{activePublishPlan.mcpUrl}</p> : null}
          {activePublishPlan.versionSnapshot ? (
            <PublishVersionLock versionSnapshot={activePublishPlan.versionSnapshot} />
          ) : null}
          {requiredConfirmations.length ? (
            <ul>
              {requiredConfirmations.slice(0, 5).map((item) => (
                <li key={item.id}>
                  {item.confirmed ? "已确认" : "待确认"}：{item.label}
                </li>
              ))}
            </ul>
          ) : null}
          <p>人工确认：{confirmedRequiredCount}/{requiredConfirmations.length || 0} 项</p>
          {pendingPublish ? (
            <div className="publishIntentActions">
              <button className="secondaryButton" disabled={busy} onClick={onCancelPublish} type="button">
                取消确认单
              </button>
              <button className="primaryButton dangerAction" disabled={busy || !canConfirmExisting} onClick={onConfirmPublish} type="button">
                {pendingPublish.mode === "schedule" ? "确认定时发布" : "确认立即发布"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {staleAccountPublishPlan ? (
        <div className="publishIntentSummary stale">
          <strong>发布确认单已与当前账号不匹配</strong>
          <p>
            这张确认单属于账号 {staleAccountPublishPlan.accountId ?? "未知账号"}，
            当前账号是 {activeAccountLabel}。为了避免误发，请重新生成发布确认单。
          </p>
        </div>
      ) : null}
      {staleCanvasPublishPlan ? (
        <div className="publishIntentSummary stale">
          <strong>发布确认单已失效</strong>
          <p>
            你已经修改了当前画布的文案、标签、图片或 Prompt。为避免误发旧版本，请先保存画布并重新运行 Quality Gate，再生成新的发布确认单。
          </p>
        </div>
      ) : null}
    </>
  );
}

function PublishVersionLock({
  versionSnapshot
}: {
  versionSnapshot: NonNullable<WorkspacePublishPlan["versionSnapshot"]>;
}) {
  return (
    <div className={versionSnapshot.qualityGateFresh ? "publishVersionLock ok" : "publishVersionLock warn"}>
      <strong>{versionSnapshot.qualityGateFresh ? "版本快照已锁定" : "版本快照需要复核"}</strong>
      <p>{versionSnapshot.summary}</p>
      <div>
        <span>文案：{versionSnapshot.copyVersionId ?? "待生成"}</span>
        <span>Prompt：{versionSnapshot.imagePromptVersionIds.length} 个</span>
        <span>图片：{versionSnapshot.selectedImageIds.length} 张</span>
      </div>
      {versionSnapshot.warnings.slice(0, 2).map((warning) => (
        <small key={warning}>{warning}</small>
      ))}
    </div>
  );
}

export function labelForPublishStatus(status?: string): string {
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

function formatPublishSchedule(plan: WorkspacePublishPlan): string {
  if (!plan.scheduleAt) return "立即发布";
  return plan.scheduleTimezone
    ? `定时：${plan.scheduleAt}（${plan.scheduleTimezone}）`
    : `定时：${plan.scheduleAt}`;
}
