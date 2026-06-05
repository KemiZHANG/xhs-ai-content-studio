import { NextResponse } from "next/server";
import { readPostProject } from "@/lib/post-project/store";
import { buildPostReadinessReport } from "@/lib/post-project/readiness";
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
