import type { AppSettings } from "@/lib/storage/settings";
import type { ModelProvider } from "@/lib/models/provider";
import { createDraftRecord, type DraftRecord } from "@/lib/storage/drafts";
import type { AssetRecord } from "@/lib/storage/assets";
import type { XhsMcpWorkflowClient } from "@/lib/workflows/one-click";
import { runOneClickWorkflow, type GeneratedDraft, type OneClickResult, type PublishMode } from "@/lib/workflows/one-click";
import { buildCopyCreativeBrief } from "@/lib/workflows/creative-briefs";
import { rankFeeds } from "@/lib/workflows/ranking";
import type { WorkflowRun } from "@/lib/storage/history";

export type ChatAgentResult = {
  answer: string;
  workflowResult?: OneClickResult;
  currentDraft?: DraftRecord;
};

export async function runChatAgent({
  message,
  settings,
  mcp,
  model,
  history,
  currentDraft,
  attachedAssets = []
}: {
  message: string;
  settings: AppSettings;
  mcp: XhsMcpWorkflowClient;
  model: ModelProvider;
  history: WorkflowRun[];
  currentDraft?: DraftRecord | null;
  attachedAssets?: AssetRecord[];
}): Promise<ChatAgentResult> {
  const attachmentContext = await buildAttachmentContextWithAnalysis(attachedAssets, model);
  const enrichedMessage = attachmentContext ? `${message}\n\n${attachmentContext}` : message;
  const topic = inferTopic(message);

  if (isPublishCurrentDraftRequest(message)) {
    return publishCurrentDraft({ message, settings, mcp, model, currentDraft });
  }

  if (isDraftRevisionRequest(message)) {
    return reviseCurrentDraft({ message: enrichedMessage, settings, model, currentDraft });
  }

  if (isEvidenceDraftRequest(message)) {
    return createDraftFromLatestResearch({ message: enrichedMessage, settings, model, history });
  }

  if (shouldRunNewWorkflow(message)) {
    const publishMode = inferPublishMode(message);
    const workflowResult = await runOneClickWorkflow({
      input: {
        topic,
        contentType: inferContentType(message),
        timeRange: inferTimeRange(message),
        sampleCount: 8,
        visibility: settings.defaultVisibility,
        workflowGoal: "draft",
        publishMode,
        analyzeImages: true,
        generateImages: publishMode !== "draft",
        scheduleAt: inferScheduleAt(message) ?? undefined,
        requirements: enrichedMessage
      },
      settings,
      mcp,
      model
    });

    return {
      answer: summarizeWorkflow(workflowResult),
      workflowResult
    };
  }

  if (shouldAnalyzeTopic(message)) {
    const searchResult = await mcp.searchFeeds(topic, { timeRange: inferTimeRange(message) });
    const ranked = rankFeedsFromUnknown(searchResult).slice(0, 10);

    if (!settings.textApiKey.trim()) {
      return {
        answer: `我已拿到「${topic}」的候选笔记，但还没有配置文本模型 API Key，所以只能先展示基础排序。\n\n${ranked
          .map((feed, index) => `${index + 1}. ${feed.title}，互动分 ${Math.round(feed.score)}`)
          .join("\n")}`
      };
    }

    const answer = await model.generateStructuredText(
      `用户需求：${enrichedMessage}

搜索主题：${topic}
高互动样本：
${JSON.stringify(ranked, null, 2)}

请用中文输出结构化分析：标题规律、正文结构、标签方向、图片风格、评论需求、可原创生成的方向。`
    );

    return { answer };
  }

  if (message.includes("账号") || message.includes("流量") || message.includes("复盘")) {
    const summary = history.slice(0, 10).map((run) => ({
      time: run.createdAt,
      topic: run.input.topic,
      status: run.result.status,
      title: run.result.draft?.title,
      sampleCount: run.result.samples.length
    }));

    if (!settings.textApiKey.trim()) {
      return {
        answer: `我可以基于历史发布记录做复盘，但还没有配置文本模型 API Key。目前已有 ${history.length} 条本地工作流记录。`
      };
    }

    const answer = await model.generateStructuredText(
      `用户想分析账号近期内容表现。当前只能使用本地工作流历史和公开互动样本，不包含小红书创作者后台曝光量。

本地历史：
${JSON.stringify(summary, null, 2)}

请输出：近期主题分布、可观察问题、下一步选题建议、需要补充的数据。`
    );

    return { answer };
  }

  if (!settings.textApiKey.trim()) {
    return {
      answer:
        "我可以在这里做自然语言分析、选题、生成和发布，但需要先在设置页配置文本模型 API Key。MCP 小红书连接可以单独在控制台检测。"
    };
  }

  const answer = await model.generateStructuredText(
    enrichedMessage,
    "你是网页里的小红书运营助手。回答要具体、可执行，优先说明能调用哪些工作流。"
  );

  return { answer };
}

