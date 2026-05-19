import type { AppSettings } from "@/lib/storage/settings";
import { buildReferenceImagePrompt, type GeneratedImage, type ModelProvider } from "@/lib/models/provider";
import { getAsset } from "@/lib/storage/assets";
import type { AssetRecord } from "@/lib/storage/assets";
import { cacheEvidenceImages } from "@/lib/storage/evidence-images";
import { rankFeeds, toNumber, type RankedFeed } from "@/lib/workflows/ranking";

export type PublishMode = "draft" | "material" | "publish" | "schedule";
export type WorkflowImageSource = "ai" | "product" | "asset";
export type WorkflowGoal = "research" | "draft";

export type OneClickInput = {
  topic: string;
  contentType: string;
  timeRange: string;
  sampleCount: number;
  visibility: AppSettings["defaultVisibility"];
  autoPublish?: boolean;
  publishMode?: PublishMode;
  workflowGoal?: WorkflowGoal;
  analyzeImages?: boolean;
  generateImages?: boolean;
  scheduleAt?: string;
  requirements?: string;
  imageSource?: WorkflowImageSource;
  assetIds?: string[];
  productName?: string;
  sellingPoints?: string;
  scene?: string;
  style?: string;
  extraImagePrompt?: string;
};

export type WorkflowStep = {
  id: string;
  label: string;
  status: "done" | "skipped" | "failed";
  detail: string;
};

export type GeneratedDraft = {
  title: string;
  content: string;
  tags: string[];
  structure: string[];
  imagePrompt: string;
};

export type SampleEvidence = {
  id: string;
  title: string;
  author: string;
  likes: number;
  collects: number;
  comments: number;
  shares: number;
  score: number;
  url: string;
  imageUrls: string[];
  cachedImageUrls: string[];
  detailText: string;
  commentSnippets: string[];
  reasonHighlights: string[];
  raw?: unknown;
};

export type ResearchSummary = {
  contentStrengths: string[];
  imageStrengths: string[];
  learningsForContent: string[];
  learningsForImages: string[];
  nextQuestions: string[];
};

export type OneClickResult = {
  status: "needs_settings" | "research_ready" | "draft_ready" | "material_ready" | "published" | "scheduled" | "failed";
  steps: WorkflowStep[];
  samples: RankedFeed[];
  evidence: SampleEvidence[];
  researchSummary: ResearchSummary | null;
  report: string;
  imageStyleReport: string;
  draft: GeneratedDraft | null;
  images: GeneratedImage[];
  publishResult: unknown;
};

export type XhsMcpWorkflowClient = {
  searchFeeds(keyword: string, options: { timeRange: string }): Promise<unknown>;
  getFeedDetail(feed: RankedFeed): Promise<unknown>;
  publishContent(args: {
    title: string;
    content: string;
    tags: string[];
    images: string[];
    visibility: AppSettings["defaultVisibility"];
    scheduleAt?: string;
  }): Promise<unknown>;
};

