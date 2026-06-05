import type { Health, PostProject, RedactedSettings, WorkspaceState } from "@/app/types";
import { activeAccountReadinessHint, isHealthForActiveAccount } from "@/app/components/account-readiness";
import { labelForPostAction } from "@/app/components/post-action-labels";
import { buildPostReadinessReport } from "@/lib/post-project/readiness";
import { getPostVersionStatus } from "@/lib/post-project/versioning";
import type { PostAction, PostStage } from "@/lib/post-project/types";

export type PostStudioStatusChip = {
  label: string;
  value: string;
  state: "ok" | "warn" | "neutral";
};

export type PostStudioAccountOption = {
  id: string;
  label: string;
  detail: string;
  isActive: boolean;
  isReady: boolean;
};

export type PostStudioStatusSummary = {
  headline: string;
  detail: string;
  accountLine: string;
  accountReady: boolean;
  accountName: string;
  accountLoginName?: string;
  accountMcpEndpoint: string;
  accountCount: number;
  accountOptions: PostStudioAccountOption[];
  accountSwitchHint: string;
  riskLevel: "ok" | "warn" | "neutral";
  progressPercent: number;
  stageLine: string;
  primaryAction?: PostAction;
  primaryActionLabel?: string;
  blockers: string[];
  chips: PostStudioStatusChip[];
};

export function buildPostStudioStatusSummary({
  project,
  workspace,
  settings,
  health,
  evidenceCount,
  hasDraft,
  selectedImageCount,
  canvasDirty,
  ragCreativeBlocked = false
}: {
  project: PostProject | null;
  workspace: WorkspaceState | null;
  settings: RedactedSettings;
  health: Health | null;
  evidenceCount: number;
  hasDraft: boolean;
  selectedImageCount: number;
  canvasDirty: boolean;
  ragCreativeBlocked?: boolean;
}): PostStudioStatusSummary {
  const activeAccount = settings.accounts.find((account) => account.id === settings.activeAccountId) ?? settings.accounts[0];
  const accountReady = isHealthForActiveAccount(health, settings);
  const accountName = activeAccount?.displayName ?? settings.activeAccountId;
  const accountLoginName = accountReady ? health?.activeAccount?.loginName : undefined;
  const accountMcpEndpoint = formatMcpEndpoint(activeAccount?.mcpUrl ?? settings.mcpUrl);
  const accountCount = settings.accounts.length || 1;
  const accountOptions = settings.accounts.length
    ? settings.accounts.map((account) => {
        const isActive = account.id === settings.activeAccountId;
        const isReady = isActive && accountReady;
        const status = isReady
          ? `已登录${accountLoginName ? ` · ${accountLoginName}` : ""}`
          : account.status === "logged_in"
            ? "上次显示已登录，切换后需要重新检测"
            : account.status === "logged_out"
              ? "未登录"
              : "待检测";
        return {
          id: account.id,
          label: `${account.displayName} · ${formatMcpEndpoint(account.mcpUrl)}`,
          detail: `${isActive ? "当前账号" : "可切换账号"} · ${status}`,
          isActive,
          isReady
        };
      })
    : [];
  const accountSwitchHint = accountCount > 1
    ? accountReady
      ? "切换账号会清空本次登录检测，并要求重新检测后才能发布。"
      : "请选择账号并检测登录状态；确认单只绑定检测通过的当前账号。"
    : "可在设置里添加更多账号，每个账号可绑定不同 MCP 地址。";
  const accountLine = [
    accountReady ? "账号可用" : "账号需确认",
    accountName,
    accountLoginName ? `登录名 ${accountLoginName}` : activeAccountReadinessHint(health, settings)
  ].filter(Boolean).join(" · ");

  if (!project) {
    return {
      headline: "先新建一篇帖子项目",
      detail: "当前还没有 PostProject。先输入主题做研究，后续文案、图片、发布都会绑定到同一篇帖子。",
      accountLine,
      accountReady,
      accountName,
      accountLoginName,
      accountMcpEndpoint,
      accountCount,
      accountOptions,
      accountSwitchHint,
      riskLevel: accountReady ? "neutral" : "warn",
      progressPercent: 0,
      stageLine: "等待项目主题 · 完成度 0%",
      primaryAction: "search_research",
      primaryActionLabel: labelForPostAction("search_research"),
      blockers: ["缺少项目主题", accountReady ? "" : "小红书账号登录状态未确认"].filter(Boolean),
      chips: [
        chip("项目", workspace?.topic ?? "未开始", "neutral"),
        chip("账号", accountReady ? "已登录" : "待检测", accountReady ? "ok" : "warn")
      ]
    };
  }

  const readiness = buildPostReadinessReport(project);
  const versionStatus = getPostVersionStatus(project);
  const viralEvidenceCount = project.evidencePack.insights.filter((insight) => insight.sourceType === "viral_library").length;
  const ragChip = buildRagStatusChip(project, viralEvidenceCount);
  const productReferenceCount = project.productInfo?.referenceAssetIds?.length ?? 0;
  const auditStatus = project.auditStatus ?? (project.qualityCheck ? (project.qualityCheck.canPublish ? "passed" : "blocked") : "unchecked");
  const blockers = [
    !accountReady ? "小红书账号登录状态未确认，发布前需要重新检测当前账号" : "",
    canvasDirty ? "画布有未保存修改，发布检查前需要先保存" : "",
    versionStatus.needsQualityGate ? "Quality Gate 需要刷新" : "",
    ...readiness.blockers.map((item) => item.detail)
  ].filter(Boolean).slice(0, 3);
  const canPublish = readiness.canRequestPublish && accountReady && !canvasDirty && versionStatus.qualityGateFresh;
  const riskLevel = canPublish ? "ok" : blockers.length ? "warn" : "neutral";
  const primaryAction = ragCreativeBlocked ? "retrieve_viral_knowledge" : readiness.nextAction;
  const primaryActionLabel = primaryAction ? labelForPostAction(primaryAction) : undefined;

  return {
    headline: canPublish
      ? "这篇帖子已经接近可发布"
      : primaryAction
        ? "下一步已经明确"
        : "继续完善当前帖子项目",
    detail: canPublish
      ? "文案、图片、证据和 Quality Gate 已对齐。最后仍需要人工确认账号、可见范围和发布时间。"
      : ragCreativeBlocked
        ? "爆款库 RAG 证据还不足，先补强证据再进入文案或图片方向创作。"
      : blockers[0] ?? readiness.summary,
    accountLine,
    accountReady,
    accountName,
    accountLoginName,
    accountMcpEndpoint,
    accountCount,
    accountOptions,
    accountSwitchHint,
    riskLevel,
    progressPercent: readiness.progress,
    stageLine: `${labelForPostStage(project.currentStage)} · 完成度 ${readiness.progress}%`,
    primaryAction,
    primaryActionLabel,
    blockers,
    chips: [
      chip("研究", evidenceCount ? `${evidenceCount} 条证据` : "待研究", evidenceCount ? "ok" : "warn"),
      ragChip,
      chip("产品图", productReferenceCount ? `${productReferenceCount} 张` : "可选", productReferenceCount ? "ok" : "neutral"),
      chip("文案", hasDraft ? "已生成" : "待生成", hasDraft ? "ok" : "warn"),
      chip("图片", selectedImageCount ? `${selectedImageCount} 张` : "待选择", selectedImageCount ? "ok" : "warn"),
      chip("检查", auditStatusLabel(auditStatus, versionStatus.qualityGateFresh), auditStatus === "passed" && versionStatus.qualityGateFresh ? "ok" : "warn")
    ]
  };
}

