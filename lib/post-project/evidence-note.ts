import type { EvidenceInsight, EvidenceSourceType } from "@/lib/post-project/types";

const SOURCE_ORDER: EvidenceSourceType[] = ["realtime", "viral_library", "user_input"];

export function buildEvidenceReferenceNote(insights: EvidenceInsight[], maxItems = 5): string {
  const selected = selectEvidenceReferenceInsights(insights, maxItems);
  if (!selected.length) {
    return "证据状态：当前 PostProject 没有可追溯 evidencePack 结论；以上只能作为临时创作建议，不能当作小红书研究结论或发布依据。请先搜索真实笔记、保存爆款库样本，或补充用户输入证据。";
  }

  const counts = countEvidenceSources(insights);
  const sourceLine = [
    counts.realtime ? `实时研究 ${counts.realtime}` : "",
    counts.viral_library ? `爆款库 ${counts.viral_library}` : "",
    counts.user_input ? `用户输入 ${counts.user_input}` : ""
  ].filter(Boolean).join(" / ");
  const lines = selected.map((insight) =>
    `- ${insight.id}｜${labelForEvidenceSource(insight.sourceType)}｜${insight.type}: ${insight.insight}`
  );
  return [`证据构成：${sourceLine || "暂无"}`, "参考证据：", ...lines].join("\n");
}

export function selectEvidenceReferenceInsights(insights: EvidenceInsight[], maxItems = 5): EvidenceInsight[] {
  const cleaned = insights
    .filter((insight) => insight.insight.trim())
    .sort((left, right) => (right.confidence ?? 0) - (left.confidence ?? 0));
  const selected: EvidenceInsight[] = [];
  const usedIds = new Set<string>();

  for (const source of SOURCE_ORDER) {
    const next = cleaned.find((insight) => normalizeEvidenceSource(insight.sourceType) === source && !usedIds.has(insight.id));
    if (next) pushInsight(selected, usedIds, next, maxItems);
  }

  const usedTypes = new Set(selected.map((insight) => insight.type));
  for (const insight of cleaned) {
    if (selected.length >= maxItems) break;
    if (usedIds.has(insight.id) || usedTypes.has(insight.type)) continue;
    pushInsight(selected, usedIds, insight, maxItems);
    usedTypes.add(insight.type);
  }

  for (const insight of cleaned) {
    if (selected.length >= maxItems) break;
    pushInsight(selected, usedIds, insight, maxItems);
  }

  return selected;
}

function pushInsight(selected: EvidenceInsight[], usedIds: Set<string>, insight: EvidenceInsight, maxItems: number) {
  if (selected.length >= maxItems || usedIds.has(insight.id)) return;
  selected.push(insight);
  usedIds.add(insight.id);
}

function countEvidenceSources(insights: EvidenceInsight[]): Record<EvidenceSourceType, number> {
  return insights.reduce<Record<EvidenceSourceType, number>>(
    (counts, insight) => {
      counts[normalizeEvidenceSource(insight.sourceType)] += 1;
      return counts;
    },
    { realtime: 0, viral_library: 0, user_input: 0 }
  );
}

function normalizeEvidenceSource(sourceType?: EvidenceSourceType): EvidenceSourceType {
  return sourceType ?? "realtime";
}

export function labelForEvidenceSource(sourceType?: EvidenceSourceType): string {
  if (sourceType === "viral_library") return "爆款库";
  if (sourceType === "user_input") return "用户输入";
  return "实时研究";
}
