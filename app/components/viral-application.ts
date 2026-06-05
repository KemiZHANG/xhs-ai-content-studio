import type { PostProject } from "@/app/types";

export type ViralApplicationAction = {
  id: string;
  label: string;
  action: string;
  primary?: boolean;
};

export type ViralApplicationRouteStatus = "empty" | "pending" | "ready";

export type ViralApplicationRoute = {
  id: "brief" | "copy" | "visual";
  label: string;
  status: ViralApplicationRouteStatus;
  detail: string;
  evidenceIds: string[];
};

export type ViralApplicationModel = {
  headline: string;
  detail: string;
  readinessGate: {
    status: "ready" | "caution" | "pending";
    label: string;
    detail: string;
  };
  ragStatus: "none" | "insufficient" | "enough";
  ragLine: string;
  missingEvidence: string[];
  recommendation: string;
  evidenceCount: number;
  focusedCount: number;
  citedEvidenceIds: string[];
  routes: ViralApplicationRoute[];
  actions: ViralApplicationAction[];
};

export function buildViralApplicationModel(project: PostProject | null | undefined): ViralApplicationModel {
  const viralInsights = project?.evidencePack.insights.filter((insight) => insight.sourceType === "viral_library") ?? [];
  const viralInsightIds = new Set(viralInsights.map((insight) => insight.id));
  const focusedViralIds = (project?.focusedEvidenceIds ?? []).filter((id) => viralInsightIds.has(id));
  const fallbackEvidenceIds = (focusedViralIds.length ? focusedViralIds : viralInsights.map((insight) => insight.id)).slice(0, 3);
  const ragReadiness = extractRagReadiness(project?.evidencePack.summary);

  if (!viralInsights.length) {
    return {
      headline: "先把爆款库规律合入当前项目",
      detail: "刷新 RAG 后，Agent 会把标题钩子、正文结构、标签组合和图片风格写入当前 PostProject 的 evidencePack。",
      readinessGate: buildReadinessGate(ragReadiness.ragStatus, false),
      ragStatus: ragReadiness.ragStatus,
      ragLine: ragReadiness.ragLine,
      missingEvidence: ragReadiness.missingEvidence,
      recommendation: ragReadiness.recommendation,
      evidenceCount: 0,
      focusedCount: 0,
      citedEvidenceIds: [],
      routes: [
        {
          id: "brief",
          label: "CreativeBrief",
          status: "empty",
          detail: "还没有爆款库证据，先检索或保存高质量样本。",
          evidenceIds: []
        },
        {
          id: "copy",
          label: "文案",
          status: "empty",
          detail: "文案会在 Brief 建立后引用可学习规律。",
          evidenceIds: []
        },
        {
          id: "visual",
          label: "图片方向",
          status: "empty",
          detail: "图片方向会在 Brief 建立后引用视觉规律。",
          evidenceIds: []
        }
      ],
      actions: [
        { id: "viral-refresh-rag", label: "刷新 RAG 证据", action: "retrieve_viral_knowledge", primary: true }
      ]
    };
  }

  const briefEvidenceIds = viralEvidenceIds(project?.creativeBrief?.basedOnEvidenceIds, viralInsightIds);
  const draftEvidenceIds = viralEvidenceIds(project?.copyDraft?.draft.basedOnEvidenceIds, viralInsightIds);
  const visualEvidenceIds = viralEvidenceIds([
    ...(project?.visualDirection?.basedOnEvidenceIds ?? []),
    ...(project?.imagePrompts ?? []).flatMap((prompt) => prompt.basedOnEvidenceIds ?? [])
  ], viralInsightIds);
  const briefUsesViral = Boolean(briefEvidenceIds.length);
  const visualUsesViral = Boolean(visualEvidenceIds.length);
  const draftUsesViral = Boolean(draftEvidenceIds.length);
  const actions: ViralApplicationAction[] = [];
  const creativeOutputAllowed = ragReadiness.ragStatus !== "insufficient";

  if (ragReadiness.ragStatus === "insufficient") {
    actions.push({ id: "viral-more-realtime", label: "继续实时研究", action: "search_research", primary: true });
    actions.push({ id: "viral-refresh-rag", label: "刷新 RAG 证据", action: "retrieve_viral_knowledge" });
  }
  if (!briefUsesViral) {
    actions.push({
      id: "viral-apply-brief",
      label: "应用到 CreativeBrief",
      action: "create_creative_brief",
      primary: creativeOutputAllowed
    });
  }
  if (creativeOutputAllowed && briefUsesViral && !draftUsesViral) {
    actions.push({ id: "viral-apply-copy", label: "生成爆款库增强文案", action: "generate_copy", primary: true });
  }
  if (creativeOutputAllowed && briefUsesViral && !visualUsesViral) {
    actions.push({ id: "viral-apply-visual", label: "生成图片方向", action: "plan_visuals" });
  }
  if (!actions.length) {
    actions.push({ id: "viral-refresh-rag", label: "刷新更多爆款规律", action: "retrieve_viral_knowledge" });
  }

  const routes: ViralApplicationRoute[] = [
    {
      id: "brief",
      label: "CreativeBrief",
      status: briefUsesViral ? "ready" : "pending",
      detail: briefUsesViral
        ? "已把爆款规律沉淀成受众、痛点、角度、语气和视觉基调。"
        : "下一步先把重点爆款规律压缩进 Brief，避免文案和图片各写各的。",
      evidenceIds: briefUsesViral ? briefEvidenceIds : fallbackEvidenceIds
    },
    {
      id: "copy",
      label: "标题/正文/标签",
      status: draftUsesViral ? "ready" : briefUsesViral ? "pending" : "empty",
      detail: draftUsesViral
        ? "当前草稿已引用爆款库证据，只复用结构和表达策略，不复制原文。"
        : briefUsesViral
          ? "可以基于 Brief 生成或改写草稿，并写入 basedOnEvidenceIds。"
          : "先生成带爆款证据的 Brief，再进入文案生成。",
      evidenceIds: draftUsesViral ? draftEvidenceIds : fallbackEvidenceIds
    },
    {
      id: "visual",
      label: "图片方向/提示词",
      status: visualUsesViral ? "ready" : briefUsesViral ? "pending" : "empty",
      detail: visualUsesViral
        ? "图片方向已引用视觉规律，后续生图会和文案共享同一套 Brief。"
        : briefUsesViral
          ? "可以把视觉规律转成封面方向、构图、氛围和避免项。"
          : "先生成带爆款证据的 Brief，再规划图片方向。",
      evidenceIds: visualUsesViral ? visualEvidenceIds : fallbackEvidenceIds
    }
  ];

  return {
    headline: ragReadiness.ragStatus === "insufficient"
      ? "爆款库证据已接入，但还需要补强"
      : focusedViralIds.length
      ? "已选择本次重点爆款规律"
      : briefUsesViral ? "爆款库规律已接入创作链路" : "爆款库规律已进入 evidencePack",
    detail: ragReadiness.ragStatus === "insufficient"
      ? "当前可以参考已有规律，但 Agent 不应把不足的历史证据伪装成完整研究结论。建议先补实时样本或继续沉淀爆款库，再生成关键发布稿。"
      : briefUsesViral
      ? "当前 Brief / 文案 / 图片方向会优先学习这些规律；如果已选重点规律，后续生成会更聚焦，但仍只复用结构、风格和决策逻辑，不复制原文原图。"
      : "下一步建议先选择 1-3 条重点规律并刷新 CreativeBrief，让文案和图片方向共享同一批爆款库证据。",
    readinessGate: buildReadinessGate(ragReadiness.ragStatus, briefUsesViral),
    ragStatus: ragReadiness.ragStatus,
    ragLine: ragReadiness.ragLine,
    missingEvidence: ragReadiness.missingEvidence,
    recommendation: ragReadiness.recommendation,
    evidenceCount: viralInsights.length,
    focusedCount: focusedViralIds.length,
    citedEvidenceIds: uniqueStrings([...briefEvidenceIds, ...draftEvidenceIds, ...visualEvidenceIds]),
    routes,
    actions: actions.slice(0, 3)
  };
}

