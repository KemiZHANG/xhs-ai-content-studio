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
};

export function createAgentPlan(input: CreateAgentPlanInput): AgentPlan {
  const message = input.message.trim();
  const lower = message.toLowerCase();
  const stage = input.postStage ?? "empty";

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

  if (isImageGenerationRequest(message, lower)) {
    if ((/方向|提示词|prompt/i.test(message) || input.allowedActions?.includes("plan_visuals")) && !/出图|生图|生成.*(?:配图|场景图|产品图)/.test(message)) {
      return buildPlan({
        intent: "answer",
        topic: inferTopic(message),
        steps: [step("answer", "Plan visual direction and image prompts from the current CreativeBrief.")]
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

  if (isDraftCreationFromProjectRequest(message, lower) && (input.hasEvidence || input.hasCreativeBrief)) {
    return buildPlan({
      intent: "answer",
      topic: inferTopic(message),
      steps: [step("generateDraft", "Generate copy from the current PostProject evidence and CreativeBrief.", "draft.createFromEvidence")]
    });
  }

  if (isResearchRequest(message, lower)) {
    const wantsDraft = /生成|写|文案|笔记|标题|正文|标签|草稿|图文/.test(message);
    return buildPlan({
      intent: wantsDraft ? "research_to_draft" : "research_only",
      topic: inferTopic(message),
      timeRange: inferTimeRange(message),
      steps: wantsDraft
        ? [
            step("research", "Search and collect Xiaohongshu evidence.", "workflow.searchRank"),
            step("retrieveViralKnowledge", "Retrieve reusable patterns from the viral knowledge base.", "knowledge.retrieveViralPatterns"),
            step("summarizeEvidence", "Summarize evidence into title, body, tag, and image insights.", "workflow.summarizeEvidence"),
            step("generateDraft", "Generate an original draft from summarized evidence.", "workflow.generateDraft")
          ]
        : [
            step("research", "Search and collect Xiaohongshu evidence.", "workflow.searchRank"),
            step("retrieveViralKnowledge", "Retrieve reusable patterns from the viral knowledge base.", "knowledge.retrieveViralPatterns"),
            step("summarizeEvidence", "Summarize evidence for the user.", "workflow.summarizeEvidence")
          ]
    });
  }

  if ((/发布|发出去|发笔记|发送/.test(message) || lower.includes("publish")) && input.hasCurrentDraft) {
    return buildPlan({
      intent: "prepare_publish",
      topic: inferTopic(message),
      steps: [step("preparePublish", "Prepare a guarded publish intent for the current draft.", "publish.prepare")]
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

function buildPlan(input: Omit<AgentPlan, "id">): AgentPlan {
  return {
    id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...input
  };
}

function step(action: AgentPlanStep["action"], reason: string, toolName?: string): AgentPlanStep {
  return toolName ? { action, reason, toolName } : { action, reason };
}

function isResearchRequest(message: string, lower: string): boolean {
  return /搜索|查找|找|分析|高收藏|高赞|爆款|小红书|笔记|竞品|研究/.test(message) || lower.includes("research");
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

function isDraftRevisionRequest(message: string, lower: string): boolean {
  return /修改|改得|优化|生活化|重写|调整|标题|正文|标签/.test(message) || lower.includes("revise");
}

function isDraftCreationFromProjectRequest(message: string, lower: string): boolean {
  return /基于当前|基于证据|根据证据|生成文案|生成草稿|写一篇|写成笔记|出一版/.test(message) || lower.includes("draft");
}

function isScheduledPublishRequest(message: string, lower: string): boolean {
  return (/发布|发|定时/.test(message) && /今晚|今天|明天|后天|\d+\s*点|[一二三四五六七八九十两]\s*点/.test(message)) || lower.includes("schedule");
}

function inferTimeRange(message: string): string | undefined {
  if (/最近一周|一周内|一周/.test(message)) return "一周内";
  if (/两周|二周/.test(message)) return "两周内";
  if (/今天|一天|一天内/.test(message)) return "一天内";
  if (/半年|六个月/.test(message)) return "半年内";
  return undefined;
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
