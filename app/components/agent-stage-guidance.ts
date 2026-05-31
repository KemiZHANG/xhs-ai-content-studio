import type { AgentResponseCard } from "@/app/types";

export type StageGuidanceDisplayItem = {
  label: string;
  ready: boolean;
  detail: string;
  action?: string;
};

export type StageGuidanceDisplay = {
  progress?: number;
  primaryAction?: string;
  summary: string;
  items: StageGuidanceDisplayItem[];
};

export function extractStageGuidanceDisplay(card: AgentResponseCard): StageGuidanceDisplay | null {
  if (card.type !== "stage_guidance" || !isRecord(card.data)) {
    return null;
  }
  const readiness = isRecord(card.data.readiness) ? card.data.readiness : null;
  const rawItems = Array.isArray(readiness?.visibleItems) ? readiness.visibleItems : [];
  const items = rawItems
    .map(normalizeItem)
    .filter((item): item is StageGuidanceDisplayItem => Boolean(item))
    .slice(0, 5);
  const progress = typeof readiness?.progress === "number" && Number.isFinite(readiness.progress)
    ? Math.max(0, Math.min(100, Math.round(readiness.progress)))
    : undefined;
  const primaryAction = typeof card.data.primaryAction === "string"
    ? card.data.primaryAction
    : typeof readiness?.nextAction === "string"
      ? readiness.nextAction
      : undefined;
  const summary = typeof readiness?.summary === "string" && readiness.summary.trim()
    ? readiness.summary.trim()
    : card.summary;

  if (!items.length && progress === undefined && !primaryAction) {
    return null;
  }
  return { progress, primaryAction, summary, items };
}

function normalizeItem(value: unknown): StageGuidanceDisplayItem | null {
  if (!isRecord(value)) return null;
  const label = typeof value.label === "string" ? value.label.trim() : "";
  const detail = typeof value.detail === "string" ? value.detail.trim() : "";
  if (!label && !detail) return null;
  return {
    label: label || "下一步",
    ready: value.ready === true,
    detail,
    action: typeof value.action === "string" ? value.action : undefined
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