function chip(label: string, value: string, state: PostStudioStatusChip["state"]): PostStudioStatusChip {
  return { label, value, state };
}

function buildRagStatusChip(project: PostProject, fallbackViralEvidenceCount: number): PostStudioStatusChip {
  const sufficiency = extractRagSufficiency(project.evidencePack.summary);
  if (!sufficiency) {
    return chip(
      "RAG",
      fallbackViralEvidenceCount ? `${fallbackViralEvidenceCount} 条爆款库` : "待检索",
      fallbackViralEvidenceCount ? "ok" : "neutral"
    );
  }

  const weakCount = sufficiency.weakViralCount ?? 0;
  const value = weakCount
    ? `可用 ${sufficiency.viralCount} / 弱 ${weakCount}`
    : sufficiency.viralCount
      ? `可用 ${sufficiency.viralCount}`
      : "无可用爆款";
  return chip("RAG", value, sufficiency.isEnough ? "ok" : sufficiency.viralCount ? "warn" : "neutral");
}

function extractRagSufficiency(summary: unknown): {
  isEnough: boolean;
  viralCount: number;
  weakViralCount?: number;
} | null {
  if (!isRecord(summary) || !isRecord(summary.viralKnowledge) || !isRecord(summary.viralKnowledge.sufficiency)) {
    return null;
  }
  const sufficiency = summary.viralKnowledge.sufficiency;
  return {
    isEnough: sufficiency.isEnough === true,
    viralCount: typeof sufficiency.viralCount === "number" ? sufficiency.viralCount : 0,
    weakViralCount: typeof sufficiency.weakViralCount === "number" ? sufficiency.weakViralCount : 0
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function auditStatusLabel(auditStatus: string, qualityGateFresh: boolean): string {
  if (auditStatus === "passed" && qualityGateFresh) return "已通过";
  if (auditStatus === "blocked") return "有风险";
  return "待检查";
}

function formatMcpEndpoint(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || (parsed.protocol === "https:" ? "443" : "80")}`;
  } catch {
    return url || "未配置 MCP";
  }
}

function labelForPostStage(stage: PostStage): string {
  const labels: Record<PostStage, string> = {
    empty: "未开始",
    briefing: "补全需求",
    researching: "研究中",
    evidence_ready: "证据已就绪",
    brief_ready: "Brief 已就绪",
    copy_drafting: "文案生成中",
    copy_ready: "文案已就绪",
    visual_planning: "图片方向规划",
    image_prompt_ready: "图片 Prompt 已就绪",
    image_generating: "图片生成中",
    image_ready: "图片已就绪",
    assembling: "组装最终帖子",
    reviewing: "发布检查中",
    scheduled: "已定时",
    published: "已发布",
    failed: "处理失败"
  };
  return labels[stage] ?? stage;
}
