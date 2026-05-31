import { describe, expect, it } from "vitest";
import { buildAgentTraceSummary } from "@/app/components/agent-trace-summary";
import type { AgentToolTraceItem } from "@/app/types";

function traceItem(id: string, status: AgentToolTraceItem["status"]): AgentToolTraceItem {
  return {
    id,
    label: `tool.${id}`,
    status,
    detail: `${id} detail`,
    createdAt: `2026-05-31T10:00:0${id}.000Z`
  };
}

describe("agent trace summary", () => {
  it("keeps the newest visible trace items and summarizes status counts", () => {
    const summary = buildAgentTraceSummary([
      traceItem("1", "completed"),
      traceItem("2", "running"),
      traceItem("3", "completed"),
      traceItem("4", "failed"),
      traceItem("5", "planned")
    ]);

    expect(summary.visibleTrace.map((item) => item.id)).toEqual(["2", "3", "4", "5"]);
    expect(summary.totalCount).toBe(5);
    expect(summary.failedCount).toBe(1);
    expect(summary.runningCount).toBe(1);
    expect(summary.completedCount).toBe(2);
    expect(summary.plannedCount).toBe(1);
    expect(summary.summaryLabel).toContain("5 步");
    expect(summary.summaryLabel).toContain("1 个失败");
    expect(summary.recoveryHint).toContain("重试当前步骤");
  });

  it("does not invent a recovery hint when there is no trace", () => {
    const summary = buildAgentTraceSummary([]);

    expect(summary.visibleTrace).toEqual([]);
    expect(summary.totalCount).toBe(0);
    expect(summary.recoveryHint).toBeUndefined();
  });

  it("tells the user to wait when a tool is still running", () => {
    const summary = buildAgentTraceSummary([
      traceItem("1", "completed"),
      traceItem("2", "running")
    ]);

    expect(summary.failedCount).toBe(0);
    expect(summary.runningCount).toBe(1);
    expect(summary.recoveryHint).toContain("仍在执行");
  });
});
