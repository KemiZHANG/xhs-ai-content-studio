import { describe, expect, it } from "vitest";
import { createAgentPlan } from "@/lib/agent/planner";

describe("agent planner", () => {
  it("plans a clean project reset when the user starts a new post project", () => {
    const plan = createAgentPlan({
      message: "新建一个帖子项目，主题是通勤包，目标人群是上班族，内容目标是生成真实通勤分享",
      hasCurrentDraft: true,
      attachedAssetCount: 0,
      postStage: "copy_ready"
    });

    expect(plan.intent).toBe("start_project");
    expect(plan.steps.map((step) => step.action)).toEqual(["startProject"]);
    expect(plan.steps[0].toolName).toBe("project.startProject");
    expect(plan.topic).toBe("通勤包");
  });

  it("plans a full research and draft flow from a natural language request", () => {
    const plan = createAgentPlan({
      message: "帮我找最近一周广州咖啡馆高收藏笔记，分析标题和图片风格，再生成一篇适合探店账号的图文笔记",
      hasCurrentDraft: false,
      attachedAssetCount: 0
    });

    expect(plan.intent).toBe("research_to_draft");
    expect(plan.steps.map((step) => step.action)).toEqual([
      "research",
      "retrieveViralKnowledge",
      "summarizeEvidence",
      "generateDraft"
    ]);
    expect(plan.steps.map((step) => step.toolName)).toEqual([
      "workflow.searchRank",
      "knowledge.retrieveViralPatterns",
      "workflow.summarizeEvidence",
      "workflow.generateDraft"
    ]);
    expect(plan.topic).toContain("广州咖啡馆");
    expect(plan.timeRange).toBe("一周内");
  });

  it("plans a viral-library refresh without realtime research", () => {
    const plan = createAgentPlan({
      message: "请刷新当前项目的爆款库 RAG 证据，不要重新搜索小红书",
      hasCurrentDraft: false,
      attachedAssetCount: 0,
      postStage: "brief_ready",
      hasEvidence: true,
      hasCreativeBrief: true
    });

    expect(plan.intent).toBe("retrieve_viral_knowledge");
    expect(plan.steps.map((step) => step.action)).toEqual(["retrieveViralKnowledge"]);
    expect(plan.steps[0].toolName).toBe("knowledge.retrieveViralPatterns");
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

  it("plans image direction before generation when the user asks for prompts or visual direction", () => {
    const plan = createAgentPlan({
      message: "请基于当前 CreativeBrief 生成图片方向和图片提示词",
      hasCurrentDraft: true,
      attachedAssetCount: 0,
      postStage: "brief_ready",
      allowedActions: ["plan_visuals"],
      hasCreativeBrief: true
    });

    expect(plan.intent).toBe("answer");
    expect(plan.steps[0].reason).toContain("image prompts");
  });

  it("asks a clarifying question for ambiguous text on an empty project", () => {
    const plan = createAgentPlan({
      message: "继续",
      hasCurrentDraft: false,
      attachedAssetCount: 0,
      postStage: "empty"
    });

    expect(plan.intent).toBe("ask");
    expect(plan.steps[0].action).toBe("askClarifyingQuestion");
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

  it("plans standalone image selection from conversational context", () => {
    const plan = createAgentPlan({
      message: "就用第二张图",
      hasCurrentDraft: true,
      attachedAssetCount: 0,
      hasSelectedImages: true,
      postStage: "image_ready",
      allowedActions: ["select_images"]
    });

    expect(plan.intent).toBe("select_images");
    expect(plan.selectedImageIndex).toBe(2);
    expect(plan.steps.map((step) => step.action)).toEqual(["selectImages"]);
  });

  it("plans final post assembly and quality gate from publish-check language", () => {
    const plan = createAgentPlan({
      message: "把当前内容组合成最终帖子并进入发布检查",
      hasCurrentDraft: true,
      attachedAssetCount: 0,
      hasSelectedImages: true,
      postStage: "image_ready",
      allowedActions: ["assemble_post", "run_quality_gate"]
    });

    expect(plan.intent).toBe("quality_check");
    expect(plan.steps.map((step) => step.action)).toEqual(["assemblePost", "runQualityGate"]);
  });
});
