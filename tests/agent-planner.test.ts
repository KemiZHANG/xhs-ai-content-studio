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
      "createCreativeBrief",
      "generateDraft",
      "planVisuals"
    ]);
    expect(plan.steps.map((step) => step.toolName)).toEqual([
      "workflow.searchRank",
      "knowledge.retrieveViralPatterns",
      "workflow.summarizeEvidence",
      "project.createCreativeBrief",
      "workflow.generateDraft",
      "workflow.planVisuals"
    ]);
    expect(plan.topic).toContain("广州咖啡馆");
    expect(plan.timeRange).toBe("一周内");
    expect(plan.ragFilters?.sortBy).toBe("collects");
    expect(plan.ragFilters?.sortOrder).toBe("desc");
    expect(plan.ragFilters?.createdAfter).toBeTruthy();
  });

  it("adds publish assembly and Quality Gate when a full research request asks for publish review", () => {
    const plan = createAgentPlan({
      message: "帮我找最近一周广州咖啡馆高收藏笔记，分析标题和图片风格，生成图文笔记，然后进入发布检查",
      hasCurrentDraft: false,
      attachedAssetCount: 0
    });

    expect(plan.intent).toBe("research_to_draft");
    expect(plan.steps.map((step) => step.action)).toEqual([
      "research",
      "retrieveViralKnowledge",
      "summarizeEvidence",
      "createCreativeBrief",
      "generateDraft",
      "planVisuals",
      "assemblePost",
      "runQualityGate"
    ]);
    expect(plan.steps.map((step) => step.toolName)).toEqual([
      "workflow.searchRank",
      "knowledge.retrieveViralPatterns",
      "workflow.summarizeEvidence",
      "project.createCreativeBrief",
      "workflow.generateDraft",
      "workflow.planVisuals",
      "project.assemblePost",
      "project.runQualityGate"
    ]);
  });

  it("plans an explicit visual direction confirmation before image generation", () => {
    const plan = createAgentPlan({
      message: "确认图片方向，就按当前视觉方向继续",
      hasCurrentDraft: true,
      attachedAssetCount: 0,
      postStage: "image_prompt_ready",
      allowedActions: ["confirm_visual_direction", "generate_images"]
    });

    expect(plan.intent).toBe("confirm_visual_direction");
    expect(plan.steps.map((step) => step.action)).toEqual(["confirmVisualDirection"]);
    expect(plan.steps[0].toolName).toBe("project.confirmVisualDirection");
  });

  it("extracts viral RAG metric and tag filters from natural language", () => {
    const plan = createAgentPlan({
      message: "检索爆款库里广州咖啡馆 #探店 #拍照 收藏超过1000 点赞大于2千 分享20以上 综合分3000以上的高收藏案例",
      hasCurrentDraft: false,
      attachedAssetCount: 0,
      postStage: "brief_ready",
      hasEvidence: true
    });

    expect(plan.intent).toBe("retrieve_viral_knowledge");
    expect(plan.ragFilters).toMatchObject({
      minCollects: 1000,
      minLikes: 2000,
      minShares: 20,
      minScore: 3000,
      sortBy: "collects",
      sortOrder: "desc",
      tags: ["探店", "拍照"]
    });
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

  it("plans saving current research samples into the viral library", () => {
    const plan = createAgentPlan({
      message: "把这些高收藏样本保存到爆款库，沉淀成可复用规律",
      hasCurrentDraft: false,
      attachedAssetCount: 0,
      postStage: "evidence_ready",
      hasEvidence: true
    });

    expect(plan.intent).toBe("save_viral_knowledge");
    expect(plan.steps.map((step) => step.action)).toEqual(["saveViralKnowledge"]);
    expect(plan.steps[0].toolName).toBe("knowledge.saveViralCase");
  });

  it("plans a direct CreativeBrief refresh from current evidence", () => {
    const plan = createAgentPlan({
      message: "请基于当前研究证据和爆款库规律，生成/刷新这个 PostProject 的 CreativeBrief",
      hasCurrentDraft: false,
      attachedAssetCount: 0,
      postStage: "evidence_ready",
      hasEvidence: true
    });

    expect(plan.intent).toBe("create_creative_brief");
    expect(plan.steps.map((step) => step.action)).toEqual(["createCreativeBrief"]);
    expect(plan.steps[0].toolName).toBe("project.createCreativeBrief");
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
    expect(plan.steps.map((step) => step.action)).toEqual(["planVisuals"]);
    expect(plan.steps[0].toolName).toBe("workflow.planVisuals");
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

  it("uses the current PostProject stage to continue vague active-project commands", () => {
    const plan = createAgentPlan({
      message: "帮我弄一下",
      hasCurrentDraft: true,
      attachedAssetCount: 0,
      postStage: "copy_ready",
      hasEvidence: true,
      hasCreativeBrief: true,
      hasSelectedImages: true
    });

    expect(plan.intent).toBe("answer");
    expect(plan.steps.map((step) => step.action)).toEqual(["planVisuals"]);
    expect(plan.steps[0].toolName).toBe("workflow.planVisuals");
    expect(plan.steps[0].reason).toContain("Continue from current PostProject stage");
  });

  it("continues from evidence-ready stage by creating a CreativeBrief", () => {
    const plan = createAgentPlan({
      message: "继续",
      hasCurrentDraft: false,
      attachedAssetCount: 0,
      postStage: "evidence_ready",
      hasEvidence: true
    });

    expect(plan.intent).toBe("create_creative_brief");
    expect(plan.steps.map((step) => step.action)).toEqual(["createCreativeBrief"]);
    expect(plan.steps[0].toolName).toBe("project.createCreativeBrief");
  });

  it("continues from evidence-ready readiness action by refreshing viral RAG", () => {
    const plan = createAgentPlan({
      message: "继续",
      hasCurrentDraft: false,
      attachedAssetCount: 0,
      postStage: "evidence_ready",
      hasEvidence: true,
      allowedActions: ["retrieve_viral_knowledge", "create_creative_brief", "search_research"]
    });

    expect(plan.intent).toBe("retrieve_viral_knowledge");
    expect(plan.steps.map((step) => step.action)).toEqual(["retrieveViralKnowledge"]);
    expect(plan.steps[0].toolName).toBe("knowledge.retrieveViralPatterns");
  });

  it("continues from reviewing stage by preparing a guarded publish confirmation", () => {
    const plan = createAgentPlan({
      message: "下一步",
      hasCurrentDraft: true,
      attachedAssetCount: 0,
      postStage: "reviewing",
      hasEvidence: true,
      hasCreativeBrief: true,
      hasSelectedImages: true
    });

    expect(plan.intent).toBe("prepare_publish");
    expect(plan.steps.map((step) => step.action)).toEqual(["preparePublish"]);
    expect(plan.steps[0].toolName).toBe("publish.prepare");
  });

  it("asks for evidence or brief context before drafting from an under-specified project", () => {
    const plan = createAgentPlan({
      message: "帮我写一篇小红书笔记",
      hasCurrentDraft: false,
      attachedAssetCount: 0,
      postStage: "briefing",
      hasEvidence: false,
      hasCreativeBrief: false
    });

    expect(plan.intent).toBe("ask");
    expect(plan.steps[0].action).toBe("askClarifyingQuestion");
    expect(plan.steps[0].reason).toContain("does not have enough evidence");
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

  it("routes confirmation language to the active publish confirmation instead of creating another intent", () => {
    const plan = createAgentPlan({
      message: "确认发布，就这样发",
      hasCurrentDraft: true,
      attachedAssetCount: 0,
      hasPendingPublishConfirmation: true
    });

    expect(plan.intent).toBe("review_publish_confirmation");
    expect(plan.steps.map((step) => step.action)).toEqual(["reviewPublishConfirmation"]);
  });

  it("routes cancel language to the pending publish confirmation", () => {
    const plan = createAgentPlan({
      message: "先别发了，取消确认单",
      hasCurrentDraft: true,
      attachedAssetCount: 0,
      hasPendingPublishConfirmation: true
    });

    expect(plan.intent).toBe("cancel_publish_confirmation");
    expect(plan.steps.map((step) => step.action)).toEqual(["cancelPublishConfirmation"]);
  });

  it("asks for a draft before preparing a publish intent", () => {
    const plan = createAgentPlan({
      message: "帮我发布到小红书",
      hasCurrentDraft: false,
      attachedAssetCount: 0,
      postStage: "brief_ready",
      hasEvidence: true,
      hasCreativeBrief: true
    });

    expect(plan.intent).toBe("ask");
    expect(plan.steps[0].action).toBe("askClarifyingQuestion");
    expect(plan.steps[0].reason).toContain("no current draft");
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

  it("plans final post assembly without Quality Gate when the user only asks for a preview", () => {
    const plan = createAgentPlan({
      message: "把当前文案和图片组装成最终帖子",
      hasCurrentDraft: true,
      attachedAssetCount: 0,
      hasSelectedImages: true,
      postStage: "image_ready",
      allowedActions: ["assemble_post"]
    });

    expect(plan.intent).toBe("assemble_post");
    expect(plan.steps.map((step) => step.action)).toEqual(["assemblePost"]);
    expect(plan.steps[0].toolName).toBe("project.assemblePost");
  });
});
