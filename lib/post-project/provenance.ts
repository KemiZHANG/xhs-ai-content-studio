import type { DraftRecord } from "@/lib/storage/drafts";
import { buildEvidenceCitationReport, buildEvidenceReferenceSummary } from "@/lib/post-project/citations";
import type { EvidenceSourceType, PostProject } from "@/lib/post-project/types";

export type CreationProvenanceItem = {
  id: "brief" | "copy" | "visual";
  label: string;
  status: "ready" | "warn" | "empty";
  summary: string;
  sourceCounts: Record<EvidenceSourceType, number>;
  evidenceCount: number;
  missingCount: number;
};

export type CreationProvenanceSummary = {
  headline: string;
  detail: string;
  items: CreationProvenanceItem[];
  canExplainCreation: boolean;
};

export function buildCreationProvenanceSummary(
  project: PostProject | null | undefined,
  draft?: DraftRecord | null
): CreationProvenanceSummary {
  if (!project) {
    const items = [
      emptyItem("brief", "CreativeBrief", "等待研究证据和 Brief"),
      emptyItem("copy", "文案", "等待生成可追溯文案"),
      emptyItem("visual", "图片方向", "等待规划图片方向")
    ];
    return {
      headline: "创作依据待建立",
      detail: "Agent 还没有可追溯 PostProject，不能把建议伪装成研究结论。",
      items,
      canExplainCreation: false
    };
  }

  const items = [
    briefProvenance(project),
    copyProvenance(project, draft ?? project.copyDraft),
    visualProvenance(project)
  ];
  const readyCount = items.filter((item) => item.status === "ready").length;
  const warnCount = items.filter((item) => item.status === "warn").length;
  return {
    headline: readyCount === items.length
      ? "创作依据完整"
      : warnCount
        ? "创作依据需要复核"
        : "创作依据还在建立",
    detail: `Brief、文案、图片方向 ${readyCount}/${items.length} 项可追溯；${warnCount} 项需要补证据或人工确认。`,
    items,
    canExplainCreation: readyCount > 0
  };
}

export function formatCreationProvenanceForReply(summary: CreationProvenanceSummary): string {
  const visible = summary.items.filter((item) => item.status !== "empty");
  if (!visible.length) {
    return `创作依据：${summary.detail}`;
  }
  return [
    `创作依据：${summary.detail}`,
    ...visible.map((item) =>
      `- ${item.label}｜${labelForStatus(item.status)}｜${formatSourceLine(item.sourceCounts)}｜证据 ${item.evidenceCount}${item.missingCount ? `｜待补 ${item.missingCount}` : ""}：${item.summary}`
    )
  ].join("\n");
}

function briefProvenance(project: PostProject): CreationProvenanceItem {
  if (!project.creativeBrief) {
    return emptyItem("brief", "CreativeBrief", "还没有生成统一创作 Brief");
  }
  const reference = buildEvidenceReferenceSummary(project, project.creativeBrief.basedOnEvidenceIds);
  return itemFromCounts({
    id: "brief",
    label: "CreativeBrief",
    evidenceCount: reference.insights.length,
    missingCount: reference.missingEvidenceIds.length,
    sourceCounts: reference.sourceCounts,
    summary: reference.insights.length
      ? "目标人群、痛点、内容角度和视觉 mood 已绑定 evidencePack。"
      : "Brief 存在，但对应 evidencePack 证据不足。"
  });
}

function copyProvenance(project: PostProject, draft?: DraftRecord | null): CreationProvenanceItem {
  if (!draft) {
    return emptyItem("copy", "文案", "还没有可追溯文案草稿");
  }
  const report = buildEvidenceCitationReport(project, draft.draft.basedOnEvidenceIds ?? [], draft.draft.evidenceReferences);
  const fieldGaps = report.sections.filter((section) => !section.insights.length).length;
  const missingCount = report.missingEvidenceIds.length + fieldGaps;
  return itemFromCounts({
    id: "copy",
    label: "文案",
    evidenceCount: report.allEvidenceIds.length,
    missingCount,
    sourceCounts: report.sourceCounts,
    summary: `标题、正文、标签、图片方向 ${report.sections.length - fieldGaps}/${report.sections.length} 个字段可追溯。`
  });
}

function visualProvenance(project: PostProject): CreationProvenanceItem {
  const evidenceIds = [
    ...(project.visualDirection?.basedOnEvidenceIds ?? []),
    ...project.imagePrompts.flatMap((prompt) => prompt.basedOnEvidenceIds ?? [])
  ];
  if (!project.visualDirection && !project.imagePrompts.length) {
    return emptyItem("visual", "图片方向", "还没有规划图片方向或 Prompt");
  }
  const reference = buildEvidenceReferenceSummary(project, evidenceIds);
  const confirmed = project.visualDirection?.confirmationStatus === "confirmed" || Boolean(project.visualDirection?.confirmedAt);
  const missingCount = reference.missingEvidenceIds.length + (confirmed ? 0 : 1);
  return itemFromCounts({
    id: "visual",
    label: "图片方向",
    evidenceCount: reference.insights.length,
    missingCount,
    sourceCounts: reference.sourceCounts,
    summary: confirmed
      ? "图片方向已人工确认，Prompt 可继续用于生图/卡片。"
      : "图片方向还需要人工确认后再进入生图或发布。"
  });
}

function itemFromCounts(input: Omit<CreationProvenanceItem, "status">): CreationProvenanceItem {
  return {
    ...input,
    status: input.evidenceCount ? input.missingCount ? "warn" : "ready" : "empty"
  };
}

function emptyItem(id: CreationProvenanceItem["id"], label: string, summary: string): CreationProvenanceItem {
  return {
    id,
    label,
    status: "empty",
    summary,
    sourceCounts: { realtime: 0, viral_library: 0, user_input: 0 },
    evidenceCount: 0,
    missingCount: 0
  };
}

function formatSourceLine(counts: Record<EvidenceSourceType, number>): string {
  const parts = [
    counts.realtime ? `实时 ${counts.realtime}` : "",
    counts.viral_library ? `爆款库 ${counts.viral_library}` : "",
    counts.user_input ? `用户输入 ${counts.user_input}` : ""
  ].filter(Boolean);
  return parts.length ? parts.join(" / ") : "暂无来源";
}

function labelForStatus(status: CreationProvenanceItem["status"]): string {
  if (status === "ready") return "已追溯";
  if (status === "warn") return "需复核";
  return "待建立";
}
