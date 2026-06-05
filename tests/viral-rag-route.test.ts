import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/viral-rag/route";
import { resetPostProject } from "@/lib/post-project/store";
import { createViralCaseFromEvidence, upsertViralCases } from "@/lib/viral-knowledge/store";
import type { ViralKnowledgePack } from "@/lib/rag/viral";
import type { SampleEvidence } from "@/lib/workflows/one-click";

let originalCwd: string;
let tempDir: string;

const sample: SampleEvidence = {
  id: "note-viral-rag-route",
  title: "Commuter bag saved checklist",
  author: "creator",
  likes: 1200,
  collects: 1800,
  comments: 96,
  shares: 42,
  score: 2600,
  url: "https://www.xiaohongshu.com/explore/note-viral-rag-route",
  imageUrls: ["https://example.com/bag.jpg"],
  cachedImageUrls: [],
  detailText: "Open with laptop capacity pain, then compare shoulder comfort, rainy commute material, and quick-access pockets.",
  commentSnippets: ["Can it fit a laptop?", "Is the strap comfortable?"],
  reasonHighlights: []
};

beforeEach(async () => {
  originalCwd = process.cwd();
  tempDir = await mkdtemp(path.join(os.tmpdir(), "xhs-viral-rag-route-"));
  process.chdir(tempDir);
  await mkdir("data", { recursive: true });
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe("viral RAG API", () => {
  it("returns a full ViralKnowledgePack using the active PostProject as defaults", async () => {
    const viralCase = await createViralCaseFromEvidence({
      sample,
      topic: "commuter bag",
      category: "product"
    });
    await upsertViralCases([viralCase]);
    await resetPostProject({
      topic: "commuter bag",
      targetAudience: "office workers",
      goal: "create a practical Xiaohongshu post",
      tone: "life-like",
      evidencePack: {
        sampleIds: ["live-note-1"],
        insights: [{
          id: "live-insight-bag",
          sourceType: "realtime",
          type: "audience",
          insight: "Office workers care about laptop fit, strap comfort, and quick access.",
          sourceSampleIds: ["live-note-1"],
          confidence: 0.83,
          createdAt: "2026-06-05T00:00:00.000Z"
        }]
      }
    });

    const response = await GET(new Request("http://localhost/api/viral-rag?limit=5"));
    const payload = await response.json() as {
      viralKnowledge: ViralKnowledgePack;
      pack: ViralKnowledgePack;
      projectContext: { query: string; topic?: string; realtimeEvidenceCount: number; defaultsApplied: Record<string, boolean> };
    };

    expect(payload.viralKnowledge.results[0].case.id).toBe(viralCase.id);
    expect(payload.pack.strategyReport.evidenceIds).toContain(viralCase.id);
    expect(payload.projectContext.query).toContain("commuter bag");
    expect(payload.projectContext.topic).toBe("commuter bag");
    expect(payload.projectContext.realtimeEvidenceCount).toBe(1);
    expect(payload.projectContext.defaultsApplied.query).toBe(true);
    expect(payload.viralKnowledge.insights.every((insight) => insight.sourceType === "viral_library")).toBe(true);
    expect(payload.viralKnowledge.evidenceTrace?.[0]?.evidenceInsightIds.length).toBeGreaterThan(0);
  });

  it("honors explicit query filters while still returning sufficiency and trace metadata", async () => {
    const viralCase = await createViralCaseFromEvidence({
      sample,
      topic: "commuter bag",
      category: "product"
    });
    await upsertViralCases([viralCase]);
    await resetPostProject({ topic: "coffee shop", targetAudience: "weekend explorers" });

    const response = await GET(new Request(
      "http://localhost/api/viral-rag?q=commuter%20bag%20laptop&topic=commuter%20bag&category=product&audience=office&painPoint=laptop&minCollects=1000&minShares=20&tag=commute&sortBy=collects&sortOrder=desc&realtimeEvidenceCount=4"
    ));
    const payload = await response.json() as {
      viralKnowledge: ViralKnowledgePack;
      projectContext: { query: string; topic?: string; realtimeEvidenceCount: number; defaultsApplied: Record<string, boolean> };
    };

    expect(payload.viralKnowledge.results.map((result) => result.case.id)).toContain(viralCase.id);
    expect(payload.viralKnowledge.filters).toMatchObject({
      category: "product",
      audience: "office",
      painPoint: "laptop",
      minCollects: 1000,
      minShares: 20,
      tags: ["commute"],
      sortBy: "collects",
      sortOrder: "desc"
    });
    expect(payload.viralKnowledge.sufficiency.realtimeCount).toBe(4);
    expect(payload.projectContext.query).toBe("commuter bag laptop");
    expect(payload.projectContext.topic).toBe("commuter bag");
    expect(payload.projectContext.defaultsApplied.query).toBe(false);
    expect(payload.projectContext.defaultsApplied.audience).toBe(false);
    expect(payload.viralKnowledge.evidenceTrace?.[0]?.matchedQueries.length).toBeGreaterThan(0);
  });
});
