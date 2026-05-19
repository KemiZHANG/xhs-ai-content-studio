import { describe, expect, it } from "vitest";
import { classifyChatRequest } from "@/lib/chat/router";

describe("classifyChatRequest", () => {
  it("routes topic analysis requests to a research workflow first", () => {
    const decision = classifyChatRequest("帮我分析最近一周「咖啡探店」的高收藏笔记", false);

    expect(decision).toMatchObject({
      kind: "queue-workflow",
      topic: "咖啡探店",
      contentType: "探店",
      timeRange: "一周内",
      workflowGoal: "research",
      publishMode: "draft",
      analyzeImages: true,
      generateImages: false
    });
  });

  it("keeps publishing the current draft in the direct chat path", () => {
    expect(classifyChatRequest("帮我发布", true).kind).toBe("direct");
  });

  it("routes one-click publish requests to a publish workflow with image generation", () => {
    const decision = classifyChatRequest("帮我一键发一篇通勤包笔记并发布", false);

    expect(decision).toMatchObject({
      kind: "queue-workflow",
      topic: "通勤包",
      workflowGoal: "draft",
      publishMode: "publish",
      generateImages: true
    });
  });
});
