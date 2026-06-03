import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readText = (path: string) => readFileSync(join(root, path), "utf8");

describe("Post Studio chat streaming UI", () => {
  it("prefers the SSE chat endpoint and keeps the legacy chat fallback", () => {
    const page = readText("app/page.tsx");

    expect(page).toContain("requestChatTurnStream");
    expect(page).toContain('fetch("/api/chat/stream"');
    expect(page).toContain('return clientApi<ChatTurnResponse>("/api/chat"');
    expect(page).toContain("正在读取当前 PostProject");
    expect(page).toContain("流式连接不可用，已自动切回普通对话请求。");
    expect(page).toContain("parseSseEvent");
    expect(page).toContain("buildStreamStatusDetail");
  });
});