export function buildAttachmentContext(assets: AssetRecord[]): string {
  if (!assets.length) {
    return "";
  }

  return `用户附带的产品图/参考图：
${assets
  .map(
    (asset, index) =>
      `${index + 1}. ${asset.name}（${asset.kind === "generated" ? "生成图" : "产品图/参考图"}，路径：${asset.absolutePath}）`
  )
  .join("\n")}

请结合这些图片理解产品主体、包装、色彩、材质、使用场景和参考风格。生成文案时不要虚构图片里没有的认证、品牌文字或功效；生成图片提示词时要说明如何保留产品主体或学习参考图风格。`;
}

async function buildAttachmentContextWithAnalysis(assets: AssetRecord[], model: ModelProvider): Promise<string> {
  const baseContext = buildAttachmentContext(assets);
  if (!baseContext || !model.analyzeLocalImages) {
    return baseContext;
  }

  try {
    const analysis = await model.analyzeLocalImages(
      "请分析这些用户上传的产品图/参考图：产品主体、包装轮廓、颜色材质、可用于小红书的画面风格、适合生成什么场景图。不要虚构看不清的品牌文字或认证。",
      assets.map((asset) => asset.absolutePath)
    );
    return `${baseContext}\n\n图片初步分析：\n${analysis}`;
  } catch {
    return baseContext;
  }
}

async function createDraftFromLatestResearch({
  message,
  settings,
  model,
  history
}: {
  message: string;
  settings: AppSettings;
  model: ModelProvider;
  history: WorkflowRun[];
}): Promise<ChatAgentResult> {
  const latestResearch = history.find((run) => run.result.evidence?.length || run.result.researchSummary);
  if (!latestResearch) {
    return {
      answer: "我还没有可复用的证据研究记录。请先让我搜索并分析一批真实小红书笔记。"
    };
  }

  if (!settings.textApiKey.trim()) {
    return {
      answer: "基于证据生成草稿需要文本模型 API Key，请先在模型设置页配置。"
    };
  }

  const fallback: GeneratedDraft = {
    title: latestResearch.input.topic.slice(0, 20) || "小红书原创笔记",
    content: "请补充你的产品、店铺或具体创作方向，我会基于刚才的证据继续写。",
    tags: [latestResearch.input.topic.replace(/\s+/g, "") || "小红书"],
    structure: ["证据观察", "用户需求", "原创表达"],
    imagePrompt: "真实小红书风格图片，自然光，生活化场景，不复制参考图"
  };

  const copyBrief = buildCopyCreativeBrief(latestResearch.result, message);

  const raw = await model.generateStructuredText(
    `请基于最近一次小红书证据研究的精简文案简报生成新的原创草稿，不要重新搜索，不要复制样本原文。

${copyBrief}

研究主题：${latestResearch.input.topic}
内容类型：${latestResearch.input.contentType}

请只返回 JSON：
{
  "title": "20字以内标题",
  "content": "原创小红书正文，不包含#标签",
  "tags": ["标签1"],
  "structure": ["开头", "正文", "结尾"],
  "imagePrompt": "用于生成新图的提示词；如果是产品图场景替换，要强调保留产品主体，不复制样本图"
}`
  );
  const draft = parseDraftUpdate(raw, fallback);
  const draftRecord = createDraftRecord({
    draft,
    images: [],
    visibility: latestResearch.input.visibility || settings.defaultVisibility,
    input: {
      ...latestResearch.input,
      workflowGoal: "draft",
      requirements: message
    },
    runId: latestResearch.id
  });

  return {
    answer: `已基于最近一次证据研究生成草稿。\n标题：${draft.title}\n\n${draft.content}\n\n标签：${draft.tags.map((tag) => `#${tag}`).join(" ")}`,
    currentDraft: draftRecord
  };
}

