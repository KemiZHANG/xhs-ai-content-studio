import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { retrieveViralKnowledge, rewriteRetrievalQueries, evaluateRagSufficiency } from "@/lib/rag/viral";
import { createViralCaseFromEvidence, upsertViralCases } from "@/lib/viral-knowledge/store";
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
    expect(pack.filters).toMatchObject({ minCollects: 1000, minShares: 20, sortBy: "collects" });
    expect(pack.filterSummary).toContain("收藏 ≥ 1000");
    expect(pack.filterSummary).toContain("分享 ≥ 20");
    expect(pack.filterSummary).toContain("按收藏降序排序");
    expect(pack.insights.every((item) => item.sourceType === "viral_library")).toBe(true);
    expect(pack.sufficiency.realtimeCount).toBe(4);
    expect(pack.sufficiency.viralCount).toBe(1);
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
});
