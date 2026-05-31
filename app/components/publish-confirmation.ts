import type {
  Health,
  PendingPublishConfirmation,
  PostProject,
  RedactedSettings,
  WorkspaceState
} from "@/app/types";

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
