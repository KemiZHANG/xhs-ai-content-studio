import type { AgentToolRegistry } from "@/lib/agent/tools/registry";
import type { AgentTrace } from "@/lib/agent/types";
import type { ViralCase, ViralSearchInput, ViralSearchResult } from "@/lib/viral-knowledge/types";

export type RetrievalQuery = {
  query: string;
  topic?: string;
  category?: string;
  audience?: string;
  painPoint?: string;
  tags?: string[];
  limit?: number;
};

export type RetrievalResult<T = unknown> = {
  item: T;
  score: number;
  reasons: string[];
};

export type Retriever<TInput = RetrievalQuery, TResult = RetrievalResult> = {
  retrieve(input: TInput): Promise<TResult[]>;
};

export type VectorStore<TItem = unknown> = {
  upsert(items: TItem[]): Promise<void>;
  search(queryEmbedding: number[], options?: { limit?: number; filters?: Record<string, unknown> }): Promise<RetrievalResult<TItem>[]>;
};

export type Reranker<TItem = unknown> = {
  rerank(query: string, results: RetrievalResult<TItem>[]): Promise<RetrievalResult<TItem>[]>;
};

export type Evaluator<TInput = unknown, TResult = unknown> = {
  evaluate(input: TInput): Promise<TResult>;
};

export type AgentRuntime = {
  toolRegistry: AgentToolRegistry;
  retrievers: Retriever<unknown, unknown>[];
  vectorStore?: VectorStore;
  reranker?: Reranker;
  evaluator?: Evaluator;
  workflowRunner?: WorkflowRunner;
  memoryProvider?: MemoryProvider;
  traceProvider: TraceProvider;
};

export type WorkflowRunner<TInput = unknown, TResult = unknown> = {
  run(input: TInput): Promise<TResult>;
};

export type MemoryProvider<TMemory = unknown> = {
  read(): Promise<TMemory>;
  write(memory: TMemory): Promise<void>;
};

export type TraceProvider = {
  append(trace: AgentTrace): Promise<void>;
};

export type ViralKnowledgeRetriever = Retriever<ViralSearchInput, ViralSearchResult>;

export type ViralKnowledgeStore = {
  list(): Promise<ViralCase[]>;
  upsert(cases: ViralCase[]): Promise<ViralCase[]>;
  search(input: ViralSearchInput): Promise<ViralSearchResult[]>;
};
