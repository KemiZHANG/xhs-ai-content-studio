import type { SampleEvidence } from "@/app/types";

export function scoreEvidence(sample: SampleEvidence): number {
  return (Number(sample.collects) || 0) * 3 + (Number(sample.likes) || 0) + (Number(sample.comments) || 0) * 2;
}

export function pickEvidenceHighlights(samples: SampleEvidence[], limit = 3): SampleEvidence[] {
  return [...samples].sort((left, right) => scoreEvidence(right) - scoreEvidence(left)).slice(0, Math.max(0, limit));
}

export type EvidencePanelModel = {
  visibleSamples: SampleEvidence[];
  hiddenCount: number;
  totalCount: number;
  visibleCount: number;
  inlineTitle: string;
  summary: string;
  detailHint: string;
  compressionLine: string;
  primaryActionLabel: string;
  stats: Array<{
    label: string;
    value: string;
  }>;
};

export function buildEvidencePanelModel(samples: SampleEvidence[], visibleLimit = 3): EvidencePanelModel {
  const displayLimit = Math.min(5, Math.max(0, visibleLimit));
  const visibleSamples = pickEvidenceHighlights(samples, displayLimit);
  const hiddenCount = Math.max(0, samples.length - visibleSamples.length);
  const topScore = visibleSamples[0] ? scoreEvidence(visibleSamples[0]) : 0;
  return {
    visibleSamples,
    hiddenCount,
    totalCount: samples.length,
    visibleCount: visibleSamples.length,
    inlineTitle: samples.length
      ? `高价值摘要 ${visibleSamples.length}/${samples.length}`
      : "等待研究证据",
    summary: samples.length
      ? `已压缩展示 ${visibleSamples.length} 条高价值摘要，完整 ${samples.length} 条样本保留在证据详情。`
      : "研究完成后这里只显示 3 条高价值摘要，完整笔记、评论和图片会放入证据详情。",
    detailHint: hiddenCount
      ? `还有 ${hiddenCount} 条样本已折叠，点击查看全部证据。`
      : topScore
        ? "当前样本较少，仍可打开详情查看正文、评论和图片。"
        : "暂无可排序样本，先搜索真实笔记。",
    compressionLine: samples.length
      ? `主面板最多保留 ${displayLimit} 条高价值摘要；原文、评论、完整图片和低优先级样本都放进证据详情。`
      : `研究完成后主面板最多保留 ${displayLimit} 条摘要，避免一开始就铺满原始笔记。`,
    primaryActionLabel: samples.length
      ? `打开完整证据目录`
      : "开始主题研究",
    stats: [
      { label: "摘要", value: `${visibleSamples.length}` },
      { label: "全部", value: `${samples.length}` },
      { label: "折叠", value: `${hiddenCount}` }
    ]
  };
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