async function publishCurrentDraft({
  message,
  settings,
  mcp,
  model,
  currentDraft
}: {
  message: string;
  settings: AppSettings;
  mcp: XhsMcpWorkflowClient;
  model: ModelProvider;
  currentDraft?: DraftRecord | null;
}): Promise<ChatAgentResult> {
  if (!currentDraft) {
    return {
      answer: "当前没有可发布的草稿。你可以先让我生成一篇笔记，或者去一键发帖页运行草稿/素材模式。"
    };
  }

  let nextDraftRecord = currentDraft;
  let images = nextDraftRecord.images.flatMap((image) => [image.path, image.url].filter(Boolean) as string[]);
  if (!images.length) {
    if (!settings.imageApiKey.trim()) {
      return {
        answer: "当前草稿还没有可发布图片。请先配置图片模型 API Key，或在一键发帖页选择“生成素材/立即发布”模式。"
      };
    }

    const generatedImage = await model.generateImage(nextDraftRecord.draft.imagePrompt);
    if (!generatedImage) {
      return {
        answer: "我尝试为当前草稿生成图片，但图片模型没有返回可发布图片。"
      };
    }

    nextDraftRecord = {
      ...nextDraftRecord,
      updatedAt: new Date().toISOString(),
      images: [generatedImage]
    };
    images = nextDraftRecord.images.flatMap((image) => [image.path, image.url].filter(Boolean) as string[]);
  }

  const scheduleAt = inferScheduleAt(message);
  const wantsSchedule = isScheduleRequest(message);

  if (wantsSchedule && !scheduleAt) {
    return {
      answer: "我可以定时发布当前草稿，但需要一个明确时间，例如：今晚 8 点发布，或 2026-05-19T20:00:00+08:00。"
    };
  }

  const publishResult = await mcp.publishContent({
    title: nextDraftRecord.draft.title,
    content: nextDraftRecord.draft.content,
    tags: nextDraftRecord.draft.tags,
    images,
    visibility: nextDraftRecord.visibility || settings.defaultVisibility,
    scheduleAt: scheduleAt ?? undefined
  });

  return {
    answer: scheduleAt
      ? `已提交定时发布：${scheduleAt}\n标题：${nextDraftRecord.draft.title}`
      : `已发布当前草稿。\n标题：${nextDraftRecord.draft.title}\n返回：${JSON.stringify(publishResult)}`,
    currentDraft: nextDraftRecord
  };
}

async function reviseCurrentDraft({
  message,
  settings,
  model,
  currentDraft
}: {
  message: string;
  settings: AppSettings;
  model: ModelProvider;
  currentDraft?: DraftRecord | null;
}): Promise<ChatAgentResult> {
  if (!currentDraft) {
    return {
      answer: "当前没有可修改的草稿。你可以先让我生成一篇笔记。"
    };
  }

  if (!settings.textApiKey.trim()) {
    return {
      answer: "修改草稿需要文本模型 API Key，请先在设置页配置。"
    };
  }

  const raw = await model.generateStructuredText(
    `请根据用户要求修改当前小红书草稿。保留原创，不复制竞品内容。

用户要求：${message}

当前草稿：
${JSON.stringify(currentDraft.draft, null, 2)}

请只返回 JSON：
{
  "title": "20字以内标题",
  "content": "正文，不包含#标签",
  "tags": ["标签1"],
  "structure": ["结构1"],
  "imagePrompt": "图片提示词"
}`
  );
  const nextDraft = parseDraftUpdate(raw, currentDraft.draft);
  const updatedDraft: DraftRecord = {
    ...currentDraft,
    updatedAt: new Date().toISOString(),
    draft: nextDraft
  };

  return {
    answer: `已更新当前草稿。\n标题：${nextDraft.title}\n\n${nextDraft.content}`,
    currentDraft: updatedDraft
  };
}

function isPublishCurrentDraftRequest(message: string): boolean {
  const asksPublish = /发布|发出去|定时/.test(message);
  const asksCreate = /生成|写|搜索|分析|围绕|主题|一篇|选题/.test(message);
  return asksPublish && !asksCreate;
}

function isDraftRevisionRequest(message: string): boolean {
  return /修改|调整|优化|改|换|润色/.test(message);
}

function isEvidenceDraftRequest(message: string): boolean {
  return /已展示证据|当前证据|刚才.*证据|最近一次.*证据|不要重新搜索|基于.*证据/.test(message) && /生成|写|草稿|笔记|正文/.test(message);
}

function shouldRunNewWorkflow(message: string): boolean {
  return /一键|发一篇|生成.*发布|写.*发布|围绕.*发布|主题.*发布|生成.*笔记|写.*笔记/.test(message);
}

function shouldAnalyzeTopic(message: string): boolean {
  return /分析|搜索|找|看看|竞品|爆款|高收藏|高点赞/.test(message);
}

function inferPublishMode(message: string): PublishMode {
  if (isScheduleRequest(message)) return "schedule";
  if (/发布|发出去|发一篇/.test(message)) return "publish";
  if (/图片|素材/.test(message)) return "material";
  return "draft";
}

