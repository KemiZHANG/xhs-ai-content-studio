import type { AgentPlan, AgentPlanStep } from "@/lib/agent/types";

export type CreateAgentPlanInput = {
  message: string;
  hasCurrentDraft: boolean;
  attachedAssetCount: number;
};

export function createAgentPlan(input: CreateAgentPlanInput): AgentPlan {
  const message = input.message.trim();
  const lower = message.toLowerCase();

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

  if (isCardGenerationRequest(message, lower) && input.hasCurrentDraft) {
    return buildPlan({
      intent: "generate_cards",
      topic: inferTopic(message),
      steps: [step("generateCards", "Render Xiaohongshu cover and content cards from the current draft.", "image.generateCards")]
    });
  }

  if (isImageGenerationRequest(message, lower)) {
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

  if (isResearchRequest(message, lower)) {
    const wantsDraft = /生成|写|文案|笔记|标题|正文|标签|草稿|图文/.test(message);
    return buildPlan({
      intent: wantsDraft ? "research_to_draft" : "research_only",
      topic: inferTopic(message),
      timeRange: inferTimeRange(message),
      steps: wantsDraft
        ? [
            step("research", "Search and collect Xiaohongshu evidence.", "workflow.searchRank"),
            step("summarizeEvidence", "Summarize evidence into title, body, tag, and image insights.", "workflow.summarizeEvidence"),
            step("generateDraft", "Generate an original draft from summarized evidence.", "workflow.generateDraft")
          ]
        : [
            step("research", "Search and collect Xiaohongshu evidence.", "workflow.searchRank"),
            step("summarizeEvidence", "Summarize evidence for the user.", "workflow.summarizeEvidence")
          ]
    });
  }

  if ((/发布|发出去|发笔记/.test(message) || lower.includes("publish")) && input.hasCurrentDraft) {
    return buildPlan({
      intent: "prepare_publish",
      topic: inferTopic(message),
      steps: [step("preparePublish", "Prepare a guarded publish intent for the current draft.", "publish.prepare")]
    });
  }

  return buildPlan({
    intent: "answer",
    topic: inferTopic(message),
    steps: [step("answer", "Answer directly or delegate to the legacy chat agent.")]
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
  return /搜索|查找|找|分析|高收藏|高赞|爆款|小红书|笔记|竞品/.test(message) || lower.includes("research");
}

function isImageGenerationRequest(message: string, lower: string): boolean {
  return /(?:生成|做|出).*?(?:图片|配图|场景图|产品图|商品图)|图片生成|配图|产品图|商品图|参考图|换.*背景|场景图/.test(message) || lower.includes("image");
}

function isCardGenerationRequest(message: string, lower: string): boolean {
  return /图文卡片|卡片图|干货图|封面卡|正文卡|卡片/.test(message) || lower.includes("card");
}

function isDraftRevisionRequest(message: string, lower: string): boolean {
  return /修改|改|优化|生活化|重写|调整|标题/.test(message) || lower.includes("revise");
}

function isScheduledPublishRequest(message: string, lower: string): boolean {
  return (/发|发布|定时/.test(message) && /今晚|明天|后天|\d+\s*点|[一二三四五六七八九十]\s*点/.test(message)) || lower.includes("schedule");
}

function inferTimeRange(message: string): string | undefined {
  if (/最近一周|一周/.test(message)) return "一周内";
  if (/两周|二周/.test(message)) return "两周内";
  if (/今天|一天/.test(message)) return "一天内";
  if (/半年|六个月/.test(message)) return "半年内";
  return undefined;
}

function inferTopic(message: string): string | undefined {
  const direct = message.match(/(?:找|搜索|查找|分析)(?:最近一周|一周内|两周内|两周|今天|一天内|半年内|半年)?\s*([^，。,.\n]+?)(?:高收藏|高赞|爆款|相关|的|笔记|，|。|,|$)/);
  if (direct?.[1]?.trim()) {
    return cleanupTopic(direct[1]);
  }

  const quoted = message.match(/[「《“"]([^」》”"]+)[」》”"]/);
  if (quoted?.[1]?.trim()) {
    return cleanupTopic(quoted[1]);
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

  const chinese = message.match(/第?\s*([一二三四五六七八九十])\s*张/);
  if (!chinese) return undefined;
  return "一二三四五六七八九十".indexOf(chinese[1]) + 1;
}

function inferScheduleText(message: string): string | undefined {
  const match = message.match(/(今晚|明天|后天)?\s*([一二三四五六七八九十\d]+)\s*点/);
  return match?.[0]?.trim();
}
