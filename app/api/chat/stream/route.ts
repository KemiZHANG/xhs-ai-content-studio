import { POST as runChatPost } from "@/app/api/chat/route";

export const runtime = "nodejs";

type StreamEvent = {
  event: string;
  data: unknown;
};

export async function POST(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = ({ event, data }: StreamEvent) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({
        event: "status",
        data: {
          stage: "received",
          message: "已收到请求，正在读取当前 PostProject、判断意图并准备工具调用。"
        }
      });

      try {
        const response = await runChatPost(request.clone());
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          send({
            event: "error",
            data: {
              status: response.status,
              error: payload?.error || "对话执行失败"
            }
          });
          return;
        }

        send({
          event: "status",
          data: {
            stage: payload?.stage || "completed",
            intent: payload?.intent,
            intentConfidence: payload?.intentConfidence,
            toolCount: Array.isArray(payload?.toolTrace) ? payload.toolTrace.length : 0,
            cardCount: Array.isArray(payload?.cards) ? payload.cards.length : 0
          }
        });
        send({
          event: "result",
          data: payload
        });
        send({
          event: "done",
          data: {
            ok: true,
            stage: payload?.stage || "completed"
          }
        });
      } catch (error) {
        send({
          event: "error",
          data: {
            status: 500,
            error: error instanceof Error ? error.message : "流式对话执行失败"
          }
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
