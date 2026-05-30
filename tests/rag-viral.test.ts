import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { retrieveViralKnowledge, rewriteRetrievalQueries } from "@/lib/rag/viral";
import { createViralCaseFromEvidence, upsertViralCases } from "@/lib/viral-knowledge/store";
import type { SampleEvidence } from "@/lib/workflows/one-click";

let originalCwd: string;
let tempDir: string;

function makeSample(overrides: Partial<SampleEvidence>): SampleEvidence {
  return {
    id: "note-default",
    title: "Quiet coffee shop guide for focused work",
    author: "creator",
    likes: 1200,
    collects: 980,
    comments: 80,
    shares: 20,
    score: 1600,
    url: "https://www.xiaohongshu.com/explore/note-default",
    imageUrls: ["https://example.com/cover.jpg"],
    cachedImageUrls: [],
    detailText: "Real visit notes with table spacing, noise level, power outlets, price, and weekend crowd reminders.",
    commentSnippets: ["Is it crowded on weekends?", "What is the average price?"],
    reasonHighlights: [],
    ...overrides
  };
}

beforeEach(async () => {
  originalCwd = process.cwd();
  tempDir = await mkdtemp(path.join(os.tmpdir(), "xhs-rag-viral-"));
  process.chdir(tempDir);
  await mkdir("data", { recursive: true });
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe("viral RAG retrieval", () => {
  it("expands a user need into multiple retrieval queries", () => {
    const queries = rewriteRetrievalQueries({
      query: "quiet Guangzhou cafe for study account",
      topic: "Guangzhou coffee shops",
      category: "local guide",
      audience: "study and work creators",
      painPoint: "hard to judge noise and seats"
    });

    expect(queries.length).toBeGreaterThan(3);
    expect(queries[0]).toContain("Guangzhou coffee shops");
    expect(queries.some((query) => query.includes("study and work creators"))).toBe(true);
  });

  it("runs multi-query fusion and returns source-tagged reusable insights", async () => {
    const focusedCafe = await createViralCaseFromEvidence({
      sample: makeSample({
        id: "note-focused-cafe",
        title: "Quiet Guangzhou cafe guide for laptop work",
        detailText: "Start with who it is for, then compare noise, seats, power outlets, price, and best arrival time.",
        url: "https://www.xiaohongshu.com/explore/note-focused-cafe"
      }),
      topic: "Guangzhou coffee shops",
      category: "local guide"
    });
    const visualCafe = await createViralCaseFromEvidence({
      sample: makeSample({
        id: "note-visual-cafe",
        title: "Window light cafe photo route",
        detailText: "Cover image uses window light, table texture, drink close-up, and a simple checklist style body.",
        likes: 900,
        collects: 760,
        comments: 42,
        score: 1260,
        url: "https://www.xiaohongshu.com/explore/note-visual-cafe"
      }),
      topic: "Guangzhou coffee shops",
      category: "local guide"
    });
    await upsertViralCases([focusedCafe, visualCafe]);

    const pack = await retrieveViralKnowledge({
      query: "find reusable patterns for quiet Guangzhou coffee shop posts",
      topic: "Guangzhou coffee shops",
      category: "local guide",
      audience: "study and work creators",
      painPoint: "hard to judge noise and seats",
      realtimeEvidenceCount: 4,
      limit: 5
    });

    expect(pack.rewrittenQueries.length).toBeGreaterThan(3);
    expect(pack.results.map((result) => result.case.id)).toContain(focusedCafe.id);
    expect(pack.results[0].matchedQueries?.length).toBeGreaterThan(0);
    expect(pack.results[0].reasons.join(" ")).toContain("RAG-Fusion query");
    expect(pack.insights.length).toBeGreaterThan(0);
    expect(pack.insights.every((insight) => insight.sourceType === "viral_library")).toBe(true);
    expect(pack.sufficiency.realtimeCount).toBe(4);
    expect(pack.sufficiency.viralCount).toBe(pack.results.length);
  });
});
