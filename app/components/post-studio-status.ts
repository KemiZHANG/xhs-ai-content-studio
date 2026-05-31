import type { Health, PostProject, RedactedSettings, WorkspaceState } from "@/app/types";
import { activeAccountReadinessHint, isHealthForActiveAccount } from "@/app/components/account-readiness";
import { buildPostReadinessReport } from "@/lib/post-project/readiness";
import { getPostVersionStatus } from "@/lib/post-project/versioning";
import type { PostAction } from "@/lib/post-project/types";

export type PostStudioStatusChip = {
  label: string;
  value: string;
  state: "ok" | "warn" | "neutral";
};

export type PostStudioStatusSummary = {
  headline: string;
  detail: string;
  accountLine: string;
  riskLevel: "ok" | "warn" | "neutral";
  primaryAction?: PostAction;
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
  canvasDirty
}: {
  project: PostProject | null;
  workspace: WorkspaceState | null;
  settings: RedactedSettings;
  health: Health | null;
  evidenceCount: number;
  hasDraft: boolean;
  selectedImageCount: number;
  canvasDirty: boolean;
}): PostStudioStatusSummary {
  const activeAccount = settings.accounts.find((account) => account.id === settings.activeAccountId) ?? settings.accounts[0];
  const accountReady = isHealthForActiveAccount(health, settings);
  const accountLine = [
    accountReady ? "账号可用" : "账号需确认",
    activeAccount?.displayName ?? settings.activeAccountId,
    health?.activeAccount?.loginName ? `登录名 ${health.activeAccount.loginName}` : activeAccountReadinessHint(health, settings)
  ].filter(Boolean).join(" · ");

  if (!project) {
    return {
      headline: "先新建一个帖子项目",
      detail: "当前还没有 PostProject。先输入主题做研究，后续文案、图片、发布都会绑定到同一个项目。",
      accountLine,
      riskLevel: accountReady ? "neutral" : "warn",
      primaryAction: "search_research",
      blockers: ["缺少项目主题", accountReady ? "" : "小红书账号登录状态未确认"].filter(Boolean),
      chips: [
        chip("项目", workspace?.topic ?? "未开始", "neutral"),
        chip("账号", accountReady ? "已登录" : "待检测", accountReady ? "ok" : "warn")
      ]
    };
  }

  const readiness = buildPostReadinessReport(project);
  const versionStatus = getPostVersionStatus(project);
  const blockers = [
    !accountReady ? "小红书账号登录状态未确认，发布前需要重新检测当前账号" : "",
    canvasDirty ? "画布有未保存修改，发布检查前需要先保存" : "",
    versionStatus.needsQualityGate ? "Quality Gate 需要刷新" : "",
    ...readiness.blockers.map((item) => item.detail)
  ].filter(Boolean).slice(0, 3);
  const canPublish = readiness.canRequestPublish && accountReady && !canvasDirty && versionStatus.qualityGateFresh;
  const riskLevel = canPublish ? "ok" : blockers.length ? "warn" : "neutral";

  return {
    headline: canPublish
      ? "这篇帖子已经接近可发布"
      : readiness.nextAction
        ? "下一步已经明确"
        : "继续完善当前帖子项目",
    detail: canPublish
      ? "文案、图片、证据和 Quality Gate 已对齐。最后仍需要人工确认账号、可见范围和发布时间。"
      : blockers[0] ?? readiness.summary,
    accountLine,
    riskLevel,
    primaryAction: readiness.nextAction,
    blockers,
    chips: [
      chip("研究", evidenceCount ? `${evidenceCount} 条证据` : "待研究", evidenceCount ? "ok" : "warn"),
      chip("文案", hasDraft ? "已生成" : "待生成", hasDraft ? "ok" : "warn"),
      chip("图片", selectedImageCount ? `${selectedImageCount} 张` : "待选择", selectedImageCount ? "ok" : "warn"),
      chip("检查", versionStatus.qualityGateFresh ? "已通过" : "待刷新", versionStatus.qualityGateFresh ? "ok" : "warn")
    ]
  };
}

function chip(label: string, value: string, state: PostStudioStatusChip["state"]): PostStudioStatusChip {
  return { label, value, state };
}
