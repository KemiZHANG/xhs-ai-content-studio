import { buildEvidencePackWithViralKnowledge } from "@/lib/agent/evidence-builder";
import { deriveCreativeBrief } from "@/lib/post-project/brief";
import { updatePostProject } from "@/lib/post-project/store";
import type { PostProject } from "@/lib/post-project/types";
import { retrieveViralKnowledge, type ViralKnowledgePack, type ViralRetrievalInput } from "@/lib/rag/viral";

export type ViralRagApplyResult = {
  project: PostProject;
  viralKnowledge: ViralKnowledgePack;
  addedInsightIds: string[];
  invalidatedDownstream: boolean;
  retrievalSignature: string;
};

export async function retrieveAndApplyViralKnowledgeToPostProject(
  project: PostProject,
  input: ViralRetrievalInput
): Promise<ViralRagApplyResult> {
  const viralKnowledge = await retrieveViralKnowledge(input);
  return applyViralKnowledgeToPostProject(project, viralKnowledge, {
    retrievalSignature: buildViralRetrievalSignature(project, input)
  });
}

export async function applyViralKnowledgeToPostProject(
  project: PostProject,
  viralKnowledge: ViralKnowledgePack,
  options: { retrievalSignature?: string } = {}
): Promise<ViralRagApplyResult> {
  const retrievalSignature = options.retrievalSignature ?? buildViralRetrievalSignature(project, {
    query: viralKnowledge.query,
    topic: project.topic,
    ...(viralKnowledge.filters ?? {})
  });
  const hasViralEvidence = project.evidencePack.insights.some((insight) => insight.sourceType === "viral_library");
  const shouldRefreshForContext = hasViralEvidence && getStoredViralRetrievalSignature(project.evidencePack.summary) !== retrievalSignature;

  if (!viralKnowledge.insights.length && !viralKnowledge.results.length) {
    const updated = await updatePostProject({
      evidencePack: {
        ...project.evidencePack,
        summary: mergeViralKnowledgeIntoSummary(project.evidencePack.summary, viralKnowledge, retrievalSignature),
        updatedAt: new Date().toISOString()
      }
    });
    return {
      project: updated,
      viralKnowledge,
      addedInsightIds: [],
      invalidatedDownstream: false,
      retrievalSignature
    };
  }

  const mergeProject = shouldRefreshForContext ? withoutViralLibraryEvidence(project) : project;
  const evidenceBuild = buildEvidencePackWithViralKnowledge(mergeProject, viralKnowledge, { retrievalSignature });
  const nextProject = {
    ...project,
    evidencePack: evidenceBuild.evidencePack
  };
  const refreshedBrief = evidenceBuild.shouldRefreshCreativeBrief
    ? deriveCreativeBrief({ ...nextProject, creativeBrief: undefined })
    : project.creativeBrief;
  const invalidatedDownstream = evidenceBuild.shouldRefreshCreativeBrief;
  const updated = await updatePostProject({
    evidencePack: nextProject.evidencePack,
    creativeBrief: refreshedBrief,
    copyDraft: invalidatedDownstream ? null : project.copyDraft,
    visualDirection: invalidatedDownstream ? undefined : project.visualDirection,
    imagePrompts: invalidatedDownstream ? [] : project.imagePrompts,
    finalPost: invalidatedDownstream ? undefined : project.finalPost,
    qualityCheck: invalidatedDownstream ? undefined : project.qualityCheck,
    publishPlan: invalidatedDownstream ? null : project.publishPlan,
    auditStatus: invalidatedDownstream ? "unchecked" : project.auditStatus,
    currentStage: refreshedBrief ? "brief_ready" : project.currentStage
  });

  return {
    project: updated,
    viralKnowledge,
    addedInsightIds: evidenceBuild.addedInsightIds,
    invalidatedDownstream,
    retrievalSignature
  };
}

export function buildViralRetrievalQuery(project: PostProject): string {
  return [
    project.topic,
    project.productInfo.name,
    project.targetAudience,
    project.goal,
    project.tone
  ].filter(Boolean).join(" ");
}

export function buildViralRetrievalSignature(project: PostProject, input: Partial<ViralRetrievalInput>): string {
  return JSON.stringify({
    query: normalizeSignatureText(input.query ?? buildViralRetrievalQuery(project)),
    topic: normalizeSignatureText(input.topic ?? project.topic ?? ""),
    filters: normalizeSignatureValue({
      category: input.category,
      audience: input.audience,
      painPoint: input.painPoint,
      createdAfter: input.createdAfter,
      createdBefore: input.createdBefore,
      minLikes: input.minLikes,
      minCollects: input.minCollects,
      minComments: input.minComments,
      minShares: input.minShares,
      minScore: input.minScore,
      tags: input.tags,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder
    })
  });
}

function getStoredViralRetrievalSignature(summary: unknown): string | null {
  const viralKnowledge = isRecord(summary) ? summary.viralKnowledge : undefined;
  return isRecord(viralKnowledge) && typeof viralKnowledge.retrievalSignature === "string"
    ? viralKnowledge.retrievalSignature
    : null;
}

function withoutViralLibraryEvidence(project: PostProject): PostProject {
  const staleViralInsights = project.evidencePack.insights.filter((insight) => insight.sourceType === "viral_library");
  const staleViralIds = new Set(staleViralInsights.map((insight) => insight.id));
  const staleViralSampleIds = new Set(staleViralInsights.flatMap((insight) => insight.sourceSampleIds));
  return {
    ...project,
    evidencePack: {
      ...project.evidencePack,
      insights: project.evidencePack.insights.filter((insight) => insight.sourceType !== "viral_library"),
      sampleIds: project.evidencePack.sampleIds.filter((id) => !staleViralSampleIds.has(id))
    },
    focusedEvidenceIds: (project.focusedEvidenceIds ?? []).filter((id) => !staleViralIds.has(id)),
    creativeBrief: project.creativeBrief
      ? {
          ...project.creativeBrief,
          basedOnEvidenceIds: project.creativeBrief.basedOnEvidenceIds.filter((id) => !staleViralIds.has(id))
        }
      : project.creativeBrief
  };
}

function mergeViralKnowledgeIntoSummary(
  summary: unknown,
  viralKnowledge: ViralKnowledgePack,
  retrievalSignature?: string
): unknown {
  return {
    ...(isRecord(summary) ? summary : {}),
    viralKnowledge: {
      ...viralKnowledge,
      ...(retrievalSignature ? { retrievalSignature } : {})
    }
  };
}

function normalizeSignatureText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeSignatureValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeSignatureValue);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => value[key] !== undefined)
        .sort()
        .map((key) => [key, normalizeSignatureValue(value[key])])
    );
  }
  return typeof value === "string" ? normalizeSignatureText(value) : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
