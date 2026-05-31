import type { AgentResponseCard } from "@/app/types";

export type AgentDirectorSummaryDisplay = {
  stageTitle: string;
  stageDescription: string;
  why: string;
  nextAction?: string;
  nextActionLabel: string;
  progress?: number;
  blockerCount: number;
  evidenceCount: number;
  memoryHints: string[];
  memorySignalCount: number;
  hasDraft: boolean;
  needsUserInput: boolean;
};

export function extractAgentDirectorSummaryDisplay(card: AgentResponseCard): AgentDirectorSummaryDisplay | null {
  if (card.type !== "director_summary" || !isRecord(card.data)) {
    return null;
  }

  const stageTitle = stringValue(card.data.stageTitle) || card.title;
  const stageDescription = stringValue(card.data.stageDescription) || card.summary;
  const why = stringValue(card.data.why) || "Agent 会先读取当前 PostProject，再决定执行、追问或生成下一步计划。";
  const progress = numberValue(card.data.progress);

  return {
    stageTitle,
    stageDescription,
    why,
    nextAction: stringValue(card.data.nextAction),
    nextActionLabel: stringValue(card.data.nextActionLabel) || "继续下一步",
    progress: progress === undefined ? undefined : Math.max(0, Math.min(100, Math.round(progress))),
    blockerCount: Math.max(0, Math.round(numberValue(card.data.blockerCount) ?? 0)),
    evidenceCount: Math.max(0, Math.round(numberValue(card.data.evidenceCount) ?? 0)),
    memoryHints: stringArray(card.data.memoryHints).slice(0, 3),
    memorySignalCount: Math.max(0, Math.round(numberValue(card.data.memorySignalCount) ?? 0)),
    hasDraft: card.data.hasDraft === true,
    needsUserInput: card.data.needsUserInput === true
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
