import { describe, expect, it } from "vitest";
import { createAgentPlan } from "@/lib/agent/planner";

describe("agent planner", () => {
  it("plans a full research and draft flow from a natural language request", () => {
    const plan = createAgentPlan({
      message: "帮我找最近一周广州咖啡馆高收藏笔记，分析标题和图片风格，再生成一篇适合探店账号的图文笔记",
      hasCurrentDraft: false,
      attachedAssetCount: 0
    });

    expect(plan.intent).toBe("research_to_draft");
    expect(plan.steps.map((step) => step.action)).toEqual([
      "research",
      "summarizeEvidence",
      "generateDraft"
    ]);
    expect(plan.steps.map((step) => step.toolName)).toEqual([
      "workflow.searchRank",
      "workflow.summarizeEvidence",
      "workflow.generateDraft"
    ]);
    expect(plan.topic).toContain("广州咖啡馆");
    expect(plan.timeRange).toBe("一周内");
  });

  it("plans product image generation when the user refers to uploaded product images", () => {
    const plan = createAgentPlan({
      message: "用我上传的产品图生成小红书场景图",
      hasCurrentDraft: true,
      attachedAssetCount: 1
    });

    expect(plan.intent).toBe("generate_images");
    expect(plan.steps.map((step) => step.action)).toContain("generateImages");
    expect(plan.requiresAssets).toBe(false);
  });

  it("plans card rendering from the current draft", () => {
    const plan = createAgentPlan({
      message: "把当前草稿生成小红书图文卡片",
      hasCurrentDraft: true,
      attachedAssetCount: 0
    });

    expect(plan.intent).toBe("generate_cards");
    expect(plan.steps.map((step) => step.toolName)).toContain("image.generateCards");
  });

  it("asks for an image when image generation depends on a product photo that is not attached", () => {
    const plan = createAgentPlan({
      message: "用我的产品图换一个咖啡馆背景",
      hasCurrentDraft: true,
      attachedAssetCount: 0
    });

    expect(plan.intent).toBe("ask");
    expect(plan.steps[0].action).toBe("askClarifyingQuestion");
    expect(plan.requiresAssets).toBe(true);
  });

  it("plans a scheduled publish from the current draft", () => {
    const plan = createAgentPlan({
      message: "就用第二张图，今晚 8 点发",
      hasCurrentDraft: true,
      attachedAssetCount: 0
    });

    expect(plan.intent).toBe("schedule_publish");
    expect(plan.steps.map((step) => step.action)).toEqual(["preparePublish", "schedulePublish"]);
    expect(plan.selectedImageIndex).toBe(2);
    expect(plan.scheduleText).toContain("今晚 8 点");
  });
});