export async function runOneClickWorkflow({
  input,
  settings,
  mcp,
  model
}: {
  input: OneClickInput;
  settings: AppSettings;
  mcp: XhsMcpWorkflowClient;
  model: ModelProvider;
}): Promise<OneClickResult> {
  const steps: WorkflowStep[] = [];
  const mode = resolvePublishMode(input);
  const workflowGoal = resolveWorkflowGoal(input);
  const samples = await searchAndRank(input, mcp, steps);

  if (!settings.textApiKey.trim()) {
    steps.push({
      id: "model-settings",
      label: "模型配置",
      status: "skipped",
      detail: "还没有配置文本模型 API Key，已停止在生成前。"
    });

    return {
      status: "needs_settings",
      steps,
      samples,
      evidence: buildSampleEvidence(samples, []),
      researchSummary: null,
      report: "请先在设置页配置文本模型 API Key，然后再运行选题分析和内容生成。",
      imageStyleReport: "",
      draft: null,
      images: [],
      publishResult: { skipped: true }
    };
  }

  try {
    const details = await loadDetails(samples.slice(0, input.sampleCount), mcp, steps);
    const evidence = await maybeCacheEvidenceImages(buildSampleEvidence(samples, details), steps);
    const imageStyleReport = await maybeAnalyzeImages(input, samples, details, model, steps);
    const research = await generateResearchSummary(input, evidence, imageStyleReport, model, steps);

    if (workflowGoal === "research") {
      steps.push({
        id: "creative-brief",
        label: "等待创作需求",
        status: "skipped",
        detail: "已完成证据研究，暂不直接生成草稿。请补充产品、店铺、卖点或探店方向后再进入 AI 对话创作。"
      });

      return {
        status: "research_ready",
        steps,
        samples,
        evidence,
        researchSummary: research.summary,
        report: research.report,
        imageStyleReport,
        draft: null,
        images: [],
        publishResult: { skipped: true, reason: "research mode" }
      };
    }

    const rawGeneration = await model.generateStructuredText(
      buildGenerationPrompt(input, evidence, imageStyleReport, research.summary)
    );
    const parsed = parseGeneration(rawGeneration, input.topic);

    steps.push({
      id: "generate-draft",
      label: "生成原创笔记",
      status: "done",
      detail: `已生成标题、正文、标签和图片提示词：${parsed.draft.title}`
    });

    const shouldGenerateImages = shouldGenerateImageAssets(input, mode);
    const images = shouldGenerateImages
      ? await generateImageAssets(settings, model, parsed.draft.imagePrompt, steps, input)
      : skipImageGeneration(steps);

    const publishDecision = await maybePublish({
      input,
      mode,
      mcp,
      draft: parsed.draft,
      images,
      steps
    });

    return {
      status: publishDecision.status,
      steps,
      samples,
      evidence,
      researchSummary: research.summary,
      report: parsed.report || research.report,
      imageStyleReport,
      draft: parsed.draft,
      images,
      publishResult: publishDecision.publishResult
    };
  } catch (error) {
    steps.push({
      id: "workflow-error",
      label: "流程错误",
      status: "failed",
      detail: error instanceof Error ? error.message : "未知错误"
    });

    return {
      status: "failed",
      steps,
      samples,
      evidence: buildSampleEvidence(samples, []),
      researchSummary: null,
      report: "流程执行失败，请查看错误详情。",
      imageStyleReport: "",
      draft: null,
      images: [],
      publishResult: { skipped: true }
    };
  }
}

function resolvePublishMode(input: OneClickInput): PublishMode {
  if (input.publishMode) {
    return input.publishMode;
  }

  return input.autoPublish ? "publish" : "draft";
}

function resolveWorkflowGoal(input: OneClickInput): WorkflowGoal {
  return input.workflowGoal === "research" ? "research" : "draft";
}

function shouldGenerateImageAssets(input: OneClickInput, mode: PublishMode): boolean {
  if (mode === "draft") {
    return Boolean(input.generateImages);
  }

  if (input.generateImages === undefined) {
    return mode === "material" || mode === "publish" || mode === "schedule";
  }

  return input.generateImages;
}

async function searchAndRank(
  input: OneClickInput,
  mcp: XhsMcpWorkflowClient,
  steps: WorkflowStep[]
): Promise<RankedFeed[]> {
  const searchResult = await mcp.searchFeeds(input.topic, { timeRange: input.timeRange });
  const feeds = normalizeFeeds(searchResult);
  const ranked = rankFeeds(feeds).slice(0, Math.max(1, input.sampleCount));

  steps.push({
    id: "search",
    label: "搜索样本",
    status: "done",
    detail: `找到 ${feeds.length} 条候选笔记，选取 ${ranked.length} 条高互动样本。`
  });

  return ranked;
}

async function loadDetails(
  feeds: RankedFeed[],
  mcp: XhsMcpWorkflowClient,
  steps: WorkflowStep[]
): Promise<unknown[]> {
  const details: unknown[] = [];

  for (const feed of feeds) {
    try {
      details.push(await mcp.getFeedDetail(feed));
    } catch {
      details.push(null);
    }
  }

  steps.push({
    id: "details",
    label: "拉取详情",
    status: "done",
    detail: `已尝试拉取 ${feeds.length} 条笔记详情，用于分析标题、正文、标签、评论和图片。`
  });

  return details;
}

