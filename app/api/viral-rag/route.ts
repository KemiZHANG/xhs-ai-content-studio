import { NextResponse } from "next/server";
import { updateWorkspaceState } from "@/lib/agent/state";
import { readPostProject } from "@/lib/post-project/store";
import { buildPostReadinessReport } from "@/lib/post-project/readiness";
import { retrieveAndApplyViralKnowledgeToPostProject } from "@/lib/post-project/viral-rag";
import { retrieveViralKnowledge, type ViralRetrievalInput } from "@/lib/rag/viral";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const project = await readPostProject();
  const url = new URL(request.url);
  const input = viralRetrievalInputFromSearchParams(url.searchParams, project);
  const viralKnowledge = await retrieveViralKnowledge(input);

  return NextResponse.json({
    viralKnowledge,
    pack: viralKnowledge,
    projectContext: {
      projectId: project.id,
      projectTopic: project.topic,
      topic: input.topic,
      query: input.query,
      realtimeEvidenceCount: input.realtimeEvidenceCount ?? 0,
      defaultsApplied: {
        query: !hasParam(url.searchParams, "q", "query"),
        topic: !hasParam(url.searchParams, "topic"),
        audience: !hasParam(url.searchParams, "audience"),
        painPoint: !hasParam(url.searchParams, "painPoint"),
        realtimeEvidenceCount: !hasParam(url.searchParams, "realtimeEvidenceCount")
      }
    },
    readiness: buildPostReadinessReport(project)
  });
}

export async function POST(request: Request) {
  const project = await readPostProject();
  const url = new URL(request.url);
  const body = await readJsonBody(request);
  const input = {
    ...viralRetrievalInputFromSearchParams(url.searchParams, project),
    ...viralRetrievalInputFromBody(body)
  };
  const result = await retrieveAndApplyViralKnowledgeToPostProject(project, input);
  await updateWorkspaceState({
    topic: result.project.topic,
    evidenceSummary: result.project.evidencePack.summary,
    selectedSamples: result.project.selectedSamples,
    lastUserIntent: "retrieve_viral_knowledge"
  });

  return NextResponse.json({
    viralKnowledge: result.viralKnowledge,
    pack: result.viralKnowledge,
    project: result.project,
    addedInsightIds: result.addedInsightIds,
    invalidatedDownstream: result.invalidatedDownstream,
    retrievalSignature: result.retrievalSignature,
    projectContext: {
      projectId: result.project.id,
      projectTopic: result.project.topic,
      topic: input.topic,
      query: input.query,
      realtimeEvidenceCount: input.realtimeEvidenceCount ?? 0,
      appliedToProject: true
    },
    readiness: buildPostReadinessReport(result.project)
  });
}

function viralRetrievalInputFromSearchParams(
  params: URLSearchParams,
  project: Awaited<ReturnType<typeof readPostProject>>
): ViralRetrievalInput {
  const query = firstParam(params, "q", "query") ?? buildProjectRetrievalQuery(project) ?? "viral-library";
  const topic = firstParam(params, "topic") ?? project.topic;
  const audience = firstParam(params, "audience") ?? project.targetAudience;
  const painPoint = firstParam(params, "painPoint") ?? project.creativeBrief?.painPoint;
  const realtimeEvidenceCountOverride = parseOptionalNumber(params.get("realtimeEvidenceCount"));
  const realtimeInsightCount = project.evidencePack.insights.filter((insight) => (insight.sourceType ?? "realtime") === "realtime").length;
  const realtimeEvidenceCount = realtimeEvidenceCountOverride ?? (realtimeInsightCount || project.selectedSamples.length);

  return {
    query,
    topic,
    category: firstParam(params, "category"),
    audience,
    painPoint,
    createdAfter: firstParam(params, "createdAfter"),
    createdBefore: firstParam(params, "createdBefore"),
    minLikes: parseOptionalNumber(params.get("minLikes")),
    minCollects: parseOptionalNumber(params.get("minCollects")),
    minComments: parseOptionalNumber(params.get("minComments")),
    minShares: parseOptionalNumber(params.get("minShares")),
    minScore: parseOptionalNumber(params.get("minScore")),
    sortBy: parseSortBy(params.get("sortBy")),
    sortOrder: parseSortOrder(params.get("sortOrder")),
    tags: parseTags(params),
    limit: parseOptionalNumber(params.get("limit")) ?? 8,
    realtimeEvidenceCount
  };
}

function buildProjectRetrievalQuery(project: Awaited<ReturnType<typeof readPostProject>>): string | undefined {
  return [
    project.topic,
    project.productInfo.name,
    project.targetAudience,
    project.goal,
    project.tone
  ].filter(Boolean).join(" ").trim() || undefined;
}

function firstParam(params: URLSearchParams, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = params.get(name)?.trim();
    if (value) return value;
  }
  return undefined;
}

function hasParam(params: URLSearchParams, ...names: string[]): boolean {
  return names.some((name) => {
    const value = params.get(name);
    return value !== null && value.trim() !== "";
  });
}

function parseOptionalNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseTags(params: URLSearchParams): string[] | undefined {
  const tags = [...params.getAll("tag"), params.get("tags") ?? ""]
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  return tags.length ? tags : undefined;
}

function parseSortBy(value: string | null): ViralRetrievalInput["sortBy"] {
  const allowed = ["createdAt", "likes", "collects", "comments", "shares", "score"] as const;
  return allowed.find((item) => item === value);
}

function parseSortOrder(value: string | null): ViralRetrievalInput["sortOrder"] {
  return value === "asc" || value === "desc" ? value : undefined;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await request.json();
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function viralRetrievalInputFromBody(body: Record<string, unknown>): Partial<ViralRetrievalInput> {
  return stripUndefined({
    query: optionalString(body.query ?? body.q),
    topic: optionalString(body.topic),
    category: optionalString(body.category),
    audience: optionalString(body.audience),
    painPoint: optionalString(body.painPoint),
    createdAfter: optionalString(body.createdAfter),
    createdBefore: optionalString(body.createdBefore),
    minLikes: optionalNumber(body.minLikes),
    minCollects: optionalNumber(body.minCollects),
    minComments: optionalNumber(body.minComments),
    minShares: optionalNumber(body.minShares),
    minScore: optionalNumber(body.minScore),
    sortBy: parseSortBy(optionalString(body.sortBy) ?? null),
    sortOrder: parseSortOrder(optionalString(body.sortOrder) ?? null),
    tags: optionalStringArray(body.tags),
    limit: optionalNumber(body.limit),
    realtimeEvidenceCount: optionalNumber(body.realtimeEvidenceCount)
  });
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item).trim()).filter(Boolean);
    return items.length ? items : undefined;
  }
  const single = optionalString(value);
  return single ? single.split(",").map((item) => item.trim()).filter(Boolean) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}
