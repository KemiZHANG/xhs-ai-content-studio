import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type JobType = "workflow" | "asset-generation" | "chat";
export type JobStatus = "queued" | "running" | "completed" | "failed";
export type JobStepStatus = "queued" | "running" | "done" | "skipped" | "failed";

export type JobStep = {
  id: string;
  label: string;
  status: JobStepStatus;
  detail: string;
  updatedAt: string;
};

export type PublishRecord = {
  title?: string;
  content?: string;
  tags?: string[];
  images?: string[];
  visibility?: string;
  scheduleAt?: string;
  status?: "draft" | "material" | "publishing" | "published" | "scheduled" | "failed";
  result?: unknown;
  error?: string;
};

export type JobRecord = {
  id: string;
  type: JobType;
  title: string;
  status: JobStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  workspaceId?: string;
  postProjectId?: string;
  input: unknown;
  steps: JobStep[];
  publish?: PublishRecord;
  result?: unknown;
  error?: string;
};

const jobsPath = () => path.join(process.cwd(), "data", "jobs.json");

export function createJobRecord({
  type,
  title,
  input,
  workspaceId,
  postProjectId
}: {
  type: JobType;
  title: string;
  input: unknown;
  workspaceId?: string;
  postProjectId?: string;
}): JobRecord {
  const now = new Date().toISOString();
  return {
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    status: "queued",
    progress: 0,
    createdAt: now,
    updatedAt: now,
    workspaceId,
    postProjectId,
    input,
    steps: []
  };
}

export function updateJobStep(job: JobRecord, step: Omit<JobStep, "updatedAt">): JobRecord {
  const now = new Date().toISOString();
  const nextSteps = job.steps.filter((existing) => existing.id !== step.id);
  nextSteps.push({
    ...step,
    updatedAt: now
  });

  const doneCount = nextSteps.filter((item) => item.status === "done" || item.status === "skipped").length;
  const failed = nextSteps.some((item) => item.status === "failed");

  return {
    ...job,
    status: failed ? "failed" : "running",
    progress: failed ? job.progress : Math.min(95, Math.max(5, Math.round((doneCount / Math.max(nextSteps.length, 1)) * 90))),
    steps: nextSteps,
    updatedAt: now
  };
}

export function updateJobPublish(job: JobRecord, publish: PublishRecord): JobRecord {
  return {
    ...job,
    publish: {
      ...(job.publish ?? {}),
      ...publish
    },
    updatedAt: new Date().toISOString()
  };
}

export function completeJob(job: JobRecord, result: unknown): JobRecord {
  if (isFailedWorkflowResult(result)) {
    return {
      ...job,
      status: "failed",
      result,
      error: "工作流执行失败",
      updatedAt: new Date().toISOString()
    };
  }

  return {
    ...job,
    status: "completed",
    progress: 100,
    result,
    updatedAt: new Date().toISOString()
  };
}

function isFailedWorkflowResult(result: unknown): boolean {
  return typeof result === "object" && result !== null && "status" in result && result.status === "failed";
}

export function failJob(job: JobRecord, error: string): JobRecord {
  const now = new Date().toISOString();

  return {
    ...job,
    status: "failed",
    error,
    steps: job.steps.map((step) =>
      step.status === "queued" || step.status === "running"
        ? {
            ...step,
            status: "failed",
            detail: `${step.detail}\n失败原因：${error}`,
            updatedAt: now
          }
        : step
    ),
    publish: job.publish
      ? {
          ...job.publish,
          status: "failed",
          error
        }
      : undefined,
    updatedAt: now
  };
}

export async function listJobs(): Promise<JobRecord[]> {
  try {
    const raw = await readFile(jobsPath(), "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as JobRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function getJob(id: string): Promise<JobRecord | null> {
  const jobs = await listJobs();
  return jobs.find((job) => job.id === id) ?? null;
}

export async function saveJob(job: JobRecord): Promise<JobRecord> {
  const jobs = await listJobs();
  const next = [job, ...jobs.filter((item) => item.id !== job.id)].slice(0, 200);
  const filePath = jobsPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return job;
}