async function maybeAnalyzeImages(
  input: OneClickInput,
  samples: RankedFeed[],
  details: unknown[],
  model: ModelProvider,
  steps: WorkflowStep[]
): Promise<string> {
  if (!input.analyzeImages) {
    steps.push({
      id: "image-style",
      label: "竞品图片分析",
      status: "skipped",
      detail: "未开启竞品图片分析。"
    });
    return "";
  }

  const imageUrls = collectImageUrls(samples, details).slice(0, 8);
  if (!imageUrls.length) {
    steps.push({
      id: "image-style",
      label: "竞品图片分析",
      status: "skipped",
      detail: "没有从样本中提取到可分析的图片链接。"
    });
    return "";
  }

  try {
    const report = await model.analyzeImageStyle(
      `请分析这些小红书样本图片的可复用视觉规律。只总结风格，不复制图片。主题：${input.topic}`,
      imageUrls
    );

    steps.push({
      id: "image-style",
      label: "竞品图片分析",
      status: "done",
      detail: `已分析 ${imageUrls.length} 张样本图，生成视觉风格报告。`
    });

    return report;
  } catch (error) {
    steps.push({
      id: "image-style",
      label: "竞品图片分析",
      status: "skipped",
      detail: `图片风格分析失败，已保留笔记正文、互动和图片证据继续研究。原因：${error instanceof Error ? error.message : "未知错误"}`
    });
    return "";
  }
}

async function generateResearchSummary(
  input: OneClickInput,
  evidence: SampleEvidence[],
  imageStyleReport: string,
  model: ModelProvider,
  steps: WorkflowStep[]
): Promise<{ report: string; summary: ResearchSummary }> {
  const raw = await model.generateStructuredText(buildResearchPrompt(input, evidence, imageStyleReport));
  const parsed = parseResearch(raw, evidence);

  steps.push({
    id: "research-summary",
    label: "证据研究总结",
    status: "done",
    detail: `已总结 ${evidence.length} 条真实笔记的内容优点、图片优点和下一步创作问题。`
  });

  return parsed;
}

function skipImageGeneration(steps: WorkflowStep[]): GeneratedImage[] {
  steps.push({
    id: "image-generate",
    label: "图片生成",
    status: "skipped",
    detail: "当前模式未开启生成新图片，已保留图片提示词。"
  });

  return [];
}

async function maybeCacheEvidenceImages(evidence: SampleEvidence[], steps: WorkflowStep[]): Promise<SampleEvidence[]> {
  if (!evidence.some((item) => item.imageUrls.length)) {
    steps.push({
      id: "evidence-image-cache",
      label: "缓存样本图片",
      status: "skipped",
      detail: "没有可缓存的样本图片。"
    });
    return evidence;
  }

  try {
    const cached = await cacheEvidenceImages(evidence);
    const cachedCount = cached.reduce((count, item) => count + item.cachedImageUrls.length, 0);
    steps.push({
      id: "evidence-image-cache",
      label: "缓存样本图片",
      status: cachedCount ? "done" : "skipped",
      detail: cachedCount ? `已本地缓存 ${cachedCount} 张样本图。` : "未能缓存样本图，结果页会继续使用远程图片链接。"
    });
    return cached;
  } catch {
    steps.push({
      id: "evidence-image-cache",
      label: "缓存样本图片",
      status: "skipped",
      detail: "样本图缓存失败，已自动降级为远程图片展示。"
    });
    return evidence;
  }
}

async function generateImageAssets(
  settings: AppSettings,
  model: ModelProvider,
  imagePrompt: string,
  steps: WorkflowStep[],
  input: OneClickInput
): Promise<GeneratedImage[]> {
  if (input.imageSource === "asset") {
    const assets = await resolveAssets(input.assetIds ?? []);
    steps.push({
      id: "image-existing-assets",
      label: "使用已有素材",
      status: assets.length ? "done" : "skipped",
      detail: assets.length ? `已选择 ${assets.length} 张已有素材。` : "没有选择已有素材。"
    });
    return assets.map((asset) => ({ path: asset.absolutePath }));
  }

  if (!settings.imageApiKey.trim()) {
    steps.push({
      id: "image-settings",
      label: "图片生成",
      status: "skipped",
      detail: "还没有配置图片模型 API Key，已保留图片提示词。"
    });

    return [];
  }

  const sourceAssets = await resolveAssets(input.assetIds ?? []);
  const image =
    input.imageSource === "product" && sourceAssets.length
      ? await model.generateImageFromReference(
          buildReferenceImagePrompt({
            productName: input.productName || input.topic,
            sellingPoints: input.sellingPoints || "结合笔记主题突出产品卖点",
            scene: input.scene || "真实生活使用场景",
            style: input.style || "小红书真实种草风",
            extraPrompt: input.extraImagePrompt || imagePrompt
          }),
          sourceAssets.map((asset) => asset.absolutePath)
        )
      : await model.generateImage(imagePrompt);
  const images = image ? [image] : [];

  steps.push({
    id: "image-generate",
    label: "图片生成",
    status: image ? "done" : "skipped",
    detail: image ? "已生成新的原创配图。" : "图片模型没有返回图片。"
  });

  return images;
}

