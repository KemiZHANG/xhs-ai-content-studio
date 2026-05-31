import type { AgentResponseCard } from "@/app/types";

const priority: AgentResponseCard["type"][] = [
  "director_summary",
  "quality_check",
  "publish_check",
  "copy_draft",
  "creation_provenance",
  "creative_brief",
  "visual_direction",
  "image_prompt",
  "evidence_citations",
  "viral_knowledge",
  "evidence_summary",
  "stage_guidance"
];

export function pickVisibleAgentCards(cards: AgentResponseCard[], limit = 4): AgentResponseCard[] {
  const sorted = [...cards].sort((left, right) => {
    const leftRank = priority.indexOf(left.type);
    const rightRank = priority.indexOf(right.type);
    return (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank);
  });
  const selected: AgentResponseCard[] = [];
  const usedTypes = new Set<string>();
  for (const card of sorted) {
    if (selected.length >= limit) break;
    if (usedTypes.has(card.type)) continue;
    selected.push(card);
    usedTypes.add(card.type);
  }
  if (selected.length < limit) {
    const selectedIds = new Set(selected.map((card) => card.id));
    for (const card of sorted) {
      if (selected.length >= limit) break;
      if (selectedIds.has(card.id)) continue;
      selected.push(card);
      selectedIds.add(card.id);
    }
  }
  return selected.length ? selected : cards.slice(0, limit);
}

export function isHighPriorityAgentCard(type: AgentResponseCard["type"]): boolean {
  return type === "director_summary" || type === "quality_check" || type === "publish_check" || type === "copy_draft" || type === "creation_provenance" || type === "creative_brief";
}
