import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildAttachmentContext, runChatAgent } from "@/lib/chat/agent";
import { defaultSettings } from "@/lib/storage/settings";
import type { DraftRecord } from "@/lib/storage/drafts";

let originalCwd: string;
let tempDir: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  tempDir = await mkdtemp(path.join(os.tmpdir(), "xhs-chat-agent-"));
  process.chdir(tempDir);
  await mkdir("data", { recursive: true });
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe("runChatAgent", () => {
  it("summarizes attached product assets for the chat prompt", () => {
    const context = buildAttachmentContext([
      {
        id: "asset-1",
        kind: "upload",
        name: "coffee-bottle",
        originalName: "coffee-bottle.png",
        absolutePath: "C:\\tmp\\coffee-bottle.png",
        mimeType: "image/png",
        size: 123,
        createdAt: "2026-05-18T00:00:00.000Z"
      }
    ]);

    expect(context).toContain("coffee-bottle");
    expect(context).toContain("产品图/参考图");
    expect(context).toContain("C:\\tmp\\coffee-bottle.png");
  });

  it("creates a draft from the latest research evidence without searching again", async () => {
    let searchCalls = 0;
    let prompt = "";

    const generatedPath = path.join(process.cwd(), "generated-assets", "generated", `chat-image-${randomUUID()}.png`);
    const result = await runChatAgent({
      message: "请基于已展示证据生成一篇原创笔记，不要重新搜索。我的需求：宣传一家适合办公的广州咖啡馆",
      settings: {
        ...defaultSettings,
        textApiKey: "text-key"
      },
      history: [
        {
          id: "run-research",
          createdAt: "2026-05-18T12:00:00.000Z",
          input: {
            topic: "广州咖啡馆",
            contentType: "探店",
            timeRange: "一周内",
            sampleCount: 1,
            visibility: "仅自己可见",
            workflowGoal: "research",
            publishMode: "draft"
          },
          result: {
            status: "research_ready",
            steps: [],
            samples: [],
            evidence: [
              {
                id: "note-1",
                title: "广州咖啡馆样本",
                author: "探店人",
                likes: 100,
                collects: 80,
                comments: 12,
                shares: 3,
                score: 300,
                url: "https://www.xiaohongshu.com/explore/note-1",
                imageUrls: ["http://sns-webpic-qc.xhscdn.com/sample.webp"],
                cachedImageUrls: [],
                detailText: "正文提到安静办公、插座、窗边座位和人均价格。",
                commentSnippets: ["求地址"],
                reasonHighlights: ["收藏高，适合提炼路线和价格。"]
              }
            ],
            researchSummary: {
              contentStrengths: ["正文有真实办公细节"],
              imageStrengths: ["窗边自然光有氛围"],
              learningsForContent: ["写清楚插座、价格、路线"],
              learningsForImages: ["拍窗边、咖啡、电脑"],
              nextQuestions: ["店名是什么？"]
            },
            report: "研究报告",
            imageStyleReport: "自然光窗边构图",
            draft: null,
            images: [],
            publishResult: { skipped: true }
          }
        }
      ],
      currentDraft: null,
      mcp: {
        searchFeeds: async () => {
          searchCalls += 1;
          return [];
        },
        getFeedDetail: async () => null,
        publishContent: async () => ({ ok: true })
      },
      model: {
        generateStructuredText: async (input) => {
          prompt = input;
          return (
          JSON.stringify({
            title: "广州办公咖啡馆",
            content: "原创正文，写清楚插座、窗边座位和路线。",
            tags: ["广州咖啡馆", "办公咖啡"],
            structure: ["证据钩子", "体验", "实用信息"],
            imagePrompt: "窗边咖啡和电脑，自然光，真实探店照片"
          })
          );
        },
        analyzeImageStyle: async () => "",
        generateImageFromReference: async () => null,
        generateImage: async () => null
      }
    });

    expect(searchCalls).toBe(0);
    expect(result.currentDraft?.draft.title).toBe("广州办公咖啡馆");
    expect(result.answer).toContain("已基于最近一次证据研究生成草稿");
    expect(prompt).toContain("文案创作简报");
    expect(prompt).toContain("写清楚插座、价格、路线");
    expect(prompt).not.toContain("正文提到安静办公");
    expect(prompt).not.toContain("sns-webpic");
    expect(prompt).not.toContain("图片风格分析");
  });

  it("does not publish when the user asks to publish but no current draft exists", async () => {
    let publishCalls = 0;

    const result = await runChatAgent({
      message: "帮我发布",
      settings: {
        ...defaultSettings,
        textApiKey: "text-key"
      },
      history: [],
      currentDraft: null,
      mcp: {
        searchFeeds: async () => [],
        getFeedDetail: async () => null,
        publishContent: async () => {
          publishCalls += 1;
          return { ok: true };
        }
      },
      model: {
        generateStructuredText: async () => "不应该生成新内容",
        analyzeImageStyle: async () => "",
        generateImageFromReference: async () => null,
        generateImage: async () => null
      }
    });

    expect(publishCalls).toBe(0);
    expect(result.answer).toContain("当前没有可发布的草稿");
  });

  it("generates a missing image before publishing the current draft", async () => {
    let publishCalls = 0;
    const generatedPath = path.join(process.cwd(), "generated-assets", "generated", "chat-image.png");
    const currentDraft: DraftRecord = {
      id: "draft-1",
      updatedAt: "2026-05-18T10:00:00.000Z",
      draft: {
        title: "通勤包这样选",
        content: "原创正文",
        tags: ["通勤包"],
        structure: ["痛点", "清单", "互动"],
        imagePrompt: "通勤包真实生活场景图"
      },
      images: [],
      visibility: defaultSettings.defaultVisibility
    };

    const result = await runChatAgent({
      message: "帮我发布",
      settings: {
        ...defaultSettings,
        textApiKey: "text-key",
        imageApiKey: "image-key",
        agentPublishPolicy: "auto_publish_allowed"
      },
      history: [],
      currentDraft,
      mcp: {
        searchFeeds: async () => [],
        getFeedDetail: async () => null,
        publishContent: async (args) => {
          publishCalls += 1;
          expect(args.images).toEqual([generatedPath]);
          return { ok: true };
        }
      },
      model: {
        generateStructuredText: async () => "不需要改文案",
        analyzeImageStyle: async () => "",
        generateImageFromReference: async () => ({ path: generatedPath }),
        generateImage: async () => ({ path: generatedPath })
      }
    });

    expect(result.answer).toContain("已发布当前草稿");
    expect(publishCalls).toBe(1);
    expect(result.currentDraft?.images).toEqual([{ path: generatedPath }]);
  });

  it("includes recent conversation context when revising the current draft", async () => {
    let prompt = "";
    const currentDraft: DraftRecord = {
      id: "draft-context",
      updatedAt: "2026-05-18T10:00:00.000Z",
      draft: {
        title: "通勤包推荐",
        content: "原始正文",
        tags: ["通勤包"],
        structure: ["痛点", "清单", "互动"],
        imagePrompt: "通勤包真实生活场景图"
      },
      images: [],
      visibility: defaultSettings.defaultVisibility
    };

    await runChatAgent({
      message: "优化标题，更生活化",
      settings: {
        ...defaultSettings,
        textApiKey: "text-key"
      },
      history: [],
      currentDraft,
      conversationMessages: [
        {
          id: "msg-1",
          role: "user",
          content: "目标人群是通勤女生，语气要像真实分享，不要像广告。",
          createdAt: "2026-05-18T09:00:00.000Z"
        },
        {
          id: "msg-2",
          role: "assistant",
          content: "好的，我会按真实分享风格处理。",
          createdAt: "2026-05-18T09:00:01.000Z"
        }
      ],
      mcp: {
        searchFeeds: async () => [],
        getFeedDetail: async () => null,
        publishContent: async () => ({ ok: true })
      },
      model: {
        generateStructuredText: async (input) => {
          prompt = input;
          return JSON.stringify({
            title: "通勤女生真的会背的包",
            content: "更新后的原创正文",
            tags: ["通勤包"],
            structure: ["真实痛点", "体验", "互动"],
            imagePrompt: "通勤包真实生活场景图"
          });
        },
        analyzeImageStyle: async () => "",
        generateImageFromReference: async () => null,
        generateImage: async () => null
      }
    });

    expect(prompt).toContain("Recent conversation context");
    expect(prompt).toContain("目标人群是通勤女生");
    expect(prompt).toContain("优化标题，更生活化");
  });
});