async function resolveAssets(assetIds: string[]) {
  return (await Promise.all(assetIds.map((id) => getAsset(id)))).filter(
    (asset): asset is AssetRecord => Boolean(asset)
  );
}

async function maybePublish({
  input,
  mode,
  mcp,
  draft,
  images,
  steps
}: {
  input: OneClickInput;
  mode: PublishMode;
  mcp: XhsMcpWorkflowClient;
  draft: GeneratedDraft;
  images: GeneratedImage[];
  steps: WorkflowStep[];
}): Promise<{ status: OneClickResult["status"]; publishResult: unknown }> {
  const publishableImages = images.flatMap((image) => [image.path, image.url].filter(Boolean) as string[]);

  if (mode === "draft") {
    steps.push({
      id: "publish",
      label: "发布",
      status: "skipped",
      detail: "草稿模式：已生成内容，不发布。"
    });
    return { status: "draft_ready", publishResult: { skipped: true, reason: "draft mode" } };
  }

  if (mode === "material") {
    steps.push({
      id: "publish",
      label: "发布",
      status: "skipped",
      detail: "素材模式：已生成内容和图片，不发布。"
    });
    return { status: "material_ready", publishResult: { skipped: true, reason: "material mode" } };
  }

  if (!publishableImages.length) {
    steps.push({
      id: "publish",
      label: "发布",
      status: "failed",
      detail: "发布需要至少一张新图片，请开启图片生成或手动添加图片。"
    });
    return { status: "failed", publishResult: { skipped: true, reason: "no images" } };
  }

  if (mode === "schedule" && !input.scheduleAt) {
    steps.push({
      id: "publish",
      label: "定时发布",
      status: "failed",
      detail: "定时发布需要选择发布时间。"
    });
    return { status: "failed", publishResult: { skipped: true, reason: "missing scheduleAt" } };
  }

  const publishResult = await mcp.publishContent({
    title: draft.title,
    content: draft.content,
    tags: draft.tags,
    images: publishableImages,
    visibility: input.visibility,
    scheduleAt: mode === "schedule" ? input.scheduleAt : undefined
  });

  steps.push({
    id: "publish",
    label: mode === "schedule" ? "定时发布" : "立即发布",
    status: "done",
    detail: mode === "schedule" ? `已提交定时发布：${input.scheduleAt}` : "已调用小红书发布工具。"
  });

  return {
    status: mode === "schedule" ? "scheduled" : "published",
    publishResult
  };
}

function buildGenerationPrompt(
  input: OneClickInput,
  evidence: SampleEvidence[],
  imageStyleReport: string,
  researchSummary: ResearchSummary | null
): string {
  return `请基于以下小红书公开样本生成一篇新的原创笔记。

硬性要求：
1. 只提炼样本的优点和规律，不复制原文、不拼接原文、不改写成近似版本。
2. 生成新的角度、新结构、新表达，标题和正文都要像真实用户分享。
3. 标签使用 tags 字段，不要在正文里写 #标签。
4. 图片提示词必须生成新的原创画面，不引用或复刻样本图片。
5. 分析报告必须引用“证据样本”里的标题、互动数据、评论或图片观察，说明为什么这样写；证据不足时要明确写“证据不足”。

主题：${input.topic}
类型：${input.contentType}
时间范围：${input.timeRange}
用户补充需求：${input.requirements || "用户还没有补充具体产品、店铺或内容方向，请只在证据允许的范围内生成，并在报告里标明需要人工补充的信息。"}

证据样本：
${JSON.stringify(evidence, null, 2)}

研究总结：
${JSON.stringify(researchSummary, null, 2)}

竞品图片风格报告：
${imageStyleReport || "未启用或未获取到图片分析。"}

请只返回 JSON：
{
  "report": "分析标题、正文、标签、结构、评论需求、图片风格和可借鉴点",
  "draft": {
    "title": "20字以内标题",
    "content": "原创小红书正文，不包含#标签",
    "tags": ["标签1", "标签2"],
    "structure": ["开头钩子", "正文段落", "结尾互动"],
    "imagePrompt": "用于图片模型的新图提示词，描述构图、场景、色调、文字排版、真实感"
  }
}`;
}

