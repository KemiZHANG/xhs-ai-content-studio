import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readText = (path: string) => readFileSync(join(root, path), "utf8");

describe("Post Studio chat streaming UI", () => {
  it("keeps the page wired to the reusable streaming client", () => {
    const page = readText("app/page.tsx");
    const client = readText("app/client/chat-stream.ts");

    expect(page).toContain('from "@/app/client/chat-stream"');
    expect(page).toContain("requestChatTurn({");
    expect(page).toContain("onStreamStatus");
    expect(page).toContain("正在读取当前 PostProject");
    expect(page).toContain("buildStreamStatusDetail");
    expect(page).not.toContain('fetch("/api/chat/stream"');

    expect(client).toContain("requestChatTurnStream");
    expect(client).toContain('fetch("/api/chat/stream"');
    expect(client).toContain('return clientApi<ChatTurnResponse>("/api/chat"');
    expect(client).toContain("流式连接不可用，已自动切回普通对话请求。");
    expect(client).toContain("parseSseEvent");
    expect(client).toContain("buildStreamStatusDetail");
  });

  it("keeps the stream client safe for fallback and token-aware requests", () => {
    const client = readText("app/client/chat-stream.ts");

    expect(client).toContain("requestChatTurnStream");
    expect(client).toContain("getClientActionToken");
    expect(client).toContain("X-XHS-Action-Token");
    expect(client).toContain("event.event === \"error\"");
    expect(client).toContain("event.event === \"result\"");
  });
});
