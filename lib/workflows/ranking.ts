export type RankableFeed = {
  id: string;
  title: string;
  likes?: number;
  collects?: number;
  comments?: number;
  shares?: number;
  xsecToken?: string;
  author?: string;
  url?: string;
  imageUrls?: string[];
  raw?: unknown;
};

export type RankedFeed = RankableFeed & {
  score: number;
};

function safeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return 0;
  }

  const multiplier = normalized.includes("万") || normalized.includes("w") ? 10000 : 1;
  const numeric = Number.parseFloat(normalized.replace(/[^\d.]/g, ""));

  return Number.isFinite(numeric) ? Math.round(numeric * multiplier) : 0;
}

export function engagementScore(feed: RankableFeed): number {
  return (
    safeNumber(feed.likes) +
    safeNumber(feed.collects) * 3 +
    safeNumber(feed.comments) * 2 +
    safeNumber(feed.shares) * 1.5
  );
}

export function rankFeeds(feeds: RankableFeed[]): RankedFeed[] {
  return feeds
    .map((feed) => ({
      ...feed,
      score: engagementScore(feed)
    }))
    .sort((left, right) => right.score - left.score);
}

export function toNumber(value: unknown): number {
  return safeNumber(value);
}
