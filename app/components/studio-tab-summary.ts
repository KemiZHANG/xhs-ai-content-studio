import type { PostProject } from "@/app/types";

export type StudioTabSummaryState = "ready" | "warn" | "empty";

export type StudioTabSummary = {
  headline: string;
  detail: string;
  state: StudioTabSummaryState;
  primaryActionLabel: string;
  primaryAction?: string;
};

export function buildBriefTabSummary({
  project,
  evidenceCount,
  viralEvidenceCount
}: {
  project: PostProject | null | undefined;
  evidenceCount: number;
  viralEvidenceCount: number;
}): StudioTabSummary {
  const brief = project?.creativeBrief;
  if (brief) {
    return {
      headline: "Brief 已建立，文案和图片会共享这份策略",
      detail: `${brief.contentAngle || "待补充角度"} · ${brief.tone || "待补充语气"} · 证据 ${brief.basedOnEvidenceIds.length} 条`,
      state: "ready",
      primaryActionLabel: project?.copyDraft ? "刷新 Brief" : "基于 Brief 生成文案",
      primaryAction: project?.copyDraft ? "create_creative_brief" : "generate_copy"
    };
  }

  if (evidenceCount) {
    return {
      headline: viralEvidenceCount ? "可以生成 CreativeBrief" : "建议先合入爆款库 RAG",
      detail: viralEvidenceCount
        ? `已准备 ${evidenceCount} 条证据，其中爆款库 ${viralEvidenceCount} 条。下一步把它们压缩成统一 Brief。`
        : `已有 ${evidenceCount} 条实时证据。先补爆款库规律，会让文案和图片方向更稳。`,
      state: viralEvidenceCount ? "warn" : "empty",
      primaryActionLabel: viralEvidenceCount ? "生成 CreativeBrief" : "刷新爆款库 RAG",
      primaryAction: viralEvidenceCount ? "create_creative_brief" : "retrieve_viral_knowledge"
    };
  }

  return {
    headline: "等待研究证据",
    detail: "先搜索真实小红书笔记，再把实时证据和爆款库规律合成 Brief。",
    state: "empty",
    primaryActionLabel: "开始主题研究",
    primaryAction: "search_research"
  };
}

export function buildImageTabSummary({
  selectedCount,
  previewCount,
  hiddenCount,
  mode
}: {
  selectedCount: number;
  previewCount: number;
  hiddenCount: number;
  mode: "reference" | "generated";
}): StudioTabSummary {
  const isGenerated = mode === "generated";
  if (selectedCount) {
    return {
      headline: `已选 ${selectedCount} 张发布图片`,
      detail: hiddenCount
        ? `默认只展示当前选图和少量${isGenerated ? "生成图" : "参考图"}，还有 ${hiddenCount} 张已折叠。`
        : "当前选图会进入最终帖子；更多素材可去 Assets 管理。",
      state: "ready",
      primaryActionLabel: "进入发布检查",
      primaryAction: "run_quality_gate"
    };
  }

  if (previewCount) {
    return {
      headline: `有 ${previewCount} 张${isGenerated ? "生成图" : "参考图"}可选`,
      detail: isGenerated
        ? "选择满意图片进入最终帖子，或继续生成图文卡片。"
        : "可把产品图/参考图设为发布图片，也可以交给 Agent 生成新图。",
      state: "warn",
      primaryActionLabel: "选择图片",
      primaryAction: "select_images"
    };
  }

  return {
    headline: isGenerated ? "还没有生成图" : "还没有参考图",
    detail: isGenerated
      ? "先确认图片方向，再让 Agent 生成配图或图文卡片。"
      : "可以拖入产品图/参考图；没有图片也可以先生成视觉方向。",
    state: "empty",
    primaryActionLabel: isGenerated ? "生成图片" : "上传参考图",
    primaryAction: isGenerated ? "generate_images" : undefined
  };
}

export function buildPublishTabSummary({
  publishReady,
  pendingConfirmation,
  blockerCount,
  riskLevel
}: {
  publishReady: boolean;
  pendingConfirmation: boolean;
  blockerCount: number;
  riskLevel: "ok" | "warn" | "blocked";
}): StudioTabSummary {
  if (pendingConfirmation) {
    return {
      headline: "确认单已生成，等待人工确认",
      detail: "核对账号、可见范围、图片版本和时间后，才会调用小红书发布。",
      state: riskLevel === "blocked" ? "warn" : "ready",
      primaryActionLabel: "查看确认单",
      primaryAction: "review_publish_confirmation"
    };
  }

  if (publishReady) {
    return {
      headline: "可以生成发布确认单",
      detail: "Quality Gate、证据引用、图片版本和账号状态已满足生成确认单条件。",
      state: "ready",
      primaryActionLabel: "生成确认单",
      primaryAction: "request_publish_confirmation"
    };
  }

  return {
    headline: "发布前还需要处理",
    detail: blockerCount ? `还有 ${blockerCount} 个阻塞项需要处理，默认不会自动发布。` : "先运行发布检查，确认内容、图片和账号状态。",
    state: riskLevel === "blocked" ? "warn" : "empty",
    primaryActionLabel: "刷新质量检查",
    primaryAction: "run_quality_gate"
  };
}
