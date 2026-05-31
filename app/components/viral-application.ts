import type { PostProject } from "@/app/types";

export type ViralApplicationAction = {
  id: string;
  label: string;
  action: string;
  primary?: boolean;
};

export type ViralApplicationModel = {
  headline: string;
  detail: string;
  evidenceCount: number;
  focusedCount: number;
  actions: ViralApplicationAction[];
};

export function buildViralApplicationModel(project: PostProject | null | undefined): ViralApplicationModel {
  const viralInsights = project?.evidencePack.insights.filter((insight) => insight.sourceType === "viral_library") ?? [];
  if (!viralInsights.length) {
    return {
      headline: "先把爆款库规律合入当前项目",
      detail: "刷新 RAG 后，Agent 会把标题钩子、正文结构、标签组合和图片风格写入当前 PostProject 的 evidencePack。",
      evidenceCount: 0,
      focusedCount: 0,
      actions: [
        { id: "viral-refresh-rag", label: "刷新 RAG 证据", action: "retrieve_viral_knowledge", primary: true }
      ]
    };
  }

  const briefUsesViral = Boolean(project?.creativeBrief?.basedOnEvidenceIds.some((id) => id.startsWith("viral-insight-")));
  const focusedViralCount = project?.focusedEvidenceIds.filter((id) => viralInsights.some((insight) => insight.id === id)).length ?? 0;
  const visualUsesViral = Boolean(project?.visualDirection?.basedOnEvidenceIds.some((id) => id.startsWith("viral-insight-")));
  const draftUsesViral = Boolean(project?.copyDraft?.draft.basedOnEvidenceIds?.some((id) => id.startsWith("viral-insight-")));
  const actions: ViralApplicationAction[] = [];

  if (!briefUsesViral) {
    actions.push({ id: "viral-apply-brief", label: "应用到 CreativeBrief", action: "create_creative_brief", primary: true });
  }
  if (briefUsesViral && !draftUsesViral) {
    actions.push({ id: "viral-apply-copy", label: "生成爆款库增强文案", action: "generate_copy", primary: true });
  }
  if (briefUsesViral && !visualUsesViral) {
    actions.push({ id: "viral-apply-visual", label: "生成图片方向", action: "plan_visuals" });
  }
  if (!actions.length) {
    actions.push({ id: "viral-refresh-rag", label: "刷新更多爆款规律", action: "retrieve_viral_knowledge" });
  }

  return {
    headline: focusedViralCount
      ? "已选择本次重点爆款规律"
      : briefUsesViral ? "爆款库规律已接入创作链路" : "爆款库规律已进入 evidencePack",
    detail: briefUsesViral
      ? "当前 Brief / 文案 / 图片方向会优先学习这些规律；如果已选重点规律，后续生成会更聚焦，但仍只复用结构、风格和决策逻辑，不复制原文原图。"
      : "下一步建议先选择 1-3 条重点规律并刷新 CreativeBrief，让文案和图片方向共享同一批爆款库证据。",
    evidenceCount: viralInsights.length,
    focusedCount: focusedViralCount,
    actions: actions.slice(0, 3)
  };
}
