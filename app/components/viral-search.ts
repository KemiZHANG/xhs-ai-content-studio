export type ViralLibrarySearchFilters = {
  query?: string;
  category?: string;
  tags?: string;
  audience?: string;
  painPoint?: string;
  createdAfter?: string;
  createdBefore?: string;
  minLikes?: string;
  minCollects?: string;
  minComments?: string;
  minShares?: string;
  minScore?: string;
  sortBy?: "createdAt" | "likes" | "collects" | "comments" | "shares" | "score";
  sortOrder?: "asc" | "desc";
};

export function buildViralKnowledgeSearchParams(filters: ViralLibrarySearchFilters = {}, limit = 12): URLSearchParams {
  const params = new URLSearchParams({ limit: String(limit) });
  setTrimmed(params, "q", filters.query);
  setTrimmed(params, "category", filters.category);
  setTrimmed(params, "tags", filters.tags);
  setTrimmed(params, "audience", filters.audience);
  setTrimmed(params, "painPoint", filters.painPoint);
  setDateFilter(params, "createdAfter", filters.createdAfter);
  setDateFilter(params, "createdBefore", filters.createdBefore);
  setNumberFilter(params, "minLikes", filters.minLikes);
  setNumberFilter(params, "minCollects", filters.minCollects);
  setNumberFilter(params, "minComments", filters.minComments);
  setNumberFilter(params, "minShares", filters.minShares);
  setNumberFilter(params, "minScore", filters.minScore);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);
  return params;
}

function setTrimmed(params: URLSearchParams, key: string, value?: string) {
  const trimmed = value?.trim();
  if (trimmed) params.set(key, trimmed);
}

function setDateFilter(params: URLSearchParams, key: string, value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return;
  params.set(key, /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00.000Z` : trimmed);
}

function setNumberFilter(params: URLSearchParams, key: string, value?: string) {
  const trimmed = value?.trim();
  if (trimmed && Number.isFinite(Number(trimmed))) {
    params.set(key, trimmed);
  }
}
