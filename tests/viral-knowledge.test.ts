import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/viral-knowledge/route";
import { ACTION_TOKEN_HEADER, getLocalActionToken } from "@/lib/security/action-token";
import {
  createViralCaseFromEvidence,
  listViralCases,
  reviewViralSaveCandidate,
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
  title: "Guangzhou coffee shop honest guide",
  author: "author",
  likes: 1200,
  collects: 980,
  comments: 88,
  shares: 22,
  score: 1680,
  url: "https://www.xiaohongshu.com/explore/note-1",
  imageUrls: ["https://example.com/a.jpg"],
  cachedImageUrls: [],
  detailText: "A real cafe visit note: opening with queue time and average spend, then photo spots, taste notes, and weekend crowd warnings.",
  commentSnippets: ["What is the average spend?", "Is it crowded on weekends?"],
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
  it("stores structured reusable patterns and originality guidance", async () => {
    const viralCase = await createViralCaseFromEvidence({
      sample,
      topic: "Guangzhou coffee",
      category: "Cafe review"
    });
    await upsertViralCases([viralCase]);

    const results = await searchViralCases({
      query: "Guangzhou coffee queue average spend",
      topic: "Guangzhou coffee",
      limit: 3
    });

    expect(results[0].case.title).toBe(sample.title);
    expect(results[0].case.sourceSampleId).toBe(sample.id);
    expect(results[0].case.extraction).toMatchObject({
      sourceSampleId: sample.id,
      method: "heuristic"
    });
    expect(results[0].case.bodyExcerpt.length).toBeLessThanOrEqual(240);
    expect(results[0].case.extractedInsights.reusableRules.length).toBeGreaterThan(0);
    expect(results[0].case.creativeSafety?.summary).toContain("只能作为创作规律来源");
    expect(results[0].case.creativeSafety?.doNotCopy.join(" ")).toContain("不要复制");
    expect(results[0].case.creativeSafety?.transformationGuidance.join(" ")).toContain("自己的");
    expect(results[0].score).toBeGreaterThan(0);
  });

  it("records model extraction provenance when AI extracts reusable viral patterns", async () => {
    const viralCase = await createViralCaseFromEvidence({
      sample,
      topic: "Guangzhou coffee",
      category: "Cafe review",
      model: {
        generateStructuredText: async () => JSON.stringify({
          titleHooks: ["Lead with a concrete save-worthy cafe scenario"],
          copyStructures: ["Queue time -> average spend -> photo spot -> weekend warning"],
          tagPatterns: ["topic tag + city tag + use-case tag"],
          visualPatterns: ["Natural light cover with clear cafe subject"],
          audienceSignals: ["weekend cafe reviewers"],
          painPoints: ["afraid of wasting time in crowded cafes"],
          emotionalTriggers: ["honest avoidance guidance"],
          commentConcerns: ["average spend", "weekend crowd"],
          reusableRules: ["Turn interaction questions into decision criteria"],
          avoidCopying: ["do not copy the original title or review wording"]
        }),
        analyzeImageStyle: async () => "",
        generateImage: async () => null,
        generateImageFromReference: async () => null
      }
    });

    expect(viralCase.extraction).toMatchObject({
      sourceSampleId: sample.id,
      method: "model"
    });
    expect(viralCase.extraction.extractedAt).toBeTruthy();
    expect(viralCase.extractedInsights.titleHooks).toEqual(["Lead with a concrete save-worthy cafe scenario"]);
    expect(viralCase.creativeSafety?.reusablePatterns.join(" ")).toContain("Turn interaction questions into decision criteria");
  });

  it("removes model-extracted source wording before storing reusable viral knowledge", async () => {
    const viralCase = await createViralCaseFromEvidence({
      sample,
      topic: "Guangzhou coffee",
      category: "Cafe review",
      model: {
        generateStructuredText: async () => JSON.stringify({
          titleHooks: [sample.title, "Lead with a concrete decision scenario"],
          copyStructures: [sample.detailText, "Open with user scenario -> compare decision details -> close with warning"],
          tagPatterns: ["city tag + scene tag + decision tag"],
          visualPatterns: ["Natural light cover with clear subject"],
          audienceSignals: ["weekend cafe reviewers"],
          painPoints: ["afraid of wasting time in crowded cafes"],
          emotionalTriggers: ["honest avoidance guidance"],
          commentConcerns: [sample.commentSnippets[0], "whether weekends are crowded"],
          reusableRules: [sample.detailText, "Convert comments into decision criteria"],
          avoidCopying: []
        }),
        analyzeImageStyle: async () => "",
        generateImage: async () => null,
        generateImageFromReference: async () => null
      }
    });

    const storedKnowledge = [
      ...viralCase.extractedInsights.titleHooks,
      ...viralCase.extractedInsights.copyStructures,
      ...viralCase.extractedInsights.commentConcerns,
      ...viralCase.extractedInsights.reusableRules
    ].join("\n");
    expect(storedKnowledge).not.toContain(sample.title);
    expect(storedKnowledge).not.toContain(sample.detailText);
    expect(storedKnowledge).not.toContain(sample.commentSnippets[0]);
    expect(viralCase.extractedInsights.titleHooks).toContain("Lead with a concrete decision scenario");
    expect(viralCase.extractedInsights.reusableRules.join(" ")).toContain("只保留创作方法");
    expect(viralCase.extractedInsights.avoidCopying.join(" ")).toContain("已从可学习规律中移除");
  });

  it("keeps a fallback reason when model extraction fails", async () => {
    const viralCase = await createViralCaseFromEvidence({
      sample,
      topic: "Guangzhou coffee",
      category: "Cafe review",
      model: {
        generateStructuredText: async () => {
          throw new Error("model unavailable");
        },
        analyzeImageStyle: async () => "",
        generateImage: async () => null,
        generateImageFromReference: async () => null
      }
    });

    expect(viralCase.extraction.method).toBe("heuristic");
    expect(viralCase.extraction.sourceSampleId).toBe(sample.id);
    expect(viralCase.extraction.fallbackReason).toBe("model unavailable");
    expect(viralCase.extractedInsights.reusableRules.length).toBeGreaterThan(0);
  });

  it("converts viral cases into source-tagged evidence insights", async () => {
    const viralCase = await createViralCaseFromEvidence({
      sample,
      topic: "Guangzhou coffee",
      category: "Cafe review"
    });
    const insights = viralCasesToEvidenceInsights([viralCase]);

    expect(insights.length).toBeGreaterThan(0);
    expect(insights.every((item) => item.sourceType === "viral_library")).toBe(true);
    expect(insights.map((item) => item.type)).toContain("hook");
    expect(insights.map((item) => item.type)).toContain("structure");
    expect(insights.map((item) => item.type)).toContain("copy");
    expect(insights.map((item) => item.type)).toContain("comment");
    expect(insights.find((item) => item.type === "comment")?.insight).toContain("评论关注点");
    expect(insights.find((item) => item.type === "comment")?.insight).toContain("决策信息");
    expect(insights.some((item) => item.insight.includes("近似复刻"))).toBe(true);
  });

  it("backfills creative safety for legacy viral cases", async () => {
    const viralCase = await createViralCaseFromEvidence({
      sample,
      topic: "Guangzhou coffee",
      category: "Cafe review"
    });
    await upsertViralCases([{
      ...viralCase,
      id: "legacy-viral-case",
      creativeSafety: undefined
    }]);

    const [stored] = await listViralCases();

    expect(stored.id).toBe("legacy-viral-case");
    expect(stored.creativeSafety?.summary).toContain("只能作为创作规律来源");
    expect(stored.creativeSafety?.reusablePatterns.length).toBeGreaterThan(0);
    expect(stored.creativeSafety?.doNotCopy.join(" ")).toContain("不要复制");
  });

  it("keeps viral evidence insight ids stable for the same reusable pattern", async () => {
    const viralCase = await createViralCaseFromEvidence({
      sample,
      topic: "Guangzhou coffee",
      category: "Cafe review"
    });
    const first = viralCasesToEvidenceInsights([viralCase]).map((insight) => insight.id);
    const second = viralCasesToEvidenceInsights([viralCase]).map((insight) => insight.id);

    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual(first);
    expect(first.every((id) => id.startsWith("viral-insight-"))).toBe(true);
  });

  it("replaces existing viral cases from the same source sample instead of duplicating them", async () => {
    const first = await createViralCaseFromEvidence({
      sample,
      topic: "Guangzhou coffee",
      category: "Cafe review"
    });
    const second = await createViralCaseFromEvidence({
      sample: {
        ...sample,
        title: "Guangzhou coffee updated learning sample",
        likes: 1800,
        collects: 1300
      },
      topic: "Guangzhou coffee",
      category: "Cafe review"
    });

    await upsertViralCases([first]);
    await upsertViralCases([second]);
    const stored = await listViralCases();

    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(second.id);
    expect(stored[0].sourceSampleId).toBe(sample.id);
    expect(stored[0].title).toBe("Guangzhou coffee updated learning sample");
  });

  it("uses multi-query fusion and preserves matched query reasons", async () => {
    const viralCase = await createViralCaseFromEvidence({
      sample,
      topic: "Guangzhou coffee",
      category: "Cafe review"
    });
    await upsertViralCases([viralCase]);

    const results = await searchViralCasesFusion({
      query: "honest cafe review with saveable details",
      topic: "Guangzhou coffee",
      category: "Cafe review",
      limit: 5
    });

    expect(results[0].case.id).toBe(viralCase.id);
    expect(results[0].matchedQueries?.length).toBeGreaterThan(0);
    expect(results[0].reasons.join(" ")).toContain("query");
    expect(results[0].diversityKey).toContain("cafe review");
    expect(results[0].angleSummary).toContain("Cafe review");
  });

  it("diversifies fused retrieval so one creative angle does not fill the first results", async () => {
    const baseCase = await createViralCaseFromEvidence({
      sample,
      topic: "Guangzhou coffee",
      category: "Cafe review"
    });
    const sameAngle = [1, 2, 3].map((index) => ({
      ...baseCase,
      id: `same-angle-${index}`,
      sourceSampleId: `same-note-${index}`,
      sourceUrl: `https://www.xiaohongshu.com/explore/same-${index}`,
      title: `Guangzhou coffee saveable guide ${index}`,
      hookType: "scenario hook",
      category: "Cafe review",
      imageStyle: "warm table flatlay",
      metrics: { ...baseCase.metrics, score: 5000 - index, likes: 3000 - index }
    }));
    const differentAngle = {
      ...baseCase,
      id: "different-angle",
      sourceSampleId: "different-note",
      sourceUrl: "https://www.xiaohongshu.com/explore/different",
      title: "Guangzhou coffee quiet work map",
      hookType: "map checklist",
      category: "Work cafe",
      imageStyle: "wide interior scene",
      metrics: { ...baseCase.metrics, score: 900, likes: 800 }
    };
    await upsertViralCases([...sameAngle, differentAngle]);

    const results = await searchViralCasesFusion({
      query: "Guangzhou coffee saveable guide",
      topic: "Guangzhou coffee",
      limit: 3
    });

    expect(results).toHaveLength(3);
    expect(results.map((item) => item.case.id)).toContain("different-angle");
    expect(results.filter((item) => item.case.hookType === "scenario hook")).toHaveLength(2);
    expect(new Set(results.map((item) => item.diversityKey)).size).toBeGreaterThan(1);
    expect(results.find((item) => item.case.id === "different-angle")?.angleSummary).toContain("Work cafe");
  });

  it("filters by audience, pain point, created time, and interaction metrics", async () => {
    const viralCase = await createViralCaseFromEvidence({
      sample,
      topic: "Guangzhou coffee",
      category: "Cafe review"
    });
    const enriched = {
      ...viralCase,
      audience: "weekend cafe reviewers",
      painPoint: "afraid of wasting time in crowded cafes",
      createdAt: "2026-05-20T12:00:00.000Z"
    };
    await upsertViralCases([enriched]);

    const matched = await searchViralCases({
      query: "coffee average spend",
      audience: "cafe reviewers",
      painPoint: "crowded cafes",
      createdAfter: "2026-05-01T00:00:00.000Z",
      createdBefore: "2026-06-01T00:00:00.000Z",
      minLikes: 1000,
      minCollects: 900,
      minComments: 50
    });
    const blocked = await searchViralCases({
      query: "coffee average spend",
      audience: "cafe reviewers",
      minCollects: 3000
    });

    expect(matched[0].case.id).toBe(enriched.id);
    expect(blocked).toEqual([]);
  });

  it("retrieves cases through structured comment concerns and reusable insight fields", async () => {
    const commentDrivenCase = await createViralCaseFromEvidence({
      sample: {
        ...sample,
        id: "note-comment-driven",
        title: "Hidden cafe route",
        detailText: "A short route note focused on location and opening hours.",
        commentSnippets: []
      },
      topic: "Guangzhou coffee",
      category: "Cafe review",
      model: {
        generateStructuredText: async () => JSON.stringify({
          titleHooks: ["lead with an unusual decision question"],
          copyStructures: ["question -> constraints -> recommendation"],
          tagPatterns: ["city + need state + decision tag"],
          visualPatterns: ["map cover with one clear route"],
          audienceSignals: ["people planning pet-friendly weekend trips"],
          painPoints: ["uncertain about parking and pet access"],
          emotionalTriggers: ["reduce trip uncertainty"],
          commentConcerns: ["parking available", "pet friendly terrace"],
          reusableRules: ["turn comment concerns into FAQ-style decision blocks"],
          avoidCopying: ["do not copy exact cafe route"]
        }),
        analyzeImageStyle: async () => "",
        generateImage: async () => null,
        generateImageFromReference: async () => null
      }
    });
    await upsertViralCases([commentDrivenCase]);

    const results = await searchViralCases({
      query: "pet friendly terrace parking FAQ decision",
      topic: "Guangzhou coffee",
      limit: 3
    });

    expect(results[0].case.id).toBe(commentDrivenCase.id);
    expect(results[0].reasons.join(" ")).toContain("命中关键词");
    expect(results[0].case.extractedInsights.commentConcerns).toContain("pet friendly terrace");
  });

  it("filters and sorts by shares, score, tags, and created time", async () => {
    const coffeeCase = await createViralCaseFromEvidence({
      sample,
      topic: "Guangzhou coffee",
      category: "Cafe review"
    });
    const bagCase = await createViralCaseFromEvidence({
      sample: {
        ...sample,
        id: "note-bag",
        title: "Commuter bag real review",
        likes: 400,
        collects: 320,
        comments: 18,
        shares: 6,
        score: 520,
        url: "https://www.xiaohongshu.com/explore/note-bag"
      },
      topic: "Commuter bag",
      category: "Product review"
    });
    await upsertViralCases([
      {
        ...coffeeCase,
        id: "viral-coffee",
        tags: ["coffee", "cafe", "photo"],
        createdAt: "2026-05-20T00:00:00.000Z",
        metrics: { ...coffeeCase.metrics, shares: 55, score: 3300 }
      },
      {
        ...bagCase,
        id: "viral-bag",
        tags: ["bag", "review"],
        createdAt: "2026-05-25T00:00:00.000Z",
        metrics: { ...bagCase.metrics, shares: 8, score: 600 }
      }
    ]);

    const filtered = await searchViralCases({
      query: "coffee photo",
      tags: ["photo"],
      minShares: 20,
      minScore: 3000,
      createdAfter: "2026-05-01T00:00:00.000Z"
    });
    const sortedByScore = await listViralCases({ sortBy: "score", sortOrder: "desc" });
    const sortedByCreated = await listViralCases({ sortBy: "createdAt", sortOrder: "asc" });

    expect(filtered.map((item) => item.case.id)).toEqual(["viral-coffee"]);
    expect(sortedByScore.map((item) => item.id)).toEqual(["viral-coffee", "viral-bag"]);
    expect(sortedByCreated.map((item) => item.id)).toEqual(["viral-coffee", "viral-bag"]);
  });

  it("returns filter metadata from the viral knowledge API", async () => {
    const viralCase = await createViralCaseFromEvidence({
      sample,
      topic: "Guangzhou coffee",
      category: "Cafe review"
    });
    await upsertViralCases([{
      ...viralCase,
      tags: ["coffee", "cafe"],
      metrics: { ...viralCase.metrics, shares: 30, score: 3000 }
    }]);

    const response = await GET(new Request("http://localhost/api/viral-knowledge?q=coffee&topic=Guangzhou%20coffee&minShares=20&sortBy=score&sortOrder=desc&tag=cafe"));
    const payload = await response.json() as {
      filterSummary: string;
      filters: { minShares?: number; sortBy?: string; tags?: string[] };
      results: unknown[];
    };

    expect(payload.results.length).toBeGreaterThan(0);
    expect(payload.filters).toMatchObject({ minShares: 20, sortBy: "score", tags: ["cafe"] });
    expect(payload.filterSummary).toContain("20");
    expect(payload.filterSummary).toContain("排序");
  });

  it("returns added evidence and readiness metadata when saving through the API", async () => {
    const token = await getLocalActionToken();
    const response = await POST(new Request("http://localhost/api/viral-knowledge", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [ACTION_TOKEN_HEADER]: token
      },
      body: JSON.stringify({
        sample,
        topic: "Guangzhou coffee",
        category: "Cafe review",
        useModel: false
      })
    }));
    const payload = await response.json() as {
      case: { id: string };
      project: { evidencePack: { sampleIds: string[] } };
      readiness: { progress: number; blockers: unknown[] };
      addedInsightIds: string[];
      addedInsights: Array<{ sourceType?: string }>;
      addedSampleIds: string[];
    };

    expect(response.status).toBe(200);
    expect(payload.project.evidencePack.sampleIds).toContain(payload.case.id);
    expect(payload.addedSampleIds).toEqual([payload.case.id]);
    expect(payload.addedInsightIds.length).toBeGreaterThan(0);
    expect(payload.addedInsights.every((insight) => insight.sourceType === "viral_library")).toBe(true);
    expect(payload.readiness.progress).toBeGreaterThan(0);
    expect(Array.isArray(payload.readiness.blockers)).toBe(true);
  });

  it("reviews research sample quality before saving to the viral knowledge API", async () => {
    const review = reviewViralSaveCandidate(sample);

    expect(review.shouldSave).toBe(true);
    expect(review.score).toBeGreaterThanOrEqual(45);
    expect(review.reasons.length).toBeGreaterThan(0);
  });

  it("rejects weak research samples unless explicitly forced", async () => {
    const token = await getLocalActionToken();
    const weakSample: SampleEvidence = {
      id: "weak-note",
      title: "Short note",
      author: "author",
      likes: 0,
      collects: 0,
      comments: 0,
      shares: 0,
      score: 0,
      url: "",
      imageUrls: [],
      cachedImageUrls: [],
      detailText: "",
      commentSnippets: [],
      reasonHighlights: []
    };

    const rejected = await POST(new Request("http://localhost/api/viral-knowledge", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [ACTION_TOKEN_HEADER]: token
      },
      body: JSON.stringify({
        sample: weakSample,
        topic: "Weak topic",
        category: "Cafe review",
        useModel: false
      })
    }));
    const rejectedPayload = await rejected.json() as {
      error: string;
      candidateReviews: Array<{ sampleId: string; shouldSave: boolean; warnings: string[] }>;
      skippedSampleIds: string[];
    };

    expect(rejected.status).toBe(422);
    expect(rejectedPayload.candidateReviews[0]).toMatchObject({ sampleId: "weak-note", shouldSave: false });
    expect(rejectedPayload.candidateReviews[0].warnings.length).toBeGreaterThan(0);
    expect(rejectedPayload.skippedSampleIds).toEqual(["weak-note"]);
    await expect(listViralCases()).resolves.toHaveLength(0);

    const forced = await POST(new Request("http://localhost/api/viral-knowledge", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [ACTION_TOKEN_HEADER]: token
      },
      body: JSON.stringify({
        sample: weakSample,
        topic: "Weak topic",
        category: "Cafe review",
        useModel: false,
        force: true
      })
    }));
    const forcedPayload = await forced.json() as {
      cases: Array<{ sourceSampleId: string }>;
      candidateReviews: Array<{ sampleId: string; shouldSave: boolean }>;
      skippedSampleIds: string[];
    };

    expect(forced.status).toBe(200);
    expect(forcedPayload.cases).toHaveLength(1);
    expect(forcedPayload.cases[0].sourceSampleId).toBe("weak-note");
    expect(forcedPayload.candidateReviews[0].shouldSave).toBe(false);
    expect(forcedPayload.skippedSampleIds).toEqual([]);
  });

  it("saves multiple research samples through the API and attaches deduped evidence", async () => {
    const token = await getLocalActionToken();
    const response = await POST(new Request("http://localhost/api/viral-knowledge", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [ACTION_TOKEN_HEADER]: token
      },
      body: JSON.stringify({
        samples: [
          sample,
          {
            ...sample,
            id: "note-2",
            title: "Quiet cafe work guide",
            url: "https://www.xiaohongshu.com/explore/note-2",
            likes: 880,
            collects: 760,
            comments: 40,
            shares: 18,
            score: 1180
          }
        ],
        topic: "Guangzhou coffee",
        category: "Cafe review",
        useModel: false
      })
    }));
    const payload = await response.json() as {
      cases: Array<{ id: string; sourceSampleId: string }>;
      project: { evidencePack: { sampleIds: string[] } };
      addedInsightIds: string[];
      addedSampleIds: string[];
    };

    expect(response.status).toBe(200);
    expect(payload.cases).toHaveLength(2);
    expect(payload.cases.map((item) => item.sourceSampleId)).toEqual(["note-1", "note-2"]);
    expect(payload.addedSampleIds).toHaveLength(2);
    expect(payload.project.evidencePack.sampleIds).toEqual(expect.arrayContaining(payload.cases.map((item) => item.id)));
    expect(payload.addedInsightIds.length).toBeGreaterThan(2);
  });
});
