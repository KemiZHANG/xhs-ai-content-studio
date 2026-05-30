import { retrieveViralKnowledge, type ViralKnowledgePack, type ViralRetrievalInput } from "@/lib/rag/viral";
import { searchViralCasesFusion } from "@/lib/viral-knowledge/store";
import type { ViralSearchInput, ViralSearchResult } from "@/lib/viral-knowledge/types";
import type { Retriever, ViralKnowledgeRetriever } from "@/lib/rag/interfaces";

export type ViralKnowledgePackRetriever = Retriever<ViralRetrievalInput, ViralKnowledgePack>;

export function createViralKnowledgeRetriever(): ViralKnowledgeRetriever {
  return {
    retrieve(input: ViralSearchInput): Promise<ViralSearchResult[]> {
      return searchViralCasesFusion(input);
    }
  };
}

export function createViralKnowledgePackRetriever(): ViralKnowledgePackRetriever {
  return {
    async retrieve(input: ViralRetrievalInput): Promise<ViralKnowledgePack[]> {
      return [await retrieveViralKnowledge(input)];
    }
  };
}
