import type { ResearchSummary, WorkflowResult } from "@/app/types";

export type ViralRagPack = NonNullable<WorkflowResult["viralKnowledge"]>;

export function mergeViralRagPreview({
  workflowResult,
  researchResult,
  viralKnowledge
}: {
  workflowResult: WorkflowResult | null;
  researchResult: WorkflowResult | null;
  viralKnowledge: ViralRagPack;
}): {
  workflowResult: WorkflowResult;
  researchResult: WorkflowResult;
} {
  const fallback = researchResult ?? workflowResult ?? createViralRagResult(viralKnowledge);
  return {
    workflowResult: mergeIntoWorkflowResult(workflowResult ?? fallback, viralKnowledge),
    researchResult: mergeIntoWorkflowResult(researchResult ?? fallback, viralKnowledge)
  };
}

function createViralRagResult(viralKnowledge: ViralRagPack): WorkflowResult {
  return {
    status: "research_ready",
    steps: [buildViralRagStep(viralKnowledge)],
    samples: [],
    evidence: [],
    researchSummary: buildResearchSummary(null, viralKnowledge),
    report: viralKnowledge.strategyReport.summary,
    imageStyleReport: "",
    draft: null,
    images: [],
    publishResult: null,
    viralKnowledge
  };
}

function mergeIntoWorkflowResult(result: WorkflowResult, viralKnowledge: ViralRagPack): WorkflowResult {
  return {
    ...result,
    steps: upsertViralRagStep(result.steps ?? [], viralKnowledge),
    researchSummary: buildResearchSummary(result.researchSummary ?? null, viralKnowledge),
    viralKnowledge
  };
}

function buildResearchSummary(current: ResearchSummary | null, viralKnowledge: ViralRagPack): ResearchSummary {
  return {
    contentStrengths: current?.contentStrengths ?? [],
    imageStrengths: current?.imageStrengths ?? [],
    learningsForContent: current?.learningsForContent ?? [],
    learningsForImages: current?.learningsForImages ?? [],
    nextQuestions: current?.nextQuestions ?? [],
    structureInsights: current?.structureInsights,
    hookInsights: current?.hookInsights,
    viralKnowledge
  };
}

function upsertViralRagStep(steps: WorkflowResult["steps"], viralKnowledge: ViralRagPack) {
  const nextStep = buildViralRagStep(viralKnowledge);
  const existingIndex = steps.findIndex((step) => step.id === nextStep.id);
  if (existingIndex < 0) {
    return [...steps, nextStep];
  }
  return steps.map((step, index) => (index === existingIndex ? nextStep : step));
}

function buildViralRagStep(viralKnowledge: ViralRagPack) {
  return {
    id: "viral-rag-preview",
    label: "爆款库 RAG",
    status: "done" as const,
    detail: `已检索 ${viralKnowledge.results.length} 条爆款库样本，生成 ${viralKnowledge.insights.length} 条可复用规律。`
  };
}
