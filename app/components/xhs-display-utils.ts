import { buildImageCreativeBrief } from "@/lib/workflows/creative-briefs";
import type { ResearchSummary, SampleEvidence, Section, WorkflowResult, WorkflowSample } from "@/app/types";

export function titleForSection(section: Section): string {
  const titles: Record<Section, string> = {
    flow: "Post Studio",
    dashboard: "控制台",
    workflow: "主题研究台",
    jobs: "任务进度",
    assets: "素材管理",
    imageStudio: "图片创作台",
    chat: "AI 工作台",
    publish: "发布装配台",
    audit: "发布审计",
    history: "历史记录",
    settings: "模型与连接设置"
  };
  return titles[section];
}

export function subtitleForSection(section: Section): string {
  const subtitles: Record<Section, string> = {
    flow: "围绕一个帖子项目完成研究、文案、图片、发布检查和确认。",
    dashboard: "查看 MCP、模型、任务和发布安全状态。",
    workflow: "按主题、类型、时间和样本数搜索真实笔记，只做研究分析，不生成、不发布。",
    jobs: "追踪搜索、分析、生成图片和发布任务的后台进度。",
    assets: "管理产品原图、参考图和生成结果；主要从 AI 工作台和图片创作台上传使用。",
    imageStudio: "在 AI 生图和图文卡片之间切换，产出可直接发布的视觉素材。",
    chat: "用自然语言调度搜索、分析、文案、图片和发布装配。",
    publish: "合并当前草稿与图片，检查安全项，先生成确认单，再由你确认立即或定时发布。",
    audit: "回看发布预览、确认单、阻止原因、真实发布和定时发布记录。",
    history: "回看研究记录、证据、草稿和生成结果。",
    settings: "配置本地 MCP、文本模型、图片模型与发布权限。"
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
