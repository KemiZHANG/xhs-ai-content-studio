import { buildEvidenceCitationReport, buildEvidenceReferenceSummary } from "@/lib/post-project/citations";
import type { PostProject } from "@/app/types";
import type { EvidenceSourceType } from "@/lib/post-project/types";

export type CreationProvenanceCard = {
  id: "brief" | "copy" | "visual";
  label: string;
  headline: string;
  detail: string;
  safetyLine?: string;
  evidenceCount: number;
  missingCount: number;
  weakViralEvidenceCount?: number;
  sourceLine: string;
  state: "ready" | "warn" | "empty";
};

export function buildCreationProvenance(project: PostProject | null): CreationProvenanceCard[] {
  if (!project) {
    return [
      emptyCard("brief", "CreativeBrief", "等待研究证据", "先搜索真实笔记或检索爆款库，再生成统一 Brief。"),
      emptyCard("copy", "文案", "等待草稿", "文案生成后会显示标题、正文、标签分别引用了哪些证据。"),
      emptyCard("visual", "图片方向", "等待图片策略", "图片方向和 Prompt 会共享 CreativeBrief 的 evidencePack 证据。")
    ];
  }

  return [
    buildBriefCard(project),
    buildCopyCard(project),
    buildVisualCard(project)
  ];
}

function buildBriefCard(project: PostProject): CreationProvenanceCard {
  if (!project.creativeBrief) {
    return emptyCard("brief", "CreativeBrief", "还没有 Brief", "把研究结论压缩成目标人群、内容角度和视觉方向。");
  }
  const summary = buildEvidenceReferenceSummary(project, project.creativeBrief.basedOnEvidenceIds);
  return {
    id: "brief",
    label: "CreativeBrief",
    headline: summary.insights.length ? "Brief 已绑定证据" : "Brief 缺少可见证据",
    detail: summary.insights.length
      ? `人群、痛点、角度和视觉 mood 来自 ${summary.insights.length} 条 evidencePack 结论。`
      : "Brief 存在，但当前 evidencePack 里找不到对应证据。",
    safetyLine: viralSafetyLine(project, summary.sourceCounts),
    evidenceCount: summary.insights.length,
    missingCount: summary.missingEvidenceIds.length,
    weakViralEvidenceCount: summary.weakViralEvidenceCount,
    sourceLine: sourceLine(summary.sourceCounts, summary.weakViralEvidenceCount),
    state: stateFromCounts(summary.insights.length, summary.missingEvidenceIds.length)
  };
}

function buildCopyCard(project: PostProject): CreationProvenanceCard {
  if (!project.copyDraft) {
    return emptyCard("copy", "文案", "还没有文案草稿", "生成文案后会展示标题、正文、标签、图片方向的字段级证据。");
  }

  const report = buildEvidenceCitationReport(
    project,
    project.copyDraft.draft.basedOnEvidenceIds ?? [],
    project.copyDraft.draft.evidenceReferences
  );
  const boundFields = report.sections.filter((section) => section.insights.length).length;
  const missingFields = report.sections.length - boundFields;
  const missingCount = report.missingEvidenceIds.length + missingFields;
  return {
    id: "copy",
    label: "文案",
    headline: missingCount ? "文案证据还不完整" : "文案字段可追溯",
    detail: `标题、正文、标签、图片方向 ${boundFields}/${report.sections.length} 个字段已绑定证据。`,
    safetyLine: viralSafetyLine(project, report.sourceCounts),
    evidenceCount: report.allEvidenceIds.length,
    missingCount,
    weakViralEvidenceCount: report.weakViralEvidenceCount,
    sourceLine: sourceLine(report.sourceCounts, report.weakViralEvidenceCount),
    state: stateFromCounts(report.allEvidenceIds.length, missingCount)
  };
}

function buildVisualCard(project: PostProject): CreationProvenanceCard {
  const visualIds = [
    ...(project.visualDirection?.basedOnEvidenceIds ?? []),
    ...project.imagePrompts.flatMap((prompt) => prompt.basedOnEvidenceIds ?? [])
  ];
  if (!project.visualDirection && !project.imagePrompts.length) {
    return emptyCard("visual", "图片方向", "还没有图片方向", "规划图片方向后，再确认 Prompt 并生成/选择图片。");
  }

  const summary = buildEvidenceReferenceSummary(project, visualIds);
  const confirmed = project.visualDirection?.confirmationStatus === "confirmed" || Boolean(project.visualDirection?.confirmedAt);
  const missingCount = summary.missingEvidenceIds.length + (confirmed ? 0 : 1);
  return {
    id: "visual",
    label: "图片方向",
    headline: confirmed ? "图片方向已确认" : "图片方向待人工确认",
    detail: summary.insights.length
      ? `封面氛围、构图和 Prompt 引用了 ${summary.insights.length} 条视觉/结构证据。`
      : "已有图片方向，但缺少可追溯 evidencePack 结论。",
    safetyLine: viralSafetyLine(project, summary.sourceCounts),
    evidenceCount: summary.insights.length,
    missingCount,
    weakViralEvidenceCount: summary.weakViralEvidenceCount,
    sourceLine: sourceLine(summary.sourceCounts, summary.weakViralEvidenceCount),
    state: stateFromCounts(summary.insights.length, missingCount)
  };
}

function emptyCard(id: CreationProvenanceCard["id"], label: string, headline: string, detail: string): CreationProvenanceCard {
  return {
    id,
    label,
    headline,
    detail,
    safetyLine: undefined,
    evidenceCount: 0,
    missingCount: 0,
    weakViralEvidenceCount: 0,
    sourceLine: "暂无来源",
    state: "empty"
  };
}

function stateFromCounts(evidenceCount: number, missingCount: number): CreationProvenanceCard["state"] {
  if (!evidenceCount) return "empty";
  return missingCount ? "warn" : "ready";
}

function sourceLine(sourceCounts: Record<EvidenceSourceType, number>, weakViralEvidenceCount = 0): string {
  const parts = [
    sourceCounts.realtime ? `实时 ${sourceCounts.realtime}` : "",
    sourceCounts.viral_library ? `爆款库 ${sourceCounts.viral_library}${weakViralEvidenceCount ? `（弱参考 ${weakViralEvidenceCount}）` : ""}` : "",
    sourceCounts.user_input ? `用户输入 ${sourceCounts.user_input}` : ""
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "暂无来源";
}

function viralSafetyLine(project: PostProject, sourceCounts: Record<EvidenceSourceType, number>): string | undefined {
  if (!sourceCounts.viral_library) {
    return undefined;
  }
  const summary = isRecord(project.evidencePack.summary) ? project.evidencePack.summary : {};
  const viralKnowledge = isRecord(summary.viralKnowledge) ? summary.viralKnowledge : {};
  const strategyReport = isRecord(viralKnowledge.strategyReport) ? viralKnowledge.strategyReport : {};
  const rules = [
    ...stringArray(strategyReport.originalityRules),
    ...stringArray(strategyReport.rewriteGuidance)
  ]
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return rules.length
    ? `原创边界：${Array.from(new Set(rules)).slice(0, 2).join(" / ")}`
    : "原创边界：只学习爆款结构、钩子和视觉规律，不复制原文或原图。";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
