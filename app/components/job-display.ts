import type { JobRecord, WorkspaceState } from "@/app/types";
import { isJobForWorkspace } from "@/lib/jobs/context";

export type JobDisplayMeta = {
  statusLabel: string;
  scopeLabel: string;
  scopeTone: "current" | "foreign" | "legacy" | "unknown";
  primaryActionLabel: string;
  canViewResult: boolean;
  canRestoreResult: boolean;
  resultHint: string;
};

export function selectRunningJobForWorkspace(
  jobs: readonly JobRecord[],
  workspace?: WorkspaceState | null
): JobRecord | null {
  return jobs.find((job) =>
    (job.status === "queued" || job.status === "running") && isJobForWorkspace(job, workspace)
  ) ?? null;
}

export function getJobDisplayMeta(job: JobRecord, workspace?: WorkspaceState | null): JobDisplayMeta {
  const hasResult = job.status === "completed" && Boolean(job.result);
  const isCurrent = isJobForWorkspace(job, workspace);
  const hasExplicitScope = Boolean(job.workspaceId || job.postProjectId);
  const isLegacy = !hasExplicitScope && hasResult;

  const scopeTone: JobDisplayMeta["scopeTone"] = isCurrent
    ? "current"
    : isLegacy
      ? "legacy"
      : hasExplicitScope
        ? "foreign"
        : "unknown";

  return {
    statusLabel: jobStatusLabel(job),
    scopeLabel: jobScopeLabel(scopeTone),
    scopeTone,
    primaryActionLabel: job.status === "completed" ? "查看任务" : "查看进度",
    canViewResult: hasResult && isCurrent,
    canRestoreResult: hasResult,
    resultHint: jobResultHint({ hasResult, isCurrent, scopeTone })
  };
}

function jobStatusLabel(job: JobRecord): string {
  if (job.status === "queued") return `排队中 · ${job.progress}%`;
  if (job.status === "running") return `运行中 · ${job.progress}%`;
  if (job.status === "completed") return "已完成 · 100%";
  return `失败 · ${job.progress}%`;
}

function jobScopeLabel(scopeTone: JobDisplayMeta["scopeTone"]): string {
  if (scopeTone === "current") return "当前项目";
  if (scopeTone === "foreign") return "历史项目";
  if (scopeTone === "legacy") return "旧任务";
  return "未绑定项目";
}

function jobResultHint({
  hasResult,
  isCurrent,
  scopeTone
}: {
  hasResult: boolean;
  isCurrent: boolean;
  scopeTone: JobDisplayMeta["scopeTone"];
}): string {
  if (!hasResult) return "任务完成后会出现查看或恢复入口。";
  if (isCurrent) return "结果属于当前 Post Studio，可直接查看。";
  if (scopeTone === "legacy") return "旧任务未绑定 PostProject，恢复后会导入当前创作台。";
  return "结果属于其他 PostProject，恢复前不会覆盖当前画布。";
}
