import type {
  Health,
  PendingPublishConfirmation,
  PostProject,
  RedactedSettings,
  WorkspaceState
} from "@/app/types";

export type PublishConfirmationReadinessInput = {
  contentReady: boolean;
  accountReady: boolean;
  qualityCanPublish: boolean;
  qualityGateFresh: boolean;
  hasScheduleAt: boolean;
  busy?: boolean;
};

export type PublishConfirmationReadiness = {
  canCreateNowConfirmation: boolean;
  canCreateScheduleConfirmation: boolean;
  nowButtonLabel: string;
  scheduleButtonLabel: string;
  blockingReasons: string[];
  helperText: string;
};

export function buildPublishConfirmationReadiness({
  contentReady,
  accountReady,
  qualityCanPublish,
  qualityGateFresh,
  hasScheduleAt,
  busy = false
}: PublishConfirmationReadinessInput): PublishConfirmationReadiness {
  const blockingReasons = [
    contentReady ? "" : "补齐标题、正文、标签和至少一张图片",
    accountReady ? "" : "检测并确认当前小红书账号已登录",
    qualityCanPublish ? "" : "运行并通过 Quality Gate",
    qualityGateFresh ? "" : "当前文案和图片版本变化后，需要重新生成最终帖子并刷新 Quality Gate"
  ].filter(Boolean);
  const ready = blockingReasons.length === 0 && !busy;

  return {
    canCreateNowConfirmation: ready,
    canCreateScheduleConfirmation: ready && hasScheduleAt,
    nowButtonLabel: busy ? "生成中" : "生成立即发布确认单",
    scheduleButtonLabel: busy ? "生成中" : "生成定时发布确认单",
    blockingReasons,
    helperText: blockingReasons.length
      ? `还不能生成发布确认单：${blockingReasons.slice(0, 2).join("；")}${blockingReasons.length > 2 ? "。" : ""}`
      : hasScheduleAt
        ? "可以生成立即发布或定时发布确认单；确认前不会提交到小红书。"
        : "可以生成立即发布确认单；如需定时发布，请先选择发布时间。"
  };
}

export function buildPendingPublishFromPlan({
  plan,
  settings,
  health
}: {
  plan: WorkspaceState["publishPlan"] | PostProject["publishPlan"] | null | undefined;
  settings: RedactedSettings;
  health: Health | null;
}): PendingPublishConfirmation | null {
  if (!plan || plan.status !== "awaiting_approval" || plan.requestedBy !== "manual" || !plan.id) {
    return null;
  }
  if (!plan.title || !plan.content || !Array.isArray(plan.tags) || !Array.isArray(plan.images)) {
    return null;
  }
  if (plan.accountId && plan.accountId !== settings.activeAccountId) {
    return null;
  }
  const activeAccount = settings.accounts.find((account) => account.id === settings.activeAccountId) ?? settings.accounts[0];
  return {
    payload: {
      title: plan.title,
      content: plan.content,
      tags: plan.tags,
      assetIds: plan.images,
      visibility: isPublishVisibilityLabel(plan.visibility) ? plan.visibility : settings.defaultVisibility,
      scheduleAt: plan.scheduleAt,
      imagePrompt: ""
    },
    publishIntentId: plan.id,
    mode: plan.scheduleAt ? "schedule" : "now",
    createdAt: plan.requestedAt ?? new Date().toISOString(),
    accountId: settings.activeAccountId,
    accountDisplayName: activeAccount?.displayName ?? "当前小红书账号",
    mcpUrl: plan.mcpUrl ?? activeAccount?.mcpUrl ?? settings.mcpUrl,
    loginName: health?.activeAccount?.loginName
  };
}

function isPublishVisibilityLabel(value: unknown): value is RedactedSettings["defaultVisibility"] {
  return value === "公开可见" || value === "仅自己可见" || value === "仅互关好友可见";
}
