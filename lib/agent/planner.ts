import type { AgentPlan, AgentPlanStep } from "@/lib/agent/types";
import type { PostStage } from "@/lib/post-project/types";

export type CreateAgentPlanInput = {
  message: string;
  hasCurrentDraft: boolean;
  attachedAssetCount: number;
  postStage?: PostStage;
  allowedActions?: string[];
  hasEvidence?: boolean;
  hasCreativeBrief?: boolean;
  hasSelectedImages?: boolean;
  hasPendingPublishConfirmation?: boolean;
};

export function createAgentPlan(input: CreateAgentPlanInput): AgentPlan {
  const message = input.message.trim();
  const lower = message.toLowerCase();
  const stage = input.postStage ?? "empty";

  if (isNewProjectRequest(message, lower)) {
    return buildPlan({
      intent: "start_project",
      topic: inferNewProjectTopic(message) ?? inferTopic(message),
      steps: [step("startProject", "Reset the active PostProject and start a clean post workspace.", "project.startProject")]
    });
  }

  if (input.hasPendingPublishConfirmation && isCancelPublishConfirmationRequest(message, lower)) {
    return buildPlan({
      intent: "cancel_publish_confirmation",
      topic: inferTopic(message),
      steps: [step("cancelPublishConfirmation", "Cancel the active pending publish confirmation without calling Xiaohongshu.", "publish.cancelConfirmation")]
    });
  }

  if (input.hasPendingPublishConfirmation && isPublishConfirmationReviewRequest(message, lower)) {
    return buildPlan({
      intent: "review_publish_confirmation",
      topic: inferTopic(message),
      steps: [step("reviewPublishConfirmation", "Show the active publish confirmation and require explicit UI confirmation before external publishing.", "publish.reviewConfirmation")]
    });
  }

  if (isScheduledPublishRequest(message, lower) && input.hasCurrentDraft) {
    return buildPlan({
      intent: "schedule_publish",
      topic: inferTopic(message),
      selectedImageIndex: inferSelectedImageIndex(message),
      scheduleText: inferScheduleText(message),
      steps: [
        step("preparePublish", "Prepare the current draft and selected assets for publishing.", "publish.prepare"),
        step("schedulePublish", "Create a scheduled publish intent guarded by publish policy.", "publish.execute")
      ]
    });
  }

  if (isImageSelectionRequest(message, lower) && (input.hasSelectedImages || input.hasCurrentDraft)) {
    return buildPlan({
      intent: "select_images",
      topic: inferTopic(message),
      selectedImageIndex: inferSelectedImageIndex(message),
      steps: [step("selectImages", "Select an image from the current PostProject canvas.", "project.selectImages")]
    });
  }

  if (isAssemblePostRequest(message, lower) && input.hasCurrentDraft) {
    return buildPlan({
      intent: "assemble_post",
      topic: inferTopic(message),
      steps: [
        step("assemblePost", "Assemble current draft and selected images into the final post preview.", "project.assemblePost")
      ]
    });
  }

  if (isQualityCheckRequest(message, lower) && input.hasCurrentDraft) {
    return buildPlan({
      intent: "quality_check",
      topic: inferTopic(message),
      steps: [
        step("assemblePost", "Assemble current draft and selected images into the final post.", "project.assemblePost"),
        step("runQualityGate", "Run the PostProject Quality Gate before publish confirmation.", "project.runQualityGate")
      ]
    });
  }

  if (isCardGenerationRequest(message, lower) && input.hasCurrentDraft) {
    return buildPlan({
      intent: "generate_cards",
      topic: inferTopic(message),
      steps: [step("generateCards", "Render Xiaohongshu cover and content cards from the current draft.", "image.generateCards")]
    });
  }

  if (isVisualDirectionConfirmationRequest(message, lower) && (input.allowedActions?.includes("confirm_visual_direction") || input.postStage === "visual_planning" || input.postStage === "image_prompt_ready")) {
    return buildPlan({
      intent: "confirm_visual_direction",
      topic: inferTopic(message),
      steps: [step("confirmVisualDirection", "Record explicit user confirmation for the current visual direction before image generation or publish checks.", "project.confirmVisualDirection")]
    });
  }

  if (isImageGenerationRequest(message, lower)) {
    if ((/方向|提示词|prompt/i.test(message) || input.allowedActions?.includes("plan_visuals")) && !/出图|生图|生成.*(?:配图|场景图|产品图)/.test(message)) {
      return buildPlan({
        intent: "answer",
        topic: inferTopic(message),
        steps: [step("planVisuals", "Plan visual direction and image prompts from the current CreativeBrief.", "workflow.planVisuals")]
      });
    }
    const needsProductAsset = /产品图|商品图|参考图|上传|换.*背景|背景/.test(message) && input.attachedAssetCount === 0;
    if (needsProductAsset) {
      return buildPlan({
        intent: "ask",
        topic: inferTopic(message),
        requiresAssets: true,
        steps: [step("askClarifyingQuestion", "The user needs product-image generation but no image is attached.")]
      });
    }

    return buildPlan({
      intent: "generate_images",
      topic: inferTopic(message),
      requiresAssets: false,
      steps: [step("generateImages", "Generate Xiaohongshu-ready images from the current draft or attached assets.", "workflow.generateImages")]
    });
  }

  if (isDraftRevisionRequest(message, lower) && input.hasCurrentDraft) {
    return buildPlan({
      intent: "revise_draft",
      topic: inferTopic(message),
      steps: [step("reviseDraft", "Revise the current draft while preserving the workspace context.", "draft.reviseCurrent")]
    });
  }

  if (isCreativeBriefRequest(message, lower)) {
    if (input.hasEvidence || input.hasCreativeBrief || input.postStage === "briefing" || input.allowedActions?.includes("create_creative_brief")) {
      return buildPlan({
        intent: "create_creative_brief",
        topic: inferTopic(message),
        steps: [step("createCreativeBrief", "Refresh the shared CreativeBrief from PostProject evidence, user inputs, and viral-library patterns.", "project.createCreativeBrief")]
      });
    }
    return buildPlan({
      intent: "ask",
      topic: inferTopic(message),
      steps: [step("askClarifyingQuestion", "The user wants a CreativeBrief, but the active PostProject does not have enough evidence or brief input yet.")]
    });
  }

  if (isDraftCreationFromProjectRequest(message, lower) && (input.hasEvidence || input.hasCreativeBrief)) {
    return buildPlan({
      intent: "answer",
      topic: inferTopic(message),
      steps: [step("generateDraft", "Generate copy from the current PostProject evidence and CreativeBrief.", "draft.createFromEvidence")]
    });
  }

  if (isDraftCreationFromProjectRequest(message, lower) && !isPublishRequest(message, lower) && !hasExplicitResearchSignal(message, lower)) {
    return buildPlan({
      intent: "ask",
      topic: inferTopic(message),
      steps: [step("askClarifyingQuestion", "The user wants draft creation, but the active PostProject does not have enough evidence or CreativeBrief context.")]
    });
  }

  if (isViralKnowledgeRequest(message, lower)) {
    if (isViralKnowledgeSaveRequest(message, lower)) {
      return buildPlan({
        intent: "save_viral_knowledge",
        topic: inferTopic(message),
        steps: [step("saveViralKnowledge", "Save high-value realtime research samples as structured viral-library patterns.", "knowledge.saveViralCase")]
      });
    }
    return buildPlan({
      intent: "retrieve_viral_knowledge",
      topic: inferTopic(message),
      ragFilters: inferRagFilters(message),
      steps: [step("retrieveViralKnowledge", "Refresh reusable patterns from the viral knowledge base without running realtime Xiaohongshu search.", "knowledge.retrieveViralPatterns")]
    });
  }

  if (isPublishRequest(message, lower) && !(hasExplicitResearchSignal(message, lower) && isDraftOutputRequest(message))) {
    if (!input.hasCurrentDraft) {
      return buildPlan({
        intent: "ask",
        topic: inferTopic(message),
        steps: [step("askClarifyingQuestion", "The user wants to publish, but there is no current draft or assembled post to publish.")]
      });
    }
    return buildPlan({
      intent: "prepare_publish",
      topic: inferTopic(message),
      steps: [step("preparePublish", "Prepare a guarded publish intent for the current draft.", "publish.prepare")]
    });
  }

  if (isResearchRequest(message, lower)) {
    const wantsDraft = isDraftOutputRequest(message);
    const wantsVisualPlan = wantsDraft && isVisualPlanningRequest(message, lower);
    const wantsPublishCheck = isQualityCheckRequest(message, lower) || /发布检查|质量检查|确认单|发布前|quality gate/i.test(message);
    const researchToDraftSteps: AgentPlanStep[] = [
      step("research", "Search and collect Xiaohongshu evidence.", "workflow.searchRank"),
      step("retrieveViralKnowledge", "Retrieve reusable patterns from the viral knowledge base.", "knowledge.retrieveViralPatterns"),
      step("summarizeEvidence", "Summarize evidence into title, body, tag, and image insights.", "workflow.summarizeEvidence"),
      step("createCreativeBrief", "Compress realtime and viral evidence into a shared CreativeBrief for copy and visuals.", "project.createCreativeBrief"),
      step("generateDraft", "Generate an original draft from the shared CreativeBrief and summarized evidence.", "workflow.generateDraft")
    ];
    if (wantsVisualPlan) {
      researchToDraftSteps.push(step("planVisuals", "Plan image direction and prompts from the same CreativeBrief used by the copy.", "workflow.planVisuals"));
    }
    if (wantsPublishCheck) {
      researchToDraftSteps.push(
        step("assemblePost", "Assemble the generated copy and selected images into a publish preview.", "project.assemblePost"),
        step("runQualityGate", "Run Quality Gate before any publish confirmation is created.", "project.runQualityGate")
      );
    }
    return buildPlan({
      intent: wantsDraft ? "research_to_draft" : "research_only",
      topic: inferTopic(message),
      timeRange: inferTimeRange(message),
      ragFilters: inferRagFilters(message),
      steps: wantsDraft
        ? researchToDraftSteps
        : [
            step("research", "Search and collect Xiaohongshu evidence.", "workflow.searchRank"),
            step("retrieveViralKnowledge", "Retrieve reusable patterns from the viral knowledge base.", "knowledge.retrieveViralPatterns"),
            step("summarizeEvidence", "Summarize evidence for the user.", "workflow.summarizeEvidence")
          ]
    });
  }

  if (isAmbiguousLowSignalRequest(message, lower)) {
    return buildPlan({
      intent: "ask",
      topic: inferTopic(message),
      steps: [step("askClarifyingQuestion", "The user command is too vague for a safe PostProject action, so clarify before calling tools.")]
    });
  }

  return buildPlan({
    intent: stage === "empty" && !inferTopic(message) ? "ask" : "answer",
    topic: inferTopic(message),
    steps: stage === "empty" && !inferTopic(message)
      ? [step("askClarifyingQuestion", "The user intent is ambiguous and no active PostProject context exists.")]
      : [step("answer", "Answer directly or delegate to the legacy chat agent.")]
  });
}