function buildResearchPrompt(input: OneClickInput, evidence: SampleEvidence[], imageStyleReport: string): string {
  return `你是小红书内容研究员。现在只做“选题研究”，不要直接写成新笔记。

用户要研究的主题：${input.topic}
内容类型：${input.contentType}
时间范围：${input.timeRange}

真实笔记证据：
${JSON.stringify(evidence, null, 2)}

图片风格分析：
${imageStyleReport || "未启用或未获取到图片分析。"}

请严格基于证据总结：
1. 这些笔记的正文/结构哪里好，为什么好。
2. 这些图片哪里好，为什么容易吸引点击或收藏。
3. 如果我们下一步也做同主题内容，正文应该学习什么。
4. 图片应该学习什么，不要复制原图。
5. 在真正生成前，还需要用户补充哪些需求，例如产品名、卖点、店铺名、场景、目标人群、是否要上传产品图。

只返回 JSON：
{
  "report": "给用户看的完整中文研究报告，必须提到证据样本中的标题、互动数据、正文或图片观察；证据不足要明确说明。",
  "researchSummary": {
    "contentStrengths": ["内容优点1"],
    "imageStrengths": ["图片优点1"],
    "learningsForContent": ["下一步正文应该学习什么"],
    "learningsForImages": ["下一步图片应该学习什么"],
    "nextQuestions": ["生成前需要问用户的问题"]
  }
}`;
}

function parseResearch(raw: string, evidence: SampleEvidence[]): { report: string; summary: ResearchSummary } {
  const fallbackSummary: ResearchSummary = {
    contentStrengths: evidence.length
      ? evidence.slice(0, 3).map((item) => `${item.title}：互动数据和正文可作为内容结构参考。`)
      : ["暂未拿到足够样本，需要重新搜索或扩大时间范围。"],
    imageStrengths: evidence.some((item) => item.imageUrls.length)
      ? ["样本图片可用于观察构图、色调、场景和封面信息密度。"]
      : ["暂未拿到足够图片，图片策略需要人工补充参考图。"],
    learningsForContent: ["先基于证据总结角度，再结合用户的产品/店铺/探店需求写原创内容。"],
    learningsForImages: ["只学习构图、光线、场景和信息呈现，不复制样本图片。"],
    nextQuestions: ["你要写的具体对象是什么？是产品、店铺、探店还是生活方式内容？"]
  };

  const jsonText = extractJson(raw);
  if (!jsonText) {
    return { report: raw, summary: fallbackSummary };
  }

  try {
    const parsed = JSON.parse(jsonText) as Partial<{ report: string; researchSummary: Partial<ResearchSummary> }>;
    return {
      report: parsed.report || raw,
      summary: {
        contentStrengths: safeStringArray(parsed.researchSummary?.contentStrengths, fallbackSummary.contentStrengths),
        imageStrengths: safeStringArray(parsed.researchSummary?.imageStrengths, fallbackSummary.imageStrengths),
        learningsForContent: safeStringArray(parsed.researchSummary?.learningsForContent, fallbackSummary.learningsForContent),
        learningsForImages: safeStringArray(parsed.researchSummary?.learningsForImages, fallbackSummary.learningsForImages),
        nextQuestions: safeStringArray(parsed.researchSummary?.nextQuestions, fallbackSummary.nextQuestions)
      }
    };
  } catch {
    return { report: raw, summary: fallbackSummary };
  }
}

function safeStringArray(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
    : fallback;
}

