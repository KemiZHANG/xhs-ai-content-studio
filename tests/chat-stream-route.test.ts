import { describe, expect, it, vi } from "vitest";

describe("chat stream route", () => {
  it("wraps the existing chat route as SSE without changing the chat contract", async () => {
    vi.resetModules();
    vi.doMock("@/app/api/chat/route", () => ({
      POST: async () =>
        Response.json({
          answer: "已基于当前 PostProject 生成回复。",
          reply: "已基于当前 PostProject 生成回复。",
          stage: "brief_ready",
          intent: "create_creative_brief",
          intentConfidence: 0.91,
          needsUserInput: false,
          questions: [],
          workspacePatch: {},
          cards: [{ type: "creative_brief", title: "Brief", summary: "ok" }],
          quickActions: [],
          toolTrace: [{ id: "tool-1", label: "agent.plan", status: "completed" }]
        })
    }));

    const { POST } = await import("@/app/api/chat/stream/route");
    const response = await POST(new Request("http://localhost/api/chat/stream", {
      method: "POST",
      body: JSON.stringify({ message: "生成 Brief" })
    }));
    const text = await response.text();

    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(text).toContain("event: status");
    expect(text).toContain("event: result");
    expect(text).toContain("event: done");
    expect(text).toContain("create_creative_brief");
    expect(text).toContain("creative_brief");
  });

  it("streams errors returned by the existing chat route", async () => {
    vi.resetModules();
    vi.doMock("@/app/api/chat/route", () => ({
      POST: async () => Response.json({ error: "请输入问题" }, { status: 400 })
    }));

    const { POST } = await import("@/app/api/chat/stream/route");
    const response = await POST(new Request("http://localhost/api/chat/stream", {
      method: "POST",
      body: JSON.stringify({})
    }));
    const text = await response.text();

    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(text).toContain("event: error");
    expect(text).toContain("请输入问题");
  });
});