function isDraftOutputRequest(message: string): boolean {
  return /生成|写|文案|笔记|标题|正文|标签|草稿|图文/.test(message);
}

function isVisualPlanningRequest(message: string, lower: string): boolean {
  return /图片风格|图片方向|视觉|封面|配图|图文|提示词|场景图|产品图/.test(message) || lower.includes("visual") || lower.includes("image prompt");
}

function isVisualDirectionConfirmationRequest(message: string, lower: string): boolean {
  return /(?:确认|可以|通过|就按|按这个|没问题|同意).{0,12}(?:图片方向|视觉方向|图片风格|视觉风格|配图方向|封面方向|Prompt|提示词)|(?:图片方向|视觉方向|配图方向|封面方向).{0,12}(?:确认|可以|通过|没问题|同意)/i.test(message) ||
    lower.includes("confirm visual") ||
    lower.includes("confirm image direction");
}

function isCreativeBriefRequest(message: string, lower: string): boolean {
  return /CreativeBrief|创作简报|创作 Brief|内容方向|生成\/刷新.*Brief|刷新.*Brief|整理.*Brief|生成.*Brief/i.test(message) || lower.includes("creative brief");
}

function isAmbiguousLowSignalRequest(message: string, lower: string): boolean {
  const compact = message.replace(/\s+/g, "");
  if (compact.length > 16) return false;
  if (lower === "ok" || lower === "thanks" || lower === "thank you") return false;
  return /^(继续|下一步|帮我弄一下|帮我处理|处理一下|搞一下|优化一下|改一下|再来一下|你看着办|随便弄|安排一下|继续吧|继续做)$/.test(compact);
}