function parseGeneration(raw: string, topic: string): { report: string; draft: GeneratedDraft } {
  const fallback: GeneratedDraft = {
    title: `${topic}`.slice(0, 20),
    content: raw || `围绕「${topic}」生成的原创笔记。`,
    tags: [topic.replace(/\s+/g, "")],
    structure: ["开头提出场景", "正文给出经验", "结尾引导互动"],
    imagePrompt: `小红书风格原创配图，主题是${topic}，自然光，真实生活场景，干净排版`
  };

  const jsonText = extractJson(raw);
  if (!jsonText) {
    return {
      report: raw,
      draft: fallback
    };
  }

  try {
    const parsed = JSON.parse(jsonText) as Partial<{ report: string; draft: Partial<GeneratedDraft> }>;
    return {
      report: parsed.report || raw,
      draft: {
        ...fallback,
        ...parsed.draft,
        tags: Array.isArray(parsed.draft?.tags) ? parsed.draft.tags : fallback.tags,
        structure: Array.isArray(parsed.draft?.structure) ? parsed.draft.structure : fallback.structure
      }
    };
  } catch {
    return {
      report: raw,
      draft: fallback
    };
  }
}

function extractJson(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenced?.[1]?.trim() ?? null;
}

function normalizeFeeds(result: unknown): RankedFeed[] {
  const text = extractText(result);
  const parsed = parseMaybeJson(text) ?? result;
  const list = findArray(parsed);

  return list.map((item, index) => {
    const record = mergeFeedRecord(item);
    const id = String(pick(record, ["feed_id", "feedId", "note_id", "noteId", "id", "noteIdStr"]) ?? `feed-${index}`);
    const title = String(pick(record, ["title", "displayTitle", "display_title", "desc", "content"]) ?? "未命名笔记").slice(0, 80);
    const xsecToken = String(pick(record, ["xsec_token", "xsecToken"]) ?? "");
    const url = String(pick(record, ["url", "link", "note_url", "noteUrl", "web_url", "share_link"]) ?? "");

    return {
      id,
      title,
      likes: toNumber(pick(record, ["likes", "like_count", "liked_count", "likedCount"])),
      collects: toNumber(pick(record, ["collects", "collect_count", "collected_count", "collectedCount", "collectCount"])),
      comments: toNumber(pick(record, ["comments", "comment_count", "commentCount"])),
      shares: toNumber(pick(record, ["shares", "share_count", "shared_count", "sharedCount", "shareCount"])),
      xsecToken,
      author: String(pick(record, ["author", "nickname", "nickName", "user_name", "userName"]) ?? ""),
      url: url || buildXhsNoteUrl(id, xsecToken),
      imageUrls: collectImageUrls([item], []),
      raw: item,
      score: 0
    };
  });
}

export function buildSampleEvidence(samples: RankedFeed[], details: unknown[]): SampleEvidence[] {
  return samples.map((sample, index) => {
    const display = hydrateFeedDisplay(sample);
    const detail = details[index];
    const imageUrls = uniqueStrings([
      ...(display.imageUrls ?? []),
      ...collectImageUrls([sample.raw, sample], [detail])
    ]).slice(0, 12);
    const detailText = extractDetailText(detail) || extractDetailText(sample.raw);
    const commentSnippets = extractCommentSnippets(detail).slice(0, 6);

    return {
      id: display.id,
      title: display.title,
      author: display.author ?? "",
      likes: display.likes ?? 0,
      collects: display.collects ?? 0,
      comments: display.comments ?? 0,
      shares: display.shares ?? 0,
      score: display.score,
      url: display.url ?? "",
      imageUrls,
      cachedImageUrls: [],
      detailText,
      commentSnippets,
      reasonHighlights: buildReasonHighlights(display, detailText, commentSnippets, imageUrls),
      raw: sample.raw
    };
  });
}