function buildReadinessGate(
  ragStatus: ViralApplicationModel["ragStatus"],
  briefUsesViral: boolean
): ViralApplicationModel["readinessGate"] {
  if (ragStatus === "enough" && briefUsesViral) {
    return {
      status: "ready",
      label: "可继续生成关键稿件",
      detail: "爆款库 RAG 已足够，CreativeBrief 已引用爆款证据，可以进入文案、图片方向或发布检查。"
    };
  }
  if (ragStatus === "enough") {
    return {
      status: "pending",
      label: "先应用到 CreativeBrief",
      detail: "RAG 证据足够，但还没有写入共享 Brief；先让文案和图片共用同一批证据。"
    };
  }
  if (ragStatus === "insufficient") {
    return {
      status: "caution",
      label: "先补证据再生成关键稿件",
      detail: "当前爆款库可作参考，但不足以支撑最终标题、正文和图片方向；建议继续实时研究或保存更多高质量样本。"
    };
  }
  return {
    status: "pending",
    label: "先刷新 RAG 充分性",
    detail: "还没有本次 RAG 充分性评估，先检索爆款库再决定是否进入 CreativeBrief 和创作。"
  };
}

function viralEvidenceIds(ids: readonly string[] | undefined, viralInsightIds: Set<string>): string[] {
  return uniqueStrings((ids ?? []).filter((id) => viralInsightIds.has(id) || id.startsWith("viral-insight-"))).slice(0, 5);
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function extractRagReadiness(summary: unknown): Pick<ViralApplicationModel, "ragStatus" | "ragLine" | "missingEvidence" | "recommendation"> {
  const viralKnowledge = isRecord(summary) && isRecord(summary.viralKnowledge) ? summary.viralKnowledge : null;
  const sufficiency = viralKnowledge && isRecord(viralKnowledge.sufficiency) ? viralKnowledge.sufficiency : null;
  if (!sufficiency) {
    return {
      ragStatus: "none",
      ragLine: "还没有本次 RAG 充分性评估。",
      missingEvidence: [],
      recommendation: "刷新爆款库 RAG 后，再决定是否进入 CreativeBrief、文案和图片方向生成。"
    };
  }

  const missing = Array.isArray(sufficiency.missing)
    ? sufficiency.missing.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 5)
    : [];
  const recommendation = typeof sufficiency.recommendation === "string" && sufficiency.recommendation.trim()
    ? sufficiency.recommendation.trim()
    : missing.length
      ? "建议继续搜索或补充参考样本。"
      : "证据足够进入 CreativeBrief、文案和图片方向生成。";
  const realtimeCount = typeof sufficiency.realtimeCount === "number" ? sufficiency.realtimeCount : 0;
  const viralCount = typeof sufficiency.viralCount === "number" ? sufficiency.viralCount : 0;
  const isEnough = sufficiency.isEnough === true;

  return {
    ragStatus: isEnough ? "enough" : "insufficient",
    ragLine: isEnough
      ? `RAG 证据充足：实时 ${realtimeCount} 条，爆款库 ${viralCount} 条。`
      : `RAG 证据还不够：实时 ${realtimeCount} 条，爆款库 ${viralCount} 条。`,
    missingEvidence: missing,
    recommendation
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
