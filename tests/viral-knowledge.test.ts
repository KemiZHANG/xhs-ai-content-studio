import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createViralCaseFromEvidence,
  searchViralCases,
  searchViralCasesFusion,
  upsertViralCases,
  viralCasesToEvidenceInsights
} from "@/lib/viral-knowledge/store";
import type { SampleEvidence } from "@/lib/workflows/one-click";

let originalCwd: string;
let tempDir: string;

const sample: SampleEvidence = {
  id: "note-1",
  title: "广州咖啡馆避坑清单",
  author: "author",
  likes: 1200,
  collects: 980,
  comments: 88,
  shares: 22,
  score: 1680,
  url: "https://www.xiaohongshu.com/explore/note-1",
  imageUrls: ["https://example.com/a.jpg"],
  cachedImageUrls: [],
  detailText: "真实探店体验，先讲排队和人均，再给适合拍照的位置，最后提醒周末避开高峰。",
  commentSnippets: ["想知道人均", "周末人多吗"],
  reasonHighlights: []
};

beforeEach(async () => {
  originalCwd = process.cwd();
  tempDir = await mkdtemp(path.join(os.tmpdir(), "xhs-viral-"));
  process.chdir(tempDir);
  await mkdir("data", { recursive: true });
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe("viral knowledge base", () => {
  it("stores structured reusable patterns instead of only raw text", async () => {
    const viralCase = await createViralCaseFromEvidence({
      sample,
      topic: "广州咖啡馆",
      category: "探店"
    });
    await upsertViralCases([viralCase]);

    const results = await searchViralCases({ query: "广州咖啡馆 避坑 人均", topic: "广州咖啡馆", limit: 3 });

    expect(results[0].case.title).toBe(sample.title);
    expect(results[0].case.bodyExcerpt.length).toBeLessThanOrEqual(240);
    expect(results[0].case.extractedInsights.reusableRules.join(" ")).toContain("不复制原句");
    expect(results[0].score).toBeGreaterThan(0);
  });

  it("converts viral cases into source-tagged evidence insights", async () => {
    const viralCase = await createViralCaseFromEvidence({
      sample,
      topic: "广州咖啡馆",
      category: "探店"
    });
    const insights = viralCasesToEvidenceInsights([viralCase]);

    expect(insights.length).toBeGreaterThan(0);
    expect(insights.every((item) => item.sourceType === "viral_library")).toBe(true);
    expect(insights.map((item) => item.type)).toContain("hook");
    expect(insights.map((item) => item.type)).toContain("structure");
  });

  it("keeps viral evidence insight ids stable for the same reusable pattern", async () => {
    const viralCase = await createViralCaseFromEvidence({
      sample,
      topic: "广州咖啡馆",
      category: "探店"
    });
    const first = viralCasesToEvidenceInsights([viralCase]).map((insight) => insight.id);
    const second = viralCasesToEvidenceInsights([viralCase]).map((insight) => insight.id);

    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual(first);
    expect(first.every((id) => id.startsWith("viral-insight-"))).toBe(true);
  });

  it("uses multi-query fusion and preserves matched query reasons", async () => {
    const viralCase = await createViralCaseFromEvidence({
      sample,
      topic: "广州咖啡馆",
      category: "探店"
    });
    await upsertViralCases([viralCase]);

    const results = await searchViralCasesFusion({
      query: "探店账号想写真实避坑收藏帖",
      topic: "广州咖啡馆",
      category: "探店",
      limit: 5
    });

    expect(results[0].case.id).toBe(viralCase.id);
    expect(results[0].matchedQueries?.length).toBeGreaterThan(0);
    expect(results[0].reasons.join(" ")).toContain("检索 query");
  });

  it("filters by audience, pain point, created time, and interaction metrics", async () => {
    const viralCase = await createViralCaseFromEvidence({
      sample,
      topic: "广州咖啡馆",
      category: "探店"
    });
    const enriched = {
      ...viralCase,
      audience: "周末约会和探店账号粉丝",
      painPoint: "怕踩雷、不知道人均和排队情况",
      createdAt: "2026-05-20T12:00:00.000Z"
    };
    await upsertViralCases([enriched]);

    const matched = await searchViralCases({
      query: "咖啡馆 人均",
      audience: "探店账号",
      painPoint: "踩雷",
      createdAfter: "2026-05-01T00:00:00.000Z",
      createdBefore: "2026-06-01T00:00:00.000Z",
      minLikes: 1000,
      minCollects: 900,
      minComments: 50
    });
    const blocked = await searchViralCases({
      query: "咖啡馆 人均",
      audience: "探店账号",
      minCollects: 3000
    });

    expect(matched[0].case.id).toBe(enriched.id);
    expect(blocked).toEqual([]);
  });
});
