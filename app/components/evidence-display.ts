import type { SampleEvidence } from "@/app/types";

export function scoreEvidence(sample: SampleEvidence): number {
  return (Number(sample.collects) || 0) * 3 + (Number(sample.likes) || 0) + (Number(sample.comments) || 0) * 2;
}

export function pickEvidenceHighlights(samples: SampleEvidence[], limit = 3): SampleEvidence[] {
  return [...samples].sort((left, right) => scoreEvidence(right) - scoreEvidence(left)).slice(0, Math.max(0, limit));
}

export function summarizeEvidenceSample(sample: SampleEvidence, maxLength = 120): string {
  const source =
    sample.reasonHighlights.find(Boolean) ??
    buildMetricSummary(sample) ??
    sample.detailText ??
    "暂无正文，仍可参考互动数据和图片风格。";

  return truncateEvidenceText(source, maxLength);
}

export function truncateEvidenceText(value: string, maxLength = 120): string {
  const clean = value.replace(/\s+/g, " ").trim();

  if (clean.length <= maxLength) {
    return clean;
  }

  return `${clean.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function buildMetricSummary(sample: SampleEvidence): string | undefined {
  const signals = [
    sample.collects ? `收藏 ${sample.collects}` : "",
    sample.likes ? `点赞 ${sample.likes}` : "",
    sample.comments ? `评论 ${sample.comments}` : "",
  ].filter(Boolean);

  if (!signals.length) {
    return undefined;
  }

  return `互动表现：${signals.join(" · ")}。点击详情查看正文、评论和图片。`;
}
