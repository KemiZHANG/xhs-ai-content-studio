import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSettings } from "@/lib/storage/settings";

let originalCwd: string;
let tempDir: string;

beforeEach(async () => {
  vi.resetModules();
  originalCwd = process.cwd();
  tempDir = await mkdtemp(path.join(os.tmpdir(), "xhs-agent-cards-"));
  process.chdir(tempDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe("agent card generation", () => {
  it("renders xhs cards from the current draft without calling the image model", async () => {
    const renderXhsCardSet = vi.fn(async () => ({
      theme: "sketch",
      mode: "auto-split",
      width: 1080,
      height: 1440,
      pages: [],
      files: [
        { kind: "cover", title: "封面卡片", absolutePath: path.join(tempDir, "generated-assets", "generated", "cover.png"), mimeType: "image/png", size: 10, pageIndex: 0 },
        { kind: "content", title: "正文卡片 1", absolutePath: path.join(tempDir, "generated-assets", "generated", "card-1.png"), mimeType: "image/png", size: 10, pageIndex: 1 }
      ]
    }));
    vi.doMock("@/lib/cards/renderer", () => ({ renderXhsCardSet }));

    const { runAgentTurn } = await import("@/lib/agent/orchestrator");
    let imageModelCalls = 0;
    const result = await runAgentTurn({
      message: "把当前草稿生成小红书图文卡片",
      conversationId: "chat-1",
      settings: defaultSettings,
      history: [],
      currentDraft: {
        id: "draft-1",
        updatedAt: "2026-05-21T00:00:00.000Z",
        draft: {
          title: "广州咖啡馆收藏榜",
          content: "第一段内容\n\n第二段内容",
          tags: ["广州咖啡", "探店"],
          structure: [],
          imagePrompt: ""
        },
        images: [],
        visibility: defaultSettings.defaultVisibility
      },
      attachedAssets: [],
      mcp: {
        searchFeeds: async () => [],
        getFeedDetail: async () => null,
        publishContent: async () => ({ ok: true })
      },
      model: {
        generateStructuredText: async () => "",
        analyzeImageStyle: async () => "",
        generateImage: async () => {
          imageModelCalls += 1;
          return null;
        },
        generateImageFromReference: async () => {
          imageModelCalls += 1;
          return null;
        }
      }
    });

    expect(imageModelCalls).toBe(0);
    expect(renderXhsCardSet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "广州咖啡馆收藏榜",
        body: "第一段内容\n\n第二段内容",
        tags: ["广州咖啡", "探店"]
      })
    );
    expect(result.answer).toContain("图文卡片");
    expect(result.currentDraft?.images).toHaveLength(2);
    expect(result.workspace.selectedImageIds).toHaveLength(2);
  });
});