function buildPlan(input: Omit<AgentPlan, "id">): AgentPlan {
  return {
    id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...input
  };
}

function step(action: AgentPlanStep["action"], reason: string, toolName?: string): AgentPlanStep {
  return toolName ? { action, reason, toolName } : { action, reason };
}

function isNewProjectRequest(message: string, lower: string): boolean {
  if (lower.includes("new project") || lower.includes("start over")) {
    return true;
  }
  if (/重新搜索|重新研究|重新生成/.test(message)) {
    return false;
  }
  return /新建|新的项目|新项目|开始新的|重新开始|换一个主题|换个主题|另写一篇|下一篇|新帖子|新笔记/.test(message);
}

function inferNewProjectTopic(message: string): string | undefined {
  const slot = message.match(/(?:主题|选题|笔记主题|帖子主题)\s*(?:是|为|:|：)?\s*([^，。！？；;\n]+)/);
  if (slot?.[1]?.trim()) {
    return cleanupTopic(slot[1]);
  }
  const loose = message.match(/(?:新建|开始|做一个|做一篇|我要写|我想写|另写一篇|下一篇)\s*(?:一个|一篇)?\s*([^，。！？；;\n]{2,32})(?:项目|笔记|帖子|图文|内容)?/);
  if (!loose?.[1]) return undefined;
  return cleanupTopic(loose[1].replace(/^(关于|小红书)/, "").replace(/(?:项目|笔记|帖子|图文|内容)$/, ""));
}