function hydrateFeedDisplay(sample: RankedFeed): RankedFeed {
  const record = mergeFeedRecord(sample.raw ?? sample);
  const id = sample.id || String(pick(record, ["feed_id", "feedId", "note_id", "noteId", "id", "noteIdStr"]) ?? "");
  const xsecToken = sample.xsecToken || String(pick(record, ["xsec_token", "xsecToken"]) ?? "");
  const rawUrl = sample.url || String(pick(record, ["url", "link", "note_url", "noteUrl", "web_url", "share_link"]) ?? "");
  const title =
    sample.title && sample.title !== "未命名笔记"
      ? sample.title
      : String(pick(record, ["title", "displayTitle", "display_title", "desc", "content"]) ?? "未命名笔记").slice(0, 80);

  return {
    ...sample,
    id,
    title,
    likes: sample.likes ?? toNumber(pick(record, ["likes", "like_count", "liked_count", "likedCount"])),
    collects:
      sample.collects ??
      toNumber(pick(record, ["collects", "collect_count", "collected_count", "collectedCount", "collectCount"])),
    comments: sample.comments ?? toNumber(pick(record, ["comments", "comment_count", "commentCount"])),
    shares: sample.shares ?? toNumber(pick(record, ["shares", "share_count", "shared_count", "sharedCount", "shareCount"])),
    xsecToken,
    author: sample.author || String(pick(record, ["author", "nickname", "nickName", "user_name", "userName"]) ?? ""),
    url: rawUrl || buildXhsNoteUrl(id, xsecToken),
    imageUrls: sample.imageUrls?.length ? sample.imageUrls : collectImageUrls([sample.raw], []),
    score: sample.score
  };
}

function buildXhsNoteUrl(id: string, xsecToken?: string): string {
  if (!id || id.startsWith("feed-")) {
    return "";
  }

  const baseUrl = `https://www.xiaohongshu.com/explore/${encodeURIComponent(id)}`;
  return xsecToken
    ? `${baseUrl}?xsec_token=${encodeURIComponent(xsecToken)}&xsec_source=pc_search`
    : baseUrl;
}

function extractDetailText(value: unknown): string {
  const primaryTexts = collectTextByKeys(
    value,
    new Set([
      "desc",
      "description",
      "noteDesc",
      "note_desc",
      "noteContent",
      "note_content",
      "contentText",
      "content_text",
      "noteText",
      "note_text"
    ])
  );
  const cleanedPrimaryTexts = cleanDetailTexts(primaryTexts);
  if (cleanedPrimaryTexts.length) {
    return compactText(cleanedPrimaryTexts.join("\n")).slice(0, 1200);
  }

  const fallbackTexts = collectTextByKeys(
    value,
    new Set(["content", "text"])
  );
  return compactText(cleanDetailTexts(fallbackTexts).join("\n")).slice(0, 1200);
}

function cleanDetailTexts(values: string[]): string[] {
  return values.map(compactText).filter((text) => text && !isDetailFailureText(text));
}

function isDetailFailureText(value: string): boolean {
  return (
    value.startsWith("获取Feed详情失败") ||
    value.includes("not found in noteDetailMap") ||
    value.includes("笔记不可访问") ||
    value.includes("This Page Isn't Available Right Now")
  );
}

function extractCommentSnippets(value: unknown): string[] {
  const comments: string[] = [];
  const commentRoots = collectArraysByKeys(value, new Set(["comments", "commentList", "comment_list", "commentData"]));

  for (const root of commentRoots) {
    for (const item of root) {
      const text = collectTextByKeys(item, new Set(["content", "text", "comment", "commentContent", "comment_content"]))
        .map(compactText)
        .find(Boolean);
      if (text) {
        comments.push(text.slice(0, 120));
      }
    }
  }

  return uniqueStrings(comments);
}

function collectTextByKeys(value: unknown, keys: Set<string>): string[] {
  const texts: string[] = [];

  function visit(candidate: unknown, key?: string): void {
    if (typeof candidate === "string") {
      const parsed = parseMaybeJson(candidate);
      if (parsed) {
        visit(parsed, key);
        return;
      }

      const text = compactText(candidate);
      if (key && keys.has(key) && text) {
        texts.push(text);
      }
      return;
    }

    if (Array.isArray(candidate)) {
      for (const child of candidate) {
        visit(child, key);
      }
      return;
    }

    if (isRecord(candidate)) {
      for (const [childKey, child] of Object.entries(candidate)) {
        visit(child, childKey);
      }
    }
  }

  visit(value);
  return uniqueStrings(texts);
}

function collectArraysByKeys(value: unknown, keys: Set<string>): unknown[][] {
  const arrays: unknown[][] = [];

  function visit(candidate: unknown, key?: string): void {
    if (typeof candidate === "string") {
      const parsed = parseMaybeJson(candidate);
      if (parsed) {
        visit(parsed, key);
      }
      return;
    }

    if (Array.isArray(candidate)) {
      if (key && keys.has(key)) {
        arrays.push(candidate);
      }
      for (const child of candidate) {
        visit(child);
      }
      return;
    }

    if (isRecord(candidate)) {
      for (const [childKey, child] of Object.entries(candidate)) {
        visit(child, childKey);
      }
    }
  }

  visit(value);
  return arrays;
}

