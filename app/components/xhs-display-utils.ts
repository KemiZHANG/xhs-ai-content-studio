import { buildImageCreativeBrief } from "@/lib/workflows/creative-briefs";
import type { ResearchSummary, SampleEvidence, Section, WorkflowResult, WorkflowSample } from "@/app/types";

export function titleForSection(section: Section): string {
  const titles: Record<Section, string> = {
    flow: "Post Studio",
    dashboard: "高级控制台",
    workflow: "高级主题研究",
    jobs: "高级任务进度",
    assets: "Assets",
    imageStudio: "高级图片工具",
    chat: "旧版 AI 工作台",
    publish: "备用发布装配",
    audit: "Publish History",
    history: "旧版历史记录",
    settings: "Settings"
  };
  return titles[section];
}

export function subtitleForSection(section: Section): string {
  const subtitles: Record<Section, string> = {
    flow: "围绕一个帖子项目完成研究、文案、图片、发布检查和人工确认。",
    dashboard: "高级状态页。日常创作请回到 Post Studio，这里只用于排查 MCP、模型、任务和发布安全状态。",
    workflow: "高级研究入口。日常从 Post Studio 左侧发起研究；这里只用于单独复查搜索条件和样本表。",
    jobs: "高级任务页。日常只看 Post Studio 左侧进度；这里用于排查后台任务失败原因。",
    assets: "管理产品原图、参考图和生成结果；主要从 Post Studio 上传和选择使用。",
    imageStudio: "高级图片工具。日常在 Post Studio 右侧选择/生成图片；这里用于批量 AI 生图和图文卡片。",
    chat: "旧版自然语言工作台；新的创作、修改和发布建议都回到 Post Studio 完成。",
    publish: "备用发布装配入口；当前项目发布请优先使用 Post Studio，真实发布前仍需先生成确认单。",
    audit: "回看发布预览、确认单、阻止原因、真实发布和定时发布记录。",
    history: "旧版历史页。日常只从 Post Studio 恢复项目；这里用于回看研究记录、证据、草稿和生成结果。",
    settings: "配置本地 MCP、文本模型、图片模型、账号档案与发布权限。"
  };
  return subtitles[section];
}

export function modeLabel(mode: string): string {
  const labels: Record<string, string> = {
    research: "证据研究",
    draft: "草稿模式",
    material: "素材模式",
    publish: "生成发布确认单",
    schedule: "生成定时确认单"
  };
  return labels[mode] ?? mode;
}

export function sampleToEvidence(sample: WorkflowSample): SampleEvidence {
  const display = displaySample(sample);
  const rawImageUrls = collectDisplayImageUrls(sample.raw).slice(0, 8);
  const raw = isRecord(sample.raw) ? sample.raw : {};
  const xsecToken = chooseText(sample.xsecToken, raw.xsecToken, raw.xsec_token);
  const sourceUrl = xsecToken && !sample.url?.includes("xsec_token") ? buildDisplayXhsUrl(sample.id, xsecToken) : sample.url ?? "";

  return {
    id: sample.id,
    title: display.title,
    author: display.author || "",
    likes: display.likes,
    collects: display.collects,
    comments: display.comments,
    shares: display.shares ?? 0,
    score: display.score,
    url: sourceUrl,
    imageUrls: rawImageUrls,
    cachedImageUrls: [],
    detailText: "",
    commentSnippets: [],
    reasonHighlights: ["这是历史记录中的样本卡片；新的研究运行会保存更完整的正文、评论和图片证据。"]
  };
}

export function displayEvidenceImages(item: SampleEvidence): string[] {
  return item.cachedImageUrls?.length ? item.cachedImageUrls : item.imageUrls;
}

export function buildClientEvidenceContext(result: WorkflowResult | null): string {
  if (!result) {
    return "";
  }
  return buildImageCreativeBrief(result).slice(0, 2400);
}

export function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

export function normalizeLocalDatetimeForApi(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)
    ? `${trimmed}+08:00`
    : `${trimmed}:00+08:00`;
}

export function buildDisplayXhsUrl(id: string, xsecToken?: string): string {
  if (!id || id.startsWith("feed-")) {
    return "";
  }

  const baseUrl = `https://www.xiaohongshu.com/explore/${encodeURIComponent(id)}`;
  return xsecToken
    ? `${baseUrl}?xsec_token=${encodeURIComponent(xsecToken)}&xsec_source=pc_search`
    : baseUrl;
}

export function displaySample(sample: WorkflowSample): WorkflowSample & Required<Pick<WorkflowSample, "likes" | "collects" | "comments">> {
  const raw = isRecord(sample.raw) ? sample.raw : {};
  const noteCard = firstRecord(raw.noteCard, raw.note_card, raw.note, raw.card) ?? {};
  const user = firstRecord(raw.user, raw.userInfo, raw.user_info, noteCard.user, noteCard.userInfo) ?? {};
  const interact = firstRecord(raw.interactInfo, raw.interact_info, noteCard.interactInfo, noteCard.interact_info) ?? {};
  const title = chooseText(sample.title === "未命名笔记" ? "" : sample.title, noteCard.displayTitle, noteCard.display_title, raw.title);
  const author = chooseText(sample.author, user.nickname, user.nickName, user.userName, raw.author);
  const likes = chooseNumber(sample.likes, interact.likedCount, interact.liked_count, raw.likes);
  const collects = chooseNumber(sample.collects, interact.collectedCount, interact.collected_count, raw.collects);
  const comments = chooseNumber(sample.comments, interact.commentCount, interact.comment_count, raw.comments);
  const shares = chooseNumber(sample.shares, interact.sharedCount, interact.shared_count, raw.shares);
  const score = sample.score > 0 ? sample.score : likes + collects * 3 + comments * 2 + shares * 1.5;
  const xsecToken = chooseText(sample.xsecToken, raw.xsecToken, raw.xsec_token);
  const url = xsecToken && !sample.url?.includes("xsec_token") ? buildDisplayXhsUrl(sample.id, xsecToken) : sample.url;

  return {
    ...sample,
    title: title || "未命名笔记",
    author,
    likes,
    collects,
    comments,
    shares,
    url,
    score
  };
}

export function collectDisplayImageUrls(value: unknown): string[] {
  const urls = new Set<string>();

  function visit(candidate: unknown): void {
    if (typeof candidate === "string") {
      if (/^https?:\/\/.+\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(candidate) || candidate.includes("sns-webpic")) {
        urls.add(candidate);
      }
      return;
    }

    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }

    if (isRecord(candidate)) {
      Object.values(candidate).forEach(visit);
    }
  }

  visit(value);
  return [...urls];
}

export function firstRecord(...values: unknown[]): Record<string, unknown> | undefined {
  return values.find(isRecord);
}

export function chooseText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export function chooseNumber(...values: unknown[]): number {
  for (const value of values) {
    const parsed = toDisplayNumber(value);
    if (parsed > 0) {
      return parsed;
    }
  }
  return 0;
}

export function toDisplayNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return 0;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return 0;
  }
  const multiplier = normalized.includes("万") || normalized.includes("w") ? 10000 : 1;
  const numeric = Number.parseFloat(normalized.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? Math.round(numeric * multiplier) : 0;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function formatMcpEndpoint(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || (parsed.protocol === "https:" ? "443" : "80")}`;
  } catch {
    return url || "未配置 MCP";
  }
}
