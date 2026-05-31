import { readWorkspaceState } from "@/lib/agent/state";
import { readPostProject } from "@/lib/post-project/store";
import { listJobs } from "@/lib/storage/jobs";

export const runtime = "nodejs";

export async function GET() {
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const sendSnapshot = async () => {
        try {
          const [jobs, workspace, postProject] = await Promise.all([
            listJobs(),
            readWorkspaceState(),
            readPostProject()
          ]);
          controller.enqueue(
            encoder.encode(`event: jobs\ndata: ${JSON.stringify({ jobs, workspace, postProject })}\n\n`)
          );
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                error: error instanceof Error ? error.message : "Failed to stream jobs"
              })}\n\n`
            )
          );
        }
      };

      controller.enqueue(encoder.encode("retry: 2500\n\n"));
      await sendSnapshot();
      timer = setInterval(() => void sendSnapshot(), 2500);
    },
    cancel() {
      if (timer) {
        clearInterval(timer);
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive"
    }
  });
}
