export type ViralPlatform = "xiaohongshu";

export type ViralMetrics = {
  likes: number;
  collects: number;
  comments: number;
  shares: number;
  score: number;
};

export type ViralExtractedInsights = {
  titleHooks: string[];
  copyStructures: string[];
  tagPatterns: string[];
  visualPatterns: string[];
  audienceSignals: string[];
  painPoints: string[];
  emotionalTriggers: string[];
  commentConcerns: string[];
  reusableRules: string[];
  avoidCopying: string[];
};

export type ViralCreativeSafety = {
  summary: string;
  reusablePatterns: string[];
  doNotCopy: string[];
  transformationGuidance: string[];
};

export type ViralExtractionProvenance = {
  sourceSampleId: string;
  method: "model" | "heuristic";
  extractedAt: string;
  fallbackReason?: string;
};

export type ViralCase = {
  id: string;
  platform: ViralPlatform;
  sourceSampleId: string;
  topic: string;
  category: string;
  title: string;
  bodyExcerpt: string;
  tags: string[];
  imageStyle: string;
  hookType: string;
  contentStructure: string[];
  painPoint: string;
  audience: string;
  emotionalTrigger: string;
  metrics: ViralMetrics;
  sourceUrl: string;
  createdAt: string;
  embedding: number[];
  extractedInsights: ViralExtractedInsights;
  creativeSafety?: ViralCreativeSafety;
  extraction: ViralExtractionProvenance;
};

export type ViralCaseFilters = {
  topic?: string;
  category?: string;
  tags?: string[];
  audience?: string;
  painPoint?: string;
  createdAfter?: string;
  createdBefore?: string;
  minLikes?: number;
  minCollects?: number;
  minComments?: number;
  minShares?: number;
  minScore?: number;
  sortBy?: "createdAt" | "likes" | "collects" | "comments" | "shares" | "score";
  sortOrder?: "asc" | "desc";
};

export type ViralSearchInput = ViralCaseFilters & {
  query?: string;
  limit?: number;
};

export type ViralSearchResult = {
  case: ViralCase;
  score: number;
  reasons: string[];
  diversityKey?: string;
  angleSummary?: string;
  matchedQueries?: string[];
};
