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

export function buildViralKnowledgeFilterSummary(filters: ViralLibrarySearchFilters = {}): string[] {
  const items = [
    trimmed(filters.query) ? `关键词：${trimmed(filters.query)}` : "",
    trimmed(filters.category) ? `类目：${trimmed(filters.category)}` : "",
    trimmed(filters.tags) ? `标签：${trimmed(filters.tags)}` : "",
    trimmed(filters.audience) ? `人群：${trimmed(filters.audience)}` : "",
    trimmed(filters.painPoint) ? `痛点：${trimmed(filters.painPoint)}` : "",
    normalizedDate(filters.createdAfter) ? `入库 ≥ ${normalizedDate(filters.createdAfter)?.slice(0, 10)}` : "",
    normalizedDate(filters.createdBefore) ? `入库 ≤ ${normalizedDate(filters.createdBefore)?.slice(0, 10)}` : "",
    validNumber(filters.minLikes) ? `点赞 ≥ ${trimmed(filters.minLikes)}` : "",
    validNumber(filters.minCollects) ? `收藏 ≥ ${trimmed(filters.minCollects)}` : "",
    validNumber(filters.minComments) ? `评论 ≥ ${trimmed(filters.minComments)}` : "",
    validNumber(filters.minShares) ? `分享 ≥ ${trimmed(filters.minShares)}` : "",
    validNumber(filters.minScore) ? `综合分 ≥ ${trimmed(filters.minScore)}` : "",
    filters.sortBy ? `排序：${labelForViralSort(filters.sortBy)}${filters.sortOrder === "asc" ? "升序" : "降序"}` : ""
  ].filter(Boolean);
  return items;
}

function setTrimmed(params: URLSearchParams, key: string, value?: string) {
  const clean = trimmed(value);
  if (clean) params.set(key, clean);
}

function setDateFilter(params: URLSearchParams, key: string, value?: string) {
  const clean = normalizedDate(value);
  if (clean) params.set(key, clean);
}

function setNumberFilter(params: URLSearchParams, key: string, value?: string) {
  const clean = trimmed(value);
  if (validNumber(value) && clean) {
    params.set(key, clean);
  }
}

function trimmed(value?: string): string {
  return value?.trim() ?? "";
}

function normalizedDate(value?: string): string {
  const clean = trimmed(value);
  if (!clean) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? `${clean}T00:00:00.000Z` : clean;
}

function validNumber(value?: string): boolean {
  const clean = trimmed(value);
  return Boolean(clean) && Number.isFinite(Number(clean));
}

function labelForViralSort(sortBy: NonNullable<ViralLibrarySearchFilters["sortBy"]>): string {
  const labels = {
    createdAt: "入库时间",
    likes: "点赞",
    collects: "收藏",
    comments: "评论",
    shares: "分享",
    score: "综合分"
  };
  return labels[sortBy];
}
