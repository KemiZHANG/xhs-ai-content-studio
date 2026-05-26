import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AgentPlan } from "@/lib/agent/types";
import type { AgentRun, AgentTrace, AgentTraceEvent, AgentTraceEventType } from "@/lib/agent/types";

const tracesPath = () => path.join(process.cwd(), "data", "agent-traces.json");

export function createAgentRun({
  message,
  conversationId,
  plan
}: {
  message: string;
  conversationId?: string | null;
  plan: AgentPlan;
}): AgentRun {
  const now = new Date().toISOString();
  return {
    id: `agent-run-${Date.now()}-${randomUUID().slice(0, 8)}`,
    conversationId,
    status: "running",
    message,
    plan,
    createdAt: now,
    updatedAt: now
  };
}

export function createTrace(runId: string): AgentTrace {
  return { runId, events: [] };
}

export function addTraceEvent(
  trace: AgentTrace,
  event: {
    type: AgentTraceEventType;
    label: string;
    detail: string;
    metadata?: Record<string, unknown>;
  }
): AgentTrace {
  const nextEvent: AgentTraceEvent = {
    id: `event-${randomUUID()}`,
    runId: trace.runId,
    type: event.type,
    label: event.label,
    detail: event.detail,
    metadata: event.metadata,
    createdAt: new Date().toISOString()
  };
  return {
    ...trace,
    events: [...trace.events, nextEvent]
  };
}

export async function persistAgentTrace(trace: AgentTrace): Promise<void> {
  const traces = await readAgentTraces();
  const next = [trace, ...traces.filter((item) => item.runId !== trace.runId)].slice(0, 200);
  const filePath = tracesPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

export async function readAgentTraces(): Promise<AgentTrace[]> {
  try {
    const raw = await readFile(tracesPath(), "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as AgentTrace[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
