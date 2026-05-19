import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendChatTurn, listChatConversations } from "@/lib/storage/chat";

let originalCwd: string;
let tempDir: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  tempDir = await mkdtemp(path.join(os.tmpdir(), "xhs-chat-history-"));
  process.chdir(tempDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe("chat history storage", () => {
  it("persists conversations with user and assistant messages", async () => {
    const conversation = await appendChatTurn({
      userContent: "帮我分析广州咖啡馆",
      assistantContent: "我会先搜索真实笔记，再基于证据总结。",
      workflowResult: {
        status: "draft_ready",
        steps: [],
        samples: [],
        evidence: [],
        researchSummary: null,
        report: "证据报告",
        imageStyleReport: "",
        draft: null,
        images: [],
        publishResult: { skipped: true }
      }
    });

    const conversations = await listChatConversations();

    expect(conversations).toHaveLength(1);
    expect(conversations[0].id).toBe(conversation.id);
    expect(conversations[0].title).toContain("帮我分析广州咖啡馆");
    expect(conversations[0].messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(conversations[0].messages[1].workflowResult?.report).toBe("证据报告");
  });
});
