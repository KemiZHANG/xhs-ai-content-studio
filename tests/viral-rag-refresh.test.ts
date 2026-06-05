import { describe, expect, it } from "vitest";
import { mergeViralRagPreview, type ViralRagPack } from "@/app/state/viral-rag-refresh";
import type { WorkflowResult } from "@/app/types";

const viralKnowledge = {
  query: "coffee",
  rewrittenQueries: ["coffee"],
  sufficiency: {
    isEnough: true,
    realtimeCount: 1,
    viralCount: 2,
    missing: [],
    recommendation: "ready"
  },
  strategyReport: {
    summary: "Use concrete morning scenes.",
    titleMoves: [],
    structureMoves: [],
    visualMoves: [],
    audiencePainPoints: [],
    originalityRules: [],
    recommendedAngles: [],
    evidenceIds: ["viral-1"]
  },
  insights: [
    {
      id: "insight-1",
      type: "hook",
      insight: "Open with a specific routine.",
      sourceSampleIds: ["viral-1"],
      confidence: 0.8,
      createdAt: "2026-06-05T00:00:00.000Z"
    }
  ],
  results: [
    {
      score: 0.9,
      reasons: ["matched hook"],
      case: { id: "viral-case-1" }
    }
  ]
} as unknown as ViralRagPack;

describe("viral RAG refresh state", () => {
  it("creates a lightweight research result when no workflow exists yet", () => {
    const next = mergeViralRagPreview({
      workflowResult: null,
      researchResult: null,
      viralKnowledge
    });

    expect(next.workflowResult.status).toBe("research_ready");
    expect(next.workflowResult.viralKnowledge).toBe(viralKnowledge);
    expect(next.workflowResult.researchSummary?.viralKnowledge).toBe(viralKnowledge);
    expect(next.workflowResult.steps.at(-1)?.detail).toContain("已检索 1 条爆款库样本");
    expect(next.researchResult).toEqual(next.workflowResult);
  });

  it("merges the refreshed pack without dropping an existing draft workflow result", () => {
    const draftResult = {
      status: "draft_ready",
      steps: [{ id: "draft", label: "Draft", status: "done", detail: "done" }],
      samples: [],
      evidence: [],
      researchSummary: null,
      report: "",
      draft: {
        title: "Original title",
        content: "Original content",
        tags: ["coffee"],
        structure: [],
        imagePrompt: "countertop"
      },
      images: [],
      publishResult: null
    } as WorkflowResult;

    const next = mergeViralRagPreview({
      workflowResult: draftResult,
      researchResult: null,
      viralKnowledge
    });

    expect(next.workflowResult.status).toBe("draft_ready");
    expect(next.workflowResult.draft?.title).toBe("Original title");
    expect(next.workflowResult.viralKnowledge).toBe(viralKnowledge);
    expect(next.researchResult.researchSummary?.viralKnowledge).toBe(viralKnowledge);
  });
});
