import type { AgentToolTraceItem } from "@/app/types";

export type AgentTraceSummary = {
  visibleTrace: AgentToolTraceItem[];
  totalCount: number;
  failedCount: number;
  runningCount: number;
  completedCount: number;
  plannedCount: number;
  summaryLabel: string;
  recoveryHint?: string;
};

export function buildAgentTraceSummary(trace: AgentToolTraceItem[], visibleLimit = 4): AgentTraceSummary {
  const totalCount = trace.length;
  const failedCount = trace.filter((item) => item.status === "failed").length;
  const runningCount = trace.filter((item) => item.status === "running").length;
  const completedCount = trace.filter((item) => item.status === "completed").length;
  const plannedCount = trace.filter((item) => item.status === "planned").length;
  const parts = [
    totalCount ? `${totalCount} 步` : "0 步",
    failedCount ? `${failedCount} 个失败` : "",
    runningCount ? `${runningCount} 个执行中` : "",
    completedCount && !failedCount && !runningCount ? `${completedCount} 个完成` : ""
  ].filter(Boolean);

  return {
    visibleTrace: trace.slice(-Math.max(1, visibleLimit)),
    totalCount,
    failedCount,
    runningCount,
    completedCount,
    plannedCount,
    summaryLabel: parts.join(" · "),
    recoveryHint: buildRecoveryHint({ failedCount, runningCount, plannedCount, totalCount })
  };
}

function buildRecoveryHint({
  failedCount,
  runningCount,
  plannedCount,
  totalCount
}: Pick<AgentTraceSummary, "failedCount" | "runningCount" | "plannedCount" | "totalCount">): string | undefined {
  if (!totalCount) return undefined;
  if (failedCount) {
    return "有步骤失败：先查看失败详情，可重试当前步骤，或回到右侧成果画布使用下一步建议继续。";
  }
  if (runningCount) {
    return "任务仍在执行：可以留在当前对话，右侧成果画布会继续刷新进度。";
  }
  if (plannedCount) {
    return "还有计划中的步骤：继续发送明确指令后，Agent 会接着调用对应工具。";
  }
  return undefined;
}
