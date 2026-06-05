import type { AgentResponseCard } from "@/app/types";

export type AgentCreationProvenanceItem = {
  id: string;
  label: string;
  status: "ready" | "warn" | "empty";
  summary: string;
  evidenceCount: number;
  missingCount: number;
  weakViralEvidenceCount: number;
  sourceLine: string;
};

export type AgentCreationProvenanceDisplay = {
  headline: string;
  detail: string;
  items: AgentCreationProvenanceItem[];
};

export function extractAgentCreationProvenanceDisplay(card: AgentResponseCard): AgentCreationProvenanceDisplay | null {
  if (card.type !== "creation_provenance" || !isRecord(card.data)) {
    return null;
  }

  const items = Array.isArray(card.data.items)
    ? card.data.items.map(normalizeItem).filter((item): item is AgentCreationProvenanceItem => Boolean(item))
    : [];
  if (!items.length) {
    return null;
  }

  return {
    headline: typeof card.data.headline === "string" ? card.data.headline : card.title,
    detail: typeof card.data.detail === "string" ? card.data.detail : card.summary,
    items
  };
}

function normalizeItem(value: unknown): AgentCreationProvenanceItem | null {
  if (!isRecord(value)) return null;
  const label = typeof value.label === "string" ? value.label : "";
  const summary = typeof value.summary === "string" ? value.summary : "";
  if (!label || !summary) return null;

  const status = value.status === "ready" || value.status === "warn" || value.status === "empty"
    ? value.status
    : "empty";
  const weakViralEvidenceCount = safeNumber(value.weakViralEvidenceCount);
  return {
    id: typeof value.id === "string" ? value.id : label,
    label,
    status,
    summary,
    evidenceCount: safeNumber(value.evidenceCount),
    missingCount: safeNumber(value.missingCount),
    weakViralEvidenceCount,
    sourceLine: formatSourceCounts(value.sourceCounts, weakViralEvidenceCount)
  };
}

function formatSourceCounts(value: unknown, weakViralEvidenceCount = 0): string {
  if (!isRecord(value)) return "暂无来源";
  const realtime = safeNumber(value.realtime);
  const viral = safeNumber(value.viral_library);
  const userInput = safeNumber(value.user_input);
  const parts = [
    realtime ? `实时 ${realtime}` : "",
    viral ? `爆款库 ${viral}${weakViralEvidenceCount ? `（弱参考 ${weakViralEvidenceCount}）` : ""}` : "",
    userInput ? `用户输入 ${userInput}` : ""
  ].filter(Boolean);
  return parts.length ? parts.join(" / ") : "暂无来源";
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
