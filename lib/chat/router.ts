import type { PublishMode, WorkflowGoal } from "@/lib/workflows/one-click";

export type ChatRouteDecision =
  | { kind: "direct" }
  | {
      kind: "queue-workflow";
      topic: string;
      contentType: string;
      timeRange: string;
      sampleCount: number;
      workflowGoal: WorkflowGoal;
      publishMode: PublishMode;
      analyzeImages: boolean;
      generateImages: boolean;
      scheduleAt?: string;
    };

export function classifyChatRequest(message: string, hasCurrentDraft: boolean): ChatRouteDecision {
  const normalized = message.trim();
  if (!normalized) {
    return { kind: "direct" };
  }

  if (shouldPublishCurrentDraft(normalized, hasCurrentDraft)) {
    return { kind: "direct" };
  }

  if (!shouldQueueWorkflow(normalized)) {
    return { kind: "direct" };
  }

  const publishMode = inferChatPublishMode(normalized);
  const workflowGoal = inferWorkflowGoal(normalized, publishMode);

  return {
    kind: "queue-workflow",
    topic: inferChatTopic(normalized),
    contentType: inferChatContentType(normalized),
    timeRange: inferChatTimeRange(normalized),
    sampleCount: inferSampleCount(normalized),
    workflowGoal,
    publishMode,
    analyzeImages: !/不分析图片|不用分析图片|只分析文字/.test(normalized),
    generateImages: inferGenerateImages(normalized, publishMode),
    scheduleAt: inferChatScheduleAt(normalized) ?? undefined
  };
}

function inferWorkflowGoal(message: string, publishMode: PublishMode): WorkflowGoal {
  const asksForResearch = /分析|搜索|找|看看|竞品|爆款|高收藏|高点赞|高互动|流量好|近期流量|账号流量/.test(message);
  const asksForDraft = /生成|写|发一篇|发布|一键|草稿|正文|标题|标签|定时/.test(message);

  if (publishMode === "publish" || publishMode === "schedule" || publishMode === "material") {
    return "draft";
  }

  return asksForResearch && !asksForDraft ? "research" : "draft";
}

function shouldPublishCurrentDraft(message: string, hasCurrentDraft: boolean): boolean {
  if (!hasCurrentDraft) {
    return false;
  }

  return (
    /发布|定时|发出去|发掉|提交/.test(message) &&
    !/一键|发一篇|写.*笔记|生成.*笔记|搜索|搜|找|分析|高收藏|高点赞|爆款|竞品/.test(message)
  );
}

function shouldQueueWorkflow(message: string): boolean {
  return (
    /一键|发一篇|生成.*笔记|写.*笔记|生成.*发布|写.*发布|小红书.*发布|发小红书/.test(message) ||
    /分析|搜索|搜|找|挖|复盘|竞品|爆款|高收藏|高点赞|高互动|流量好|近期流量|账号流量/.test(message)
  );
}

function inferChatTopic(message: string): string {
  const quoted = message.match(/[「“"']([^」”"']{2,60})[」”"']/);
  if (quoted?.[1]) {
    return quoted[1].trim();
  }

  const publishTopic = message.match(/(?:发一篇|写一篇|生成一篇)([^，。！？!?、]{2,40}?)(?:笔记|内容|帖子|并|然后|发布|$)/);
  if (publishTopic?.[1]) {
    return cleanTopic(publishTopic[1]);
  }

  const explicitTopic = message.match(/(?:关于|围绕|主题是|主题为)([^，。！？!?、]{2,40})/);
  if (explicitTopic?.[1]) {
    return cleanTopic(explicitTopic[1]);
  }

  const analysisTopic = message.match(
    /(?:分析|搜索|搜|找|复盘)(?:最近)?(?:一天|一周|两周|半个月|半年|[0-9]+天|[0-9]+周|[0-9]+个月)?([^，。！？!?、]{2,40}?)(?:的)?(?:高收藏|高点赞|高互动|爆款|笔记|帖子|内容|选题)/
  );
  if (analysisTopic?.[1]) {
    return cleanTopic(analysisTopic[1]);
  }

  return (
    cleanTopic(
      message.replace(/帮我|请|小红书|笔记|内容|帖子|发布|生成|写|分析|搜索|搜|找|一键|高收藏|高点赞|爆款/g, "")
    ).slice(0, 30) || "小红书选题"
  );
}

function cleanTopic(value: string): string {
  return value
    .replace(/最近|一天|一周|两周|半个月|半年|[0-9]+天|[0-9]+周|[0-9]+个月/g, "")
    .replace(/的$/, "")
    .trim();
}

function inferChatContentType(message: string): string {
  if (message.includes("探店")) return "探店";
  if (message.includes("种草")) return "种草";
  if (message.includes("穿搭")) return "穿搭";
  if (message.includes("干货")) return "干货";
  if (message.includes("视频")) return "视频";
  if (/产品|宣传|场景图/.test(message)) return "产品种草";
  return "图文";
}

function inferChatTimeRange(message: string): string {
  if (/一天|今日|今天|24小时/.test(message)) return "一天内";
  if (/两周|2周|14天|半个月/.test(message)) return "两周内";
  if (/半年|6个月|六个月/.test(message)) return "半年内";
  return "一周内";
}

function inferSampleCount(message: string): number {
  const sample = message.match(/(?:样本|笔记|帖子)[^\d]{0,4}(\d{1,2})/);
  const count = sample?.[1] ? Number(sample[1]) : 8;
  return Math.min(20, Math.max(3, Number.isFinite(count) ? count : 8));
}

function inferChatPublishMode(message: string): PublishMode {
  if (/定时|今晚|明天|\d{4}-\d{2}-\d{2}T/.test(message)) return "schedule";
  if (/草稿|只生成文案|不要发布|不发布/.test(message)) return "draft";
  if (/发布|发出去|发到我的账号|自动发送|一键发|发一篇/.test(message)) return "publish";
  if (/生成图片|配图|素材|产品图|场景图/.test(message)) return "material";
  return "draft";
}

function inferGenerateImages(message: string, mode: PublishMode): boolean {
  if (/不生成图片|不要图片|不用图片|只生成文案|草稿/.test(message)) {
    return false;
  }

  if (/生成图片|配图|素材|产品图|场景图/.test(message)) {
    return true;
  }

  return mode === "material" || mode === "publish" || mode === "schedule";
}

function inferChatScheduleAt(message: string): string | null {
  const iso = message.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\+\d{2}:\d{2})?/);
  if (iso?.[0]) {
    return iso[0].includes("+") ? iso[0] : `${iso[0]}+08:00`;
  }

  return null;
}
