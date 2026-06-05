import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/viral-rag/route";
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

  it("applies retrieved viral RAG evidence to the active PostProject through POST", async () => {
    const viralCase = await createViralCaseFromEvidence({
      sample,
      topic: "commuter bag",
      category: "product"
    });
    await upsertViralCases([viralCase]);
    await resetPostProject({
      topic: "commuter bag",
      targetAudience: "office workers",
      evidencePack: {
        sampleIds: ["live-note-1"],
        insights: [{
          id: "live-insight-bag",
          sourceType: "realtime",
          type: "audience",
          insight: "Office workers care about laptop fit and rainy commute materials.",
          sourceSampleIds: ["live-note-1"],
          confidence: 0.83,
          createdAt: "2026-06-05T00:00:00.000Z"
        }]
      },
      creativeBrief: {
        audience: "office workers",
        painPoint: "daily commute is messy",
        contentAngle: "bag checklist",
        emotionalHook: "reduce commute friction",
        proofPoints: ["laptop fit"],
        tone: "life-like",
        visualMood: "natural commute scenes",
        imageMustHave: ["bag detail"],
        imageMustAvoid: ["fake certification"],
        platformStyle: "Xiaohongshu practical review",
        tabooWords: [],
        complianceNotes: [],
        basedOnEvidenceIds: ["live-insight-bag"]
      },
      copyDraft: {
        id: "draft-stale",
        updatedAt: "2026-06-05T00:00:00.000Z",
        visibility: "仅自己可见",
        images: [],
        draft: {
          title: "Old title",
          content: "Old content",
          tags: ["commute"],
          structure: [],
          imagePrompt: "Old image prompt",
          basedOnEvidenceIds: ["live-insight-bag"]
        }
      } as never,
      visualDirection: {
        mood: "old",
        composition: "old",
        colorPalette: "old",
        mustHave: [],
        mustAvoid: [],
        basedOnEvidenceIds: ["live-insight-bag"]
      },
      imagePrompts: [{
        id: "prompt-stale",
        label: "Old prompt",
        createdAt: "2026-06-05T00:00:00.000Z",
        value: { prompt: "Old prompt" },
        basedOnEvidenceIds: ["live-insight-bag"]
      }],
      finalPost: {
        title: "Old title",
        content: "Old content",
        tags: ["commute"],
        imageIds: [],
        imagePromptVersionIds: [],
        basedOnEvidenceIds: ["live-insight-bag"]
      },
      publishPlan: { id: "publish-stale", status: "awaiting_confirmation" } as never,
      qualityCheck: {
        titleScore: 80,
        copyScore: 80,
        visualConsistencyScore: 80,
        platformFitScore: 80,
        complianceScore: 80,
        canPublish: true,
        issues: [],
        suggestions: [],
        checkedAt: "2026-06-05T00:00:00.000Z"
      }
    });

    const response = await POST(new Request("http://localhost/api/viral-rag?limit=5&category=product&audience=office&painPoint=laptop&minCollects=1000&sortBy=collects&sortOrder=desc", {
      method: "POST",
      body: JSON.stringify({ action: "refresh_project_evidence" })
    }));
    const payload = await response.json() as {
      project: Awaited<ReturnType<typeof resetPostProject>>;
      viralKnowledge: ViralKnowledgePack;
      addedInsightIds: string[];
      invalidatedDownstream: boolean;
      retrievalSignature: string;
    };

    expect(payload.viralKnowledge.results[0].case.id).toBe(viralCase.id);
    expect(payload.viralKnowledge.filters).toMatchObject({
      category: "product",
      audience: "office",
      painPoint: "laptop",
      minCollects: 1000,
      sortBy: "collects",
      sortOrder: "desc"
    });
    expect(payload.project.evidencePack.sampleIds).toContain(viralCase.id);
    expect(payload.project.evidencePack.insights.some((insight) => insight.sourceType === "viral_library")).toBe(true);
    expect(payload.addedInsightIds.length).toBeGreaterThan(0);
    expect(payload.invalidatedDownstream).toBe(true);
    expect(payload.project.copyDraft).toBeNull();
    expect(payload.project.visualDirection).toBeUndefined();
    expect(payload.project.imagePrompts).toEqual([]);
    expect(payload.project.finalPost).toBeUndefined();
    expect(payload.project.publishPlan).toBeNull();
    expect(payload.project.qualityCheck).toBeUndefined();
    expect(payload.retrievalSignature).toContain("commuter bag");
  });
});