function buildReasonHighlights(
  sample: RankedFeed,
  detailText: string,
  commentSnippets: string[],
  imageUrls: string[]
): string[] {
  const reasons: string[] = [];
  const collects = sample.collects ?? 0;
  const comments = sample.comments ?? 0;
  const shares = sample.shares ?? 0;

  if (collects > 0) {
    reasons.push(`收藏 ${collects}：说明内容有回看价值，适合提炼路线、价格、清单或避坑信息。`);
  }
  if (comments > 0 || commentSnippets.length) {
    reasons.push("评论有提问：可以把用户最关心的地址、价格、时间、停车等信息写进新稿。");
  }
  if (shares > 0) {
    reasons.push(`分享 ${shares}：说明选题有社交转发点，可强化场景感和“想带朋友去”的理由。`);
  }
  if (imageUrls.length) {
    reasons.push(`图片 ${imageUrls.length} 张：可参考画面里的场景、构图、色调和信息呈现方式。`);
  }
  if (detailText) {
    reasons.push("已获取正文/详情：可从真实描述中提炼结构，不做无依据生成。");
  }

  return reasons.length ? reasons : ["入选高互动样本：可作为标题、结构和选题角度的参考。"];
}

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())).map((value) => value.trim()))];
}

export function collectImageUrls(samples: unknown[], details: unknown[]): string[] {
  const urls = new Set<string>();

  for (const value of [...samples, ...details]) {
    walkImageUrlCandidates(value, (candidate) => {
      if (isEvidenceImageUrl(candidate)) {
        urls.add(candidate);
      }
    });
  }

  return [...urls];
}

function walkImageUrlCandidates(value: unknown, visit: (value: string) => void): void {
  if (typeof value === "string") {
    const parsed = parseMaybeJson(value);
    if (parsed) {
      walkImageUrlCandidates(parsed, visit);
      return;
    }

    visit(value.trim());
    return;
  }

  if (Array.isArray(value)) {
    for (const child of value) {
      walkImageUrlCandidates(child, visit);
    }
    return;
  }

  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (isAvatarKey(key)) {
        continue;
      }
      walkImageUrlCandidates(child, visit);
    }
  }
}

function isEvidenceImageUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) {
    return false;
  }

  if (value.includes("sns-avatar")) {
    return false;
  }

  return /^https?:\/\/.+\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(value) || value.includes("sns-webpic");
}

function isAvatarKey(key: string): boolean {
  return ["avatar", "avatarUrl", "avatar_url"].includes(key);
}

function extractText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (isRecord(value) && Array.isArray(value.content)) {
    return value.content
      .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function parseMaybeJson(text: string): unknown | null {
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function findArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return [];
  }

  for (const key of ["feeds", "items", "data", "notes", "list", "results"]) {
    const child = value[key];
    if (Array.isArray(child)) {
      return child;
    }
    if (isRecord(child)) {
      const nested = findArray(child);
      if (nested.length) {
        return nested;
      }
    }
  }

  return [];
}

function mergeFeedRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return {};
  }

  const noteCard = firstRecord(value.note_card, value.noteCard, value.note, value.card);
  const user = firstRecord(value.user, value.user_info, value.userInfo, noteCard?.user, noteCard?.userInfo);
  const interactInfo = firstRecord(
    value.interact_info,
    value.interactInfo,
    noteCard?.interact_info,
    noteCard?.interactInfo
  );
  const cover = firstRecord(value.cover, noteCard?.cover);
  const nested = [
    noteCard,
    user,
    interactInfo,
    cover
  ].filter(isRecord);

  return Object.assign({}, value, ...nested);
}

function firstRecord(...values: unknown[]): Record<string, unknown> | undefined {
  return values.find(isRecord);
}

function pick(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
      return record[key];
    }
  }
  return undefined;
}

function walk(value: unknown, visit: (value: unknown) => void): void {
  visit(value);

  if (Array.isArray(value)) {
    for (const child of value) {
      walk(child, visit);
    }
    return;
  }

  if (isRecord(value)) {
    for (const child of Object.values(value)) {
      walk(child, visit);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
