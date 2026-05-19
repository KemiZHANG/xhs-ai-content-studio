import { describe, expect, it } from "vitest";
import { createJobRecord, completeJob, failJob, updateJobStep } from "@/lib/storage/jobs";

describe("job records", () => {
  it("tracks progress as steps are updated and completed", () => {
    let job = createJobRecord({
      type: "workflow",
      title: "生成咖啡探店笔记",
      input: { topic: "咖啡探店" }
    });

    job = updateJobStep(job, {
      id: "search",
      label: "搜索相关笔记",
      status: "running",
      detail: "正在搜索"
    });
    expect(job.status).toBe("running");
    expect(job.progress).toBeGreaterThan(0);

    job = updateJobStep(job, {
      id: "search",
      label: "搜索相关笔记",
      status: "done",
      detail: "完成"
    });
    job = completeJob(job, { ok: true });

    expect(job.status).toBe("completed");
    expect(job.progress).toBe(100);
    expect(job.result).toEqual({ ok: true });
  });

  it("records failures without losing previous steps", () => {
    let job = createJobRecord({
      type: "workflow",
      title: "发布笔记",
      input: {}
    });

    job = updateJobStep(job, {
      id: "publish",
      label: "发布",
      status: "running",
      detail: "调用 MCP"
    });
    job = failJob(job, "MCP timeout");

    expect(job.status).toBe("failed");
    expect(job.error).toBe("MCP timeout");
    expect(job.steps).toHaveLength(1);
    expect(job.steps[0].status).toBe("failed");
  });

  it("does not mark a job completed when the workflow result failed", () => {
    let job = createJobRecord({
      type: "workflow",
      title: "选题研究",
      input: {}
    });

    job = updateJobStep(job, {
      id: "workflow",
      label: "搜索与证据研究",
      status: "failed",
      detail: "模型失败"
    });
    job = completeJob(job, { status: "failed", report: "流程执行失败" });

    expect(job.status).toBe("failed");
    expect(job.progress).toBeLessThan(100);
    expect(job.result).toEqual({ status: "failed", report: "流程执行失败" });
  });
});