function isResearchRequest(message: string, lower: string): boolean {
  return /搜索|查找|找|分析|高收藏|高赞|爆款|小红书|笔记|竞品|研究/.test(message) || lower.includes("research");
}

function hasExplicitResearchSignal(message: string, lower: string): boolean {
  return /搜索|查找|找|分析|高收藏|高赞|爆款|竞品|研究/.test(message) || lower.includes("research");
}

function isViralKnowledgeRequest(message: string, lower: string): boolean {
  return /爆款库|RAG|历史爆款|爆款规律|可复用规律|刷新爆款|检索爆款库/.test(message) || lower.includes("viral knowledge") || lower.includes("rag");
}

function isViralKnowledgeSaveRequest(message: string, lower: string): boolean {
  return /保存.*爆款库|存.*爆款库|加入.*爆款库|入库|沉淀.*爆款|把.*样本.*爆款库|save.*viral/i.test(message) || lower.includes("save viral");
}

function isImageGenerationRequest(message: string, lower: string): boolean {
  return /(?:生成|做|出).*?(?:图片|配图|场景图|产品图|商品图)|图片生成|配图|产品图|商品图|参考图|换.*背景|场景图/.test(message) || lower.includes("image");
}

function isCardGenerationRequest(message: string, lower: string): boolean {
  return /图文卡片|卡片图|干货图|封面卡|正文卡|卡片/.test(message) || lower.includes("card");
}

function isImageSelectionRequest(message: string, lower: string): boolean {
  return /(?:用|选|选择|设为|就用|使用).{0,8}(?:第?\s*\d+\s*张|第?\s*[一二三四五六七八九十两]\s*张|这张|当前图|封面图|配图)/.test(message) || lower.includes("select image");
}

