import { describe, expect, it, vi } from "vitest";
import { createDefaultAgentRuntime } from "@/lib/rag/runtime";
import type { AgentTrace } from "@/lib/agent/types";

describe("agent runtime adapter", () => {
  it("assembles replaceable runtime providers without coupling them to UI", async () => {
    const append = vi.fn(async (_trace: AgentTrace) => undefined);
    const runtime = createDefaultAgentRuntime({
      traceProvider: { append }
    });

    expect(runtime.toolRegistry.get("knowledge.retrieveViralPatterns")).toBeTruthy();
    expect(runtime.retrievers.length).toBeGreaterThanOrEqual(2);
    expect(runtime.vectorStore).toBeUndefined();

    await runtime.traceProvider.append({ runId: "agent-run-test", events: [] });
    expect(append).toHaveBeenCalledWith({ runId: "agent-run-test", events: [] });
  });

  it("allows future vector stores and rerankers to be swapped in", () => {
    const vectorStore = {
      upsert: vi.fn(async () => undefined),
      search: vi.fn(async () => [])
    };
    const reranker = {
      rerank: vi.fn(async (_query: string, results: []) => results)
    };
    const runtime = createDefaultAgentRuntime({ vectorStore, reranker });

    expect(runtime.vectorStore).toBe(vectorStore);
    expect(runtime.reranker).toBe(reranker);
  });
});
