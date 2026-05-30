import { NextResponse } from "next/server";
import { createModelProvider } from "@/lib/models/provider";
import { addViralCasesToPostProject } from "@/lib/post-project/store";
import { requireLocalActionToken } from "@/lib/security/action-token";
import { readSettings } from "@/lib/storage/settings";
import { createViralCaseFromEvidence, listViralCases, searchViralCasesFusion, upsertViralCases } from "@/lib/viral-knowledge/store";
import type { ViralCaseFilters } from "@/lib/viral-knowledge/types";
import type { SampleEvidence } from "@/lib/workflows/one-click";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? undefined;
  const topic = url.searchParams.get("topic") ?? undefined;
  const category = url.searchParams.get("category") ?? undefined;
  const audience = url.searchParams.get("audience") ?? undefined;
  const painPoint = url.searchParams.get("painPoint") ?? undefined;
  const createdAfter = url.searchParams.get("createdAfter") ?? undefined;
  const createdBefore = url.searchParams.get("createdBefore") ?? undefined;
  const minLikes = parseOptionalNumber(url.searchParams.get("minLikes"));
  const minCollects = parseOptionalNumber(url.searchParams.get("minCollects"));
  const minComments = parseOptionalNumber(url.searchParams.get("minComments"));
  const minShares = parseOptionalNumber(url.searchParams.get("minShares"));
  const minScore = parseOptionalNumber(url.searchParams.get("minScore"));
  const sortBy = parseSortBy(url.searchParams.get("sortBy"));
  const sortOrder = parseSortOrder(url.searchParams.get("sortOrder"));
  const tags = parseTags(url.searchParams);
  const limit = Number(url.searchParams.get("limit") ?? 8);

  const filters = {
    query,
    topic,
    category,
    audience,
    painPoint,
    createdAfter,
    createdBefore,
    minLikes,
    minCollects,
    minComments,
    minShares,
    minScore,
    sortBy,
    sortOrder,
    tags,
    limit
  };

  if (query || topic || category || audience || painPoint || createdAfter || createdBefore || minLikes !== undefined || minCollects !== undefined || minComments !== undefined || minShares !== undefined || minScore !== undefined || tags.length) {
    const results = await searchViralCasesFusion({
      ...filters,
      tags: tags.length ? tags : undefined
    });
    return NextResponse.json({ results, cases: results.map((item) => item.case) });
  }

  const cases = await listViralCases(filters);
  return NextResponse.json({ cases: cases.slice(0, limit || 20) });
}

export async function POST(request: Request) {
  try {
    const authError = await requireLocalActionToken(request);
    if (authError) return authError;

    const body = (await request.json()) as {
      sample?: SampleEvidence;
      topic?: string;
      category?: string;
      useModel?: boolean;
    };
    if (!body.sample?.id || !body.sample.title) {
      return NextResponse.json({ error: "缺少可入库的研究样本" }, { status: 400 });
    }

    const settings = await readSettings();
    const model = body.useModel === false || !settings.textApiKey.trim() ? undefined : createModelProvider(settings);
    const viralCase = await createViralCaseFromEvidence({
      sample: body.sample,
      topic: body.topic || "未分类主题",
      category: body.category || "小红书图文",
      model
    });
    const [saved] = await upsertViralCases([viralCase]);
    const project = await addViralCasesToPostProject([saved]);
    return NextResponse.json({ case: saved, project });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存爆款库失败" },
      { status: 500 }
    );
  }
}

function parseOptionalNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseTags(params: URLSearchParams): string[] {
  return [...params.getAll("tag"), params.get("tags") ?? ""]
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseSortBy(value: string | null): ViralCaseFilters["sortBy"] {
  const allowed = ["createdAt", "likes", "collects", "comments", "shares", "score"] as const;
  return allowed.find((item) => item === value);
}

function parseSortOrder(value: string | null): ViralCaseFilters["sortOrder"] {
  return value === "asc" || value === "desc" ? value : undefined;
}
