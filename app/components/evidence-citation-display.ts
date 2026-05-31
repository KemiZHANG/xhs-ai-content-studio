import type { EvidenceCitationReport } from "@/lib/post-project/citations";

export function formatCitationStripSummary(report: EvidenceCitationReport): string {
  const sourceParts = [
    report.sourceCounts.realtime ? `实时研究 ${report.sourceCounts.realtime}` : "",
    report.sourceCounts.viral_library ? `爆款库 ${report.sourceCounts.viral_library}` : "",
    report.sourceCounts.user_input ? `用户输入 ${report.sourceCounts.user_input}` : "",
  ].filter(Boolean);
  const fieldReady = report.sections.filter((section) => section.insights.length).length;
  const missingFields = report.sections.filter((section) => !section.insights.length).map((section) => labelForCitationField(section.field));
  const sourceText = sourceParts.length ? sourceParts.join(" · ") : "暂无来源";
  const fieldText = `字段 ${fieldReady}/${report.sections.length} 已绑定`;
  const missingText = missingFields.length ? `；缺 ${missingFields.join("、")}` : "";
  const invalidText = report.missingEvidenceIds.length ? `；${report.missingEvidenceIds.length} 个无效 ID` : "";
  return `${fieldText}；${sourceText}${missingText}${invalidText}`;
}

export function citationFieldBadges(report: EvidenceCitationReport): Array<{ label: string; status: "ok" | "warn"; count: number }> {
  return report.sections.map((section) => ({
    label: labelForCitationField(section.field),
    status: section.insights.length && !section.missingEvidenceIds.length ? "ok" : "warn",
    count: section.insights.length
  }));
}

function labelForCitationField(field: EvidenceCitationReport["sections"][number]["field"]): string {
  const labels: Record<EvidenceCitationReport["sections"][number]["field"], string> = {
    title: "标题",
    content: "正文",
    tags: "标签",
    imagePrompt: "图片方向"
  };
  return labels[field];
}
