import type { PublishAuditRecord, RedactedSettings } from "@/app/types";

export type PublishAuditSafetySummary = {
  headline: string;
  detail: string;
  state: "ok" | "warn" | "neutral";
  eventLabel: string;
  title?: string;
  createdAt?: string;
  reasonLine?: string;
  evidenceLine?: string;
  accountLine?: string;
  shouldReviewHistory: boolean;
};

export function buildPublishAuditSafetySummary({
  audits,
  settings,
  currentTitle,
  publishIntentId
}: {
  audits: PublishAuditRecord[];
  settings: RedactedSettings;
  currentTitle?: string;
  publishIntentId?: string;
}): PublishAuditSafetySummary {
  const activeAccountId = settings.activeAccountId;
  const activeAccount = settings.accounts.find((account) => account.id === activeAccountId) ?? settings.accounts[0];
  const matching = audits.find((audit) =>
    auditMatchesCurrentPost(audit, {
      activeAccountId,
      currentTitle,
      publishIntentId
    })
  );

  if (!matching) {
    return {
      headline: "还没有当前帖子的发布审计",
      detail: "生成发布预览、确认单、定时或真实发布后，这里只显示最近一条必要状态；完整日志仍在 Publish History。",
      state: "neutral",
      eventLabel: "未记录",
      accountLine: activeAccount ? `${activeAccount.displayName} · ${formatMcpEndpoint(activeAccount.mcpUrl)}` : settings.activeAccountId,
      shouldReviewHistory: false
    };
  }

  const failed = matching.event === "blocked" || matching.event === "failed";
  const done = matching.event === "published" || matching.event === "scheduled";
  const evidence = matching.evidenceCitationSummary;
  return {
    headline: failed
      ? "最近一次发布动作被阻止/失败"
      : done
        ? "最近一次发布动作已完成"
        : "最近一次发布动作等待确认",
    detail: failed
      ? "请先处理原因，再重新生成发布确认单；不要直接复用旧确认单。"
      : done
        ? "该记录已经进入发布审计，可在 Publish History 查看完整回执。"
        : "确认单或预览已记录，但真实发布仍需要人工确认。",
    state: failed ? "warn" : done ? "ok" : "neutral",
    eventLabel: labelForAuditEvent(matching.event),
    title: matching.title,
    createdAt: matching.createdAt,
    reasonLine: matching.reasons.length ? matching.reasons.slice(0, 2).join("；") : undefined,
    evidenceLine: evidence
      ? `${evidence.summary}${evidence.missingEvidenceIds.length ? `；缺失 ${evidence.missingEvidenceIds.length} 个证据 ID` : ""}`
      : undefined,
    accountLine: [
      activeAccount?.displayName ?? matching.accountId,
      matching.accountId && matching.accountId !== activeAccountId ? `记录账号 ${matching.accountId}` : "",
      matching.mcpUrl ? formatMcpEndpoint(matching.mcpUrl) : ""
    ].filter(Boolean).join(" · "),
    shouldReviewHistory: failed || Boolean(matching.resultSummary)
  };
}

function auditMatchesCurrentPost(
  audit: PublishAuditRecord,
  {
    activeAccountId,
    currentTitle,
    publishIntentId
  }: {
    activeAccountId: string;
    currentTitle?: string;
    publishIntentId?: string;
  }
): boolean {
  if (publishIntentId && audit.publishIntentId === publishIntentId) return true;
  if (audit.accountId && audit.accountId !== activeAccountId) return false;
  if (currentTitle?.trim()) return normalizeTitle(audit.title) === normalizeTitle(currentTitle);
  return !audit.accountId || audit.accountId === activeAccountId;
}

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, "").trim().toLowerCase();
}

function labelForAuditEvent(event: PublishAuditRecord["event"]): string {
  const labels: Record<string, string> = {
    preview: "预览",
    awaiting_approval: "待人工确认",
    blocked: "已阻止",
    publishing: "发布中",
    published: "已发布",
    scheduled: "已定时",
    failed: "失败"
  };
  return labels[event] ?? event;
}

function formatMcpEndpoint(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || (parsed.protocol === "https:" ? "443" : "80")}`;
  } catch {
    return url || "未配置 MCP";
  }
}
