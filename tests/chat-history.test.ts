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

  it("persists structured agent cards, quick actions, and tool trace", async () => {
    const conversation = await appendChatTurn({
      userContent: "基于证据生成文案",
      assistantContent: "我整理了当前项目的下一步。",
      assistantMeta: {
        intent: "research_to_draft",
        intentConfidence: 0.66,
        needsUserInput: true,
        stage: "copy_ready",
        questions: ["请确认目标人群"],
        cards: [{
          id: "card-copy",
          type: "copy_draft",
          title: "文案草稿",
          summary: "一版基于证据的草稿"
        }],
        quickActions: [{
          id: "qa-quality",
          label: "进入发布检查",
          action: "run_quality_gate"
        }],
        toolTrace: [{
          id: "trace-1",
          label: "draft.createFromEvidence",
          status: "completed",
          detail: "基于 evidencePack 生成草稿",
          createdAt: "2026-05-30T00:00:00.000Z"
        }]
      }
    });

    const conversations = await listChatConversations();
    const assistant = conversations.find((item) => item.id === conversation.id)?.messages.at(-1);

    expect(assistant?.cards?.[0].type).toBe("copy_draft");
    expect(assistant?.quickActions?.[0].action).toBe("run_quality_gate");
    expect(assistant?.toolTrace?.[0].label).toBe("draft.createFromEvidence");
    expect(assistant?.questions).toEqual(["请确认目标人群"]);
    expect(assistant?.intent).toBe("research_to_draft");
    expect(assistant?.intentConfidence).toBe(0.66);
    expect(assistant?.needsUserInput).toBe(true);
    expect(assistant?.stage).toBe("copy_ready");
  });
});
