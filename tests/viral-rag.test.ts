import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { retrieveViralKnowledge, rewriteRetrievalQueries, evaluateRagSufficiency } from "@/lib/rag/viral";
import { createViralKnowledgePackRetriever, createViralKnowledgeRetriever } from "@/lib/rag/retrievers";
import { createViralCaseFromEvidence, evaluateViralKnowledgeQuality, upsertViralCases } from "@/lib/viral-knowledge/store";
import type { SampleEvidence } from "@/lib/workflows/one-click";

let originalCwd: string;
let tempDir: string;

const sample: SampleEvidence = {
  id: "note-viral-rag",
  title: "广州咖啡馆高收藏拍照攻略",
  author: "author",
  likes: 1800,
  collects: 2100,
  comments: 120,
  shares: 41,
  score: 3200,
  url: "https://www.xiaohongshu.com/explore/note-viral-rag",
  imageUrls: ["https://example.com/coffee.jpg"],
  cachedImageUrls: [],
  detailText: "先给适合拍照的座位，再写人均和光线，最后提醒周末排队和适合人群。",
  commentSnippets: ["想知道哪张桌子出片", "人均多少"],
  reasonHighlights: []
};

beforeEach(async () => {
  originalCwd = process.cwd();
  tempDir = await mkdtemp(path.join(os.tmpdir(), "xhs-rag-"));
  process.chdir(tempDir);
  await mkdir("data", { recursive: true });
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe("viral RAG retrieval", () => {
  it("rewrites a user need into diverse retrieval queries", () => {
    const queries = rewriteRetrievalQueries({
      query: "广州咖啡馆 探店账号",
      topic: "广州咖啡馆",
      category: "探店",
      audience: "周末约会人群",
      painPoint: "怕踩雷"
    });

    expect(queries.length).toBeGreaterThanOrEqual(4);
    expect(queries.join(" ")).toContain("标题钩子");
    expect(queries.join(" ")).toContain("图片风格");
  });

  it("returns viral_library insights with sufficiency metadata", async () => {
    const viralCase = await createViralCaseFromEvidence({
      sample,
      topic: "广州咖啡馆",
      category: "探店"
    });
    await upsertViralCases([viralCase]);

    const pack = await retrieveViralKnowledge({
      query: "广州咖啡馆 高收藏 探店",
      topic: "广州咖啡馆",
      category: "探店",
      minCollects: 1000,
      minShares: 20,
      sortBy: "collects",
      sortOrder: "desc",
      limit: 5,
      realtimeEvidenceCount: 4
    });

    expect(pack.rewrittenQueries.length).toBeGreaterThan(1);
    expect(pack.results[0].case.id).toBe(viralCase.id);
    expect(pack.results[0].case.quality?.score).toBeGreaterThan(0.5);
    expect(pack.filters).toMatchObject({ minCollects: 1000, minShares: 20, sortBy: "collects" });
    expect(pack.filterSummary).toContain("收藏 ≥ 1000");
    expect(pack.filterSummary).toContain("分享 ≥ 20");
    expect(pack.filterSummary).toContain("按收藏降序排序");
    expect(pack.insights.every((item) => item.sourceType === "viral_library")).toBe(true);
    expect(pack.insights.map((item) => item.type)).toContain("comment");
    expect(pack.strategyReport.audiencePainPoints.join(" ")).toContain("评论关注点");
    expect(pack.sufficiency.realtimeCount).toBe(4);
    expect(pack.sufficiency.viralCount).toBe(1);
    const trace = pack.evidenceTrace ?? [];
    expect(trace[0]).toMatchObject({
      caseId: viralCase.id,
      sourceSampleId: sample.id,
      sourceUrl: viralCase.sourceUrl
    });
    expect(trace[0].score).toBeGreaterThan(0);
    expect(trace[0].matchedQueries.length).toBeGreaterThan(0);
    expect(trace[0].reasons.length).toBeGreaterThan(0);
    expect(trace[0].evidenceInsightIds.length).toBeGreaterThan(0);
    expect(trace[0].evidenceInsightIds.every((id) => id.startsWith("viral-insight-"))).toBe(true);
  });

  it("scores structured viral knowledge quality for safer RAG reuse", async () => {
    const viralCase = await createViralCaseFromEvidence({
      sample,
      topic: "广州咖啡馆",
      category: "探店"
    });

    expect(viralCase.quality?.structuredFieldCount).toBeGreaterThanOrEqual(5);
    expect(viralCase.quality?.safetyRuleCount).toBeGreaterThanOrEqual(3);
    expect(viralCase.quality?.warnings.join(" ")).toContain("启发式提取");

    const weakQuality = evaluateViralKnowledgeQuality({
      extractionMethod: "model",
      extractedInsights: {
        titleHooks: [],
        copyStructures: [],
        tagPatterns: [],
        visualPatterns: [],
        audienceSignals: [],
        painPoints: [],
        emotionalTriggers: [],
        commentConcerns: [],
        reusableRules: [],
        avoidCopying: []
      }
    });

    expect(weakQuality.score).toBeLessThan(0.2);
    expect(weakQuality.warnings.join(" ")).toContain("可复用规则不足");
    expect(weakQuality.warnings.join(" ")).toContain("防复制约束不足");
  });

  it("marks evidence insufficient when key dimensions are missing", () => {
    const sufficiency = evaluateRagSufficiency({
      realtimeCount: 1,
      viralCount: 0,
      hasVisual: false,
      hasHook: false,
      hasStructure: false
    });

    expect(sufficiency.isEnough).toBe(false);
    expect(sufficiency.missing.join(" ")).toContain("实时小红书样本不足");
    expect(sufficiency.recommendation).toContain("建议继续搜索");
  });

  it("exposes viral knowledge as replaceable retriever adapters", async () => {
    const viralCase = await createViralCaseFromEvidence({
      sample,
      topic: "广州咖啡馆",
      category: "探店"
    });
    await upsertViralCases([viralCase]);

    const caseRetriever = createViralKnowledgeRetriever();
    const caseResults = await caseRetriever.retrieve({
      query: "广州咖啡馆 拍照攻略",
      topic: "广州咖啡馆",
      limit: 3
    });

    const packRetriever = createViralKnowledgePackRetriever();
    const [pack] = await packRetriever.retrieve({
      query: "广州咖啡馆 拍照攻略",
      topic: "广州咖啡馆",
      minCollects: 1000,
      limit: 3,
      realtimeEvidenceCount: 2
    });

    expect(caseResults[0].case.id).toBe(viralCase.id);
    expect(pack.results[0].case.id).toBe(viralCase.id);
    expect(pack.filterSummary).toContain("收藏 ≥ 1000");
    expect(pack.insights.every((item) => item.sourceType === "viral_library")).toBe(true);
  });
});