function isScheduleRequest(message: string): boolean {
  return /定时|今晚|明天|\d{4}-\d{2}-\d{2}T/.test(message);
}

function inferScheduleAt(message: string): string | null {
  const iso = message.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\+\d{2}:\d{2})?/);
  if (iso?.[0]) {
    return iso[0].includes("+") ? iso[0] : `${iso[0]}+08:00`;
  }

  const tonight = message.match(/(?:今晚|今天).*?(\d{1,2})\s*点/);
  if (tonight?.[1]) {
    return localIsoAtHour(Number(tonight[1]), 0);
  }

  const tomorrow = message.match(/明天.*?(\d{1,2})\s*点/);
  if (tomorrow?.[1]) {
    return localIsoAtHour(Number(tomorrow[1]), 1);
  }

  return null;
}

function localIsoAtHour(hour: number, dayOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, 0, 0, 0);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  return `${year}-${month}-${day}T${hh}:00:00+08:00`;
}

function inferTopic(message: string): string {
  const quoted = message.match(/[「“"](.*?)[」”"]/);
  if (quoted?.[1]) {
    return quoted[1].trim();
  }

  const about = message.match(/(?:关于|主题是|围绕|分析)([^，。,.!?！？]{2,30})/);
  if (about?.[1]) {
    return about[1].replace(/的笔记|的内容|高收藏|高点赞/g, "").trim();
  }

  return message.replace(/帮我|请|分析|搜索|发布|小红书|笔记/g, "").trim().slice(0, 30) || "小红书选题";
}

function inferContentType(message: string): string {
  if (message.includes("探店")) return "探店";
  if (message.includes("种草")) return "种草";
  if (message.includes("穿搭")) return "穿搭";
  if (message.includes("干货")) return "干货";
  if (message.includes("视频")) return "视频";
  return "图文";
}

function inferTimeRange(message: string): string {
  if (message.includes("一天") || message.includes("24小时")) return "一天内";
  if (message.includes("两周") || message.includes("2周")) return "两周内";
  if (message.includes("半年")) return "半年内";
  if (message.includes("一周") || message.includes("最近")) return "一周内";
  return "一周内";
}

function summarizeWorkflow(result: OneClickResult): string {
  const title = result.draft?.title ? `\n生成标题：${result.draft.title}` : "";
  return `工作流状态：${result.status}${title}\n\n${result.steps
    .map((step) => `- ${step.label}：${step.detail}`)
    .join("\n")}`;
}

function parseDraftUpdate(raw: string, fallback: GeneratedDraft): GeneratedDraft {
  try {
    const text = raw.trim().startsWith("{")
      ? raw.trim()
      : raw.trim().match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim();
    if (!text) return fallback;
    const parsed = JSON.parse(text) as Partial<GeneratedDraft>;
    return {
      ...fallback,
      ...parsed,
      tags: Array.isArray(parsed.tags) ? parsed.tags : fallback.tags,
      structure: Array.isArray(parsed.structure) ? parsed.structure : fallback.structure
    };
  } catch {
    return fallback;
  }
}

function rankFeedsFromUnknown(value: unknown) {
  const text = extractText(value);
  const parsed = parseMaybeJson(text) ?? value;
  const list = findArray(parsed);

  return rankFeeds(
    list.map((item, index) => {
      const record = isRecord(item) ? item : {};
      return {
        id: String(record.feed_id ?? record.feedId ?? record.id ?? `feed-${index}`),
        title: String(record.title ?? record.desc ?? record.content ?? "未命名笔记").slice(0, 80),
        likes: Number(record.likes ?? record.like_count ?? record.liked_count ?? 0),
        collects: Number(record.collects ?? record.collect_count ?? record.collected_count ?? 0),
        comments: Number(record.comments ?? record.comment_count ?? 0),
        xsecToken: String(record.xsec_token ?? record.xsecToken ?? ""),
        raw: item
      };
    })
  );
}

function extractText(value: unknown): string {
  if (typeof value === "string") return value;
  if (isRecord(value) && Array.isArray(value.content)) {
    return value.content
      .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
      .join("\n");
  }
  return "";
}

function parseMaybeJson(text: string): unknown | null {
  try {
    return text.trim() ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function findArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  for (const key of ["feeds", "items", "data", "notes", "list", "results"]) {
    const child = value[key];
    if (Array.isArray(child)) return child;
    const nested = findArray(child);
    if (nested.length) return nested;
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
