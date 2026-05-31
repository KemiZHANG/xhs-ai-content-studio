import { createAgentToolRegistry } from "@/lib/agent/tools/registry";
import { persistAgentTrace } from "@/lib/agent/trace";
import { createViralKnowledgePackRetriever, createViralKnowledgeRetriever } from "@/lib/rag/retrievers";
import type { AgentRuntime } from "@/lib/rag/interfaces";

export function createDefaultAgentRuntime(overrides: Partial<AgentRuntime> = {}): AgentRuntime {
  return {
    toolRegistry: overrides.toolRegistry ?? createAgentToolRegistry(),
    retrievers: overrides.retrievers ?? [
      createViralKnowledgeRetriever(),
      createViralKnowledgePackRetriever()
    ],
    vectorStore: overrides.vectorStore,
    reranker: overrides.reranker,
    evaluator: overrides.evaluator,
    workflowRunner: overrides.workflowRunner,
    memoryProvider: overrides.memoryProvider,
    traceProvider: overrides.traceProvider ?? {
      append: persistAgentTrace
    }
  };
}