function isQualityCheckRequest(message: string, lower: string): boolean {
  return /发布检查|质量检查|检查发布|进入发布检查|组合(?:成)?(?:最终)?帖子|组装(?:成)?(?:最终)?帖子|生成确认单|发布前检查/.test(message) || lower.includes("quality gate");
}

function isAssemblePostRequest(message: string, lower: string): boolean {
  const wantsAssembly = /组合(?:成)?(?:最终)?帖子|组装(?:成)?(?:最终)?帖子|生成(?:最终)?发布预览|发布预览|最终稿/.test(message) || lower.includes("assemble post");
  const wantsQuality = /发布检查|质量检查|检查发布|进入发布检查|生成确认单|发布前检查|quality gate/i.test(message);
  return wantsAssembly && !wantsQuality;
}

function isDraftRevisionRequest(message: string, lower: string): boolean {
  return /修改|改得|优化|生活化|重写|调整|标题|正文|标签/.test(message) || lower.includes("revise");
}

function isDraftCreationFromProjectRequest(message: string, lower: string): boolean {
  return /基于当前|基于证据|根据证据|生成文案|生成草稿|写一篇|写成笔记|出一版/.test(message) || lower.includes("draft");
}

function isScheduledPublishRequest(message: string, lower: string): boolean {
  return (/发布|发|定时/.test(message) && /今晚|今天|明天|后天|\d+\s*点|[一二三四五六七八九十两]\s*点/.test(message)) || lower.includes("schedule");
}

function isPublishRequest(message: string, lower: string): boolean {
  return /发布|发出去|发笔记|发送|发到小红书|帮我发|立即发|确认发布/.test(message) || lower.includes("publish");
}

function isPublishConfirmationReviewRequest(message: string, lower: string): boolean {
  return /查看.*确认单|确认单|确认发布|确认立即发布|确认定时发布|可以发了|就这样发|确认提交/.test(message) || lower.includes("confirm publish");
}

function isCancelPublishConfirmationRequest(message: string, lower: string): boolean {
  return /取消.*确认|取消.*发布|撤销.*发布|不要发|先别发|别发了|取消确认单/.test(message) || lower.includes("cancel publish");
}

function inferTimeRange(message: string): string | undefined {
  if (/最近一周|一周内|一周/.test(message)) return "一周内";
  if (/两周|二周/.test(message)) return "两周内";
  if (/今天|一天|一天内/.test(message)) return "一天内";
  if (/半年|六个月/.test(message)) return "半年内";
  return undefined;
}

function inferRagFilters(message: string): AgentPlan["ragFilters"] {
  const filters: AgentPlan["ragFilters"] = {};
  const timeRange = inferTimeRange(message);
  if (timeRange) {
    filters.createdAfter = createdAfterForTimeRange(timeRange);
  }
  const minLikes = inferMetricThreshold(message, ["点赞", "赞", "likes"]);
  const minCollects = inferMetricThreshold(message, ["收藏", "藏", "collects"]);
  const minComments = inferMetricThreshold(message, ["评论", "评", "comments"]);
  const minShares = inferMetricThreshold(message, ["分享", "转发", "shares"]);
  const minScore = inferMetricThreshold(message, ["评分", "分数", "综合分", "score"]);
  if (minLikes !== undefined) filters.minLikes = minLikes;
  if (minCollects !== undefined) filters.minCollects = minCollects;
  if (minComments !== undefined) filters.minComments = minComments;
  if (minShares !== undefined) filters.minShares = minShares;
  if (minScore !== undefined) filters.minScore = minScore;
  if (/高分|评分高|综合分/.test(message)) filters.sortBy = "score";
  if (/高分享|分享高|转发高/.test(message)) filters.sortBy = "shares";
  if (/高评论|评论高/.test(message)) filters.sortBy = "comments";
  if (/高赞|点赞高/.test(message)) filters.sortBy = "likes";
  if (/高收藏|收藏高|高藏/.test(message)) filters.sortBy = "collects";
  if (filters.sortBy) filters.sortOrder = "desc";
  const tags = inferTags(message);
  if (tags.length) filters.tags = tags;
  return Object.keys(filters).length ? filters : undefined;
}

