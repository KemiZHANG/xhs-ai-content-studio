import { activeAccountReadinessHint, isHealthForActiveAccount } from "@/app/components/account-readiness";
import type { Health, PendingPublishConfirmation, PostProject, RedactedSettings } from "@/app/types";

export type PublishAccountSafetyCheck = {
  label: string;
  detail: string;
  ok: boolean;
  severity: "ok" | "warn" | "blocked";
};

export type PublishAccountSafety = {
  status: "ready" | "warn" | "blocked";
  headline: string;
  detail: string;
  activeAccountLine: string;
  lockedAccountLine: string;
  canCreateConfirmation: boolean;
  canConfirmExisting: boolean;
  checks: PublishAccountSafetyCheck[];
};

export function buildPublishAccountSafety({
  settings,
  health,
  publishPlan,
  pendingPublish,
  canvasDirty
}: {
  settings: RedactedSettings;
  health: Health | null;
  publishPlan: PostProject["publishPlan"] | null | undefined;
  pendingPublish: PendingPublishConfirmation | null;
  canvasDirty: boolean;
}): PublishAccountSafety {
  const activeAccount = settings.accounts.find((account) => account.id === settings.activeAccountId) ?? settings.accounts[0];
  const accountReady = isHealthForActiveAccount(health, settings);
  const activeAccountLine = formatAccountLine({
    name: activeAccount?.displayName ?? settings.activeAccountId,
    id: settings.activeAccountId,
    loginName: accountReady ? health?.activeAccount?.loginName : undefined,
    mcpUrl: activeAccount?.mcpUrl ?? settings.mcpUrl
  });
  const lockedAccountId = pendingPublish?.accountId ?? publishPlan?.accountId;
  const lockedAccount = lockedAccountId
    ? settings.accounts.find((account) => account.id === lockedAccountId)
    : undefined;
  const lockedAccountLine = lockedAccountId
    ? formatAccountLine({
        name: pendingPublish?.accountDisplayName ?? lockedAccount?.displayName ?? lockedAccountId,
        id: lockedAccountId,
        loginName: pendingPublish?.loginName,
        mcpUrl: pendingPublish?.mcpUrl ?? publishPlan?.mcpUrl ?? lockedAccount?.mcpUrl
      })
    : "尚未生成发布确认单，下一张确认单会锁定当前账号";
  const accountMismatch = Boolean(lockedAccountId && lockedAccountId !== settings.activeAccountId);
  const planExists = Boolean(pendingPublish || publishPlan);
  const staleCanvas = canvasDirty && planExists;
  const checks: PublishAccountSafetyCheck[] = [
    {
      label: "当前账号检测",
      detail: activeAccountReadinessHint(health, settings),
      ok: accountReady,
      severity: accountReady ? "ok" : "blocked"
    },
    {
      label: "确认单账号绑定",
      detail: lockedAccountId
        ? accountMismatch
          ? `确认单绑定 ${lockedAccountLine}，不是当前账号`
          : `确认单已绑定当前账号：${lockedAccountLine}`
        : "还没有确认单；生成时会写入当前账号、登录名和 MCP 地址",
      ok: !accountMismatch,
      severity: accountMismatch ? "blocked" : lockedAccountId ? "ok" : "warn"
    },
    {
      label: "画布版本状态",
      detail: staleCanvas
        ? "画布已在确认单生成后修改，请重新保存、检查并生成确认单"
        : planExists
          ? "确认单没有被当前画布修改污染"
          : "暂无确认单，生成前会读取当前画布",
      ok: !staleCanvas,
      severity: staleCanvas ? "blocked" : "ok"
    },
    {
      label: "自动发布策略",
      detail: settings.defaultAutoPublish
        ? "设置中允许自动发布，但 Post Studio 仍会要求确认单和账号锁定"
        : "自动发布默认关闭，发布前必须人工确认账号、可见范围和时间",
      ok: !settings.defaultAutoPublish,
      severity: settings.defaultAutoPublish ? "warn" : "ok"
    }
  ];
  const blocked = checks.some((check) => check.severity === "blocked");
  const warned = checks.some((check) => check.severity === "warn");
  const status: PublishAccountSafety["status"] = blocked ? "blocked" : warned ? "warn" : "ready";

  return {
    status,
    headline: status === "ready"
      ? "发布账号已锁定，可以进入人工确认"
      : status === "blocked"
        ? "发布账号需要先处理，当前不能提交"
        : "发布账号可继续，但确认单尚未锁定",
    detail: buildDetail({ accountReady, accountMismatch, staleCanvas, lockedAccountId }),
    activeAccountLine,
    lockedAccountLine,
    canCreateConfirmation: accountReady && !accountMismatch && !staleCanvas,
    canConfirmExisting: accountReady && !accountMismatch && !staleCanvas && Boolean(pendingPublish),
    checks
  };
}

function buildDetail({
  accountReady,
  accountMismatch,
  staleCanvas,
  lockedAccountId
}: {
  accountReady: boolean;
  accountMismatch: boolean;
  staleCanvas: boolean;
  lockedAccountId?: string;
}): string {
  if (!accountReady) return "请先检测并确认当前小红书账号已登录；旧账号或旧 MCP 地址的检测结果不能用于发布。";
  if (accountMismatch) return "确认单属于其他账号。为了避免误发，必须切回对应账号或重新生成确认单。";
  if (staleCanvas) return "当前画布已修改，旧确认单不能继续使用。请重新运行 Quality Gate 并生成新的确认单。";
  if (!lockedAccountId) return "生成确认单时会把当前账号、登录名、MCP 地址、可见范围和版本快照一起锁定。";
  return "当前账号、登录状态和确认单绑定一致；最终发布仍需要人工确认。";
}

function formatAccountLine({
  name,
  id,
  loginName,
  mcpUrl
}: {
  name: string;
  id: string;
  loginName?: string;
  mcpUrl?: string;
}): string {
  return [
    name,
    `ID ${id}`,
    loginName ? `登录名 ${loginName}` : "",
    mcpUrl ? `MCP ${formatMcpEndpoint(mcpUrl)}` : ""
  ].filter(Boolean).join(" · ");
}

function formatMcpEndpoint(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || (parsed.protocol === "https:" ? "443" : "80")}`;
  } catch {
    return url || "未配置 MCP";
  }
}
