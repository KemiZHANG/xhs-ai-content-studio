import { NextResponse } from "next/server";
import { getJobRunner } from "@/lib/jobs/runner";
import { restoreJobResultAsWorkspace } from "@/lib/jobs/restore";
import { requireLocalActionToken } from "@/lib/security/action-token";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJobRunner().getJob(id);

  if (!job) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }

  return NextResponse.json({ job });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = await requireLocalActionToken(request);
    if (authError) return authError;

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    if (body.action !== "restore") {
      return NextResponse.json({ error: "Unsupported job action" }, { status: 400 });
    }

    const job = await getJobRunner().getJob(id);
    if (!job) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }
    if (job.status !== "completed" || !job.result) {
      return NextResponse.json({ error: "任务尚未完成，不能恢复为 PostProject" }, { status: 409 });
    }

    const restored = await restoreJobResultAsWorkspace(job);
    return NextResponse.json({ job, ...restored });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to restore job result" },
      { status: 500 }
    );
  }
}