function createdAfterForTimeRange(timeRange: string): string | undefined {
  const days = timeRange === "一天内" ? 1 : timeRange === "一周内" ? 7 : timeRange === "两周内" ? 14 : timeRange === "半年内" ? 183 : undefined;
  if (!days) return undefined;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function inferMetricThreshold(message: string, labels: string[]): number | undefined {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*(?:大于|超过|高于|至少|>=|不少于)?\\s*(\\d+(?:\\.\\d+)?)\\s*(万|千|k|K)?`);
    const match = message.match(pattern);
    if (match?.[1]) {
      const base = Number(match[1]);
      const unit = match[2];
      const multiplier = unit === "万" ? 10000 : unit === "千" || unit === "k" || unit === "K" ? 1000 : 1;
      return Math.round(base * multiplier);
    }
  }
  return undefined;
}

function inferTags(message: string): string[] {
  const tagMatches = [...message.matchAll(/#([\p{L}\p{N}\u4e00-\u9fa5_-]{2,20})/gu)].map((match) => match[1]);
  const explicit = message.match(/(?:标签|tag|tags)\s*(?:是|为|:|：)?\s*([^，。！？；;\n]+)/i);
  const explicitTags = explicit?.[1]
    ? explicit[1].split(/[、,\s]+/).map((item) => item.replace(/^#/, "").trim()).filter(Boolean)
    : [];
  return [...new Set([...tagMatches, ...explicitTags])].slice(0, 8);
}

function inferTopic(message: string): string | undefined {
  const quoted = message.match(/[「《“"']([^」》”"']+)[」》”"']/);
  if (quoted?.[1]?.trim()) {
    return cleanupTopic(quoted[1]);
  }

  const direct = message.match(/(?:帮我|请)?(?:找|搜索|查找|分析)(?:最近一周|一周内|两周内|两周|今天|一天内|半年内|半年)?\s*([^，。！？!?、\n]+?)(?:高收藏|高赞|爆款|相关|的?笔记|，|。|、|$)/);
  if (direct?.[1]?.trim()) {
    return cleanupTopic(direct[1]);
  }

  const write = message.match(/(?:写|生成|做)(?:一篇|一个)?\s*([^，。！？!?、\n]+?)(?:笔记|文案|帖子|图文|内容|，|。|$)/);
  if (write?.[1]?.trim()) {
    return cleanupTopic(write[1]);
  }

  return undefined;
}

function cleanupTopic(value: string): string {
  return value
    .replace(/最近一周|一周内|两周内|两周|今天|一天内|半年内|相关|小红书|笔记/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function inferSelectedImageIndex(message: string): number | undefined {
  const digit = message.match(/第?\s*(\d+)\s*张/);
  if (digit) return Number(digit[1]);

  const englishDigit = message
    .toLowerCase()
    .match(/\b(?:image|pic|picture)\s*(\d+)(?:st|nd|rd|th)?\b|\b(\d+)(?:st|nd|rd|th)\s*(?:image|pic|picture)\b/);
  if (englishDigit) return Number(englishDigit[1] ?? englishDigit[2]);

  const englishWords: Record<string, number> = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    sixth: 6,
    seventh: 7,
    eighth: 8,
    ninth: 9
  };
  const englishWord = message.toLowerCase().match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth)\b/);
  if (englishWord?.[1]) return englishWords[englishWord[1]];

  const chinese = message.match(/第?\s*([一二三四五六七八九十两])\s*张/);
  if (!chinese?.[1]) return undefined;
  const values: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10
  };
  return values[chinese[1]];
}

function inferScheduleText(message: string): string | undefined {
  const iso = message.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:[zZ]|[+-]\d{2}:\d{2})?/);
  if (iso?.[0]) return iso[0];
  const match = message.match(/(今晚|今天|明天|后天)?\s*([一二三四五六七八九十两\d]+)\s*点(?:\s*半)?/);
  return match?.[0]?.trim();
}
