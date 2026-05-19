import { createModelProvider } from "@/lib/models/provider";
import { createXhsMcpClient } from "@/lib/mcp/xhs";
import { createDraftRecord, writeCurrentDraft } from "@/lib/storage/drafts";
import { appendHistory } from "@/lib/storage/history";
import {
  completeJob,
  createJobRecord,
  failJob,
  getJob,
  listJobs,
  saveJob,
  updateJobPublish,
  updateJobStep,
  type JobRecord
} from "@/lib/storage/jobs";
import { readSettings } from "@/lib/storage/settings";
import { runOneClickWorkflow, type OneClickInput } from "@/lib/workflows/one-click";

type JobRunner = {
  enqueueWorkflow(input: OneClickInput): Promise<JobRecord>;
  getJob(id: string): Promise<JobRecord | null>;
  listJobs(): Promise<JobRecord[]>;
};

const globalForJobs = globalThis as typeof globalThis & {
  xhsJobRunner?: JobRunner;
  xhsRunningJobs?: Set<string>;
};

export function getJobRunner(): JobRunner {
  if (!globalForJobs.xhsRunningJobs) {
    globalForJobs.xhsRunningJobs = new Set<string>();
  }

  if (!globalForJobs.xhsJobRunner) {
    globalForJobs.xhsJobRunner = {
      async enqueueWorkflow(input) {
        let job = createJobRecord({
          type: "workflow",
          title: `${input.workflowGoal === "research" ? "选题研究" : "生成笔记"}：${input.topic}`,
          input
        });
        job = updateJobStep(job, {
          id: "queued",
          label: "排队中",
          status: "done",
          detail: "任务已创建，准备执行。"
        });
        await saveJob(job);

        void runWorkflowJob(job.id, input);
        return job;
      },

      getJob,
      listJobs
    };
  }

  return globalForJobs.xhsJobRunner;
}

async function runWorkflowJob(jobId: string, input: OneClickInput): Promise<void> {
  if (globalForJobs.xhsRunningJobs?.has(jobId)) {
    return;
  }

  globalForJobs.xhsRunningJobs?.add(jobId);

  try {
    let job = await getJob(jobId);
    if (!job) {
      return;
    }

    job = await persist(
      updateJobStep(job, {
        id: "start",
        label: "开始执行",
        status: "done",
        detail: "后台任务已启动。"
      })
    );

    job = await persist(
      updateJobStep(job, {
        id: "workflow",
        label: input.workflowGoal === "research" ? "搜索与证据研究" : "搜索、分析与生成",
        status: "running",
        detail: "正在调用小红书 MCP 和模型。"
      })
    );

    const settings = await readSettings();
    const result = await runOneClickWorkflow({
      input,
      settings,
      mcp: createXhsMcpClient(settings),
      model: createModelProvider(settings)
    });

    job = await persist(
      updateJobStep(job, {
        id: "workflow",
        label: "搜索、分析与生成",
        status: result.status === "failed" ? "failed" : "done",
        detail: `工作流状态：${result.status}`
      })
    );

    if (result.draft) {
      job = await persist(
        updateJobPublish(job, {
          title: result.draft.title,
          content: result.draft.content,
          tags: result.draft.tags,
          images: result.images.flatMap((image) => [image.path, image.url].filter(Boolean) as string[]),
          visibility: input.visibility,
          scheduleAt: input.scheduleAt,
          status:
            result.status === "published"
              ? "published"
              : result.status === "scheduled"
                ? "scheduled"
                : result.status === "material_ready"
                  ? "material"
                  : result.status === "failed"
                    ? "failed"
                    : "draft",
          result: result.publishResult
        })
      );
    }

    const run = await appendHistory(input, result);
    if (result.draft) {
      await writeCurrentDraft(
        createDraftRecord({
          draft: result.draft,
          images: result.images,
          visibility: input.visibility,
          input,
          runId: run.id
        })
      );
    }

    await persist(completeJob(job, result));
  } catch (error) {
    const job = await getJob(jobId);
    if (job) {
      await persist(failJob(job, error instanceof Error ? error.message : "后台任务失败"));
    }
  } finally {
    globalForJobs.xhsRunningJobs?.delete(jobId);
  }
}

async function persist(job: JobRecord): Promise<JobRecord> {
  return saveJob(job);
}
